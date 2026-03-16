import { pgTable, text, timestamp, numeric, integer, date } from "drizzle-orm/pg-core";
import { vendorsTable } from "./crm";
import { itemsTable } from "./items";
import { warehousesTable } from "./inventory";

export const purchaseOrdersTable = pgTable("purchase_orders", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  number: text("number").notNull().unique(),
  vendorId: text("vendor_id").notNull().references(() => vendorsTable.id),
  status: text("status").notNull().default("draft"),
  orderDate: date("order_date"),
  requestedDate: date("requested_date"),
  promisedDate: date("promised_date"),
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).default("0"),
  taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }).default("0"),
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).default("0"),
  warehouseId: text("warehouse_id").references(() => warehousesTable.id),
  notes: text("notes"),
  terms: text("terms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const purchaseOrderLinesTable = pgTable("purchase_order_lines", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  purchaseOrderId: text("purchase_order_id").notNull().references(() => purchaseOrdersTable.id, { onDelete: "cascade" }),
  lineNumber: integer("line_number").notNull(),
  itemId: text("item_id").notNull().references(() => itemsTable.id),
  quantity: numeric("quantity", { precision: 15, scale: 6 }).notNull(),
  quantityReceived: numeric("quantity_received", { precision: 15, scale: 6 }).default("0"),
  uom: text("uom").default("EA"),
  unitCost: numeric("unit_cost", { precision: 15, scale: 4 }).notNull(),
  lineTotal: numeric("line_total", { precision: 15, scale: 2 }),
  requestedDate: date("requested_date"),
  promisedDate: date("promised_date"),
  notes: text("notes"),
});

export type PurchaseOrder = typeof purchaseOrdersTable.$inferSelect;
export type PurchaseOrderLine = typeof purchaseOrderLinesTable.$inferSelect;
