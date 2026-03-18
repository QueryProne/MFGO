import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { customersTable, vendorsTable } from "./crm";
import { usersTable } from "./users";

export const leadsTable = pgTable(
  "leads",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    number: text("number").notNull().unique(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    companyName: text("company_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    source: text("source"),
    status: text("status").notNull().default("new"),
    ownerId: text("owner_id").references(() => usersTable.id, { onDelete: "set null" }),
    notes: text("notes"),
    convertedCustomerId: text("converted_customer_id").references(() => customersTable.id, { onDelete: "set null" }),
    convertedAt: timestamp("converted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index("idx_leads_status").on(table.status, table.createdAt),
    ownerIdx: index("idx_leads_owner_status").on(table.ownerId, table.status),
    companyIdx: index("idx_leads_company").on(table.companyName),
  }),
);

export const opportunitiesTable = pgTable(
  "opportunities",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    number: text("number").notNull().unique(),
    name: text("name").notNull(),
    stage: text("stage").notNull().default("qualification"),
    status: text("status").notNull().default("open"),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull().default("0"),
    probability: integer("probability").notNull().default(10),
    expectedCloseDate: timestamp("expected_close_date"),
    customerId: text("customer_id").references(() => customersTable.id, { onDelete: "set null" }),
    vendorId: text("vendor_id").references(() => vendorsTable.id, { onDelete: "set null" }),
    leadId: text("lead_id").references(() => leadsTable.id, { onDelete: "set null" }),
    ownerId: text("owner_id").references(() => usersTable.id, { onDelete: "set null" }),
    notes: text("notes"),
    wonReason: text("won_reason"),
    lostReason: text("lost_reason"),
    closedAt: timestamp("closed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    stageIdx: index("idx_opportunities_stage").on(table.stage, table.status),
    expectedCloseIdx: index("idx_opportunities_expected_close").on(table.expectedCloseDate, table.status),
    ownerIdx: index("idx_opportunities_owner").on(table.ownerId, table.status),
  }),
);

export const opportunityStageHistoryTable = pgTable(
  "opportunity_stage_history",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    opportunityId: text("opportunity_id")
      .notNull()
      .references(() => opportunitiesTable.id, { onDelete: "cascade" }),
    fromStage: text("from_stage"),
    toStage: text("to_stage").notNull(),
    changedBy: text("changed_by").references(() => usersTable.id, { onDelete: "set null" }),
    note: text("note"),
    changedAt: timestamp("changed_at").defaultNow().notNull(),
  },
  (table) => ({
    opportunityChangedIdx: index("idx_opportunity_stage_history_changed").on(table.opportunityId, table.changedAt),
  }),
);

export const aiLeadScoresTable = pgTable(
  "ai_lead_scores",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    leadId: text("lead_id")
      .notNull()
      .references(() => leadsTable.id, { onDelete: "cascade" }),
    modelName: text("model_name").notNull(),
    score: integer("score").notNull(),
    confidence: integer("confidence"),
    reasoning: text("reasoning"),
    factors: text("factors"),
    scoredBy: text("scored_by").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    leadCreatedIdx: index("idx_ai_lead_scores_lead_created").on(table.leadId, table.createdAt),
  }),
);

export const opportunityForecastSnapshotsTable = pgTable(
  "opportunity_forecast_snapshots",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    snapshotLabel: text("snapshot_label").notNull(),
    periodStart: timestamp("period_start"),
    periodEnd: timestamp("period_end"),
    weightedAmount: numeric("weighted_amount", { precision: 15, scale: 2 }).notNull().default("0"),
    pipelineAmount: numeric("pipeline_amount", { precision: 15, scale: 2 }).notNull().default("0"),
    openCount: integer("open_count").notNull().default(0),
    wonCount: integer("won_count").notNull().default(0),
    lostCount: integer("lost_count").notNull().default(0),
    metadata: text("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    labelUnique: uniqueIndex("uq_opportunity_forecast_snapshots_label").on(table.snapshotLabel),
    createdAtIdx: index("idx_opportunity_forecast_snapshots_created").on(table.createdAt),
  }),
);

export type Lead = typeof leadsTable.$inferSelect;
export type Opportunity = typeof opportunitiesTable.$inferSelect;
export type OpportunityStageHistory = typeof opportunityStageHistoryTable.$inferSelect;
export type AiLeadScore = typeof aiLeadScoresTable.$inferSelect;
export type OpportunityForecastSnapshot = typeof opportunityForecastSnapshotsTable.$inferSelect;
