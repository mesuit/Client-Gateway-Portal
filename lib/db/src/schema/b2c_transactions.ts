import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const b2cTransactionsTable = pgTable("b2c_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  conversationId: text("conversation_id").unique(),
  originatorConversationId: text("originator_conversation_id"),
  mpesaReceiptNumber: text("mpesa_receipt_number"),
  phoneNumber: text("phone_number").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("KES"),
  commandId: text("command_id").notNull().default("BusinessPayment"),
  remarks: text("remarks"),
  occasion: text("occasion"),
  status: text("status").notNull().default("pending"), // pending | completed | failed
  resultCode: text("result_code"),
  resultDescription: text("result_description"),
  transactionAmount: numeric("transaction_amount", { precision: 12, scale: 2 }),
  b2cRecipientIsRegistered: text("b2c_recipient_is_registered"),
  b2cChargesPaidAccount: text("b2c_charges_paid_account"),
  receiverPartyPublicName: text("receiver_party_public_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type B2CTransaction = typeof b2cTransactionsTable.$inferSelect;
