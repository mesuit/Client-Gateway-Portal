import { Router } from "express";
import { db } from "@workspace/db";
import { pesapalTransactionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireApiKey, type ApiKeyRequest } from "../lib/apiKeyAuth";
import { requireAuth, type AuthRequest } from "../lib/auth";
import {
  getOrRegisterIPN,
  submitOrder,
  getTransactionStatus,
  calculateFees,
} from "../lib/pesapal";
import { getCallbackBaseUrl } from "../lib/mpesa";
import { logger } from "../lib/logger";
import crypto from "crypto";

const router = Router();

/** Normalise PesaPal payment_status_description to our internal status */
function resolveStatus(raw: string | undefined | null): "completed" | "failed" | "cancelled" | null {
  const desc = (raw ?? "").toLowerCase().trim();
  if (desc === "completed") return "completed";
  if (desc === "cancelled") return "cancelled";
  if (["failed", "invalid", "reversed"].includes(desc)) return "failed";
  return null; // still pending / unknown
}

// POST /payments/pesapal/initiate — merchant-facing (API key auth)
// Initiates a PesaPal payment (card, Airtel Money, etc.)
router.post("/payments/pesapal/initiate", requireApiKey, async (req: ApiKeyRequest, res) => {
  const userId = req.apiKeyUserId!;
  const { amount, currency, description, phone, email, callbackUrl, cancellationUrl } = req.body;

  if (!amount || !description) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "amount and description are required" });
    return;
  }
  if (Number(amount) < 10) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Minimum amount is KES 10" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(403).json({ error: "USER_NOT_FOUND", message: "Account not found" });
    return;
  }
  if (user.mode === "sandbox") {
    res.status(403).json({
      error: "ACTIVATION_REQUIRED",
      message: "Activate your account to use card/Airtel payments",
      activationRequired: true,
    });
    return;
  }

  const baseUrl = getCallbackBaseUrl(req);
  const ipnUrl = `${baseUrl}/api/pesapal/ipn`;
  const merchantRef = `NEXUS-${userId}-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

  try {
    const ipnId = await getOrRegisterIPN(ipnUrl);
    const order = await submitOrder({
      merchantRef,
      amount: Number(amount),
      currency: currency ?? "KES",
      description: String(description).slice(0, 100),
      callbackUrl: callbackUrl ?? `${baseUrl}/api/pesapal/callback`,
      cancellationUrl: cancellationUrl ?? `${baseUrl}/api/pesapal/callback`,
      ipnId,
      phone: phone ?? "",
      email: email ?? "",
    });

    const gross = Number(amount);
    const { netAmount, platformFee } = calculateFees(gross);

    const [tx] = await db.insert(pesapalTransactionsTable).values({
      userId,
      orderTrackingId: order.order_tracking_id,
      orderMerchantRef: merchantRef,
      amount: String(gross),
      netAmount: String(netAmount),
      platformFee: String(platformFee),
      currency: currency ?? "KES",
      status: "pending",
      phoneNumber: phone ?? null,
      customerEmail: email ?? null,
      description: String(description).slice(0, 255),
    }).returning();

    res.status(201).json({
      orderTrackingId: order.order_tracking_id,
      merchantReference: merchantRef,
      redirectUrl: order.redirect_url,
      amount: gross,
      netAmount,
      platformFee,
      currency: currency ?? "KES",
      transactionId: tx.id,
    });
  } catch (err) {
    logger.error(err, "PesaPal initiate failed");
    res.status(502).json({ error: "PESAPAL_ERROR", message: err instanceof Error ? err.message : "Payment initiation failed" });
  }
});

// GET /pesapal/ipn — PesaPal IPN notification (public, no auth)
router.get("/pesapal/ipn", async (req, res) => {
  const { orderTrackingId, orderMerchantReference } = req.query as Record<string, string>;

  if (!orderTrackingId) {
    res.status(400).json({ orderNotificationType: "IPNCHANGE", orderTrackingId: "", orderMerchantReference: "", status: "400" });
    return;
  }

  try {
    const statusResult = await getTransactionStatus(orderTrackingId);
    logger.info({ orderTrackingId, statusResult }, "PesaPal IPN received");

    const newStatus = resolveStatus(statusResult.payment_status_description);

    if (newStatus) {
      await db
        .update(pesapalTransactionsTable)
        .set({
          orderTrackingId,
          status: newStatus,
          paymentMethod: statusResult.payment_method ?? null,
          statusCode: String(statusResult.status_code ?? ""),
          statusDescription: statusResult.payment_status_description ?? null,
          callbackMetadata: JSON.stringify(statusResult),
        })
        .where(eq(pesapalTransactionsTable.orderMerchantRef, orderMerchantReference ?? ""));
    }
  } catch (err) {
    logger.error(err, "PesaPal IPN processing error");
  }

  res.json({ orderNotificationType: "IPNCHANGE", orderTrackingId, orderMerchantReference, status: "200" });
});

// GET /pesapal/callback — customer browser redirect after payment (public)
router.get("/pesapal/callback", async (req, res) => {
  const { OrderTrackingId, OrderMerchantReference } = req.query as Record<string, string>;

  let finalStatus = "pending";

  if (OrderTrackingId) {
    try {
      const statusResult = await getTransactionStatus(OrderTrackingId);
      const newStatus = resolveStatus(statusResult.payment_status_description);

      if (newStatus) {
        finalStatus = newStatus;
        await db
          .update(pesapalTransactionsTable)
          .set({
            status: newStatus,
            paymentMethod: statusResult.payment_method ?? null,
            statusCode: String(statusResult.status_code ?? ""),
            statusDescription: statusResult.payment_status_description ?? null,
            callbackMetadata: JSON.stringify(statusResult),
          })
          .where(eq(pesapalTransactionsTable.orderMerchantRef, OrderMerchantReference ?? ""));
      }
    } catch (err) {
      logger.error(err, "PesaPal callback status update error");
    }
  }

  const baseUrl = process.env.CALLBACK_BASE_URL ?? "https://pay.makamesco-tech.co.ke";
  const returnPage = OrderMerchantReference?.startsWith("NEXUS-") ? "/card-test" : "/card";
  res.redirect(`${baseUrl}${returnPage}?status=${finalStatus}&tracking=${encodeURIComponent(OrderTrackingId ?? "")}&ref=${encodeURIComponent(OrderMerchantReference ?? "")}`);
});

// GET /payments/pesapal/status/:orderTrackingId — check status (API key auth)
// When status is still "pending" the endpoint checks PesaPal directly for a fresh result,
// so this always returns the most up-to-date status without waiting for an IPN.
router.get("/payments/pesapal/status/:orderTrackingId", requireApiKey, async (req: ApiKeyRequest, res) => {
  const { orderTrackingId } = req.params;
  const txs = await db
    .select()
    .from(pesapalTransactionsTable)
    .where(eq(pesapalTransactionsTable.orderTrackingId, orderTrackingId));

  if (txs.length === 0) {
    res.status(404).json({ error: "NOT_FOUND", message: "Transaction not found" });
    return;
  }
  let tx = txs[0];
  if (tx.userId !== req.apiKeyUserId) {
    res.status(403).json({ error: "FORBIDDEN" });
    return;
  }

  // If still pending, call PesaPal directly for the freshest status
  if (tx.status === "pending") {
    try {
      const fresh = await getTransactionStatus(orderTrackingId);
      const newStatus = resolveStatus(fresh.payment_status_description);

      if (newStatus) {
        const [updated] = await db
          .update(pesapalTransactionsTable)
          .set({
            status: newStatus,
            paymentMethod: fresh.payment_method ?? null,
            statusCode: String(fresh.status_code ?? ""),
            statusDescription: fresh.payment_status_description ?? null,
            callbackMetadata: JSON.stringify(fresh),
          })
          .where(eq(pesapalTransactionsTable.id, tx.id))
          .returning();
        if (updated) tx = updated;
      }
    } catch (err) {
      logger.warn({ err }, "PesaPal live status check failed, returning cached status");
    }
  }

  res.json({
    orderTrackingId: tx.orderTrackingId,
    merchantReference: tx.orderMerchantRef,
    status: tx.status,
    statusDescription: tx.statusDescription,
    amount: tx.amount,
    netAmount: tx.netAmount,
    platformFee: tx.platformFee,
    paymentMethod: tx.paymentMethod,
    currency: tx.currency,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
  });
});

// GET /wallet/pesapal-transactions — list merchant's PesaPal transactions (session auth)
router.get("/wallet/pesapal-transactions", requireAuth, async (req: AuthRequest, res) => {
  const txs = await db
    .select()
    .from(pesapalTransactionsTable)
    .where(eq(pesapalTransactionsTable.userId, req.userId!))
    .orderBy(pesapalTransactionsTable.createdAt);
  res.json(txs);
});

export default router;
