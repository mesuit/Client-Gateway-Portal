import { db } from "@workspace/db";
import { webhooksTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { logger } from "./logger";

export async function fireWebhooks(userId: number, event: string, data: object): Promise<void> {
  const webhooks = await db
    .select()
    .from(webhooksTable)
    .where(and(eq(webhooksTable.userId, userId), eq(webhooksTable.isActive, true)));

  if (webhooks.length === 0) return;

  const timestamp = new Date().toISOString();

  for (const webhook of webhooks) {
    const events = webhook.events.split(",").map((e) => e.trim());
    if (!events.includes(event)) continue;

    const body = JSON.stringify({ event, data, timestamp });
    const sig = crypto.createHmac("sha256", webhook.secret).update(body).digest("hex");

    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": `sha256=${sig}`,
          "X-Webhook-Event": event,
          "X-Webhook-Timestamp": timestamp,
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(tid);
      logger.info({ userId, webhookId: webhook.id, event, status: response.status }, "Webhook delivered");
    } catch (err) {
      logger.warn({ userId, webhookId: webhook.id, event, err }, "Webhook delivery failed");
    }
  }
}
