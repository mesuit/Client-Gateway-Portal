import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const pesapalTransactionsTable = pgTable("pesapal_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  orderTrackingId: text("order_tracking_id").unique(),
  orderMerchantRef: text("order_merchant_ref").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  netAmount: numeric("net_amount", { precision: 12, scale: 2 }).notNull(),
  platformFee: numeric("platform_fee", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("KES"),
  status: text("status").notNull().default("pending"), // pending | completed | failed | cancelled
  paymentMethod: text("payment_method"),
  phoneNumber: text("phone_number"),
  customerEmail: text("customer_email"),
  description: text("description"),
  statusCode: text("status_code"),
  statusDescription: text("status_description"),
  callbackMetadata: text("callback_metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type PesapalTransaction = typeof pesapalTransactionsTable.$inferSelect;
