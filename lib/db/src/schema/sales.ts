import { pgTable, text, timestamp, numeric, integer, date, jsonb } from "drizzle-orm/pg-core";
import { customersTable } from "./crm";
import { itemsTable } from "./items";

export const quotesTable = pgTable("quotes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  number: text("number").notNull().unique(),
  customerId: text("customer_id").notNull().references(() => customersTable.id),
  status: text("status").notNull().default("draft"),
  quoteDate: date("quote_date"),
  expiryDate: date("expiry_date"),
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).default("0"),
  taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }).default("0"),
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).default("0"),
  notes: text("notes"),
  terms: text("terms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const quoteLinesTable = pgTable("quote_lines", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  quoteId: text("quote_id").notNull().references(() => quotesTable.id, { onDelete: "cascade" }),
  lineNumber: integer("line_number").notNull(),
  itemId: text("item_id").notNull().references(() => itemsTable.id),
  description: text("description"),
  quantity: numeric("quantity", { precision: 15, scale: 6 }).notNull(),
  uom: text("uom").default("EA"),
  unitPrice: numeric("unit_price", { precision: 15, scale: 4 }).notNull(),
  discount: numeric("discount", { precision: 5, scale: 2 }).default("0"),
  lineTotal: numeric("line_total", { precision: 15, scale: 2 }),
  requestedDate: date("requested_date"),
  notes: text("notes"),
});

export const salesOrdersTable = pgTable("sales_orders", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  number: text("number").notNull().unique(),
  customerId: text("customer_id").notNull().references(() => customersTable.id),
  quoteId: text("quote_id").references(() => quotesTable.id),
  status: text("status").notNull().default("draft"),
  orderDate: date("order_date"),
  requestedDate: date("requested_date"),
  promisedDate: date("promised_date"),
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).default("0"),
  taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }).default("0"),
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).default("0"),
  shippingAddress: jsonb("shipping_address"),
  notes: text("notes"),
  terms: text("terms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const salesOrderLinesTable = pgTable("sales_order_lines", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  salesOrderId: text("sales_order_id").notNull().references(() => salesOrdersTable.id, { onDelete: "cascade" }),
  lineNumber: integer("line_number").notNull(),
  itemId: text("item_id").notNull().references(() => itemsTable.id),
  description: text("description"),
  quantity: numeric("quantity", { precision: 15, scale: 6 }).notNull(),
  quantityShipped: numeric("quantity_shipped", { precision: 15, scale: 6 }).default("0"),
  uom: text("uom").default("EA"),
  unitPrice: numeric("unit_price", { precision: 15, scale: 4 }).notNull(),
  discount: numeric("discount", { precision: 5, scale: 2 }).default("0"),
  lineTotal: numeric("line_total", { precision: 15, scale: 2 }),
  requestedDate: date("requested_date"),
  promisedDate: date("promised_date"),
  notes: text("notes"),
});

export type Quote = typeof quotesTable.$inferSelect;
export type QuoteLine = typeof quoteLinesTable.$inferSelect;
export type SalesOrder = typeof salesOrdersTable.$inferSelect;
export type SalesOrderLine = typeof salesOrderLinesTable.$inferSelect;
