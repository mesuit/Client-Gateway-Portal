import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { settlementAccountsTable } from "./settlement_accounts";

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  settlementAccountId: integer("settlement_account_id").references(() => settlementAccountsTable.id),
  checkoutRequestId: text("checkout_request_id").unique(),
  merchantRequestId: text("merchant_request_id"),
  mpesaReceiptNumber: text("mpesa_receipt_number"),
  phoneNumber: text("phone_number").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("KES"),
  status: text("status").notNull().default("pending"), // pending | completed | failed | cancelled
  statusCode: text("status_code"),
  statusDescription: text("status_description"),
  accountReference: text("account_reference"),
  transactionDesc: text("transaction_desc"),
  callbackMetadata: text("callback_metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
