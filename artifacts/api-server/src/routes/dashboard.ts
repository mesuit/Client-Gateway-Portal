import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable } from "@workspace/db";
import { eq, and, sql, count, sum } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

router.get("/dashboard/stats", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;

  const [totals] = await db
    .select({
      total: count(),
      successful: sql<number>`COUNT(*) FILTER (WHERE ${transactionsTable.status} = 'completed')`,
      failed: sql<number>`COUNT(*) FILTER (WHERE ${transactionsTable.status} = 'failed')`,
      pending: sql<number>`COUNT(*) FILTER (WHERE ${transactionsTable.status} = 'pending')`,
      cancelled: sql<number>`COUNT(*) FILTER (WHERE ${transactionsTable.status} = 'cancelled')`,
      totalVolume: sql<string>`COALESCE(SUM(CASE WHEN ${transactionsTable.status} = 'completed' THEN ${transactionsTable.amount}::numeric ELSE 0 END), 0)::text`,
    })
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, userId));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [todayStats] = await db
    .select({
      todayVolume: sql<string>`COALESCE(SUM(CASE WHEN ${transactionsTable.status} = 'completed' THEN ${transactionsTable.amount}::numeric ELSE 0 END), 0)::text`,
      todayCount: count(),
    })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.userId, userId), sql`${transactionsTable.createdAt} >= ${today}`));

  const total = Number(totals.total);
  const successful = Number(totals.successful);
  const successRate = total > 0 ? (successful / total) * 100 : 0;

  res.json({
    totalTransactions: total,
    successfulTransactions: successful,
    failedTransactions: Number(totals.failed),
    pendingTransactions: Number(totals.pending),
    totalVolume: totals.totalVolume,
    todayVolume: todayStats.todayVolume,
    todayTransactions: Number(todayStats.todayCount),
    successRate: Math.round(successRate * 100) / 100,
  });
});

export default router;
