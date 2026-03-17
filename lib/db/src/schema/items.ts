import { pgTable, text, timestamp, numeric, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const itemsTable = pgTable("items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  number: text("number").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(),
  supplyType: text("supply_type").notNull().default("purchased"),
  makeBuy: text("make_buy").notNull().default("buy"),
  status: text("status").notNull().default("active"),
  uom: text("uom").default("EA"),
  category: text("category"),
  revision: text("revision").default("A"),
  standardCost: numeric("standard_cost", { precision: 15, scale: 4 }),
  listPrice: numeric("list_price", { precision: 15, scale: 4 }),
  weight: numeric("weight", { precision: 10, scale: 4 }),
  leadTime: integer("lead_time"),
  reorderPoint: numeric("reorder_point", { precision: 15, scale: 4 }),
  reorderQty: numeric("reorder_qty", { precision: 15, scale: 4 }),
  safetyStock: numeric("safety_stock", { precision: 15, scale: 4 }),
  lotTracked: boolean("lot_tracked").default(false),
  serialTracked: boolean("serial_tracked").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertItemSchema = createInsertSchema(itemsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type Item = typeof itemsTable.$inferSelect;
export type InsertItem = z.infer<typeof insertItemSchema>;
