import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable } from "@workspace/db";
import { eq, and, count, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

router.get("/transactions", requireAuth, async (req: AuthRequest, res) => {
  const page = parseInt(String(req.query.page ?? "1"));
  const limit = Math.min(parseInt(String(req.query.limit ?? "20")), 100);
  const status = req.query.status as string | undefined;
  const offset = (page - 1) * limit;

  const conditions = [eq(transactionsTable.userId, req.userId!)];
  if (status) {
    conditions.push(eq(transactionsTable.status, status));
  }

  const [{ total }] = await db
    .select({ total: count() })
    .from(transactionsTable)
    .where(and(...conditions));

  const transactions = await db
    .select()
    .from(transactionsTable)
    .where(and(...conditions))
    .orderBy(sql`${transactionsTable.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  res.json({
    transactions: transactions.map((tx) => ({
      id: tx.id,
      checkoutRequestId: tx.checkoutRequestId,
      mpesaReceiptNumber: tx.mpesaReceiptNumber,
      phoneNumber: tx.phoneNumber,
      amount: tx.amount,
      status: tx.status,
      accountReference: tx.accountReference,
      transactionDesc: tx.transactionDesc,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
    })),
    total,
    page,
    limit,
  });
});

export default router;
