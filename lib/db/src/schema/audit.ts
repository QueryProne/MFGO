import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const auditLogsTable = pgTable("audit_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  userId: text("user_id"),
  userName: text("user_name"),
  fieldChanges: jsonb("field_changes"),
  source: text("source").default("ui"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogsTable.$inferSelect;
