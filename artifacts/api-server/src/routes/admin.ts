import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  settlementAccountsTable,
  transactionsTable,
  withdrawalRequestsTable,
  systemSettingsTable,
  securityEventsTable,
} from "@workspace/db";
import { eq, count, sql, isNull, desc } from "drizzle-orm";
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

export default router;
