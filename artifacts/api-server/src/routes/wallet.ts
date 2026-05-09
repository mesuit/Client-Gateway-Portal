import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable, withdrawalRequestsTable, pesapalTransactionsTable } from "@workspace/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { isB2CConfigured, initiateB2C, getCallbackBaseUrl } from "../lib/mpesa";
import { logger } from "../lib/logger";

const router = Router();

async function getAvailableBalance(userId: number): Promise<{ available: number; mpesaCollected: number; pesapalCollected: number; totalWithdrawn: number }> {
  // M-Pesa: completed transactions with no settlement account (collected by platform)
  const [mpesa] = await db
    .select({
      balance: sql<string>`COALESCE(SUM(CASE WHEN ${transactionsTable.status} = 'completed' THEN ${transactionsTable.amount}::numeric ELSE 0 END), 0)::text`,
    })
    .from(transactionsTable)
    .where(and(
      eq(transactionsTable.userId, userId),
      isNull(transactionsTable.settlementAccountId)
    ));

  // PesaPal: net amounts from completed card/Airtel payments (after 10% fee)
  const [pesapal] = await db
    .select({
      balance: sql<string>`COALESCE(SUM(CASE WHEN ${pesapalTransactionsTable.status} = 'completed' THEN ${pesapalTransactionsTable.netAmount}::numeric ELSE 0 END), 0)::text`,
    })
    .from(pesapalTransactionsTable)
    .where(eq(pesapalTransactionsTable.userId, userId));

  const [withdrawn] = await db
    .select({
      total: sql<string>`COALESCE(SUM(amount::numeric), 0)::text`,
    })
    .from(withdrawalRequestsTable)
    .where(and(
      eq(withdrawalRequestsTable.userId, userId),
      sql`${withdrawalRequestsTable.status} IN ('pending', 'processing', 'completed')`
    ));

  const mpesaCollected = Number(mpesa.balance);
  const pesapalCollected = Number(pesapal.balance);
  const totalCollected = mpesaCollected + pesapalCollected;
  const totalWithdrawn = Number(withdrawn.total);
  const available = Math.max(0, totalCollected - totalWithdrawn);

  return { available, mpesaCollected, pesapalCollected, totalWithdrawn };
}

// GET /wallet/balance
router.get("/wallet/balance", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { available, mpesaCollected, pesapalCollected, totalWithdrawn } = await getAvailableBalance(userId);
  const totalCollected = mpesaCollected + pesapalCollected;

  res.json({
    totalCollected: String(totalCollected),
    mpesaCollected: String(mpesaCollected),
    pesapalCollected: String(pesapalCollected),
    totalWithdrawn: String(totalWithdrawn),
    available: String(available),
  });
});

// GET /wallet/withdrawals
router.get("/wallet/withdrawals", requireAuth, async (req: AuthRequest, res) => {
  const requests = await db
    .select()
    .from(withdrawalRequestsTable)
    .where(eq(withdrawalRequestsTable.userId, req.userId!))
    .orderBy(sql`${withdrawalRequestsTable.createdAt} DESC`);
  res.json(requests);
});

// POST /wallet/withdraw
router.post("/wallet/withdraw", requireAuth, async (req: AuthRequest, res) => {
  const { amount, phone } = req.body;

  if (!amount || !phone) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "amount and phone are required" });
    return;
  }

  const requestAmount = Number(amount);
  if (requestAmount < 10) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Minimum withdrawal is KES 10" });
    return;
  }

  const { available } = await getAvailableBalance(req.userId!);

  if (requestAmount > available) {
    res.status(400).json({
      error: "INSUFFICIENT_BALANCE",
      message: `Available balance is KES ${available.toFixed(2)}`,
    });
    return;
  }

  // Normalise phone to 254XXXXXXXXX
  let formattedPhone = String(phone).replace(/\D/g, "");
  if (formattedPhone.startsWith("0")) formattedPhone = "254" + formattedPhone.slice(1);
  if (!formattedPhone.startsWith("254")) formattedPhone = "254" + formattedPhone;

  // ── Auto-disburse via B2C if credentials are configured ──────────────────
  const b2cReady = await isB2CConfigured();

  if (b2cReady) {
    // 2.5% platform fee on every withdrawal
    const PLATFORM_FEE_RATE = 0.025;
    const platformFee = parseFloat((requestAmount * PLATFORM_FEE_RATE).toFixed(2));
    const netAmount   = parseFloat((requestAmount - platformFee).toFixed(2));

    const baseUrl = getCallbackBaseUrl(req);
    const resultUrl  = `${baseUrl}/api/payments/b2c/result`;
    const timeoutUrl = `${baseUrl}/api/payments/b2c/timeout`;

    try {
      const b2cResult = await initiateB2C({
        phoneNumber: formattedPhone,
        amount: netAmount,
        commandId: "BusinessPayment",
        remarks: "Wallet withdrawal payout",
        resultUrl,
        timeoutUrl,
      });

      const [request] = await db.insert(withdrawalRequestsTable).values({
        userId: req.userId!,
        amount: String(requestAmount),
        phone: formattedPhone,
        status: "processing",
        note: `Auto-processed via B2C. Platform fee: KES ${platformFee.toFixed(2)} (2.5%). Net to merchant: KES ${netAmount.toFixed(2)}.`,
        b2cConversationId: b2cResult.ConversationID,
        autoProcessed: "true",
      }).returning();

      logger.info(
        { userId: req.userId, amount: requestAmount, platformFee, netAmount, conversationId: b2cResult.ConversationID },
        "Auto-withdrawal B2C initiated"
      );

      res.status(201).json({
        ...request,
        autoProcessed: true,
        platformFee,
        netAmount,
        message: `Withdrawal processing via M-Pesa B2C. KES ${netAmount.toFixed(2)} will be sent (2.5% platform fee of KES ${platformFee.toFixed(2)} deducted).`,
      });
      return;
    } catch (err) {
      // B2C initiation failed — fall through to manual queue
      logger.error({ err }, "Auto-withdrawal B2C initiation failed, falling back to manual");
    }
  }

  // ── Manual fallback (no B2C creds, or B2C call failed) ───────────────────
  const [request] = await db.insert(withdrawalRequestsTable).values({
    userId: req.userId!,
    amount: String(requestAmount),
    phone: formattedPhone,
    status: "pending",
    note: b2cReady ? "B2C auto-processing failed — queued for manual review" : undefined,
  }).returning();

  res.status(201).json({
    ...request,
    autoProcessed: false,
    message: b2cReady
      ? "B2C processing unavailable. Your withdrawal has been queued for manual review."
      : "Your withdrawal request has been queued for manual review.",
  });
});

export default router;
