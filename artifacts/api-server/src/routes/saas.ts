import { Router } from "express";
import { db } from "@workspace/db";
import { saasSubscriptionsTable, saasTenantsTable, settlementAccountsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { requireApiKey, type ApiKeyRequest } from "../lib/apiKeyAuth";
import { initiateSTKPush, getCallbackBaseUrl } from "../lib/mpesa";
import { logger } from "../lib/logger";

const router = Router();

const SAAS_PLANS = {
  monthly: { amount: 300, days: 30 },
  yearly:  { amount: 1000, days: 365 },
};

function generateTenantCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "tnnt_";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function getSaasStatus(userId: number) {
  const [sub] = await db.select().from(saasSubscriptionsTable).where(eq(saasSubscriptionsTable.userId, userId));
  if (!sub) return { active: false, subscription: null };
  const now = new Date();
  if (sub.status === "active" && sub.expiresAt && new Date(sub.expiresAt) < now) {
    await db.update(saasSubscriptionsTable).set({ status: "expired" }).where(eq(saasSubscriptionsTable.userId, userId));
    return { active: false, subscription: { ...sub, status: "expired" } };
  }
  return { active: sub.status === "active", subscription: sub };
}

// GET /api/saas/status
router.get("/saas/status", requireAuth, async (req: AuthRequest, res) => {
  const { active, subscription } = await getSaasStatus(req.userId!);
  res.json({ active, subscription });
});

// POST /api/saas/activate — initiate STK Push for SaaS subscription
router.post("/saas/activate", requireAuth, async (req: AuthRequest, res) => {
  const { plan, phone } = req.body;
  if (!plan || !phone) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "plan and phone are required" });
    return;
  }
  const planDetails = SAAS_PLANS[plan as keyof typeof SAAS_PLANS];
  if (!planDetails) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "plan must be monthly or yearly" });
    return;
  }

  const callbackUrl = `${getCallbackBaseUrl(req)}/api/saas/activate/callback`;

  try {
    const result = await initiateSTKPush({
      phoneNumber: phone,
      amount: planDetails.amount,
      accountReference: "SaaSPlan",
      transactionDesc: `Nexus Pay SaaS ${plan} plan`,
      callbackUrl,
    });

    // Upsert subscription record as pending
    const existing = await db.select().from(saasSubscriptionsTable).where(eq(saasSubscriptionsTable.userId, req.userId!));
    if (existing.length > 0) {
      await db.update(saasSubscriptionsTable)
        .set({ plan, status: "pending", checkoutRequestId: result.CheckoutRequestID, amount: String(planDetails.amount) })
        .where(eq(saasSubscriptionsTable.userId, req.userId!));
    } else {
      await db.insert(saasSubscriptionsTable).values({
        userId: req.userId!,
        plan,
        status: "pending",
        checkoutRequestId: result.CheckoutRequestID,
        amount: String(planDetails.amount),
      });
    }

    logger.info({ userId: req.userId, plan, checkoutRequestId: result.CheckoutRequestID }, "SaaS activation initiated");
    res.json({ checkoutRequestId: result.CheckoutRequestID, customerMessage: result.CustomerMessage, amount: planDetails.amount });
  } catch (err) {
    logger.error(err, "SaaS STK Push failed");
    res.status(502).json({ error: "MPESA_ERROR", message: err instanceof Error ? err.message : "STK Push failed" });
  }
});

// GET /api/saas/activate/status/:checkoutRequestId
router.get("/saas/activate/status/:checkoutRequestId", requireAuth, async (req: AuthRequest, res) => {
  const { checkoutRequestId } = req.params;
  res.set("Cache-Control", "no-store");
  const [sub] = await db.select().from(saasSubscriptionsTable)
    .where(and(eq(saasSubscriptionsTable.userId, req.userId!), eq(saasSubscriptionsTable.checkoutRequestId, checkoutRequestId)));
  if (!sub) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  res.json({ status: sub.status, plan: sub.plan, expiresAt: sub.expiresAt });
});

// POST /api/saas/activate/callback — Safaricom STK callback (public)
router.post("/saas/activate/callback", async (req, res) => {
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

    if (resultCode === 0) {
      const [sub] = await db.select().from(saasSubscriptionsTable).where(eq(saasSubscriptionsTable.checkoutRequestId, checkoutRequestId));
      if (sub) {
        const planDetails = SAAS_PLANS[sub.plan as keyof typeof SAAS_PLANS];
        const now = new Date();
        const expiresAt = new Date(now.getTime() + planDetails.days * 24 * 60 * 60 * 1000);
        await db.update(saasSubscriptionsTable)
          .set({ status: "active", mpesaReceiptNumber, activatedAt: now, expiresAt })
          .where(eq(saasSubscriptionsTable.checkoutRequestId, checkoutRequestId));
        logger.info({ userId: sub.userId, plan: sub.plan, expiresAt }, "SaaS subscription activated");
      }
    } else {
      await db.update(saasSubscriptionsTable)
        .set({ status: "pending" })
        .where(eq(saasSubscriptionsTable.checkoutRequestId, checkoutRequestId));
    }

    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (err) {
    logger.error(err, "SaaS callback error");
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
});

// GET /api/saas/tenants
router.get("/saas/tenants", requireAuth, async (req: AuthRequest, res) => {
  const tenants = await db
    .select({
      id: saasTenantsTable.id,
      name: saasTenantsTable.name,
      description: saasTenantsTable.description,
      tenantCode: saasTenantsTable.tenantCode,
      settlementAccountId: saasTenantsTable.settlementAccountId,
      isActive: saasTenantsTable.isActive,
      createdAt: saasTenantsTable.createdAt,
      settlementAccountName: settlementAccountsTable.accountName,
      settlementAccountType: settlementAccountsTable.accountType,
      settlementAccountNumber: settlementAccountsTable.accountNumber,
    })
    .from(saasTenantsTable)
    .leftJoin(settlementAccountsTable, eq(saasTenantsTable.settlementAccountId, settlementAccountsTable.id))
    .where(eq(saasTenantsTable.userId, req.userId!))
    .orderBy(sql`${saasTenantsTable.createdAt} DESC`);

  res.json(tenants);
});

// POST /api/saas/tenants
router.post("/saas/tenants", requireAuth, async (req: AuthRequest, res) => {
  const { active } = await getSaasStatus(req.userId!);
  if (!active) {
    res.status(403).json({ error: "SAAS_NOT_ACTIVE", message: "SaaS subscription required to create tenants." });
    return;
  }

  const { name, description, settlementAccountId } = req.body;
  if (!name) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "name is required" });
    return;
  }

  // Verify settlement account belongs to this user
  if (settlementAccountId) {
    const [acct] = await db.select().from(settlementAccountsTable)
      .where(and(eq(settlementAccountsTable.id, settlementAccountId), eq(settlementAccountsTable.userId, req.userId!)));
    if (!acct) {
      res.status(400).json({ error: "INVALID_SETTLEMENT", message: "Settlement account not found or not yours" });
      return;
    }
  }

  // Generate unique tenant code
  let tenantCode = generateTenantCode();
  let attempts = 0;
  while (attempts < 5) {
    const existing = await db.select().from(saasTenantsTable).where(eq(saasTenantsTable.tenantCode, tenantCode));
    if (existing.length === 0) break;
    tenantCode = generateTenantCode();
    attempts++;
  }

  const [tenant] = await db.insert(saasTenantsTable).values({
    userId: req.userId!,
    name,
    description: description ?? null,
    tenantCode,
    settlementAccountId: settlementAccountId ?? null,
    isActive: true,
  }).returning();

  logger.info({ userId: req.userId, tenantCode, name }, "SaaS tenant created");
  res.status(201).json(tenant);
});

// PUT /api/saas/tenants/:id
router.put("/saas/tenants/:id", requireAuth, async (req: AuthRequest, res) => {
  const { active } = await getSaasStatus(req.userId!);
  if (!active) {
    res.status(403).json({ error: "SAAS_NOT_ACTIVE", message: "SaaS subscription required." });
    return;
  }

  const tenantId = Number(req.params.id);
  const { name, description, settlementAccountId, isActive } = req.body;

  const [existing] = await db.select().from(saasTenantsTable)
    .where(and(eq(saasTenantsTable.id, tenantId), eq(saasTenantsTable.userId, req.userId!)));
  if (!existing) { res.status(404).json({ error: "NOT_FOUND" }); return; }

  if (settlementAccountId) {
    const [acct] = await db.select().from(settlementAccountsTable)
      .where(and(eq(settlementAccountsTable.id, settlementAccountId), eq(settlementAccountsTable.userId, req.userId!)));
    if (!acct) {
      res.status(400).json({ error: "INVALID_SETTLEMENT", message: "Settlement account not found or not yours" });
      return;
    }
  }

  const [updated] = await db.update(saasTenantsTable)
    .set({
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(settlementAccountId !== undefined && { settlementAccountId }),
      ...(isActive !== undefined && { isActive }),
    })
    .where(eq(saasTenantsTable.id, tenantId))
    .returning();

  res.json(updated);
});

// DELETE /api/saas/tenants/:id
router.delete("/saas/tenants/:id", requireAuth, async (req: AuthRequest, res) => {
  const tenantId = Number(req.params.id);
  const [existing] = await db.select().from(saasTenantsTable)
    .where(and(eq(saasTenantsTable.id, tenantId), eq(saasTenantsTable.userId, req.userId!)));
  if (!existing) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  await db.delete(saasTenantsTable).where(eq(saasTenantsTable.id, tenantId));
  res.json({ success: true });
});

// GET /api/saas/tenant/:tenantCode — API-key accessible, resolves tenant settlement info
router.get("/saas/tenant/:tenantCode", requireApiKey, async (req: ApiKeyRequest, res) => {
  const { tenantCode } = req.params;
  const [tenant] = await db
    .select({
      id: saasTenantsTable.id,
      name: saasTenantsTable.name,
      tenantCode: saasTenantsTable.tenantCode,
      isActive: saasTenantsTable.isActive,
      settlementAccountId: saasTenantsTable.settlementAccountId,
      settlementAccountName: settlementAccountsTable.accountName,
      settlementAccountType: settlementAccountsTable.accountType,
      settlementAccountNumber: settlementAccountsTable.accountNumber,
    })
    .from(saasTenantsTable)
    .leftJoin(settlementAccountsTable, eq(saasTenantsTable.settlementAccountId, settlementAccountsTable.id))
    .where(and(eq(saasTenantsTable.tenantCode, tenantCode), eq(saasTenantsTable.userId, req.apiKeyUserId!)));

  if (!tenant) { res.status(404).json({ error: "TENANT_NOT_FOUND", message: "Tenant not found" }); return; }
  if (!tenant.isActive) { res.status(403).json({ error: "TENANT_INACTIVE", message: "Tenant is inactive" }); return; }

  res.json(tenant);
});

export { getSaasStatus };
export default router;
