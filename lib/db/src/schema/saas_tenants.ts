import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { settlementAccountsTable } from "./settlement_accounts";

export const saasTenantsTable = pgTable("saas_tenants", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  tenantCode: text("tenant_code").notNull().unique(),
  settlementAccountId: integer("settlement_account_id").references(() => settlementAccountsTable.id, { onDelete: "set null" }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type SaasTenant = typeof saasTenantsTable.$inferSelect;
