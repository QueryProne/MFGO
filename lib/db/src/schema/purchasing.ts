import { pgTable, text, timestamp, numeric, integer, date, boolean } from "drizzle-orm/pg-core";
import { vendorsTable } from "./crm";
import { itemsTable } from "./items";
import { warehousesTable, stockLocationsTable, binsTable } from "./inventory";

export const itemVendorsTable = pgTable("item_vendors", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  itemId: text("item_id").notNull().references(() => itemsTable.id, { onDelete: "cascade" }),
  vendorId: text("vendor_id").notNull().references(() => vendorsTable.id),
  vendorPartNumber: text("vendor_part_number"),
  isPreferred: boolean("is_preferred").default(false),
  isApproved: boolean("is_approved").default(true),
  leadTimeDays: integer("lead_time_days"),
  minOrderQty: numeric("min_order_qty", { precision: 15, scale: 6 }).default("1"),
  orderMultiple: numeric("order_multiple", { precision: 15, scale: 6 }).default("1"),
  purchaseUom: text("purchase_uom").default("EA"),
  uomConversionToStock: numeric("uom_conversion_to_stock", { precision: 15, scale: 6 }).default("1"),
  safetyStockQty: numeric("safety_stock_qty", { precision: 15, scale: 4 }),
  reorderPointQty: numeric("reorder_point_qty", { precision: 15, scale: 4 }),
  lastCost: numeric("last_cost", { precision: 15, scale: 4 }),
  standardCost: numeric("standard_cost", { precision: 15, scale: 4 }),
  effectiveFrom: date("effective_from"),
  effectiveTo: date("effective_to"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
  mrpRecommendationId: text("mrp_recommendation_id"),
  notes: text("notes"),
});

export const receiptsTable = pgTable("receipts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  number: text("number").notNull().unique(),
  purchaseOrderId: text("purchase_order_id").references(() => purchaseOrdersTable.id),
  vendorId: text("vendor_id").notNull().references(() => vendorsTable.id),
  status: text("status").notNull().default("draft"),
  receiptDate: date("receipt_date"),
  packingSlipNumber: text("packing_slip_number"),
  warehouseId: text("warehouse_id").references(() => warehousesTable.id),
  stockLocationId: text("stock_location_id").references(() => stockLocationsTable.id),
  inspectionRequired: boolean("inspection_required").default(false),
  notes: text("notes"),
  receivedBy: text("received_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const receiptLinesTable = pgTable("receipt_lines", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  receiptId: text("receipt_id").notNull().references(() => receiptsTable.id, { onDelete: "cascade" }),
  purchaseOrderLineId: text("purchase_order_line_id").references(() => purchaseOrderLinesTable.id),
  itemId: text("item_id").notNull().references(() => itemsTable.id),
  lineNumber: integer("line_number").notNull(),
  receivedQty: numeric("received_qty", { precision: 15, scale: 6 }).notNull().default("0"),
  acceptedQty: numeric("accepted_qty", { precision: 15, scale: 6 }).notNull().default("0"),
  rejectedQty: numeric("rejected_qty", { precision: 15, scale: 6 }).notNull().default("0"),
  uom: text("uom").default("EA"),
  unitCost: numeric("unit_cost", { precision: 15, scale: 4 }),
  warehouseId: text("warehouse_id").references(() => warehousesTable.id),
  stockLocationId: text("stock_location_id").references(() => stockLocationsTable.id),
  binId: text("bin_id").references(() => binsTable.id),
  lotNumber: text("lot_number"),
  serialNumbers: text("serial_numbers"),
  receiptStatus: text("receipt_status").notNull().default("pending"),
  inspectionStatus: text("inspection_status").default("not_required"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ItemVendor = typeof itemVendorsTable.$inferSelect;
export type PurchaseOrder = typeof purchaseOrdersTable.$inferSelect;
export type PurchaseOrderLine = typeof purchaseOrderLinesTable.$inferSelect;
export type Receipt = typeof receiptsTable.$inferSelect;
export type ReceiptLine = typeof receiptLinesTable.$inferSelect;
