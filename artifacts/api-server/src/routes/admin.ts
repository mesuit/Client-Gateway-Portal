import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, settlementAccountsTable, transactionsTable, withdrawalRequestsTable } from "@workspace/db";
import { eq, count, sql, isNull } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { initiateB2C, getCallbackBaseUrl } from "../lib/mpesa";
import { logger } from "../lib/logger";

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

// GET /admin/stats — platform-wide totals
router.get("/admin/stats", requireAuth, requireAdmin, async (req, res) => {
  const [txStats] = await db.select({
    totalTransactions: sql<number>`COUNT(*)`,
    completedTransactions: sql<number>`COUNT(*) FILTER (WHERE status = 'completed')`,
    totalVolume: sql<string>`COALESCE(SUM(CASE WHEN status = 'completed' THEN amount::numeric ELSE 0 END), 0)::text`,
  }).from(transactionsTable);

  // Platform wallet = completed transactions with no settlement account (money collected by platform)
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

// POST /admin/users/:id/revoke — revoke active status, return to sandbox
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

// POST /admin/withdrawals/:id/complete — mark as complete and auto-trigger B2C settlement
router.post("/admin/withdrawals/:id/complete", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid ID" }); return; }

  const { note } = req.body;

  const [withdrawal] = await db
    .select()
    .from(withdrawalRequestsTable)
    .where(eq(withdrawalRequestsTable.id, id));

  if (!withdrawal) { res.status(404).json({ error: "NOT_FOUND", message: "Withdrawal not found" }); return; }
  if (withdrawal.status !== "pending") {
    res.status(400).json({ error: "ALREADY_PROCESSED", message: `Withdrawal is already ${withdrawal.status}` });
    return;
  }

  // Auto-trigger B2C if credentials are configured
  let b2cResult: { conversationId: string } | null = null;
  let b2cError: string | null = null;

  if (process.env.MPESA_INITIATOR_NAME && (process.env.MPESA_SECURITY_CREDENTIAL || process.env.MPESA_INITIATOR_PASSWORD)) {
    try {
      const baseUrl = getCallbackBaseUrl(req);
      const result = await initiateB2C({
        phoneNumber: withdrawal.phone,
        amount: Number(withdrawal.amount),
        commandId: "BusinessPayment",
        remarks: `Settlement for withdrawal #${id}`,
        occasion: `Nexus Pay settlement`,
        resultUrl: `${baseUrl}/api/admin/settlement/result`,
        timeoutUrl: `${baseUrl}/api/admin/settlement/timeout`,
      });
      b2cResult = { conversationId: result.ConversationID };
      logger.info({ withdrawalId: id, conversationId: result.ConversationID, phone: withdrawal.phone, amount: withdrawal.amount }, "Auto B2C settlement triggered");
    } catch (err) {
      b2cError = err instanceof Error ? err.message : "B2C failed";
      logger.error({ withdrawalId: id, err }, "Auto B2C settlement failed");
    }
  } else {
    b2cError = "B2C not configured — MPESA_INITIATOR_NAME and MPESA_SECURITY_CREDENTIAL required";
    logger.warn({ withdrawalId: id }, "B2C credentials not configured for auto settlement");
  }

  const rows = await db.update(withdrawalRequestsTable).set({
    status: b2cResult ? "processing" : "completed",
    note: b2cResult
      ? `B2C initiated — conversationId: ${b2cResult.conversationId}${note ? `. ${note}` : ""}`
      : (b2cError ? `Manual settlement required — ${b2cError}${note ? `. ${note}` : ""}` : note || null),
    processedAt: new Date(),
  }).where(eq(withdrawalRequestsTable.id, id)).returning();

  res.json({
    message: b2cResult
      ? `B2C settlement triggered — KES ${withdrawal.amount} → ${withdrawal.phone}`
      : `Marked as complete — ${b2cError ?? ""}`,
    withdrawal: rows[0],
    b2cConversationId: b2cResult?.conversationId ?? null,
    b2cError,
  });
});

// POST /api/admin/settlement/result — B2C result callback from Safaricom
router.post("/admin/settlement/result", async (req, res) => {
  try {
    const result = req.body?.Result;
    if (result?.ConversationID) {
      const conversationId: string = result.ConversationID;
      const resultCode: number = result.ResultCode;
      const resultDesc: string = result.ResultDesc;
      const status = resultCode === 0 ? "completed" : "failed";

      // Find withdrawal by conversationId in note field and update
      const allPending = await db.select().from(withdrawalRequestsTable)
        .where(eq(withdrawalRequestsTable.status, "processing"));
      const match = allPending.find(w => w.note?.includes(conversationId));
      if (match) {
        await db.update(withdrawalRequestsTable)
          .set({ status, note: `${match.note ?? ""} | B2C result: ${resultDesc}`, processedAt: new Date() })
          .where(eq(withdrawalRequestsTable.id, match.id));
      }
      logger.info({ conversationId, status, resultDesc }, "Admin settlement B2C result received");
    }
  } catch (err) {
    logger.error(err, "Admin settlement result callback error");
  }
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

// POST /api/admin/settlement/timeout
router.post("/admin/settlement/timeout", async (req, res) => {
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
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
