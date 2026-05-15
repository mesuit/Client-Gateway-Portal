import { Router } from "express";
import { fireWebhooks } from "../lib/webhooks";
import { db } from "@workspace/db";
import { transactionsTable, settlementAccountsTable, apiKeysTable, usersTable, saasTenantsTable, saasSubscriptionsTable } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import { requireApiKey, type ApiKeyRequest } from "../lib/apiKeyAuth";
import { initiateSTKPush, getCallbackBaseUrl } from "../lib/mpesa";
import { logger } from "../lib/logger";

const router = Router();

const SANDBOX_LIMIT = 2;

router.post("/payments/stkpush", requireApiKey, async (req: ApiKeyRequest, res) => {
  const userId = req.apiKeyUserId!;
  const { phoneNumber, amount, accountReference, transactionDesc, settlementAccountId, tenantCode } = req.body;

  if (!phoneNumber || !amount || !accountReference || !transactionDesc) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "phoneNumber, amount, accountReference, transactionDesc are required" });
    return;
  }

  if (amount < 1) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Amount must be at least 1 KES" });
    return;
  }

  // Fetch user and check sandbox/subscription status
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(403).json({ error: "USER_NOT_FOUND", message: "Account not found" });
    return;
  }

  // Check if monthly subscription has expired → revert to sandbox
  const now = new Date();
  let effectiveMode = user.mode;
  if (user.mode === "active" && user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) < now) {
    effectiveMode = "sandbox";
    // Revert in DB
    await db.update(usersTable).set({ mode: "sandbox", subscriptionType: null }).where(eq(usersTable.id, userId));
  }

  if (effectiveMode === "sandbox") {
    if (user.sandboxTransactionsUsed >= SANDBOX_LIMIT) {
      res.status(403).json({
        error: "SANDBOX_LIMIT_REACHED",
        message: `You have used ${SANDBOX_LIMIT} sandbox transactions. Please activate your account to continue.`,
        activationRequired: true,
      });
      return;
    }
  }

  // Resolve settlement account (supports tenantCode as alias)
  let resolvedSettlement: { id: number; accountNumber: string; businessNumber: string | null; accountType: string } | null = null;

  // tenantCode takes priority — look up tenant's settlement account
  if (tenantCode) {
    // Verify the merchant has an active SaaS subscription before allowing multi-tenant routing
    const [saasSub] = await db.select()
      .from(saasSubscriptionsTable)
      .where(and(eq(saasSubscriptionsTable.userId, userId), eq(saasSubscriptionsTable.status, "active")));
    const saasActive = saasSub && (!saasSub.expiresAt || new Date(saasSub.expiresAt) > now);
    if (!saasActive) {
      res.status(403).json({
        error: "SAAS_NOT_ACTIVE",
        message: "Your SaaS Multi-Tenant subscription is not active — activate from your dashboard.",
        activationRequired: true,
      });
      return;
    }

    const [tenant] = await db.select().from(saasTenantsTable)
      .where(and(eq(saasTenantsTable.tenantCode, tenantCode), eq(saasTenantsTable.userId, userId), eq(saasTenantsTable.isActive, true)));
    if (!tenant) {
      res.status(400).json({ error: "TENANT_NOT_FOUND", message: `Tenant '${tenantCode}' not found or inactive` });
      return;
    }
    if (tenant.settlementAccountId) {
      const [acct] = await db.select().from(settlementAccountsTable)
        .where(and(eq(settlementAccountsTable.id, tenant.settlementAccountId), eq(settlementAccountsTable.isActive, true)));
      if (acct) resolvedSettlement = acct;
    }
  } else if (settlementAccountId) {
    const accts = await db
      .select()
      .from(settlementAccountsTable)
      .where(and(
        eq(settlementAccountsTable.id, settlementAccountId),
        eq(settlementAccountsTable.userId, userId),
        eq(settlementAccountsTable.isActive, true)
      ));
    if (accts.length === 0) {
      res.status(400).json({ error: "INVALID_SETTLEMENT", message: "Settlement account not found or not yours" });
      return;
    }
    resolvedSettlement = accts[0];
  } else {
    const defaults = await db
      .select()
      .from(settlementAccountsTable)
      .where(and(
        eq(settlementAccountsTable.userId, userId),
        eq(settlementAccountsTable.isDefault, true),
        eq(settlementAccountsTable.isActive, true)
      ));
    if (defaults.length > 0) resolvedSettlement = defaults[0];
  }

  const callbackUrl = `${getCallbackBaseUrl(req)}/api/payments/callback`;

  // Till    → CustomerBuyGoodsOnline, PartyB = merchant till number.
  const merchantTill = resolvedSettlement?.accountType === "till"
    ? resolvedSettlement.accountNumber
    : undefined;

  // Paybill → CustomerPayBillOnline, PartyB = merchant paybill business number.
  //           If businessNumber missing, fall back to accountNumber as the paybill shortcode.
  //           AccountReference = merchant's account number on their paybill.
  const paybillShortcode = resolvedSettlement?.accountType === "paybill"
    ? (resolvedSettlement.businessNumber || resolvedSettlement.accountNumber)
    : undefined;

  const merchantPaybill = paybillShortcode || undefined;

  const effectiveAccountReference = resolvedSettlement?.accountType === "paybill"
    ? (resolvedSettlement.businessNumber ? resolvedSettlement.accountNumber : accountReference)
    : accountReference;

  try {
    const result = await initiateSTKPush({
      phoneNumber,
      amount: Number(amount),
      accountReference: effectiveAccountReference,
      transactionDesc,
      callbackUrl,
      merchantTill,
      merchantPaybill,
    });

    const [tx] = await db.insert(transactionsTable).values({
      userId,
      settlementAccountId: resolvedSettlement?.id ?? null,
      checkoutRequestId: result.CheckoutRequestID,
      merchantRequestId: result.MerchantRequestID,
      phoneNumber,
      amount: String(amount),
      status: "pending",
      accountReference,
      transactionDesc,
    }).returning();

    // Increment sandbox usage counter
    if (effectiveMode === "sandbox") {
      await db
        .update(usersTable)
        .set({ sandboxTransactionsUsed: user.sandboxTransactionsUsed + 1 })
        .where(eq(usersTable.id, userId));
    }

    res.json({
      checkoutRequestId: result.CheckoutRequestID,
      merchantRequestId: result.MerchantRequestID,
      responseCode: result.ResponseCode,
      responseDescription: result.ResponseDescription,
      customerMessage: result.CustomerMessage,
      transactionId: tx.id,
      sandboxMode: effectiveMode === "sandbox",
      sandboxTransactionsRemaining: effectiveMode === "sandbox" ? SANDBOX_LIMIT - user.sandboxTransactionsUsed - 1 : null,
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

    const updated = await db
      .update(transactionsTable)
      .set({ status, statusCode: String(resultCode), statusDescription: resultDesc, mpesaReceiptNumber, callbackMetadata })
      .where(eq(transactionsTable.checkoutRequestId, checkoutRequestId))
      .returning();

    if (updated.length > 0 && (status === "completed" || status === "failed")) {
      const tx = updated[0];
      fireWebhooks(tx.userId, `payment.${status}`, {
        id: tx.id,
        checkoutRequestId: tx.checkoutRequestId,
        status: tx.status,
        amount: tx.amount,
        phoneNumber: tx.phoneNumber,
        mpesaReceiptNumber: tx.mpesaReceiptNumber,
        accountReference: tx.accountReference,
        createdAt: tx.createdAt,
      }).catch((err: unknown) => logger.warn(err, "Webhook delivery failed"));
    }

    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (err) {
    logger.error(err, "Callback processing error");
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
});

router.get("/payments/status/:checkoutRequestId", requireApiKey, async (req: ApiKeyRequest, res) => {
  const { checkoutRequestId } = req.params;

  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.removeHeader("ETag");

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
