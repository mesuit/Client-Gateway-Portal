import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, createSession, requireAuth, invalidateSessionCache, type AuthRequest } from "../lib/auth";

const router = Router();

function safeUser(user: typeof usersTable.$inferSelect) {
  const now = new Date();
  let effectiveMode = user.mode;
  // Monthly subscription expiry check
  if (user.mode === "active" && user.subscriptionType === "monthly" && user.subscriptionExpiresAt) {
    if (new Date(user.subscriptionExpiresAt) < now) effectiveMode = "sandbox";
  }
  // Yearly subscription expiry check
  if (user.mode === "active" && user.subscriptionType === "yearly" && user.subscriptionExpiresAt) {
    if (new Date(user.subscriptionExpiresAt) < now) effectiveMode = "sandbox";
  }
  return {
    id: user.id,
    email: user.email,
    businessName: user.businessName,
    isActive: user.isActive,
    isAdmin: user.isAdmin,
    mode: effectiveMode,
    sandboxTransactionsUsed: user.sandboxTransactionsUsed,
    subscriptionType: user.subscriptionType,
    subscriptionExpiresAt: user.subscriptionExpiresAt,
    activatedAt: user.activatedAt,
    createdAt: user.createdAt,
  };
}

router.post("/auth/register", async (req, res) => {
  const { email, password, businessName } = req.body;

  if (!email || !password || !businessName) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "email, password and businessName are required" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Password must be at least 8 characters" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (existing.length > 0) {
    res.status(400).json({ error: "EMAIL_TAKEN", message: "An account with this email already exists" });
    return;
  }

  const passwordHash = hashPassword(password);
  const [user] = await db.insert(usersTable).values({
    email: email.toLowerCase(),
    passwordHash,
    businessName,
    mode: "sandbox",
    sandboxTransactionsUsed: 0,
  }).returning();

  const token = await createSession(user.id);
  res.status(201).json({ token, user: safeUser(user) });
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "email and password are required" });
    return;
  }

  const users = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (users.length === 0) {
    res.status(401).json({ error: "INVALID_CREDENTIALS", message: "Invalid email or password" });
    return;
  }

  const user = users[0];
  if (!verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "INVALID_CREDENTIALS", message: "Invalid email or password" });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ error: "ACCOUNT_DISABLED", message: "Your account has been disabled" });
    return;
  }

  const token = await createSession(user.id);
  res.json({ token, user: safeUser(user) });
});

router.post("/auth/logout", requireAuth, async (req: AuthRequest, res) => {
  const authHeader = req.headers.authorization!;
  const token = authHeader.slice(7);
  invalidateSessionCache(token);
  await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
  res.json({ message: "Logged out successfully" });
});

router.get("/auth/me", requireAuth, async (req: AuthRequest, res) => {
  const users = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (users.length === 0) {
    res.status(404).json({ error: "NOT_FOUND", message: "User not found" });
    return;
  }
  res.json(safeUser(users[0]));
});

export default router;
