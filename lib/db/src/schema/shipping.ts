import { pgTable, text, timestamp, numeric, date, jsonb, integer } from "drizzle-orm/pg-core";
import { salesOrdersTable } from "./sales";
import { customersTable } from "./crm";
import { itemsTable } from "./items";
import { warehousesTable } from "./inventory";

export const shipmentsTable = pgTable("shipments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  number: text("number").notNull().unique(),
  salesOrderId: text("sales_order_id").notNull().references(() => salesOrdersTable.id),
  customerId: text("customer_id").notNull().references(() => customersTable.id),
  status: text("status").notNull().default("draft"),
  shippedDate: date("shipped_date"),
  carrier: text("carrier"),
  trackingNumber: text("tracking_number"),
  shippingAddress: jsonb("shipping_address"),
  warehouseId: text("warehouse_id").references(() => warehousesTable.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const shipmentLinesTable = pgTable("shipment_lines", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  shipmentId: text("shipment_id").notNull().references(() => shipmentsTable.id, { onDelete: "cascade" }),
  salesOrderLineId: text("sales_order_line_id"),
  itemId: text("item_id").notNull().references(() => itemsTable.id),
  quantity: numeric("quantity", { precision: 15, scale: 6 }).notNull(),
  uom: text("uom").default("EA"),
  lotNumber: text("lot_number"),
  serialNumber: text("serial_number"),
});

export const invoicesTable = pgTable("invoices", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  number: text("number").notNull().unique(),
  customerId: text("customer_id").notNull().references(() => customersTable.id),
  salesOrderId: text("sales_order_id").references(() => salesOrdersTable.id),
  shipmentId: text("shipment_id").references(() => shipmentsTable.id),
  status: text("status").notNull().default("draft"),
  invoiceDate: date("invoice_date"),
  dueDate: date("due_date"),
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).default("0"),
  taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }).default("0"),
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).default("0"),
  amountPaid: numeric("amount_paid", { precision: 15, scale: 2 }).default("0"),
  paymentTerms: text("payment_terms"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const invoiceLinesTable = pgTable("invoice_lines", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  invoiceId: text("invoice_id").notNull().references(() => invoicesTable.id, { onDelete: "cascade" }),
  itemId: text("item_id").references(() => itemsTable.id),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 15, scale: 6 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 15, scale: 4 }).notNull(),
  discount: numeric("discount", { precision: 5, scale: 2 }).default("0"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).default("0"),
  lineTotal: numeric("line_total", { precision: 15, scale: 2 }),
  lineNumber: integer("line_number").notNull(),
});

export type Shipment = typeof shipmentsTable.$inferSelect;
export type ShipmentLine = typeof shipmentLinesTable.$inferSelect;
export type Invoice = typeof invoicesTable.$inferSelect;
export type InvoiceLine = typeof invoiceLinesTable.$inferSelect;
