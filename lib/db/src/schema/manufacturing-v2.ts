import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { itemsTable } from "./items";

export const mfgWorkCentersTable = pgTable(
  "mfg_work_centers",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    type: text("type").notNull().default("machine"),
    capacityModel: text("capacity_model").notNull().default("calendar_finite"),
    efficiencyFactor: numeric("efficiency_factor", { precision: 8, scale: 4 }).notNull().default("1.0000"),
    defaultSetupMinutes: numeric("default_setup_minutes", { precision: 10, scale: 2 }).notNull().default("0"),
    sequenceDependentSetupMatrix: jsonb("sequence_dependent_setup_matrix"),
    runtimeStatus: text("runtime_status").notNull().default("idle"),
    lifecycleStatus: text("lifecycle_status").notNull().default("active"),
    queuePolicy: text("queue_policy").notNull().default("FIFO"),
    wipLimit: integer("wip_limit"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index("idx_mfg_work_centers_name").on(table.name),
    statusIdx: index("idx_mfg_work_centers_status").on(table.runtimeStatus, table.lifecycleStatus),
  }),
);

export const mfgWorkCenterCalendarsTable = pgTable(
  "mfg_work_center_calendars",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workCenterId: text("work_center_id")
      .notNull()
      .references(() => mfgWorkCentersTable.id, { onDelete: "cascade" }),
    calendarDate: date("calendar_date").notNull(),
    availableMinutes: integer("available_minutes").notNull(),
    shiftWindows: jsonb("shift_windows"),
    isWorkingDay: boolean("is_working_day").notNull().default(true),
    reasonCode: text("reason_code"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueDay: uniqueIndex("uq_mfg_work_center_calendar_day").on(table.workCenterId, table.calendarDate),
    dateIdx: index("idx_mfg_work_center_calendar_date").on(table.calendarDate),
  }),
);

export const mfgWorkCenterResourcesTable = pgTable(
  "mfg_work_center_resources",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workCenterId: text("work_center_id")
      .notNull()
      .references(() => mfgWorkCentersTable.id, { onDelete: "cascade" }),
    resourceType: text("resource_type").notNull(),
    resourceCode: text("resource_code"),
    resourceName: text("resource_name").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull().default("1"),
    availabilityStatus: text("availability_status").notNull().default("available"),
    skillCode: text("skill_code"),
    toolingClass: text("tooling_class"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    wcIdx: index("idx_mfg_work_center_resources_wc").on(table.workCenterId),
  }),
);

export const mfgWorkCenterStateTransitionsTable = pgTable(
  "mfg_work_center_state_transitions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workCenterId: text("work_center_id")
      .notNull()
      .references(() => mfgWorkCentersTable.id, { onDelete: "cascade" }),
    fromStatus: text("from_status").notNull(),
    toStatus: text("to_status").notNull(),
    reason: text("reason"),
    changedBy: text("changed_by"),
    sourceEventId: text("source_event_id"),
    changedAt: timestamp("changed_at").defaultNow().notNull(),
  },
  (table) => ({
    wcTimeIdx: index("idx_mfg_work_center_state_transitions_wc_time").on(table.workCenterId, table.changedAt),
  }),
);

export const mfgBomsTable = pgTable(
  "mfg_boms",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    parentItemId: text("parent_item_id")
      .notNull()
      .references(() => itemsTable.id),
    bomType: text("bom_type").notNull().default("manufacturing"),
    alternateCode: text("alternate_code").notNull().default("PRIMARY"),
    version: text("version").notNull().default("1.0"),
    status: text("status").notNull().default("draft"),
    isDefault: boolean("is_default").notNull().default(false),
    isPhantom: boolean("is_phantom").notNull().default(false),
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
    sourceBomId: text("source_bom_id"),
    notes: text("notes"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    versionUnique: uniqueIndex("uq_mfg_boms_item_variant_version").on(
      table.parentItemId,
      table.bomType,
      table.alternateCode,
      table.version,
    ),
    itemIdx: index("idx_mfg_boms_item").on(table.parentItemId),
  }),
);

export const mfgBomComponentsTable = pgTable(
  "mfg_bom_components",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    bomId: text("bom_id")
      .notNull()
      .references(() => mfgBomsTable.id, { onDelete: "cascade" }),
    parentComponentId: text("parent_component_id"),
    componentItemId: text("component_item_id")
      .notNull()
      .references(() => itemsTable.id),
    sequence: integer("sequence").notNull().default(10),
    quantity: numeric("quantity", { precision: 16, scale: 6 }).notNull(),
    uom: text("uom").notNull().default("EA"),
    scrapFactor: numeric("scrap_factor", { precision: 8, scale: 4 }).notNull().default("0"),
    isPhantom: boolean("is_phantom").notNull().default(false),
    isOptional: boolean("is_optional").notNull().default(false),
    operationSequence: integer("operation_sequence"),
    substituteGroup: text("substitute_group"),
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
    notes: text("notes"),
  },
  (table) => ({
    bomParentIdx: index("idx_mfg_bom_components_bom_parent").on(table.bomId, table.parentComponentId),
    bomSeqIdx: index("idx_mfg_bom_components_bom_seq").on(table.bomId, table.sequence),
  }),
);

export const mfgBomVersionHistoryTable = pgTable(
  "mfg_bom_version_history",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    bomId: text("bom_id")
      .notNull()
      .references(() => mfgBomsTable.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    action: text("action").notNull(),
    snapshot: jsonb("snapshot"),
    changedBy: text("changed_by"),
    changedAt: timestamp("changed_at").defaultNow().notNull(),
  },
  (table) => ({
    bomVersionIdx: index("idx_mfg_bom_version_history").on(table.bomId, table.version),
  }),
);

export const mfgRoutingsTable = pgTable(
  "mfg_routings_v2",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    itemId: text("item_id")
      .notNull()
      .references(() => itemsTable.id),
    routingType: text("routing_type").notNull().default("primary"),
    alternateCode: text("alternate_code").notNull().default("PRIMARY"),
    version: text("version").notNull().default("1.0"),
    status: text("status").notNull().default("draft"),
    isDefault: boolean("is_default").notNull().default(false),
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
    notes: text("notes"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    routingUnique: uniqueIndex("uq_mfg_routings_item_variant_version").on(
      table.itemId,
      table.routingType,
      table.alternateCode,
      table.version,
    ),
  }),
);

export const mfgRoutingOperationsTable = pgTable(
  "mfg_routing_operations_v2",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    routingId: text("routing_id")
      .notNull()
      .references(() => mfgRoutingsTable.id, { onDelete: "cascade" }),
    sequenceNumber: integer("sequence_number").notNull(),
    operationCode: text("operation_code"),
    name: text("name").notNull(),
    workCenterId: text("work_center_id")
      .notNull()
      .references(() => mfgWorkCentersTable.id),
    standardTimeMinutes: numeric("standard_time_minutes", { precision: 12, scale: 2 }).notNull().default("0"),
    setupTimeMinutes: numeric("setup_time_minutes", { precision: 12, scale: 2 }).notNull().default("0"),
    laborRequirements: jsonb("labor_requirements"),
    toolRequirements: jsonb("tool_requirements"),
    predecessorSequence: integer("predecessor_sequence"),
    reworkLoopToSequence: integer("rework_loop_to_sequence"),
    allowRework: boolean("allow_rework").notNull().default(false),
    isReworkOperation: boolean("is_rework_operation").notNull().default(false),
    notes: text("notes"),
  },
  (table) => ({
    routingSeqUnique: uniqueIndex("uq_mfg_routing_operations_seq").on(table.routingId, table.sequenceNumber),
    routingIdx: index("idx_mfg_routing_operations_routing").on(table.routingId),
  }),
);

export const mfgOperationMaterialsTable = pgTable(
  "mfg_operation_materials",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    routingOperationId: text("routing_operation_id")
      .notNull()
      .references(() => mfgRoutingOperationsTable.id, { onDelete: "cascade" }),
    componentItemId: text("component_item_id")
      .notNull()
      .references(() => itemsTable.id),
    bomComponentId: text("bom_component_id").references(() => mfgBomComponentsTable.id),
    quantity: numeric("quantity", { precision: 16, scale: 6 }).notNull(),
    uom: text("uom").notNull().default("EA"),
    consumptionType: text("consumption_type").notNull().default("per_unit"),
    scrapFactor: numeric("scrap_factor", { precision: 8, scale: 4 }).notNull().default("0"),
    notes: text("notes"),
  },
  (table) => ({
    opIdx: index("idx_mfg_operation_materials_op").on(table.routingOperationId),
  }),
);

export const mfgJobsTable = pgTable(
  "mfg_jobs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    jobNumber: text("job_number").notNull().unique(),
    sourceType: text("source_type").notNull().default("work_order"),
    sourceId: text("source_id"),
    itemId: text("item_id")
      .notNull()
      .references(() => itemsTable.id),
    quantity: numeric("quantity", { precision: 16, scale: 6 }).notNull(),
    uom: text("uom").notNull().default("EA"),
    priority: text("priority").notNull().default("normal"),
    releaseDate: timestamp("release_date").notNull(),
    dueDate: timestamp("due_date").notNull(),
    status: text("status").notNull().default("released"),
    selectedBomId: text("selected_bom_id").references(() => mfgBomsTable.id),
    selectedRoutingId: text("selected_routing_id").references(() => mfgRoutingsTable.id),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    dueDateIdx: index("idx_mfg_jobs_due_date").on(table.dueDate),
    statusIdx: index("idx_mfg_jobs_status").on(table.status),
  }),
);

export const mfgJobOperationsTable = pgTable(
  "mfg_job_operations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    jobId: text("job_id")
      .notNull()
      .references(() => mfgJobsTable.id, { onDelete: "cascade" }),
    routingOperationId: text("routing_operation_id").references(() => mfgRoutingOperationsTable.id),
    operationCode: text("operation_code"),
    sequenceNumber: integer("sequence_number").notNull(),
    workCenterId: text("work_center_id")
      .notNull()
      .references(() => mfgWorkCentersTable.id),
    setupMinutes: integer("setup_minutes").notNull().default(0),
    runMinutes: integer("run_minutes").notNull().default(0),
    status: text("status").notNull().default("queued"),
    materialReady: boolean("material_ready").notNull().default(true),
    predecessorOperationId: text("predecessor_operation_id"),
    plannedStart: timestamp("planned_start"),
    plannedEnd: timestamp("planned_end"),
    actualStart: timestamp("actual_start"),
    actualEnd: timestamp("actual_end"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    jobSeqUnique: uniqueIndex("uq_mfg_job_operations_job_seq").on(table.jobId, table.sequenceNumber),
    wcStatusIdx: index("idx_mfg_job_operations_wc_status").on(table.workCenterId, table.status),
  }),
);

export const mfgJobMaterialConstraintsTable = pgTable(
  "mfg_job_material_constraints",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    jobOperationId: text("job_operation_id")
      .notNull()
      .references(() => mfgJobOperationsTable.id, { onDelete: "cascade" }),
    itemId: text("item_id")
      .notNull()
      .references(() => itemsTable.id),
    requiredQty: numeric("required_qty", { precision: 16, scale: 6 }).notNull(),
    availableQty: numeric("available_qty", { precision: 16, scale: 6 }).notNull().default("0"),
    reservedQty: numeric("reserved_qty", { precision: 16, scale: 6 }).notNull().default("0"),
    uom: text("uom").notNull().default("EA"),
    isBlocking: boolean("is_blocking").notNull().default(true),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    opIdx: index("idx_mfg_job_material_constraints_op").on(table.jobOperationId),
  }),
);

export const mfgQueueEntriesTable = pgTable(
  "mfg_queue_entries",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workCenterId: text("work_center_id")
      .notNull()
      .references(() => mfgWorkCentersTable.id, { onDelete: "cascade" }),
    jobId: text("job_id").references(() => mfgJobsTable.id),
    jobOperationId: text("job_operation_id").references(() => mfgJobOperationsTable.id),
    dueDate: timestamp("due_date"),
    releaseDate: timestamp("release_date"),
    processingMinutes: integer("processing_minutes").notNull(),
    priorityScore: numeric("priority_score", { precision: 12, scale: 4 }),
    materialReady: boolean("material_ready").notNull().default(true),
    constraintBlocked: boolean("constraint_blocked").notNull().default(false),
    status: text("status").notNull().default("queued"),
    dispatchRuleSnapshot: text("dispatch_rule_snapshot"),
    metadata: jsonb("metadata"),
    queuedAt: timestamp("queued_at").defaultNow().notNull(),
    dispatchedAt: timestamp("dispatched_at"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    queueIdx: index("idx_mfg_queue_entries_wc_status").on(table.workCenterId, table.status),
    dueIdx: index("idx_mfg_queue_entries_due").on(table.dueDate),
  }),
);

export const mfgSchedulesTable = pgTable(
  "mfg_schedules",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    scheduleMode: text("schedule_mode").notNull(),
    dispatchRule: text("dispatch_rule").notNull(),
    horizonStart: date("horizon_start").notNull(),
    horizonEnd: date("horizon_end").notNull(),
    status: text("status").notNull().default("completed"),
    isSimulation: boolean("is_simulation").notNull().default(false),
    scenarioName: text("scenario_name"),
    requestPayload: jsonb("request_payload"),
    resultSummary: jsonb("result_summary"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    createdIdx: index("idx_mfg_schedules_created").on(table.createdAt),
  }),
);

export const mfgScheduleAssignmentsTable = pgTable(
  "mfg_schedule_assignments",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    scheduleId: text("schedule_id")
      .notNull()
      .references(() => mfgSchedulesTable.id, { onDelete: "cascade" }),
    jobId: text("job_id").references(() => mfgJobsTable.id),
    jobOperationId: text("job_operation_id").references(() => mfgJobOperationsTable.id),
    workCenterId: text("work_center_id")
      .notNull()
      .references(() => mfgWorkCentersTable.id),
    scheduledDate: date("scheduled_date").notNull(),
    consumedMinutes: integer("consumed_minutes").notNull(),
    dispatchSequence: integer("dispatch_sequence").notNull(),
    constraintSummary: jsonb("constraint_summary"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    schedIdx: index("idx_mfg_schedule_assignments_schedule").on(table.scheduleId, table.dispatchSequence),
  }),
);

export const mfgEventsTable = pgTable(
  "mfg_events",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    eventType: text("event_type").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    payload: jsonb("payload"),
    status: text("status").notNull().default("pending"),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
    processedAt: timestamp("processed_at"),
    errorMessage: text("error_message"),
  },
  (table) => ({
    eventTypeIdx: index("idx_mfg_events_type_time").on(table.eventType, table.occurredAt),
  }),
);

export const mfgDocSpacesTable = pgTable(
  "mfg_doc_spaces",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    spaceKey: text("space_key").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index("idx_mfg_doc_spaces_name").on(table.name),
  }),
);

export const mfgDocPagesTable = pgTable(
  "mfg_doc_pages",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    spaceId: text("space_id")
      .notNull()
      .references(() => mfgDocSpacesTable.id, { onDelete: "cascade" }),
    parentPageId: text("parent_page_id"),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    status: text("status").notNull().default("active"),
    currentVersion: integer("current_version").notNull().default(1),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    slugUnique: uniqueIndex("uq_mfg_doc_pages_space_slug").on(table.spaceId, table.slug),
    parentIdx: index("idx_mfg_doc_pages_parent").on(table.parentPageId),
  }),
);

export const mfgDocPageVersionsTable = pgTable(
  "mfg_doc_page_versions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    pageId: text("page_id")
      .notNull()
      .references(() => mfgDocPagesTable.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    contentMarkdown: text("content_markdown").notNull(),
    changeSummary: text("change_summary"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    versionUnique: uniqueIndex("uq_mfg_doc_page_versions_page_version").on(table.pageId, table.version),
  }),
);

export const mfgDocAttachmentsTable = pgTable(
  "mfg_doc_attachments",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    pageId: text("page_id")
      .notNull()
      .references(() => mfgDocPagesTable.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    objectKey: text("object_key").notNull(),
    bucket: text("bucket").notNull(),
    etag: text("etag"),
    attachmentVersion: integer("attachment_version").notNull().default(1),
    uploadedBy: text("uploaded_by"),
    uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  },
  (table) => ({
    pageIdx: index("idx_mfg_doc_attachments_page").on(table.pageId),
  }),
);

export const mfgDocTagsTable = pgTable(
  "mfg_doc_tags",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tagNameIdx: index("idx_mfg_doc_tags_name").on(table.name),
  }),
);

export const mfgDocPageTagsTable = pgTable(
  "mfg_doc_page_tags",
  {
    pageId: text("page_id")
      .notNull()
      .references(() => mfgDocPagesTable.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => mfgDocTagsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.pageId, table.tagId] }),
  }),
);

export const mfgDocLinksTable = pgTable(
  "mfg_doc_links",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    pageId: text("page_id")
      .notNull()
      .references(() => mfgDocPagesTable.id, { onDelete: "cascade" }),
    linkType: text("link_type").notNull(),
    targetId: text("target_id").notNull(),
    targetRef: text("target_ref"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    linkLookupIdx: index("idx_mfg_doc_links_lookup").on(table.linkType, table.targetId),
  }),
);

export const mfgDocPermissionsTable = pgTable(
  "mfg_doc_permissions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    spaceId: text("space_id").references(() => mfgDocSpacesTable.id, { onDelete: "cascade" }),
    pageId: text("page_id").references(() => mfgDocPagesTable.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    permission: text("permission").notNull(),
    granted: boolean("granted").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    permissionIdx: index("idx_mfg_doc_permissions_lookup").on(table.role, table.permission),
  }),
);

export const mfgDocAuditHistoryTable = pgTable(
  "mfg_doc_audit_history",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    pageId: text("page_id").references(() => mfgDocPagesTable.id, { onDelete: "cascade" }),
    pageVersionId: text("page_version_id").references(() => mfgDocPageVersionsTable.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    performedBy: text("performed_by"),
    details: jsonb("details"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    pageAuditIdx: index("idx_mfg_doc_audit_history_page").on(table.pageId, table.createdAt),
  }),
);

export type MfgWorkCenter = typeof mfgWorkCentersTable.$inferSelect;
export type MfgBom = typeof mfgBomsTable.$inferSelect;
export type MfgRouting = typeof mfgRoutingsTable.$inferSelect;
export type MfgJob = typeof mfgJobsTable.$inferSelect;
export type MfgQueueEntry = typeof mfgQueueEntriesTable.$inferSelect;
export type MfgSchedule = typeof mfgSchedulesTable.$inferSelect;
export type MfgDocPage = typeof mfgDocPagesTable.$inferSelect;