import { logger } from "./logger";

/**
 * This function sends the payment info to a developer's URL.
 */
export async function dispatchWebhook(url: string, data: any) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "NexusPay-Webhook-Dispatcher/1.0",
      },
      body: JSON.stringify({
        event: "payment.completed",
        data: data,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      logger.warn({ url, status: response.status }, "Webhook sent but the other server gave an error");
    } else {
      logger.info({ url }, "Webhook delivered successfully!");
    }
  } catch (err) {
    logger.error({ err, url }, "Failed to send webhook. Is the URL correct?");
  }
}
