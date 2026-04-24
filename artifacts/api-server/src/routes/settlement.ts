import { Router } from "express";
import { db } from "@workspace/db";
import { settlementAccountsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

router.get("/settlement", requireAuth, async (req: AuthRequest, res) => {
  const accounts = await db
    .select()
    .from(settlementAccountsTable)
    .where(and(eq(settlementAccountsTable.userId, req.userId!), eq(settlementAccountsTable.isActive, true)));
  res.json(accounts);
});

router.post("/settlement", requireAuth, async (req: AuthRequest, res) => {
  const { accountType, accountNumber, accountName, isDefault } = req.body;

  if (!accountType || !accountNumber || !accountName) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "accountType, accountNumber and accountName are required" });
    return;
  }
  if (!["till", "paybill"].includes(accountType)) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "accountType must be 'till' or 'paybill'" });
    return;
  }

  if (isDefault) {
    await db
      .update(settlementAccountsTable)
      .set({ isDefault: false })
      .where(eq(settlementAccountsTable.userId, req.userId!));
  }

  const [account] = await db.insert(settlementAccountsTable).values({
    userId: req.userId!,
    accountType,
    accountNumber,
    accountName,
    isDefault: isDefault ?? false,
  }).returning();

  res.status(201).json(account);
});

router.put("/settlement/:accountId", requireAuth, async (req: AuthRequest, res) => {
  const accountId = parseInt(req.params.accountId);
  if (isNaN(accountId)) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid account ID" });
    return;
  }

  const { accountType, accountNumber, accountName, isDefault } = req.body;

  if (!accountType || !accountNumber || !accountName) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "accountType, accountNumber and accountName are required" });
    return;
  }
  if (!["till", "paybill"].includes(accountType)) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "accountType must be 'till' or 'paybill'" });
    return;
  }

  if (isDefault) {
    await db
      .update(settlementAccountsTable)
      .set({ isDefault: false })
      .where(eq(settlementAccountsTable.userId, req.userId!));
  }

  const rows = await db
    .update(settlementAccountsTable)
    .set({ accountType, accountNumber, accountName, isDefault: isDefault ?? false })
    .where(and(eq(settlementAccountsTable.id, accountId), eq(settlementAccountsTable.userId, req.userId!)))
    .returning();

  if (rows.length === 0) {
    res.status(404).json({ error: "NOT_FOUND", message: "Settlement account not found" });
    return;
  }

  res.json(rows[0]);
});

router.delete("/settlement/:accountId", requireAuth, async (req: AuthRequest, res) => {
  const accountId = parseInt(req.params.accountId);
  if (isNaN(accountId)) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid account ID" });
    return;
  }

  const rows = await db
    .update(settlementAccountsTable)
    .set({ isActive: false })
    .where(and(eq(settlementAccountsTable.id, accountId), eq(settlementAccountsTable.userId, req.userId!)))
    .returning();

  if (rows.length === 0) {
    res.status(404).json({ error: "NOT_FOUND", message: "Settlement account not found" });
    return;
  }

  res.json({ message: "Settlement account deleted successfully" });
});

router.post("/settlement/:accountId/default", requireAuth, async (req: AuthRequest, res) => {
  const accountId = parseInt(req.params.accountId);
  if (isNaN(accountId)) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid account ID" });
    return;
  }

  await db
    .update(settlementAccountsTable)
    .set({ isDefault: false })
    .where(eq(settlementAccountsTable.userId, req.userId!));

  const rows = await db
    .update(settlementAccountsTable)
    .set({ isDefault: true })
    .where(and(eq(settlementAccountsTable.id, accountId), eq(settlementAccountsTable.userId, req.userId!)))
    .returning();

  if (rows.length === 0) {
    res.status(404).json({ error: "NOT_FOUND", message: "Settlement account not found" });
    return;
  }

  res.json({ message: "Default settlement account updated" });
});

export default router;
