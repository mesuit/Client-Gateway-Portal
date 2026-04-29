import { Router } from "express";
import { db } from "@workspace/db";
import { paymentLinksTable, transactionsTable, settlementAccountsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { initiateSTKPush, getCallbackBaseUrl } from "../lib/mpesa";
import { logger } from "../lib/logger";

const SANDBOX_LIMIT = 2;

const router = Router();

// Public status endpoint — MUST be before /pay/:slug to avoid route shadowing
router.get("/pay/status/:checkoutRequestId", async (req, res) => {
  const { checkoutRequestId } = req.params;

  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.removeHeader("ETag");

  const txs = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.checkoutRequestId, checkoutRequestId));

  if (txs.length === 0) {
    res.status(404).json({ error: "NOT_FOUND", message: "Transaction not found" });
    return;
  }

  const tx = txs[0];
  res.json({
    status: tx.status,
    mpesaReceiptNumber: tx.mpesaReceiptNumber,
    amount: tx.amount,
    phoneNumber: tx.phoneNumber,
    updatedAt: tx.updatedAt,
  });
});

router.get("/pay/:slug", async (req, res) => {
  const { slug } = req.params;

  const links = await db
    .select()
    .from(paymentLinksTable)
    .where(eq(paymentLinksTable.slug, slug));

  if (links.length === 0 || !links[0].isActive) {
    res.status(404).json({ error: "NOT_FOUND", message: "Payment link not found or inactive" });
    return;
  }

  const link = links[0];

  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    res.status(410).json({ error: "EXPIRED", message: "This payment link has expired" });
    return;
  }

  res.json({
    id: link.id,
    slug: link.slug,
    title: link.title,
    description: link.description,
    amount: link.amount,
    accountReference: link.accountReference,
    transactionDesc: link.transactionDesc,
  });
});

router.post("/pay/:slug", async (req, res) => {
  const { slug } = req.params;
  const { phoneNumber, amount: customAmount } = req.body;

  if (!phoneNumber) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "phoneNumber is required" });
    return;
  }

  const links = await db
    .select()
    .from(paymentLinksTable)
    .where(eq(paymentLinksTable.slug, slug));

  if (links.length === 0 || !links[0].isActive) {
    res.status(404).json({ error: "NOT_FOUND", message: "Payment link not found or inactive" });
    return;
  }

  const link = links[0];

  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    res.status(410).json({ error: "EXPIRED", message: "This payment link has expired" });
    return;
  }

  const finalAmount = link.amount ? Number(link.amount) : Number(customAmount);

  if (!finalAmount || finalAmount < 1) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Valid amount is required" });
    return;
  }

  // Check merchant sandbox/subscription status
  const [merchant] = await db.select().from(usersTable).where(eq(usersTable.id, link.userId));
  if (!merchant) {
    res.status(404).json({ error: "MERCHANT_NOT_FOUND", message: "Merchant account not found" });
    return;
  }

  const now = new Date();
  let effectiveMode = merchant.mode;
  if (merchant.mode === "active" && merchant.subscriptionExpiresAt && new Date(merchant.subscriptionExpiresAt) < now) {
    effectiveMode = "sandbox";
    await db.update(usersTable).set({ mode: "sandbox", subscriptionType: null }).where(eq(usersTable.id, link.userId));
  }

  if (effectiveMode === "sandbox") {
    if (merchant.sandboxTransactionsUsed >= SANDBOX_LIMIT) {
      res.status(403).json({
        error: "MERCHANT_NOT_ACTIVATED",
        message: "This merchant has not activated their account. Payments are currently unavailable.",
      });
      return;
    }
  }

  // Look up merchant's default settlement account
  let settlementAccountId: number | null = null;
  let merchantTill: string | undefined = undefined;
  let merchantPaybill: string | undefined = undefined;
  let effectiveAccountReference = link.accountReference;

  const defaults = await db
    .select()
    .from(settlementAccountsTable)
    .where(and(
      eq(settlementAccountsTable.userId, link.userId),
      eq(settlementAccountsTable.isDefault, true),
      eq(settlementAccountsTable.isActive, true)
    ));

  if (defaults.length > 0) {
    const settlement = defaults[0];
    settlementAccountId = settlement.id;

    if (settlement.accountType === "till") {
      // CustomerBuyGoodsOnline — money goes directly to merchant's till
      merchantTill = settlement.accountNumber;
    } else if (settlement.accountType === "paybill") {
      // CustomerPayBillOnline — PartyB = merchant's paybill business number
      // Falls back to accountNumber if businessNumber wasn't set
      merchantPaybill = settlement.businessNumber || settlement.accountNumber || undefined;
      // Use merchant's paybill account number as the AccountReference
      if (settlement.businessNumber && settlement.accountNumber) {
        effectiveAccountReference = settlement.accountNumber;
      }
    }
  }

  const callbackUrl = `${getCallbackBaseUrl(req)}/api/payments/callback`;

  try {
    const result = await initiateSTKPush({
      phoneNumber,
      amount: finalAmount,
      accountReference: effectiveAccountReference,
      transactionDesc: link.transactionDesc,
      callbackUrl,
      merchantTill,
      merchantPaybill,
    });

    const [tx] = await db.insert(transactionsTable).values({
      userId: link.userId,
      settlementAccountId,
      checkoutRequestId: result.CheckoutRequestID,
      merchantRequestId: result.MerchantRequestID,
      phoneNumber,
      amount: String(finalAmount),
      status: "pending",
      accountReference: link.accountReference,
      transactionDesc: link.transactionDesc,
    }).returning();

    // Increment sandbox usage counter if in sandbox mode
    if (effectiveMode === "sandbox") {
      await db.update(usersTable)
        .set({ sandboxTransactionsUsed: merchant.sandboxTransactionsUsed + 1 })
        .where(eq(usersTable.id, link.userId));
    }

    res.json({
      checkoutRequestId: result.CheckoutRequestID,
      merchantRequestId: result.MerchantRequestID,
      responseCode: result.ResponseCode,
      customerMessage: result.CustomerMessage,
      transactionId: tx.id,
    });
  } catch (err) {
    logger.error(err, "STK Push via payment link failed");
    res.status(502).json({ error: "MPESA_ERROR", message: err instanceof Error ? err.message : "STK Push failed" });
  }
});

export default router;
