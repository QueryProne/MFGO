import { pgTable, text, timestamp, numeric, integer, date } from "drizzle-orm/pg-core";
import { itemsTable } from "./items";

export const workcentersTable = pgTable("workcenters", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  department: text("department"),
  capacity: numeric("capacity", { precision: 10, scale: 2 }),
  capacityUom: text("capacity_uom"),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const bomsTable = pgTable("boms", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  number: text("number").notNull().unique(),
  itemId: text("item_id").notNull().references(() => itemsTable.id),
  revision: text("revision").notNull().default("A"),
  status: text("status").notNull().default("draft"),
  effectiveDate: date("effective_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const bomLinesTable = pgTable("bom_lines", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  bomId: text("bom_id").notNull().references(() => bomsTable.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  itemId: text("item_id").notNull().references(() => itemsTable.id),
  quantity: numeric("quantity", { precision: 15, scale: 6 }).notNull(),
  uom: text("uom").default("EA"),
  scrapFactor: numeric("scrap_factor", { precision: 5, scale: 4 }).default("0"),
  notes: text("notes"),
});

export const routingsTable = pgTable("routings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  itemId: text("item_id").notNull().references(() => itemsTable.id),
  revision: text("revision").notNull().default("A"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const routingOperationsTable = pgTable("routing_operations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  routingId: text("routing_id").notNull().references(() => routingsTable.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  name: text("name").notNull(),
  workcenterId: text("workcenter_id").notNull().references(() => workcentersTable.id),
  setupTime: numeric("setup_time", { precision: 10, scale: 2 }),
  runTime: numeric("run_time", { precision: 10, scale: 2 }),
  queueTime: numeric("queue_time", { precision: 10, scale: 2 }),
  notes: text("notes"),
});

export type Workcenter = typeof workcentersTable.$inferSelect;
export type Bom = typeof bomsTable.$inferSelect;
export type BomLine = typeof bomLinesTable.$inferSelect;
export type Routing = typeof routingsTable.$inferSelect;
export type RoutingOperation = typeof routingOperationsTable.$inferSelect;
