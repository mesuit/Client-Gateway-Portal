import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const settlementAccountsTable = pgTable("settlement_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  accountType: text("account_type").notNull(), // "till" | "paybill"
  accountNumber: text("account_number").notNull(),
  accountName: text("account_name").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSettlementAccountSchema = createInsertSchema(settlementAccountsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSettlementAccount = z.infer<typeof insertSettlementAccountSchema>;
export type SettlementAccount = typeof settlementAccountsTable.$inferSelect;
