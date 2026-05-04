import { db } from "@workspace/db";
import { apiKeysTable, usersTable, sessionsTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";
import { logSecurityEvent } from "./securityLogger";

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
    logSecurityEvent({
      eventType: "invalid_api_key",
      severity: "medium",
      description: "Invalid or revoked API key used",
      req,
      metadata: { keyPrefix: apiKey.slice(0, 8) + "..." },
    });
    res.status(401).json({ error: "Unauthorized", message: "Invalid or revoked API key" });
    return;
  }

  req.apiKeyUserId = rows[0].userId;
  req.apiKeyId = rows[0].keyId;

  db.update(apiKeysTable)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeysTable.id, rows[0].keyId))
    .catch(() => {});

  next();
}

// Dual-auth: accepts both X-API-Key and Authorization Bearer (session token)
// Sets req.apiKeyUserId in both cases so B2C routes work from both portal and API
export async function requireAuthOrApiKey(req: ApiKeyRequest, res: Response, next: NextFunction): Promise<void> {
  const apiKey = req.headers["x-api-key"] as string | undefined;

  if (apiKey) {
    const rows = await db
      .select({ userId: apiKeysTable.userId, keyId: apiKeysTable.id })
      .from(apiKeysTable)
      .innerJoin(usersTable, eq(apiKeysTable.userId, usersTable.id))
      .where(and(eq(apiKeysTable.secretKey, apiKey), eq(apiKeysTable.isActive, true), eq(usersTable.isActive, true)));

    if (rows.length === 0) {
      logSecurityEvent({
        eventType: "invalid_api_key",
        severity: "medium",
        description: "Invalid or revoked API key used on B2C endpoint",
        req,
        metadata: { keyPrefix: apiKey.slice(0, 8) + "..." },
      });
      res.status(401).json({ error: "Unauthorized", message: "Invalid or revoked API key" });
      return;
    }

    req.apiKeyUserId = rows[0].userId;
    req.apiKeyId = rows[0].keyId;

    db.update(apiKeysTable)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeysTable.id, rows[0].keyId))
      .catch(() => {});

    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const now = new Date();
    const rows = await db
      .select({ userId: sessionsTable.userId })
      .from(sessionsTable)
      .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
      .where(and(eq(sessionsTable.token, token), gt(sessionsTable.expiresAt, now), eq(usersTable.isActive, true)));

    if (rows.length === 0) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid or expired session" });
      return;
    }

    req.apiKeyUserId = rows[0].userId;
    next();
    return;
  }

  res.status(401).json({
    error: "Unauthorized",
    message: "Missing authentication. Provide X-API-Key header or Authorization Bearer token.",
  });
}
