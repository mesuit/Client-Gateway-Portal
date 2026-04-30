import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const b2cTopupsTable = pgTable("b2c_topups", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  checkoutRequestId: text("checkout_request_id").unique(),
  mpesaReceiptNumber: text("mpesa_receipt_number"),
  phoneNumber: text("phone_number").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  statusDescription: text("status_description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type B2CTopup = typeof b2cTopupsTable.$inferSelect;
