import { Router } from "express";
import { db } from "@workspace/db";
import { paymentLinksTable, transactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { initiateSTKPush } from "../lib/mpesa";
import { logger } from "../lib/logger";

const router = Router();

router.get("/pay/:slug", async (req, res) => {
  const { slug } = req.params;

  const links = await db
    .select()
    .from(paymentLinksTable)
    .where(eq(paymentLinksTable.slug, slug));

  if (links.length === 0 || !links[0].isActive) {
    res.status(404).json({ error: "NOT_FOUND", message: "Payment link not found or inactive" });
    return;
  }

  const link = links[0];

  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    res.status(410).json({ error: "EXPIRED", message: "This payment link has expired" });
    return;
  }

  res.json({
    id: link.id,
    slug: link.slug,
    title: link.title,
    description: link.description,
    amount: link.amount,
    accountReference: link.accountReference,
    transactionDesc: link.transactionDesc,
  });
});

router.post("/pay/:slug", async (req, res) => {
  const { slug } = req.params;
  const { phoneNumber, amount: customAmount } = req.body;

  if (!phoneNumber) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "phoneNumber is required" });
    return;
  }

  const links = await db
    .select()
    .from(paymentLinksTable)
    .where(eq(paymentLinksTable.slug, slug));

  if (links.length === 0 || !links[0].isActive) {
    res.status(404).json({ error: "NOT_FOUND", message: "Payment link not found or inactive" });
    return;
  }

  const link = links[0];

  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    res.status(410).json({ error: "EXPIRED", message: "This payment link has expired" });
    return;
  }

  const finalAmount = link.amount ? Number(link.amount) : Number(customAmount);

  if (!finalAmount || finalAmount < 1) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Valid amount is required" });
    return;
  }

  const callbackUrl = `${req.protocol}://${req.get("host")}/api/payments/callback`;

  try {
    const result = await initiateSTKPush({
      phoneNumber,
      amount: finalAmount,
      accountReference: link.accountReference,
      transactionDesc: link.transactionDesc,
      callbackUrl,
    });

    const [tx] = await db.insert(transactionsTable).values({
      userId: link.userId,
      checkoutRequestId: result.CheckoutRequestID,
      merchantRequestId: result.MerchantRequestID,
      phoneNumber,
      amount: String(finalAmount),
      status: "pending",
      accountReference: link.accountReference,
      transactionDesc: link.transactionDesc,
    }).returning();

    res.json({
      checkoutRequestId: result.CheckoutRequestID,
      merchantRequestId: result.MerchantRequestID,
      responseCode: result.ResponseCode,
      customerMessage: result.CustomerMessage,
      transactionId: tx.id,
    });
  } catch (err) {
    logger.error(err, "STK Push via payment link failed");
    res.status(502).json({ error: "MPESA_ERROR", message: err instanceof Error ? err.message : "STK Push failed" });
  }
});

export default router;
