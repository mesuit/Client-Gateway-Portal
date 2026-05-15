import { Router } from "express";
import { db } from "@workspace/db";
import { webhooksTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { logger } from "../lib/logger";
import crypto from "crypto";

const router = Router();

// GET /webhooks — list merchant's webhooks
router.get("/webhooks", requireAuth, async (req: AuthRequest, res) => {
  const rows = await db
    .select()
    .from(webhooksTable)
    .where(eq(webhooksTable.userId, req.userId!))
    .orderBy(webhooksTable.createdAt);
  res.json(rows.map(w => ({ ...w, secret: `${w.secret.slice(0, 8)}…` })));
});

// POST /webhooks — create a webhook
router.post("/webhooks", requireAuth, async (req: AuthRequest, res) => {
  const { url, events } = req.body;
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "url is required" });
    return;
  }
  try {
    new URL(url);
  } catch {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "url must be a valid HTTPS URL" });
    return;
  }

  const existing = await db.select().from(webhooksTable).where(eq(webhooksTable.userId, req.userId!));
  if (existing.length >= 5) {
    res.status(400).json({ error: "LIMIT_EXCEEDED", message: "Maximum 5 webhooks allowed per account" });
    return;
  }

  const secret = `whsec_${crypto.randomBytes(24).toString("hex")}`;
  const allowedEvents = ["payment.completed", "payment.failed", "payment.cancelled", "subscription.activated"];
  const eventList = Array.isArray(events)
    ? events.filter((e: string) => allowedEvents.includes(e)).join(",")
    : "payment.completed,payment.failed";

  const [webhook] = await db.insert(webhooksTable).values({
    userId: req.userId!,
    url,
    secret,
    events: eventList || "payment.completed,payment.failed",
    isActive: true,
  }).returning();

  logger.info({ userId: req.userId, webhookId: webhook.id, url }, "Webhook created");
  res.status(201).json({ ...webhook });
});

// PATCH /webhooks/:id — toggle active / update events
router.patch("/webhooks/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params["id"]));
  const [existing] = await db.select().from(webhooksTable).where(
    and(eq(webhooksTable.id, id), eq(webhooksTable.userId, req.userId!))
  );
  if (!existing) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  const updates: Partial<typeof existing> = {};
  if (typeof req.body.isActive === "boolean") updates.isActive = req.body.isActive;
  if (Array.isArray(req.body.events)) {
    const allowed = ["payment.completed", "payment.failed", "payment.cancelled"];
    updates.events = req.body.events.filter((e: string) => allowed.includes(e)).join(",");
  }
  const [updated] = await db.update(webhooksTable).set(updates).where(eq(webhooksTable.id, id)).returning();
  res.json({ ...updated, secret: `${updated.secret.slice(0, 8)}…` });
});

// DELETE /webhooks/:id — delete a webhook
router.delete("/webhooks/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params["id"]));
  const rows = await db.delete(webhooksTable).where(
    and(eq(webhooksTable.id, id), eq(webhooksTable.userId, req.userId!))
  ).returning();
  if (rows.length === 0) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  logger.info({ userId: req.userId, webhookId: id }, "Webhook deleted");
  res.json({ message: "Webhook deleted" });
});

export default router;
