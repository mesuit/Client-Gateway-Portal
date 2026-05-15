import { db } from "@workspace/db";
import { sessionsTable, usersTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export function generateToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const hashBuf = crypto.scryptSync(password, salt, 64);
  return hashBuf.toString("hex") === hash;
}

interface CachedSession {
  userId: number;
  email: string;
  businessName: string;
  isSuspended: boolean;
  expiresAt: number;
}

const sessionCache = new Map<string, CachedSession>();
const CACHE_TTL_MS = 60 * 1000;

function getCached(token: string): CachedSession | null {
  const entry = sessionCache.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    sessionCache.delete(token);
    return null;
  }
  return entry;
}

export function invalidateSessionCache(token: string): void {
  sessionCache.delete(token);
}

export function invalidateAllUserSessions(userId: number): void {
  for (const [token, session] of sessionCache.entries()) {
    if (session.userId === userId) sessionCache.delete(token);
  }
}

export async function createSession(userId: number): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(sessionsTable).values({ userId, token, expiresAt });
  return token;
}

export interface AuthRequest extends Request {
  userId?: number;
  userEmail?: string;
  businessName?: string;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", message: "Missing or invalid token" });
    return;
  }

  const token = authHeader.slice(7);

  const cached = getCached(token);
  if (cached) {
    if (cached.isSuspended) {
      res.status(403).json({ error: "ACCOUNT_SUSPENDED", message: "Your account has been suspended. Contact support." });
      return;
    }
    req.userId = cached.userId;
    req.userEmail = cached.email;
    req.businessName = cached.businessName;
    next();
    return;
  }

  const now = new Date();
  const rows = await db
    .select({
      userId: sessionsTable.userId,
      email: usersTable.email,
      businessName: usersTable.businessName,
      isSuspended: usersTable.isSuspended,
    })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(and(eq(sessionsTable.token, token), gt(sessionsTable.expiresAt, now)));

  if (rows.length === 0) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token" });
    return;
  }

  if (rows[0].isSuspended) {
    res.status(403).json({ error: "ACCOUNT_SUSPENDED", message: "Your account has been suspended. Contact support." });
    return;
  }

  sessionCache.set(token, {
    userId: rows[0].userId,
    email: rows[0].email,
    businessName: rows[0].businessName,
    isSuspended: rows[0].isSuspended,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  req.userId = rows[0].userId;
  req.userEmail = rows[0].email;
  req.businessName = rows[0].businessName;
  next();
}
