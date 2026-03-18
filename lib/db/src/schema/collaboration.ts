import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { usersTable } from "./users";
import { commEmailTemplatesTable } from "./communications";

export const tasksTable = pgTable(
  "tasks",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    relatedEntityType: text("related_entity_type"),
    relatedEntityId: text("related_entity_id"),
    title: text("title").notNull(),
    description: text("description"),
    dueDate: timestamp("due_date"),
    status: text("status").notNull().default("open"),
    priority: text("priority").notNull().default("medium"),
    assigneeId: text("assignee_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdBy: text("created_by").references(() => usersTable.id, { onDelete: "set null" }),
    reminders: jsonb("reminders").$type<Array<Record<string, unknown>>>().notNull().default([]),
    comments: jsonb("comments").$type<Array<Record<string, unknown>>>().notNull().default([]),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    entityIdx: index("idx_tasks_entity").on(table.entityType, table.entityId, table.createdAt),
    statusIdx: index("idx_tasks_status_due").on(table.status, table.dueDate),
    assigneeIdx: index("idx_tasks_assignee").on(table.assigneeId, table.status),
  }),
);

export const activityTimelineTable = pgTable(
  "activity_timeline",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    relatedEntityType: text("related_entity_type"),
    relatedEntityId: text("related_entity_id"),
    activityType: text("activity_type").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id"),
    title: text("title").notNull(),
    body: text("body"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    actorId: text("actor_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    entityIdx: index("idx_activity_timeline_entity").on(table.entityType, table.entityId, table.createdAt),
    sourceIdx: index("idx_activity_timeline_source").on(table.sourceType, table.sourceId),
  }),
);

export const automationRulesTable = pgTable(
  "automation_rules",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    description: text("description"),
    triggerEvent: text("trigger_event").notNull(),
    conditionJson: jsonb("condition_json").$type<Record<string, unknown>>().notNull().default({}),
    actionJson: jsonb("action_json").$type<Record<string, unknown>>().notNull().default({}),
    isActive: boolean("is_active").notNull().default(true),
    lastRunAt: timestamp("last_run_at"),
    createdBy: text("created_by").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    triggerIdx: index("idx_automation_rules_trigger_active").on(table.triggerEvent, table.isActive),
  }),
);

export const chatLogsTable = pgTable(
  "chat_logs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    queryText: text("query_text").notNull(),
    responseText: text("response_text").notNull(),
    intent: text("intent"),
    provider: text("provider"),
    model: text("model"),
    contextRows: jsonb("context_rows").$type<Array<Record<string, unknown>>>().notNull().default([]),
    responseMetadata: jsonb("response_metadata").$type<Record<string, unknown>>().notNull().default({}),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    redacted: boolean("redacted").notNull().default(true),
    createdBy: text("created_by").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    entityIdx: index("idx_chat_logs_entity").on(table.entityType, table.entityId, table.createdAt),
    createdAtIdx: index("idx_chat_logs_created_at").on(table.createdAt),
  }),
);

export const emailSequencesTable = pgTable(
  "email_sequences",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    description: text("description"),
    module: text("module").notNull().default("crm"),
    entryEntityType: text("entry_entity_type").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: text("created_by").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    moduleIdx: index("idx_email_sequences_module_active").on(table.module, table.isActive),
  }),
);

export const emailSequenceStepsTable = pgTable(
  "email_sequence_steps",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    sequenceId: text("sequence_id")
      .notNull()
      .references(() => emailSequencesTable.id, { onDelete: "cascade" }),
    stepNumber: integer("step_number").notNull(),
    templateId: text("template_id").references(() => commEmailTemplatesTable.id, { onDelete: "set null" }),
    subjectOverride: text("subject_override"),
    bodyHtmlOverride: text("body_html_override"),
    bodyTextOverride: text("body_text_override"),
    delayDays: integer("delay_days").notNull().default(0),
    trackingEnabled: boolean("tracking_enabled").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    sequenceStepUnique: uniqueIndex("uq_email_sequence_steps_sequence_step").on(table.sequenceId, table.stepNumber),
  }),
);

export const emailSequenceEnrollmentsTable = pgTable(
  "email_sequence_enrollments",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    sequenceId: text("sequence_id")
      .notNull()
      .references(() => emailSequencesTable.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    status: text("status").notNull().default("active"),
    currentStep: integer("current_step").notNull().default(1),
    sentCount: integer("sent_count").notNull().default(0),
    nextSendAt: timestamp("next_send_at"),
    lastSentAt: timestamp("last_sent_at"),
    createdBy: text("created_by").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    enrollmentUnique: uniqueIndex("uq_email_sequence_enrollments").on(table.sequenceId, table.entityType, table.entityId),
    statusIdx: index("idx_email_sequence_enrollments_status_next").on(table.status, table.nextSendAt),
  }),
);

export type Task = typeof tasksTable.$inferSelect;
export type ActivityTimelineEntry = typeof activityTimelineTable.$inferSelect;
export type AutomationRule = typeof automationRulesTable.$inferSelect;
export type ChatLog = typeof chatLogsTable.$inferSelect;
export type EmailSequence = typeof emailSequencesTable.$inferSelect;
export type EmailSequenceStep = typeof emailSequenceStepsTable.$inferSelect;
export type EmailSequenceEnrollment = typeof emailSequenceEnrollmentsTable.$inferSelect;
