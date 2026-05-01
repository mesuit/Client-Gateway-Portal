import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const saasSubscriptionsTable = pgTable("saas_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  plan: text("plan").notNull(), // monthly | yearly
  status: text("status").notNull().default("pending"), // pending | active | expired
  amount: numeric("amount", { precision: 10, scale: 2 }),
  checkoutRequestId: text("checkout_request_id"),
  mpesaReceiptNumber: text("mpesa_receipt_number"),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type SaasSubscription = typeof saasSubscriptionsTable.$inferSelect;
