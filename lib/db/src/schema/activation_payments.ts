import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const activationPaymentsTable = pgTable("activation_payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  plan: text("plan").notNull(), // monthly | yearly
  amount: text("amount").notNull(),
  checkoutRequestId: text("checkout_request_id").unique(),
  merchantRequestId: text("merchant_request_id"),
  status: text("status").notNull().default("pending"), // pending | completed | failed
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
