import { db } from "@workspace/db";
import { securityEventsTable } from "@workspace/db";
import { logger } from "./logger";
import type { Request } from "express";

export type SecurityEventType =
  | "failed_login"
  | "invalid_api_key"
  | "unauthorized_admin"
  | "suspicious_activity"
  | "account_suspended"
  | "ip_blocked"
  | "mpesa_reversal_initiated";

export type SecuritySeverity = "low" | "medium" | "high" | "critical";

export interface SecurityEventData {
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  description: string;
  req?: Request;
  userId?: number;
  email?: string;
  metadata?: Record<string, unknown>;
}

export function logSecurityEvent(data: SecurityEventData): void {
  const ipAddress = data.req
    ? (data.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
      data.req.socket?.remoteAddress ??
      null
    : null;

  db.insert(securityEventsTable)
    .values({
      eventType: data.eventType,
      severity: data.severity,
      description: data.description,
      ipAddress: ipAddress ?? undefined,
      userId: data.userId ?? undefined,
      email: data.email ?? undefined,
      metadata: data.metadata ?? undefined,
    })
    .catch((err) => logger.error(err, "Failed to log security event"));
}
