import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, activationPaymentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { initiateSTKPush, getCallbackBaseUrl } from "../lib/mpesa";
import { logger } from "../lib/logger";

const router = Router();

const PLANS: Record<string, number> = {
  monthly: 100,
  yearly: 500,
};

// POST /activate — initiate activation STK push
router.post("/activate", requireAuth, async (req: AuthRequest, res) => {
  const { plan, phone } = req.body;

  if (!plan || !["monthly", "yearly"].includes(plan)) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "plan must be 'monthly' or 'yearly'" });
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

  const amount = PLANS[plan];
  const callbackUrl = `${getCallbackBaseUrl(req)}/api/activate/callback`;

  try {
    const result = await initiateSTKPush({
      phoneNumber: phone,
      amount,
      accountReference: `NEXUSPAY-${plan.toUpperCase()}`,
      transactionDesc: `Nexus Pay ${plan === "monthly" ? "Monthly" : "Yearly"} Activation`,
      callbackUrl,
      // No merchantTill → goes to platform shortcode (collected by platform)
    });

    const [payment] = await db.insert(activationPaymentsTable).values({
      userId: req.userId!,
      plan,
      amount: String(amount),
      checkoutRequestId: result.CheckoutRequestID,
      merchantRequestId: result.MerchantRequestID,
      status: "pending",
    }).returning();

    res.json({
      checkoutRequestId: result.CheckoutRequestID,
      customerMessage: result.CustomerMessage,
      paymentId: payment.id,
      amount,
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

  res.json({ status: rows[0].status, plan: rows[0].plan });
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
    const resultCode = stk.ResultCode;

    const status = resultCode === 0 ? "completed" : "failed";

    const rows = await db
      .update(activationPaymentsTable)
      .set({ status })
      .where(eq(activationPaymentsTable.checkoutRequestId, checkoutRequestId))
      .returning();

    if (status === "completed" && rows.length > 0) {
      const payment = rows[0];
      const plan = payment.plan;
      const now = new Date();

      // Monthly: expires in 30 days; yearly: expires in 365 days
      const expiresAt = new Date(now);
      if (plan === "monthly") expiresAt.setDate(expiresAt.getDate() + 30);
      else expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      await db.update(usersTable)
        .set({
          mode: "active",
          subscriptionType: plan,
          subscriptionExpiresAt: expiresAt,
          activatedAt: now,
        })
        .where(eq(usersTable.id, payment.userId));

      logger.info({ userId: payment.userId, plan }, "Account activated");
    }

    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (err) {
    logger.error(err, "Activation callback error");
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
});

export default router;
