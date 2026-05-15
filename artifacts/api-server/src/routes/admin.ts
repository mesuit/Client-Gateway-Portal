import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  settlementAccountsTable,
  transactionsTable,
  withdrawalRequestsTable,
  systemSettingsTable,
  securityEventsTable,
  b2cTransactionsTable,
  pesapalTransactionsTable,
  activationPaymentsTable,
} from "@workspace/db";
import { eq, count, sql, isNull, desc, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { logSecurityEvent } from "../lib/securityLogger";
import { invalidateMpesaSettingsCache } from "../lib/mpesa";

const router = Router();

async function requireAdmin(req: AuthRequest, res: any, next: any) {
  const [user] = await db.select({ isAdmin: usersTable.isAdmin, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user?.isAdmin) {
    logSecurityEvent({
      eventType: "unauthorized_admin",
      severity: "high",
      description: `Non-admin user attempted to access admin route: ${req.method} ${req.path}`,
      req,
      userId: req.userId,
      email: user?.email,
    });
    res.status(403).json({ error: "FORBIDDEN", message: "Admin access required" });
    return;
  }
  next();
}

// GET /admin/stats
router.get("/admin/stats", requireAuth, requireAdmin, async (req, res) => {
  const [txStats] = await db.select({
    totalTransactions: sql<number>`COUNT(*)`,
    completedTransactions: sql<number>`COUNT(*) FILTER (WHERE status = 'completed')`,
    totalVolume: sql<string>`COALESCE(SUM(CASE WHEN status = 'completed' THEN amount::numeric ELSE 0 END), 0)::text`,
  }).from(transactionsTable);

  const [walletStats] = await db.select({
    walletBalance: sql<string>`COALESCE(SUM(CASE WHEN status = 'completed' THEN amount::numeric ELSE 0 END), 0)::text`,
    walletTxCount: sql<number>`COUNT(*) FILTER (WHERE status = 'completed')`,
  }).from(transactionsTable).where(isNull(transactionsTable.settlementAccountId));

  const [withdrawn] = await db.select({
    totalWithdrawn: sql<string>`COALESCE(SUM(amount::numeric) FILTER (WHERE status IN ('pending', 'processing', 'completed')), 0)::text`,
  }).from(withdrawalRequestsTable);

  const walletBalance = Number(walletStats.walletBalance);
  const totalWithdrawn = Number(withdrawn.totalWithdrawn);

  res.json({
    totalTransactions: Number(txStats.totalTransactions),
    completedTransactions: Number(txStats.completedTransactions),
    totalVolume: txStats.totalVolume,
    walletBalance: walletStats.walletBalance,
    walletAvailable: String(Math.max(0, walletBalance - totalWithdrawn)),
    walletTxCount: Number(walletStats.walletTxCount),
    totalWithdrawn: withdrawn.totalWithdrawn,
  });
});

// GET /admin/users
router.get("/admin/users", requireAuth, requireAdmin, async (req, res) => {
  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      businessName: usersTable.businessName,
      mode: usersTable.mode,
      isAdmin: usersTable.isAdmin,
      subscriptionType: usersTable.subscriptionType,
      subscriptionExpiresAt: usersTable.subscriptionExpiresAt,
      activatedAt: usersTable.activatedAt,
      sandboxTransactionsUsed: usersTable.sandboxTransactionsUsed,
      createdAt: usersTable.createdAt,
      txCount: sql<number>`(SELECT COUNT(*) FROM transactions WHERE user_id = ${usersTable.id})`,
      totalVolume: sql<string>`COALESCE((SELECT SUM(amount::numeric) FROM transactions WHERE user_id = ${usersTable.id} AND status = 'completed'), 0)::text`,
    })
    .from(usersTable)
    .orderBy(sql`${usersTable.createdAt} DESC`);

  res.json(users);
});

// GET /admin/users/:id
router.get("/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId)) { res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid user ID" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "NOT_FOUND", message: "User not found" }); return; }

  const settlements = await db.select().from(settlementAccountsTable)
    .where(eq(settlementAccountsTable.userId, userId));

  const [stats] = await db.select({
    txCount: count(),
    completed: sql<number>`COUNT(*) FILTER (WHERE status = 'completed')`,
    totalVolume: sql<string>`COALESCE(SUM(CASE WHEN status = 'completed' THEN amount::numeric ELSE 0 END), 0)::text`,
  }).from(transactionsTable).where(eq(transactionsTable.userId, userId));

  res.json({
    user: {
      id: user.id,
      email: user.email,
      businessName: user.businessName,
      mode: user.mode,
      isAdmin: user.isAdmin,
      subscriptionType: user.subscriptionType,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      activatedAt: user.activatedAt,
      sandboxTransactionsUsed: user.sandboxTransactionsUsed,
      createdAt: user.createdAt,
    },
    settlements,
    stats,
  });
});

// POST /admin/users/:id/revoke
router.post("/admin/users/:id/revoke", requireAuth, requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId)) { res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid user ID" }); return; }

  await db.update(usersTable).set({
    mode: "sandbox",
    subscriptionType: null,
    subscriptionExpiresAt: null,
    activatedAt: null,
    sandboxTransactionsUsed: 0,
  }).where(eq(usersTable.id, userId));

  res.json({ message: "User revoked to sandbox" });
});

// POST /admin/users/:id/activate
router.post("/admin/users/:id/activate", requireAuth, requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId)) { res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid user ID" }); return; }

  const { plan = "monthly" } = req.body;
  const now = new Date();
  const expiresAt = new Date(now);
  if (plan === "yearly") expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  else expiresAt.setDate(expiresAt.getDate() + 30);

  await db.update(usersTable).set({
    mode: "active",
    subscriptionType: plan,
    subscriptionExpiresAt: expiresAt,
    activatedAt: now,
  }).where(eq(usersTable.id, userId));

  res.json({ message: "User activated successfully" });
});

// GET /admin/withdrawals
router.get("/admin/withdrawals", requireAuth, requireAdmin, async (req, res) => {
  const rows = await db
    .select({
      id: withdrawalRequestsTable.id,
      amount: withdrawalRequestsTable.amount,
      phone: withdrawalRequestsTable.phone,
      status: withdrawalRequestsTable.status,
      note: withdrawalRequestsTable.note,
      processedAt: withdrawalRequestsTable.processedAt,
      createdAt: withdrawalRequestsTable.createdAt,
      userId: withdrawalRequestsTable.userId,
      email: usersTable.email,
      businessName: usersTable.businessName,
    })
    .from(withdrawalRequestsTable)
    .leftJoin(usersTable, eq(withdrawalRequestsTable.userId, usersTable.id))
    .orderBy(sql`${withdrawalRequestsTable.createdAt} DESC`);

  res.json(rows);
});

// GET /admin/withdrawals/:id
router.get("/admin/withdrawals/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid ID" }); return; }

  const [row] = await db.select({
    id: withdrawalRequestsTable.id,
    amount: withdrawalRequestsTable.amount,
    phone: withdrawalRequestsTable.phone,
    status: withdrawalRequestsTable.status,
    createdAt: withdrawalRequestsTable.createdAt,
    userId: withdrawalRequestsTable.userId,
    email: usersTable.email,
    businessName: usersTable.businessName,
  })
    .from(withdrawalRequestsTable)
    .leftJoin(usersTable, eq(withdrawalRequestsTable.userId, usersTable.id))
    .where(eq(withdrawalRequestsTable.id, id));

  if (!row) { res.status(404).json({ error: "NOT_FOUND", message: "Withdrawal not found" }); return; }

  const settlements = await db.select().from(settlementAccountsTable)
    .where(eq(settlementAccountsTable.userId, row.userId!));

  res.json({ withdrawal: row, settlements });
});

// POST /admin/withdrawals/:id/complete
router.post("/admin/withdrawals/:id/complete", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid ID" }); return; }

  const { note } = req.body;
  const rows = await db.update(withdrawalRequestsTable).set({
    status: "completed",
    note: note || null,
    processedAt: new Date(),
  }).where(eq(withdrawalRequestsTable.id, id)).returning();

  if (rows.length === 0) { res.status(404).json({ error: "NOT_FOUND", message: "Withdrawal not found" }); return; }
  res.json({ message: "Withdrawal marked as complete", withdrawal: rows[0] });
});

// POST /admin/withdrawals/:id/reject
router.post("/admin/withdrawals/:id/reject", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid ID" }); return; }

  const { note } = req.body;
  const rows = await db.update(withdrawalRequestsTable).set({
    status: "rejected",
    note: note || null,
    processedAt: new Date(),
  }).where(eq(withdrawalRequestsTable.id, id)).returning();

  if (rows.length === 0) { res.status(404).json({ error: "NOT_FOUND", message: "Withdrawal not found" }); return; }
  res.json({ message: "Withdrawal rejected", withdrawal: rows[0] });
});

// ─── System Settings ──────────────────────────────────────────────────────────

const SETTING_KEYS = [
  "mpesa_consumer_key",
  "mpesa_consumer_secret",
  "mpesa_passkey",
  "mpesa_shortcode",
  "b2c_consumer_key",
  "b2c_consumer_secret",
  "b2c_shortcode",
  "mpesa_initiator_name",
  "mpesa_security_credential",
  "mpesa_initiator_password",
  "callback_base_url",
];

// GET /admin/settings — returns current settings (sensitive values masked)
router.get("/admin/settings", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const rows = await db.select().from(systemSettingsTable);
  const settingsMap: Record<string, string | null> = {};
  for (const row of rows) {
    settingsMap[row.key] = row.value;
  }

  const SENSITIVE = ["mpesa_consumer_secret", "mpesa_passkey", "mpesa_security_credential", "mpesa_initiator_password", "b2c_consumer_secret"];

  const result = SETTING_KEYS.map(key => ({
    key,
    value: settingsMap[key] ?? null,
    masked: SENSITIVE.includes(key) && !!settingsMap[key],
    updatedAt: rows.find(r => r.key === key)?.updatedAt ?? null,
  }));

  res.json(result);
});

// PUT /admin/settings — upsert settings
router.put("/admin/settings", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const updates: Record<string, string> = req.body;

  if (!updates || typeof updates !== "object") {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Body must be a key-value object" });
    return;
  }

  const allowedKeys = new Set(SETTING_KEYS);
  const toUpsert: { key: string; value: string; updatedBy: number }[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (!allowedKeys.has(key)) continue;
    if (typeof value !== "string") continue;
    toUpsert.push({ key, value: value.trim(), updatedBy: req.userId! });
  }

  if (toUpsert.length === 0) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "No valid settings provided" });
    return;
  }

  for (const item of toUpsert) {
    await db
      .insert(systemSettingsTable)
      .values({ key: item.key, value: item.value, updatedBy: item.updatedBy })
      .onConflictDoUpdate({
        target: systemSettingsTable.key,
        set: { value: item.value, updatedBy: item.updatedBy, updatedAt: new Date() },
      });
  }

  invalidateMpesaSettingsCache();

  res.json({ message: `${toUpsert.length} setting(s) saved successfully` });
});

// ─── Transaction Monitor ──────────────────────────────────────────────────────

// GET /admin/transactions — all transactions across all accounts, merged + fraud-flagged
router.get("/admin/transactions", requireAuth, requireAdmin, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 500, 2000);

  // STK Push transactions
  const stkRows = await db
    .select({
      id: transactionsTable.id,
      type: sql<string>`'stk'`,
      merchantId: transactionsTable.userId,
      merchantEmail: usersTable.email,
      merchantName: usersTable.businessName,
      phone: transactionsTable.phoneNumber,
      amount: transactionsTable.amount,
      status: transactionsTable.status,
      receipt: transactionsTable.mpesaReceiptNumber,
      description: transactionsTable.transactionDesc,
      createdAt: transactionsTable.createdAt,
    })
    .from(transactionsTable)
    .leftJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(limit);

  // B2C outgoing transactions
  const b2cRows = await db
    .select({
      id: b2cTransactionsTable.id,
      type: sql<string>`'b2c'`,
      merchantId: b2cTransactionsTable.userId,
      merchantEmail: usersTable.email,
      merchantName: usersTable.businessName,
      phone: b2cTransactionsTable.phoneNumber,
      amount: b2cTransactionsTable.amount,
      status: b2cTransactionsTable.status,
      receipt: b2cTransactionsTable.mpesaReceiptNumber,
      description: b2cTransactionsTable.remarks,
      createdAt: b2cTransactionsTable.createdAt,
    })
    .from(b2cTransactionsTable)
    .leftJoin(usersTable, eq(b2cTransactionsTable.userId, usersTable.id))
    .orderBy(desc(b2cTransactionsTable.createdAt))
    .limit(limit);

  // PesaPal (card / Airtel) transactions
  const pesapalRows = await db
    .select({
      id: pesapalTransactionsTable.id,
      type: sql<string>`'pesapal'`,
      merchantId: pesapalTransactionsTable.userId,
      merchantEmail: usersTable.email,
      merchantName: usersTable.businessName,
      phone: pesapalTransactionsTable.phoneNumber,
      amount: pesapalTransactionsTable.amount,
      status: pesapalTransactionsTable.status,
      receipt: pesapalTransactionsTable.orderTrackingId,
      description: pesapalTransactionsTable.description,
      createdAt: pesapalTransactionsTable.createdAt,
    })
    .from(pesapalTransactionsTable)
    .leftJoin(usersTable, eq(pesapalTransactionsTable.userId, usersTable.id))
    .orderBy(desc(pesapalTransactionsTable.createdAt))
    .limit(limit);

  // Merge and sort all by createdAt desc
  const merged = [...stkRows, ...b2cRows, ...pesapalRows]
    .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
    .slice(0, limit);

  // Build phone → failed count map for repeated failure detection
  const phoneFailCount: Record<string, number> = {};
  for (const tx of merged) {
    if (tx.status === "failed" && tx.phone) {
      phoneFailCount[tx.phone] = (phoneFailCount[tx.phone] ?? 0) + 1;
    }
  }

  // Build merchantId → timestamps list for rapid succession detection
  const merchantTimes: Record<number, number[]> = {};
  for (const tx of merged) {
    if (tx.merchantId && tx.createdAt) {
      if (!merchantTimes[tx.merchantId]) merchantTimes[tx.merchantId] = [];
      merchantTimes[tx.merchantId].push(new Date(tx.createdAt).getTime());
    }
  }

  const result = merged.map(tx => {
    const flags: string[] = [];
    const amt = Number(tx.amount);
    if (amt >= 50000) flags.push("large_amount");
    if (tx.status === "failed" && tx.phone && (phoneFailCount[tx.phone] ?? 0) >= 3) {
      flags.push("repeated_failure");
    }
    // Rapid succession: merchant made 5+ transactions within any 5-minute window
    if (tx.merchantId && merchantTimes[tx.merchantId]) {
      const times = merchantTimes[tx.merchantId];
      const txTime = new Date(tx.createdAt!).getTime();
      const window = 5 * 60 * 1000;
      const nearby = times.filter(t => Math.abs(t - txTime) <= window);
      if (nearby.length >= 5) flags.push("rapid_succession");
    }
    return { ...tx, amount: String(tx.amount), flags };
  });

  res.json(result);
});

// ─── Security Events ──────────────────────────────────────────────────────────

// GET /admin/security-events
router.get("/admin/security-events", requireAuth, requireAdmin, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);

  const events = await db
    .select()
    .from(securityEventsTable)
    .orderBy(desc(securityEventsTable.createdAt))
    .limit(limit);

  res.json(events);
});

// DELETE /admin/security-events — clear all events
router.delete("/admin/security-events", requireAuth, requireAdmin, async (req, res) => {
  await db.delete(securityEventsTable);
  res.json({ message: "Security events cleared" });
});

// ─── Profit Calculation ───────────────────────────────────────────────────────

// GET /admin/profit — calculate platform profit breakdown
router.get("/admin/profit", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const [actResult] = await db.select({
    total: sql<string>`COALESCE(SUM(amount::numeric), 0)::text`,
  }).from(activationPaymentsTable).where(sql`status = 'completed'`);

  const [b2cFeeResult] = await db.select({
    total: sql<string>`COALESCE(SUM(fee_amount::numeric), 0)::text`,
  }).from(b2cTransactionsTable).where(and(
    sql`status = 'completed'`,
    sql`fee_amount IS NOT NULL`
  ));

  const [pesapalFeeResult] = await db.select({
    total: sql<string>`COALESCE(SUM(platform_fee::numeric), 0)::text`,
  }).from(pesapalTransactionsTable).where(sql`status = 'completed'`);

  const [wdrFeeResult] = await db.select({
    total: sql<string>`COALESCE(SUM(amount::numeric) * 0.025, 0)::text`,
  }).from(withdrawalRequestsTable).where(sql`status = 'completed' AND (note IS NULL OR note NOT LIKE 'PROFIT:%')`);

  const [profitWdnResult] = await db.select({
    total: sql<string>`COALESCE(SUM(amount::numeric), 0)::text`,
  }).from(withdrawalRequestsTable).where(sql`note LIKE 'PROFIT:%' AND status IN ('pending', 'processing', 'completed')`);

  const activationFees = Number(actResult.total);
  const b2cFees = Number(b2cFeeResult.total);
  const pesapalFees = Number(pesapalFeeResult.total);
  const withdrawalFees = Number(wdrFeeResult.total);
  const totalProfit = activationFees + b2cFees + pesapalFees + withdrawalFees;
  const profitWithdrawn = Number(profitWdnResult.total);
  const profitAvailable = Math.max(0, totalProfit - profitWithdrawn);

  res.json({
    activationFees: activationFees.toFixed(2),
    b2cFees: b2cFees.toFixed(2),
    pesapalFees: pesapalFees.toFixed(2),
    withdrawalFees: withdrawalFees.toFixed(2),
    totalProfit: totalProfit.toFixed(2),
    profitWithdrawn: profitWithdrawn.toFixed(2),
    profitAvailable: profitAvailable.toFixed(2),
  });
});

// POST /admin/withdraw-profit — record a profit withdrawal (manual B2C)
router.post("/admin/withdraw-profit", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const { amount, phone, note } = req.body;
  if (!amount || !phone) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "amount and phone are required" });
    return;
  }
  const requestAmount = Number(amount);
  if (isNaN(requestAmount) || requestAmount <= 0) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid amount" });
    return;
  }

  // Check available profit
  const [actResult] = await db.select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)::text` }).from(activationPaymentsTable).where(sql`status = 'completed'`);
  const [b2cFeeResult] = await db.select({ total: sql<string>`COALESCE(SUM(fee_amount::numeric), 0)::text` }).from(b2cTransactionsTable).where(sql`status = 'completed' AND fee_amount IS NOT NULL`);
  const [pesapalFeeResult] = await db.select({ total: sql<string>`COALESCE(SUM(platform_fee::numeric), 0)::text` }).from(pesapalTransactionsTable).where(sql`status = 'completed'`);
  const [wdrFeeResult] = await db.select({ total: sql<string>`COALESCE(SUM(amount::numeric) * 0.025, 0)::text` }).from(withdrawalRequestsTable).where(sql`status = 'completed' AND (note IS NULL OR note NOT LIKE 'PROFIT:%')`);
  const [profitWdnResult] = await db.select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)::text` }).from(withdrawalRequestsTable).where(sql`note LIKE 'PROFIT:%' AND status IN ('pending', 'processing', 'completed')`);

  const totalProfit = Number(actResult.total) + Number(b2cFeeResult.total) + Number(pesapalFeeResult.total) + Number(wdrFeeResult.total);
  const profitAvailable = Math.max(0, totalProfit - Number(profitWdnResult.total));

  if (requestAmount > profitAvailable) {
    res.status(400).json({
      error: "INSUFFICIENT_PROFIT",
      message: `Only KES ${profitAvailable.toFixed(2)} available as profit`,
      profitAvailable: profitAvailable.toFixed(2),
    });
    return;
  }

  const [record] = await db.insert(withdrawalRequestsTable).values({
    userId: req.userId!,
    amount: String(requestAmount),
    phone,
    status: "pending",
    note: `PROFIT: ${note || "Admin profit withdrawal"}`,
  }).returning();

  res.status(201).json({ message: "Profit withdrawal recorded", withdrawal: record });
});

export default router;
