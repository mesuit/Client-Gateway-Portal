import { Router } from "express";
import { db } from "@workspace/db";
import { paymentLinksTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { nanoid } from "nanoid";

const router = Router();

router.post("/payment-links", requireAuth, async (req: AuthRequest, res) => {
  const { title, description, amount, accountReference, transactionDesc, expiresAt } = req.body;

  if (!title || !accountReference || !transactionDesc) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "title, accountReference, and transactionDesc are required" });
    return;
  }

  const slug = nanoid(10);

  const [link] = await db.insert(paymentLinksTable).values({
    userId: req.userId!,
    slug,
    title,
    description: description || null,
    amount: amount ? String(amount) : null,
    accountReference,
    transactionDesc,
    isActive: true,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  }).returning();

  res.status(201).json(link);
});

router.get("/payment-links", requireAuth, async (req: AuthRequest, res) => {
  const links = await db
    .select()
    .from(paymentLinksTable)
    .where(eq(paymentLinksTable.userId, req.userId!));
  res.json(links);
});

router.delete("/payment-links/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await db
    .update(paymentLinksTable)
    .set({ isActive: false })
    .where(and(eq(paymentLinksTable.id, id), eq(paymentLinksTable.userId, req.userId!)));
  res.json({ message: "Payment link deactivated" });
});

export default router;
