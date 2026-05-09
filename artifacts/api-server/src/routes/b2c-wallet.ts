import { Router } from "express";
import { db } from "@workspace/db";
import { b2cWalletsTable, b2cTopupsTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import { requireAuthOrApiKey, type ApiKeyRequest } from "../lib/apiKeyAuth";
import { initiateSTKPush, getCallbackBaseUrl, getB2CConfig } from "../lib/mpesa";
import { logger } from "../lib/logger";

const router = Router();

export const B2C_FEE_RATE = 0.08; // 8%

export async function getOrCreateWallet(userId: number) {
  const existing = await db.select().from(b2cWalletsTable).where(eq(b2cWalletsTable.userId, userId));
  if (existing.length > 0) return existing[0];
  const [created] = await db.insert(b2cWalletsTable).values({ userId, balance: "0" }).returning();
  return created;
}

export async function deductWallet(userId: number, amount: number): Promise<{ feeAmount: number; totalDeducted: number }> {
  const feeAmount = parseFloat((amount * B2C_FEE_RATE).toFixed(2));
  const totalDeducted = parseFloat((amount + feeAmount).toFixed(2));

  const result = await db
    .update(b2cWalletsTable)
    .set({
      balance: sql`${b2cWalletsTable.balance}::numeric - ${totalDeducted}`,
      totalSpent: sql`${b2cWalletsTable.totalSpent}::numeric + ${amount}`,
      totalFees: sql`${b2cWalletsTable.totalFees}::numeric + ${feeAmount}`,
    })
    .where(
      sql`${b2cWalletsTable.userId} = ${userId} AND ${b2cWalletsTable.balance}::numeric >= ${totalDeducted}`
    )
    .returning();

  if (result.length === 0) {
    throw new Error("INSUFFICIENT_B2C_BALANCE");
  }
  return { feeAmount, totalDeducted };
}

export async function refundWallet(userId: number, totalDeducted: number) {
  await db
    .update(b2cWalletsTable)
    .set({
      balance: sql`${b2cWalletsTable.balance}::numeric + ${totalDeducted}`,
      totalSpent: sql`${b2cWalletsTable.totalSpent}::numeric - ${totalDeducted}`,
    })
    .where(eq(b2cWalletsTable.userId, userId));
}

// GET /api/b2c/wallet — get balance + recent topups (session OR API key)
router.get("/b2c/wallet", requireAuthOrApiKey, async (req: ApiKeyRequest, res) => {
  const userId = req.apiKeyUserId!;
  const wallet = await getOrCreateWallet(userId);
  const topups = await db
    .select()
    .from(b2cTopupsTable)
    .where(eq(b2cTopupsTable.userId, userId))
    .orderBy(desc(b2cTopupsTable.createdAt))
    .limit(10);

  res.json({
    balance: wallet.balance,
    totalToppedup: wallet.totalToppedup,
    totalSpent: wallet.totalSpent,
    totalFees: wallet.totalFees,
    feeRate: B2C_FEE_RATE,
    recentTopups: topups,
  });
});

// POST /api/b2c/wallet/topup — initiate STK Push to top up wallet (session OR API key)
router.post("/b2c/wallet/topup", requireAuthOrApiKey, async (req: ApiKeyRequest, res) => {
  const userId = req.apiKeyUserId!;
  const { phoneNumber, amount } = req.body;

  if (!phoneNumber || !amount) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "phoneNumber and amount are required" });
    return;
  }
  if (Number(amount) < 10) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Minimum top-up is KES 10" });
    return;
  }

  const callbackUrl = `${getCallbackBaseUrl(req)}/api/b2c/wallet/topup/callback`;

  try {
    const result = await initiateSTKPush({
      phoneNumber,
      amount: Number(amount),
      accountReference: "B2CWallet",
      transactionDesc: "B2C Wallet Top Up",
      callbackUrl,
    });

    const [topup] = await db.insert(b2cTopupsTable).values({
      userId,
      checkoutRequestId: result.CheckoutRequestID,
      phoneNumber,
      amount: String(amount),
      status: "pending",
    }).returning();

    logger.info({ userId, amount, checkoutRequestId: result.CheckoutRequestID }, "B2C wallet top-up initiated");

    res.json({
      checkoutRequestId: result.CheckoutRequestID,
      customerMessage: result.CustomerMessage,
      topupId: topup.id,
    });
  } catch (err) {
    logger.error(err, "B2C wallet top-up STK Push failed");
    res.status(502).json({ error: "MPESA_ERROR", message: err instanceof Error ? err.message : "STK Push failed" });
  }
});

// POST /api/b2c/wallet/topup/callback — Safaricom STK callback (public)
router.post("/b2c/wallet/topup/callback", async (req, res) => {
  try {
    const stk = req.body?.Body?.stkCallback;
    if (!stk) { res.json({ ResultCode: 0, ResultDesc: "Accepted" }); return; }

    const checkoutRequestId: string = stk.CheckoutRequestID;
    const resultCode: number = stk.ResultCode;
    const resultDesc: string = stk.ResultDesc;

    let mpesaReceiptNumber: string | null = null;
    if (resultCode === 0 && stk.CallbackMetadata?.Item) {
      const items: Array<{ Name: string; Value: unknown }> = stk.CallbackMetadata.Item;
      const r = items.find(i => i.Name === "MpesaReceiptNumber");
      mpesaReceiptNumber = r ? String(r.Value) : null;
    }

    const status = resultCode === 0 ? "completed" : "failed";

    const [topup] = await db
      .update(b2cTopupsTable)
      .set({ status, statusDescription: resultDesc, mpesaReceiptNumber })
      .where(eq(b2cTopupsTable.checkoutRequestId, checkoutRequestId))
      .returning();

    if (topup && resultCode === 0) {
      await getOrCreateWallet(topup.userId);
      await db
        .update(b2cWalletsTable)
        .set({
          balance: sql`${b2cWalletsTable.balance}::numeric + ${topup.amount}::numeric`,
          totalToppedup: sql`${b2cWalletsTable.totalToppedup}::numeric + ${topup.amount}::numeric`,
        })
        .where(eq(b2cWalletsTable.userId, topup.userId));

      logger.info({ userId: topup.userId, amount: topup.amount, mpesaReceiptNumber }, "B2C wallet credited");
    }

    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (err) {
    logger.error(err, "B2C wallet top-up callback error");
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
});

// GET /api/b2c/wallet/topup/status/:checkoutRequestId (session OR API key)
router.get("/b2c/wallet/topup/status/:checkoutRequestId", requireAuthOrApiKey, async (req: ApiKeyRequest, res) => {
  const { checkoutRequestId } = req.params;
  res.set("Cache-Control", "no-store");

  const [topup] = await db
    .select()
    .from(b2cTopupsTable)
    .where(eq(b2cTopupsTable.checkoutRequestId, checkoutRequestId));

  if (!topup) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  res.json({ status: topup.status, amount: topup.amount, mpesaReceiptNumber: topup.mpesaReceiptNumber });
});

// GET /api/b2c/config — return B2C configuration status (no secrets exposed)
router.get("/b2c/config", requireAuthOrApiKey, async (_req: ApiKeyRequest, res) => {
  try {
    const config = await getB2CConfig();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: "CONFIG_ERROR", message: err instanceof Error ? err.message : "Failed to read config" });
  }
});

export default router;
