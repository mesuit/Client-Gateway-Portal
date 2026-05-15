import { db } from "@workspace/db";
import { blockedIpsTable } from "@workspace/db";
import type { Request, Response, NextFunction } from "express";

export function getRequestIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return (typeof forwarded === "string" ? forwarded : forwarded[0]).split(",")[0].trim();
  }
  return req.socket?.remoteAddress ?? "unknown";
}

let blockedIpCache: Set<string> = new Set();
let cacheExpiry = 0;

async function getBlockedIps(): Promise<Set<string>> {
  if (Date.now() < cacheExpiry) return blockedIpCache;
  const rows = await db.select({ ip: blockedIpsTable.ip }).from(blockedIpsTable);
  blockedIpCache = new Set(rows.map(r => r.ip));
  cacheExpiry = Date.now() + 30_000;
  return blockedIpCache;
}

export function invalidateBlockedIpCache(): void {
  cacheExpiry = 0;
}

export async function checkBlockedIp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ip = getRequestIp(req);
    const blocked = await getBlockedIps();
    if (blocked.has(ip)) {
      res.status(403).json({ error: "BLOCKED", message: "Access denied" });
      return;
    }
  } catch {
    // never block on error — fail open
  }
  next();
}
