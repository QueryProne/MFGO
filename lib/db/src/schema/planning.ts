import { pgTable, text, timestamp, integer, jsonb, date } from "drizzle-orm/pg-core";
import { itemsTable } from "./items";

export const mrpRunsTable = pgTable("mrp_runs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  status: text("status").notNull().default("queued"),
  type: text("type").notNull().default("full_regen"),
  planningHorizon: integer("planning_horizon").default(90),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  summaryStats: jsonb("summary_stats"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mrpRecommendationsTable = pgTable("mrp_recommendations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  runId: text("run_id").notNull().references(() => mrpRunsTable.id),
  type: text("type").notNull(),
  itemId: text("item_id").notNull().references(() => itemsTable.id),
  quantity: text("quantity").notNull(),
  neededDate: date("needed_date"),
  vendorId: text("vendor_id"),
  priority: text("priority"),
  message: text("message"),
  status: text("status").notNull().default("open"),
});

export const planningScenariosTable = pgTable("planning_scenarios", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft"),
  baselineRunId: text("baseline_run_id").references(() => mrpRunsTable.id),
  modifications: jsonb("modifications"),
  comparisonResult: jsonb("comparison_result"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const dashboardWidgetsTable = pgTable("dashboard_widgets", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  config: jsonb("config"),
  position: jsonb("position"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const smartTransferJobsTable = pgTable("smart_transfer_jobs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  sourceType: text("source_type").notNull(),
  status: text("status").notNull().default("draft"),
  targetEntity: text("target_entity").notNull(),
  sourceConfig: jsonb("source_config"),
  fieldMappings: jsonb("field_mappings"),
  mappingTemplateId: text("mapping_template_id"),
  isDryRun: text("is_dry_run").default("true"),
  totalRecords: integer("total_records"),
  processedRecords: integer("processed_records"),
  errorRecords: integer("error_records"),
  errorLog: jsonb("error_log"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const smartTransferMappingsTable = pgTable("smart_transfer_mappings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  sourceType: text("source_type"),
  targetEntity: text("target_entity").notNull(),
  fieldMappings: jsonb("field_mappings"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type MrpRun = typeof mrpRunsTable.$inferSelect;
export type MrpRecommendation = typeof mrpRecommendationsTable.$inferSelect;
export type PlanningScenario = typeof planningScenariosTable.$inferSelect;
export type DashboardWidget = typeof dashboardWidgetsTable.$inferSelect;
export type SmartTransferJob = typeof smartTransferJobsTable.$inferSelect;
export type SmartTransferMapping = typeof smartTransferMappingsTable.$inferSelect;
