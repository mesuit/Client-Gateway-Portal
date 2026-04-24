import { db } from "@workspace/db";
import { apiKeysTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";

export interface ApiKeyRequest extends Request {
  apiKeyUserId?: number;
  apiKeyId?: number;
}

export async function requireApiKey(req: ApiKeyRequest, res: Response, next: NextFunction): Promise<void> {
  const apiKey = req.headers["x-api-key"] as string | undefined;

  if (!apiKey) {
    res.status(401).json({ error: "Unauthorized", message: "Missing X-API-Key header" });
    return;
  }

  const rows = await db
    .select({ userId: apiKeysTable.userId, keyId: apiKeysTable.id })
    .from(apiKeysTable)
    .innerJoin(usersTable, eq(apiKeysTable.userId, usersTable.id))
    .where(and(eq(apiKeysTable.secretKey, apiKey), eq(apiKeysTable.isActive, true), eq(usersTable.isActive, true)));

  if (rows.length === 0) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid or revoked API key" });
    return;
  }

  req.apiKeyUserId = rows[0].userId;
  req.apiKeyId = rows[0].keyId;

  // Update lastUsedAt in background
  db.update(apiKeysTable)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeysTable.id, rows[0].keyId))
    .catch(() => {});

  next();
}
