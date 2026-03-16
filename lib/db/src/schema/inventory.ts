import { pgTable, text, timestamp, numeric, jsonb } from "drizzle-orm/pg-core";
import { itemsTable } from "./items";

export const warehousesTable = pgTable("warehouses", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  address: jsonb("address"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const inventoryBalancesTable = pgTable("inventory_balances", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  itemId: text("item_id").notNull().references(() => itemsTable.id),
  warehouseId: text("warehouse_id").notNull().references(() => warehousesTable.id),
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
  quantity: numeric("quantity", { precision: 15, scale: 6 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 15, scale: 4 }),
  totalCost: numeric("total_cost", { precision: 15, scale: 4 }),
  reference: text("reference"),
  notes: text("notes"),
  lotNumber: text("lot_number"),
  serialNumber: text("serial_number"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Warehouse = typeof warehousesTable.$inferSelect;
export type InventoryBalance = typeof inventoryBalancesTable.$inferSelect;
export type InventoryTransaction = typeof inventoryTransactionsTable.$inferSelect;
