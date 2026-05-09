import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, activationPaymentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { initiateSTKPush, getCallbackBaseUrl } from "../lib/mpesa";
import { logger } from "../lib/logger";

const router = Router();

const PLANS: Record<string, { amount: number; days: number; label: string }> = {
  monthly:    { amount: 100,  days: 30,  label: "Monthly" },
  yearly:     { amount: 500,  days: 365, label: "Yearly" },
  "1month":   { amount: 450,  days: 30,  label: "1 Month" },
  "3months":  { amount: 1400, days: 90,  label: "3 Months" },
  "6months":  { amount: 2800, days: 180, label: "6 Months" },
  "12months": { amount: 3800, days: 365, label: "12 Months" },
};

const RESULT_MESSAGES: Record<number, string> = {
  1032: "You cancelled the M-Pesa request. Please try again and enter your PIN when prompted.",
  1037: "The M-Pesa request timed out — the prompt was not responded to in time. Please try again.",
  1: "Your M-Pesa account has insufficient funds. Please top up and try again.",
  2001: "Wrong M-Pesa PIN entered. Please try again.",
  17: "You have reached your M-Pesa transaction limit for today. Try again tomorrow.",
  1001: "Unable to reach M-Pesa servers. Please try again in a moment.",
};

// POST /activate — initiate activation STK push
router.post("/activate", requireAuth, async (req: AuthRequest, res) => {
  const { plan, phone } = req.body;

  if (!plan || !Object.keys(PLANS).includes(plan)) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid plan" });
    return;
  }
  if (!phone) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "phone is required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user) {
    res.status(404).json({ error: "NOT_FOUND", message: "User not found" });
    return;
  }

  const planDetails = PLANS[plan];
  const callbackUrl = `${getCallbackBaseUrl(req)}/api/activate/callback`;

  try {
    const result = await initiateSTKPush({
      phoneNumber: phone,
      amount: planDetails.amount,
      accountReference: `ACTIVATION-${plan.toUpperCase()}`,
      transactionDesc: `${planDetails.label} Plan Activation`,
      callbackUrl,
      // No merchantTill → goes to platform shortcode (collected by platform)
    });

    const [payment] = await db.insert(activationPaymentsTable).values({
      userId: req.userId!,
      plan,
      amount: String(planDetails.amount),
      checkoutRequestId: result.CheckoutRequestID,
      merchantRequestId: result.MerchantRequestID,
      status: "pending",
    }).returning();

    res.json({
      checkoutRequestId: result.CheckoutRequestID,
      customerMessage: result.CustomerMessage,
      paymentId: payment.id,
      amount: planDetails.amount,
      plan,
    });
  } catch (err) {
    logger.error(err, "Activation STK push failed");
    res.status(502).json({ error: "MPESA_ERROR", message: err instanceof Error ? err.message : "Payment initiation failed" });
  }
});

// GET /activate/status/:checkoutRequestId — poll activation status
router.get("/activate/status/:checkoutRequestId", requireAuth, async (req: AuthRequest, res) => {
  const { checkoutRequestId } = req.params;
  const rows = await db
    .select()
    .from(activationPaymentsTable)
    .where(eq(activationPaymentsTable.checkoutRequestId, checkoutRequestId));

  if (rows.length === 0) {
    res.status(404).json({ error: "NOT_FOUND", message: "Activation payment not found" });
    return;
  }

  // Disable caching so the browser always gets the latest status
  res.setHeader("Cache-Control", "no-store");
  res.json({
    status: rows[0].status,
    plan: rows[0].plan,
    failureReason: rows[0].failureReason ?? null,
  });
});

// POST /activate/callback — M-Pesa callback for activation payments
router.post("/activate/callback", async (req, res) => {
  try {
    const body = req.body;
    const stk = body?.Body?.stkCallback;
    if (!stk) {
      res.json({ ResultCode: 0, ResultDesc: "Accepted" });
      return;
    }

    const checkoutRequestId = stk.CheckoutRequestID;
    const resultCode = Number(stk.ResultCode);
    const resultDesc: string = stk.ResultDesc ?? "";

    const status = resultCode === 0 ? "completed" : "failed";
    const failureReason = resultCode !== 0
      ? (RESULT_MESSAGES[resultCode] ?? `Payment failed: ${resultDesc}`)
      : null;

    logger.info(
      { checkoutRequestId, resultCode, resultDesc, status },
      "Activation callback received"
    );

    const rows = await db
      .update(activationPaymentsTable)
      .set({ status, ...(failureReason ? { failureReason } : {}) })
      .where(eq(activationPaymentsTable.checkoutRequestId, checkoutRequestId))
      .returning();

    if (status === "completed" && rows.length > 0) {
      const payment = rows[0];
      const plan = payment.plan;
      const now = new Date();
      const planDetails = PLANS[plan] ?? { days: 30 };
      const expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + planDetails.days);

      await db.update(usersTable)
        .set({
          mode: "active",
          subscriptionType: plan,
          subscriptionExpiresAt: expiresAt,
          activatedAt: now,
        })
        .where(eq(usersTable.id, payment.userId));

      logger.info({ userId: payment.userId, plan }, "Account activated successfully");
    } else if (status === "failed") {
      logger.warn({ checkoutRequestId, resultCode, resultDesc }, "Activation payment failed");
    }

    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (err) {
    logger.error(err, "Activation callback error");
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
});

export default router;
