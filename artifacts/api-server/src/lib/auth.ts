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

export async function createSession(userId: number): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
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
  const now = new Date();

  const rows = await db
    .select({ userId: sessionsTable.userId, email: usersTable.email, businessName: usersTable.businessName })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(and(eq(sessionsTable.token, token), gt(sessionsTable.expiresAt, now)));

  if (rows.length === 0) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token" });
    return;
  }

  req.userId = rows[0].userId;
  req.userEmail = rows[0].email;
  req.businessName = rows[0].businessName;
  next();
}
