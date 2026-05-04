import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export const securityEventsTable = pgTable("security_events", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  severity: text("severity").notNull().default("medium"),
  description: text("description").notNull(),
  ipAddress: text("ip_address"),
  userId: integer("user_id"),
  email: text("email"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SecurityEvent = typeof securityEventsTable.$inferSelect;
