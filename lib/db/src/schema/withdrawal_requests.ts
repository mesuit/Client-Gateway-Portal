import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const withdrawalRequestsTable = pgTable("withdrawal_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  phone: text("phone").notNull(),
  status: text("status").notNull().default("pending"), // pending | processing | completed | rejected | failed
  note: text("note"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  b2cConversationId: text("b2c_conversation_id"),
  autoProcessed: text("auto_processed").default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
