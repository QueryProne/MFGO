import { pgTable, text, timestamp, numeric, boolean } from "drizzle-orm/pg-core";
import { itemsTable } from "./items";

export const sitesTable = pgTable("sites", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  address: text("address"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const warehousesTable = pgTable("warehouses", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  siteId: text("site_id").references(() => sitesTable.id),
  address: text("address"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stockLocationsTable = pgTable("stock_locations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  warehouseId: text("warehouse_id").notNull().references(() => warehousesTable.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  locationType: text("location_type").notNull().default("storage"),
  isPickable: boolean("is_pickable").notNull().default(true),
  isPutaway: boolean("is_putaway").notNull().default(true),
  isNettable: boolean("is_nettable").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const binsTable = pgTable("bins", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  stockLocationId: text("stock_location_id").notNull().references(() => stockLocationsTable.id, { onDelete: "cascade" }),
  warehouseId: text("warehouse_id").notNull().references(() => warehousesTable.id),
  code: text("code").notNull(),
  description: text("description"),
  binType: text("bin_type").notNull().default("storage"),
  isPickable: boolean("is_pickable").notNull().default(true),
  isPutaway: boolean("is_putaway").notNull().default(true),
  isNettable: boolean("is_nettable").notNull().default(true),
  maxQty: numeric("max_qty", { precision: 15, scale: 6 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const inventoryLotsTable = pgTable("inventory_lots", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  lotNumber: text("lot_number").notNull(),
  itemId: text("item_id").notNull().references(() => itemsTable.id),
  status: text("status").notNull().default("active"),
  quantityOnHand: numeric("quantity_on_hand", { precision: 15, scale: 6 }).notNull().default("0"),
  quantityAllocated: numeric("quantity_allocated", { precision: 15, scale: 6 }).notNull().default("0"),
  manufactureDate: text("manufacture_date"),
  receiptDate: text("receipt_date"),
  expirationDate: text("expiration_date"),
  supplierLotNumber: text("supplier_lot_number"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const inventorySerialsTable = pgTable("inventory_serials", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  serialNumber: text("serial_number").notNull(),
  itemId: text("item_id").notNull().references(() => itemsTable.id),
  lotId: text("lot_id").references(() => inventoryLotsTable.id),
  warehouseId: text("warehouse_id").references(() => warehousesTable.id),
  stockLocationId: text("stock_location_id").references(() => stockLocationsTable.id),
  binId: text("bin_id").references(() => binsTable.id),
  status: text("status").notNull().default("available"),
  currentWorkOrderId: text("current_work_order_id"),
  manufactureDate: text("manufacture_date"),
  receiptDate: text("receipt_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const inventoryBalancesTable = pgTable("inventory_balances", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  itemId: text("item_id").notNull().references(() => itemsTable.id),
  warehouseId: text("warehouse_id").notNull().references(() => warehousesTable.id),
  stockLocationId: text("stock_location_id").references(() => stockLocationsTable.id),
  binId: text("bin_id").references(() => binsTable.id),
  location: text("location"),
  quantityOnHand: numeric("quantity_on_hand", { precision: 15, scale: 6 }).notNull().default("0"),
  quantityAllocated: numeric("quantity_allocated", { precision: 15, scale: 6 }).notNull().default("0"),
  quantityOnOrder: numeric("quantity_on_order", { precision: 15, scale: 6 }).notNull().default("0"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const inventoryTransactionsTable = pgTable("inventory_transactions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text("type").notNull(),
  itemId: text("item_id").notNull().references(() => itemsTable.id),
  warehouseId: text("warehouse_id").notNull().references(() => warehousesTable.id),
  stockLocationId: text("stock_location_id").references(() => stockLocationsTable.id),
  binId: text("bin_id").references(() => binsTable.id),
  quantity: numeric("quantity", { precision: 15, scale: 6 }).notNull(),
  uom: text("uom").default("EA"),
  unitCost: numeric("unit_cost", { precision: 15, scale: 4 }),
  totalCost: numeric("total_cost", { precision: 15, scale: 4 }),
  lotId: text("lot_id").references(() => inventoryLotsTable.id),
  serialId: text("serial_id").references(() => inventorySerialsTable.id),
  lotNumber: text("lot_number"),
  serialNumber: text("serial_number"),
  sourceEntityType: text("source_entity_type"),
  sourceEntityId: text("source_entity_id"),
  sourceLineId: text("source_line_id"),
  reference: text("reference"),
  notes: text("notes"),
  performedBy: text("performed_by"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  performedAt: timestamp("performed_at").defaultNow().notNull(),
});

export type Site = typeof sitesTable.$inferSelect;
export type Warehouse = typeof warehousesTable.$inferSelect;
export type StockLocation = typeof stockLocationsTable.$inferSelect;
export type Bin = typeof binsTable.$inferSelect;
export type InventoryLot = typeof inventoryLotsTable.$inferSelect;
export type InventorySerial = typeof inventorySerialsTable.$inferSelect;
export type InventoryBalance = typeof inventoryBalancesTable.$inferSelect;
export type InventoryTransaction = typeof inventoryTransactionsTable.$inferSelect;
