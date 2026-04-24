import { Router } from "express";
import { db } from "@workspace/db";
import { apiKeysTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import crypto from "crypto";

const router = Router();

function generateApiKey(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(32).toString("hex")}`;
}

router.get("/keys", requireAuth, async (req: AuthRequest, res) => {
  const keys = await db
    .select({
      id: apiKeysTable.id,
      keyName: apiKeysTable.keyName,
      publicKey: apiKeysTable.publicKey,
      isActive: apiKeysTable.isActive,
      lastUsedAt: apiKeysTable.lastUsedAt,
      createdAt: apiKeysTable.createdAt,
    })
    .from(apiKeysTable)
    .where(eq(apiKeysTable.userId, req.userId!));

  res.json(keys);
});

router.post("/keys", requireAuth, async (req: AuthRequest, res) => {
  const { keyName } = req.body;
  if (!keyName) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "keyName is required" });
    return;
  }

  const publicKey = generateApiKey("pk");
  const secretKey = generateApiKey("sk");

  const [key] = await db.insert(apiKeysTable).values({
    userId: req.userId!,
    keyName,
    publicKey,
    secretKey,
    isActive: true,
  }).returning();

  res.status(201).json({
    id: key.id,
    keyName: key.keyName,
    publicKey: key.publicKey,
    secretKey: key.secretKey,
    isActive: key.isActive,
    lastUsedAt: key.lastUsedAt,
    createdAt: key.createdAt,
  });
});

router.delete("/keys/:keyId", requireAuth, async (req: AuthRequest, res) => {
  const keyId = parseInt(req.params.keyId);
  if (isNaN(keyId)) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid key ID" });
    return;
  }

  const rows = await db
    .update(apiKeysTable)
    .set({ isActive: false })
    .where(and(eq(apiKeysTable.id, keyId), eq(apiKeysTable.userId, req.userId!)))
    .returning();

  if (rows.length === 0) {
    res.status(404).json({ error: "NOT_FOUND", message: "API key not found" });
    return;
  }

  res.json({ message: "API key revoked successfully" });
});

export default router;
