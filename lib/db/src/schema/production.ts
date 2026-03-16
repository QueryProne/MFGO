import { pgTable, text, timestamp, numeric, date } from "drizzle-orm/pg-core";
import { itemsTable } from "./items";
import { bomsTable, routingsTable } from "./engineering";
import { salesOrdersTable } from "./sales";
import { warehousesTable } from "./inventory";

export const workOrdersTable = pgTable("work_orders", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  number: text("number").notNull().unique(),
  itemId: text("item_id").notNull().references(() => itemsTable.id),
  bomId: text("bom_id").references(() => bomsTable.id),
  routingId: text("routing_id").references(() => routingsTable.id),
  salesOrderId: text("sales_order_id").references(() => salesOrdersTable.id),
  salesOrderLineId: text("sales_order_line_id"),
  status: text("status").notNull().default("draft"),
  type: text("type").notNull().default("standard"),
  quantityOrdered: numeric("quantity_ordered", { precision: 15, scale: 6 }).notNull(),
  quantityCompleted: numeric("quantity_completed", { precision: 15, scale: 6 }).default("0"),
  quantityScrapped: numeric("quantity_scrapped", { precision: 15, scale: 6 }).default("0"),
  uom: text("uom").default("EA"),
  scheduledStart: date("scheduled_start"),
  scheduledEnd: date("scheduled_end"),
  actualStart: date("actual_start"),
  actualEnd: date("actual_end"),
  warehouseId: text("warehouse_id").references(() => warehousesTable.id),
  priority: text("priority").default("normal"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workOrderOperationsTable = pgTable("work_order_operations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  workOrderId: text("work_order_id").notNull().references(() => workOrdersTable.id, { onDelete: "cascade" }),
  sequence: numeric("sequence", { precision: 5, scale: 0 }).notNull(),
  name: text("name").notNull(),
  workcenterId: text("workcenter_id"),
  status: text("status").notNull().default("pending"),
  scheduledStart: timestamp("scheduled_start"),
  scheduledEnd: timestamp("scheduled_end"),
  actualStart: timestamp("actual_start"),
  actualEnd: timestamp("actual_end"),
  setupTime: numeric("setup_time", { precision: 10, scale: 2 }),
  runTime: numeric("run_time", { precision: 10, scale: 2 }),
  laborHours: numeric("labor_hours", { precision: 10, scale: 2 }),
});

export type WorkOrder = typeof workOrdersTable.$inferSelect;
export type WorkOrderOperation = typeof workOrderOperationsTable.$inferSelect;
