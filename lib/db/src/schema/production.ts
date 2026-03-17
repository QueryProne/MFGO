import { pgTable, text, timestamp, numeric, date, boolean } from "drizzle-orm/pg-core";
import { itemsTable } from "./items";
import { bomsTable, bomLinesTable, routingsTable } from "./engineering";
import { salesOrdersTable, salesOrderLinesTable } from "./sales";
import { warehousesTable } from "./inventory";
import { customersTable } from "./crm";

export const workOrdersTable = pgTable("work_orders", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  number: text("number").notNull().unique(),
  itemId: text("item_id").notNull().references(() => itemsTable.id),
  bomId: text("bom_id").references(() => bomsTable.id),
  routingId: text("routing_id").references(() => routingsTable.id),
  salesOrderId: text("sales_order_id").references(() => salesOrdersTable.id),
  salesOrderLineId: text("sales_order_line_id"),
  parentWorkOrderId: text("parent_work_order_id"),
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

export const workOrderMaterialsTable = pgTable("work_order_materials", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  workOrderId: text("work_order_id").notNull().references(() => workOrdersTable.id, { onDelete: "cascade" }),
  bomLineId: text("bom_line_id").references(() => bomLinesTable.id),
  itemId: text("item_id").notNull().references(() => itemsTable.id),
  requiredQty: numeric("required_qty", { precision: 15, scale: 6 }).notNull(),
  issuedQty: numeric("issued_qty", { precision: 15, scale: 6 }).default("0"),
  allocatedQty: numeric("allocated_qty", { precision: 15, scale: 6 }).default("0"),
  shortageQty: numeric("shortage_qty", { precision: 15, scale: 6 }).default("0"),
  supplyTypeSnapshot: text("supply_type_snapshot"),
  sourceWorkOrderId: text("source_work_order_id"),
  uom: text("uom").default("EA"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const serviceOrdersTable = pgTable("service_orders", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  number: text("number").notNull().unique(),
  salesOrderId: text("sales_order_id").references(() => salesOrdersTable.id),
  salesOrderLineId: text("sales_order_line_id").references(() => salesOrderLinesTable.id),
  customerId: text("customer_id").notNull().references(() => customersTable.id),
  itemId: text("item_id").references(() => itemsTable.id),
  serviceType: text("service_type").notNull().default("standard"),
  status: text("status").notNull().default("draft"),
  requestedDate: date("requested_date"),
  scheduledDate: date("scheduled_date"),
  completionDate: date("completion_date"),
  customerSite: text("customer_site"),
  assetReference: text("asset_reference"),
  plannedHours: numeric("planned_hours", { precision: 10, scale: 2 }),
  actualHours: numeric("actual_hours", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type WorkOrder = typeof workOrdersTable.$inferSelect;
export type WorkOrderOperation = typeof workOrderOperationsTable.$inferSelect;
export type WorkOrderMaterial = typeof workOrderMaterialsTable.$inferSelect;
export type ServiceOrder = typeof serviceOrdersTable.$inferSelect;
