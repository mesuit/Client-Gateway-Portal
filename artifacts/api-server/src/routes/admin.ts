import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, settlementAccountsTable, transactionsTable, withdrawalRequestsTable } from "@workspace/db";
import { eq, count, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

// Middleware: require isAdmin flag
async function requireAdmin(req: AuthRequest, res: any, next: any) {
  const [user] = await db.select({ isAdmin: usersTable.isAdmin }).from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user?.isAdmin) {
    res.status(403).json({ error: "FORBIDDEN", message: "Admin access required" });
    return;
  }
  next();
}

// GET /admin/users — list all users
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

// GET /admin/users/:id — user detail
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

// POST /admin/users/:id/activate — manually activate a user
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

// GET /admin/withdrawals — list withdrawal requests with user info
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

// GET /admin/withdrawals/:id — withdrawal detail with settlement accounts
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

// POST /admin/withdrawals/:id/complete — mark as complete
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

// POST /admin/withdrawals/:id/reject — reject a withdrawal
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

export default router;
