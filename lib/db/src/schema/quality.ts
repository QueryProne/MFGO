import { pgTable, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { itemsTable } from "./items";

export const inspectionsTable = pgTable("inspections", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  number: text("number").notNull().unique(),
  type: text("type").notNull(),
  status: text("status").notNull().default("pending"),
  itemId: text("item_id").notNull().references(() => itemsTable.id),
  quantity: numeric("quantity", { precision: 15, scale: 6 }).notNull(),
  quantityPassed: numeric("quantity_passed", { precision: 15, scale: 6 }),
  quantityFailed: numeric("quantity_failed", { precision: 15, scale: 6 }),
  reference: text("reference"),
  lotNumber: text("lot_number"),
  inspectedBy: text("inspected_by"),
  inspectedAt: timestamp("inspected_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const nonconformancesTable = pgTable("nonconformances", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  number: text("number").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("open"),
  severity: text("severity").notNull().default("minor"),
  itemId: text("item_id").references(() => itemsTable.id),
  defectCode: text("defect_code"),
  disposition: text("disposition"),
  quantityAffected: numeric("quantity_affected", { precision: 15, scale: 6 }),
  lotNumber: text("lot_number"),
  containmentAction: text("containment_action"),
  rootCause: text("root_cause"),
  correctiveAction: text("corrective_action"),
  reportedBy: text("reported_by"),
  assignedTo: text("assigned_to"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Inspection = typeof inspectionsTable.$inferSelect;
export type Nonconformance = typeof nonconformancesTable.$inferSelect;
