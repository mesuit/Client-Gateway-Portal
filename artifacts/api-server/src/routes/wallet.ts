import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable, withdrawalRequestsTable } from "@workspace/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

// GET /wallet/balance — platform-collected balance (no settlement account)
router.get("/wallet/balance", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;

  const [result] = await db
    .select({
      balance: sql<string>`COALESCE(SUM(CASE WHEN ${transactionsTable.status} = 'completed' THEN ${transactionsTable.amount}::numeric ELSE 0 END), 0)::text`,
      txCount: sql<number>`COUNT(*) FILTER (WHERE ${transactionsTable.status} = 'completed')`,
    })
    .from(transactionsTable)
    .where(and(
      eq(transactionsTable.userId, userId),
      isNull(transactionsTable.settlementAccountId)
    ));

  const [withdrawn] = await db
    .select({
      total: sql<string>`COALESCE(SUM(amount::numeric), 0)::text`,
    })
    .from(withdrawalRequestsTable)
    .where(and(
      eq(withdrawalRequestsTable.userId, userId),
      sql`${withdrawalRequestsTable.status} IN ('pending', 'processing', 'completed')`
    ));

  const balance = Number(result.balance);
  const totalWithdrawn = Number(withdrawn.total);
  const available = Math.max(0, balance - totalWithdrawn);

  res.json({
    totalCollected: result.balance,
    totalWithdrawn: withdrawn.total,
    available: String(available),
    txCount: Number(result.txCount),
  });
});

// GET /wallet/withdrawals — list withdrawal requests
router.get("/wallet/withdrawals", requireAuth, async (req: AuthRequest, res) => {
  const requests = await db
    .select()
    .from(withdrawalRequestsTable)
    .where(eq(withdrawalRequestsTable.userId, req.userId!))
    .orderBy(sql`${withdrawalRequestsTable.createdAt} DESC`);
  res.json(requests);
});

// POST /wallet/withdraw — request a withdrawal
router.post("/wallet/withdraw", requireAuth, async (req: AuthRequest, res) => {
  const { amount, phone } = req.body;

  if (!amount || !phone) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "amount and phone are required" });
    return;
  }

  const requestAmount = Number(amount);
  if (requestAmount < 10) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Minimum withdrawal is KES 10" });
    return;
  }

  // Check available balance
  const [result] = await db
    .select({
      balance: sql<string>`COALESCE(SUM(CASE WHEN ${transactionsTable.status} = 'completed' THEN ${transactionsTable.amount}::numeric ELSE 0 END), 0)::text`,
    })
    .from(transactionsTable)
    .where(and(
      eq(transactionsTable.userId, req.userId!),
      isNull(transactionsTable.settlementAccountId)
    ));

  const [withdrawn] = await db
    .select({
      total: sql<string>`COALESCE(SUM(amount::numeric), 0)::text`,
    })
    .from(withdrawalRequestsTable)
    .where(and(
      eq(withdrawalRequestsTable.userId, req.userId!),
      sql`${withdrawalRequestsTable.status} IN ('pending', 'processing', 'completed')`
    ));

  const available = Math.max(0, Number(result.balance) - Number(withdrawn.total));

  if (requestAmount > available) {
    res.status(400).json({
      error: "INSUFFICIENT_BALANCE",
      message: `Available balance is KES ${available.toFixed(2)}`,
    });
    return;
  }

  const [request] = await db.insert(withdrawalRequestsTable).values({
    userId: req.userId!,
    amount: String(requestAmount),
    phone: String(phone).replace(/\D/g, ""),
    status: "pending",
  }).returning();

  res.status(201).json(request);
});

export default router;
