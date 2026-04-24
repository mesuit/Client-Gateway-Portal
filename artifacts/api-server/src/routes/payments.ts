import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable, settlementAccountsTable, apiKeysTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireApiKey, type ApiKeyRequest } from "../lib/apiKeyAuth";
import { initiateSTKPush } from "../lib/mpesa";
import { logger } from "../lib/logger";

const router = Router();

function getCallbackUrl(req: ApiKeyRequest): string {
  const domains = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (domains) {
    return `https://${domains}/api/payments/callback`;
  }
  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  if (devDomain) {
    return `https://${devDomain}/api/payments/callback`;
  }
  return `${req.protocol}://${req.get("host")}/api/payments/callback`;
}

router.post("/payments/stkpush", requireApiKey, async (req: ApiKeyRequest, res) => {
  const { phoneNumber, amount, accountReference, transactionDesc, settlementAccountId } = req.body;

  if (!phoneNumber || !amount || !accountReference || !transactionDesc) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "phoneNumber, amount, accountReference, transactionDesc are required" });
    return;
  }

  if (amount < 1) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Amount must be at least 1 KES" });
    return;
  }

  let resolvedSettlementId: number | null = null;

  if (settlementAccountId) {
    const accts = await db
      .select()
      .from(settlementAccountsTable)
      .where(and(
        eq(settlementAccountsTable.id, settlementAccountId),
        eq(settlementAccountsTable.userId, req.apiKeyUserId!),
        eq(settlementAccountsTable.isActive, true)
      ));
    if (accts.length === 0) {
      res.status(400).json({ error: "INVALID_SETTLEMENT", message: "Settlement account not found or not yours" });
      return;
    }
    resolvedSettlementId = settlementAccountId;
  } else {
    const defaults = await db
      .select()
      .from(settlementAccountsTable)
      .where(and(
        eq(settlementAccountsTable.userId, req.apiKeyUserId!),
        eq(settlementAccountsTable.isDefault, true),
        eq(settlementAccountsTable.isActive, true)
      ));
    if (defaults.length > 0) resolvedSettlementId = defaults[0].id;
  }

  const callbackUrl = getCallbackUrl(req);

  try {
    const result = await initiateSTKPush({
      phoneNumber,
      amount: Number(amount),
      accountReference,
      transactionDesc,
      callbackUrl,
    });

    const [tx] = await db.insert(transactionsTable).values({
      userId: req.apiKeyUserId!,
      settlementAccountId: resolvedSettlementId,
      checkoutRequestId: result.CheckoutRequestID,
      merchantRequestId: result.MerchantRequestID,
      phoneNumber,
      amount: String(amount),
      status: "pending",
      accountReference,
      transactionDesc,
    }).returning();

    res.json({
      checkoutRequestId: result.CheckoutRequestID,
      merchantRequestId: result.MerchantRequestID,
      responseCode: result.ResponseCode,
      responseDescription: result.ResponseDescription,
      customerMessage: result.CustomerMessage,
      transactionId: tx.id,
    });
  } catch (err) {
    logger.error(err, "STK Push failed");
    res.status(502).json({ error: "MPESA_ERROR", message: err instanceof Error ? err.message : "STK Push failed" });
  }
});

router.post("/payments/callback", async (req, res) => {
  try {
    const body = req.body;
    const stk = body?.Body?.stkCallback;
    if (!stk) {
      res.json({ ResultCode: 0, ResultDesc: "Accepted" });
      return;
    }

    const checkoutRequestId = stk.CheckoutRequestID;
    const resultCode = stk.ResultCode;
    const resultDesc = stk.ResultDesc;

    let mpesaReceiptNumber: string | null = null;
    let callbackMetadata: string | null = null;

    if (resultCode === 0 && stk.CallbackMetadata?.Item) {
      const items: Array<{ Name: string; Value: unknown }> = stk.CallbackMetadata.Item;
      const receipt = items.find((i) => i.Name === "MpesaReceiptNumber");
      mpesaReceiptNumber = receipt ? String(receipt.Value) : null;
      callbackMetadata = JSON.stringify(stk.CallbackMetadata.Item);
    }

    const status = resultCode === 0 ? "completed" : resultCode === 1032 ? "cancelled" : "failed";

    await db
      .update(transactionsTable)
      .set({
        status,
        statusCode: String(resultCode),
        statusDescription: resultDesc,
        mpesaReceiptNumber,
        callbackMetadata,
      })
      .where(eq(transactionsTable.checkoutRequestId, checkoutRequestId));

    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (err) {
    logger.error(err, "Callback processing error");
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
});

router.get("/payments/status/:checkoutRequestId", requireApiKey, async (req: ApiKeyRequest, res) => {
  const { checkoutRequestId } = req.params;

  const txs = await db
    .select()
    .from(transactionsTable)
    .where(and(
      eq(transactionsTable.checkoutRequestId, checkoutRequestId),
      eq(transactionsTable.userId, req.apiKeyUserId!)
    ));

  if (txs.length === 0) {
    res.status(404).json({ error: "NOT_FOUND", message: "Transaction not found" });
    return;
  }

  const tx = txs[0];
  res.json({
    checkoutRequestId: tx.checkoutRequestId,
    status: tx.status,
    mpesaReceiptNumber: tx.mpesaReceiptNumber,
    amount: tx.amount,
    phoneNumber: tx.phoneNumber,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
  });
});

export default router;
