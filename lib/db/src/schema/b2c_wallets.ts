import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const b2cWalletsTable = pgTable("b2c_wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  balance: numeric("balance", { precision: 14, scale: 2 }).notNull().default("0"),
  totalToppedup: numeric("total_toppedup", { precision: 14, scale: 2 }).notNull().default("0"),
  totalSpent: numeric("total_spent", { precision: 14, scale: 2 }).notNull().default("0"),
  totalFees: numeric("total_fees", { precision: 14, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type B2CWallet = typeof b2cWalletsTable.$inferSelect;
