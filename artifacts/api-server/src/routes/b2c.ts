import { Router } from "express";
import { db } from "@workspace/db";
import { b2cTransactionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireApiKey, type ApiKeyRequest } from "../lib/apiKeyAuth";
import { initiateB2C, getCallbackBaseUrl } from "../lib/mpesa";
import { logger } from "../lib/logger";

const router = Router();

// POST /api/payments/b2c — initiate a B2C payment (send money to phone)
router.post("/payments/b2c", requireApiKey, async (req: ApiKeyRequest, res) => {
  const userId = req.apiKeyUserId!;
  const { phoneNumber, amount, remarks, occasion, commandId } = req.body;

  if (!phoneNumber || !amount || !remarks) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "phoneNumber, amount, and remarks are required",
    });
    return;
  }

  if (Number(amount) < 10) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Minimum B2C amount is KES 10",
    });
    return;
  }

  const validCommands = ["BusinessPayment", "SalaryPayment", "PromotionPayment"];
  if (commandId && !validCommands.includes(commandId)) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: `commandId must be one of: ${validCommands.join(", ")}`,
    });
    return;
  }

  const baseUrl = getCallbackBaseUrl(req);
  const resultUrl = `${baseUrl}/api/payments/b2c/result`;
  const timeoutUrl = `${baseUrl}/api/payments/b2c/timeout`;

  try {
    const result = await initiateB2C({
      phoneNumber,
      amount: Number(amount),
      commandId: commandId ?? "BusinessPayment",
      remarks,
      occasion,
      resultUrl,
      timeoutUrl,
    });

    const [tx] = await db.insert(b2cTransactionsTable).values({
      userId,
      conversationId: result.ConversationID,
      originatorConversationId: result.OriginatorConversationID,
      phoneNumber,
      amount: String(amount),
      commandId: commandId ?? "BusinessPayment",
      remarks,
      occasion: occasion ?? null,
      status: "pending",
    }).returning();

    logger.info({ conversationId: result.ConversationID, userId }, "B2C payment initiated");

    res.json({
      conversationId: result.ConversationID,
      originatorConversationId: result.OriginatorConversationID,
      responseCode: result.ResponseCode,
      responseDescription: result.ResponseDescription,
      transactionId: tx.id,
    });
  } catch (err) {
    logger.error(err, "B2C initiation failed");
    res.status(502).json({
      error: "MPESA_ERROR",
      message: err instanceof Error ? err.message : "B2C payment failed",
    });
  }
});

// GET /api/payments/b2c/status/:conversationId — check status
router.get("/payments/b2c/status/:conversationId", requireApiKey, async (req: ApiKeyRequest, res) => {
  const { conversationId } = req.params;

  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.removeHeader("ETag");

  const [tx] = await db
    .select()
    .from(b2cTransactionsTable)
    .where(
      and(
        eq(b2cTransactionsTable.conversationId, conversationId),
        eq(b2cTransactionsTable.userId, req.apiKeyUserId!)
      )
    );

  if (!tx) {
    res.status(404).json({ error: "NOT_FOUND", message: "B2C transaction not found" });
    return;
  }

  res.json({
    conversationId: tx.conversationId,
    status: tx.status,
    amount: tx.amount,
    phoneNumber: tx.phoneNumber,
    mpesaReceiptNumber: tx.mpesaReceiptNumber,
    receiverPartyPublicName: tx.receiverPartyPublicName,
    resultDescription: tx.resultDescription,
    commandId: tx.commandId,
    remarks: tx.remarks,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
  });
});

// GET /api/payments/b2c — list all B2C transactions for the authenticated merchant
router.get("/payments/b2c", requireApiKey, async (req: ApiKeyRequest, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.removeHeader("ETag");

  const txs = await db
    .select()
    .from(b2cTransactionsTable)
    .where(eq(b2cTransactionsTable.userId, req.apiKeyUserId!));

  res.json(txs.map(tx => ({
    id: tx.id,
    conversationId: tx.conversationId,
    status: tx.status,
    amount: tx.amount,
    phoneNumber: tx.phoneNumber,
    mpesaReceiptNumber: tx.mpesaReceiptNumber,
    receiverPartyPublicName: tx.receiverPartyPublicName,
    commandId: tx.commandId,
    remarks: tx.remarks,
    resultDescription: tx.resultDescription,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
  })));
});

// POST /api/payments/b2c/result — Safaricom B2C result callback (public — no API key)
router.post("/payments/b2c/result", async (req, res) => {
  try {
    const result = req.body?.Result;
    if (!result) {
      res.json({ ResultCode: 0, ResultDesc: "Accepted" });
      return;
    }

    const conversationId: string = result.ConversationID;
    const resultCode: number = result.ResultCode;
    const resultDesc: string = result.ResultDesc;
    const originatorConversationId: string = result.OriginatorConversationID;
    const transactionId: string = result.TransactionID;

    const status = resultCode === 0 ? "completed" : "failed";

    let mpesaReceiptNumber: string | null = transactionId ?? null;
    let transactionAmount: string | null = null;
    let receiverPartyPublicName: string | null = null;
    let b2cRecipientIsRegistered: string | null = null;
    let b2cChargesPaidAccount: string | null = null;

    if (resultCode === 0 && result.ResultParameters?.ResultParameter) {
      const params: Array<{ Key: string; Value: unknown }> = result.ResultParameters.ResultParameter;
      const get = (key: string) => {
        const p = params.find(p => p.Key === key);
        return p ? String(p.Value) : null;
      };
      transactionAmount = get("TransactionAmount");
      receiverPartyPublicName = get("ReceiverPartyPublicName");
      b2cRecipientIsRegistered = get("B2CRecipientIsRegisteredCustomer");
      b2cChargesPaidAccount = get("B2CChargesPaidAccountAvailableFunds");
    }

    await db
      .update(b2cTransactionsTable)
      .set({
        status,
        resultCode: String(resultCode),
        resultDescription: resultDesc,
        mpesaReceiptNumber,
        transactionAmount,
        receiverPartyPublicName,
        b2cRecipientIsRegistered,
        b2cChargesPaidAccount,
      })
      .where(eq(b2cTransactionsTable.conversationId, conversationId));

    logger.info({ conversationId, status, resultCode }, "B2C result received");
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (err) {
    logger.error(err, "B2C result callback error");
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
});

// POST /api/payments/b2c/timeout — Safaricom B2C timeout callback (public)
router.post("/payments/b2c/timeout", async (req, res) => {
  try {
    const result = req.body?.Result;
    if (result?.ConversationID) {
      await db
        .update(b2cTransactionsTable)
        .set({ status: "failed", resultDescription: "Transaction timed out" })
        .where(eq(b2cTransactionsTable.conversationId, result.ConversationID));
      logger.warn({ conversationId: result.ConversationID }, "B2C timeout received");
    }
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (err) {
    logger.error(err, "B2C timeout callback error");
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
});

export default router;
