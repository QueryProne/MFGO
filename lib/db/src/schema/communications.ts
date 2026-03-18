import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const commOutboundMailboxConfigsTable = pgTable(
  "comm_outbound_mailbox_configs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    providerName: text("provider_name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    fromAddress: text("from_address").notNull(),
    replyTo: text("reply_to"),
    providerConfig: jsonb("provider_config"),
    authConfig: jsonb("auth_config"),
    allowedRecipientDomains: jsonb("allowed_recipient_domains"),
    blockedRecipientDomains: jsonb("blocked_recipient_domains"),
    requireApprovalForExternal: boolean("require_approval_for_external").notNull().default(false),
    retryPolicy: jsonb("retry_policy"),
    retentionPolicy: jsonb("retention_policy"),
    defaultTenantId: text("default_tenant_id").notNull().default("default"),
    defaultCompanyId: text("default_company_id"),
    defaultSiteId: text("default_site_id"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    providerIdx: index("idx_comm_outbound_mailbox_provider").on(table.providerName, table.isActive),
  }),
);

export const commInboundMailboxConfigsTable = pgTable(
  "comm_inbound_mailbox_configs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    providerName: text("provider_name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    mailboxAddress: text("mailbox_address").notNull(),
    connectionConfig: jsonb("connection_config"),
    authConfig: jsonb("auth_config"),
    routingRules: jsonb("routing_rules"),
    allowedSenderDomains: jsonb("allowed_sender_domains"),
    defaultTenantId: text("default_tenant_id").notNull().default("default"),
    defaultCompanyId: text("default_company_id"),
    defaultSiteId: text("default_site_id"),
    lastPolledAt: timestamp("last_polled_at"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    providerIdx: index("idx_comm_inbound_mailbox_provider").on(table.providerName, table.isActive),
    mailboxUnique: uniqueIndex("uq_comm_inbound_mailbox_address").on(table.mailboxAddress),
  }),
);

export const commEmailTemplatesTable = pgTable(
  "comm_email_templates",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    code: text("code").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    module: text("module").notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    companyBranding: jsonb("company_branding"),
    defaultFromAddress: text("default_from_address"),
    defaultReplyTo: text("default_reply_to"),
    defaultMailboxConfigId: text("default_mailbox_config_id").references(() => commOutboundMailboxConfigsTable.id, {
      onDelete: "set null",
    }),
    activeVersionId: text("active_version_id"),
    tenantId: text("tenant_id").notNull().default("default"),
    companyId: text("company_id"),
    siteId: text("site_id"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantCodeUnique: uniqueIndex("uq_comm_email_templates_tenant_code").on(table.tenantId, table.code),
    categoryIdx: index("idx_comm_email_templates_category").on(table.category, table.module),
  }),
);

export const commEmailTemplateVersionsTable = pgTable(
  "comm_email_template_versions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    templateId: text("template_id")
      .notNull()
      .references(() => commEmailTemplatesTable.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: text("status").notNull().default("draft"),
    isActive: boolean("is_active").notNull().default(false),
    subjectTemplate: text("subject_template").notNull(),
    bodyHtmlTemplate: text("body_html_template"),
    bodyTextTemplate: text("body_text_template"),
    placeholderSchema: jsonb("placeholder_schema"),
    changeNotes: text("change_notes"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    templateVersionUnique: uniqueIndex("uq_comm_email_template_versions_template_version").on(table.templateId, table.version),
    templateActiveIdx: index("idx_comm_email_template_versions_template_active").on(table.templateId, table.isActive),
  }),
);

export const commEmailConversationsTable = pgTable(
  "comm_email_conversations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    conversationKey: text("conversation_key").notNull(),
    subject: text("subject"),
    threadRootMessageId: text("thread_root_message_id"),
    status: text("status").notNull().default("active"),
    tenantId: text("tenant_id").notNull().default("default"),
    companyId: text("company_id"),
    siteId: text("site_id"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    lastMessageAt: timestamp("last_message_at"),
  },
  (table) => ({
    tenantConversationKeyUnique: uniqueIndex("uq_comm_email_conversations_tenant_key").on(table.tenantId, table.conversationKey),
    tenantLatestIdx: index("idx_comm_email_conversations_tenant_last").on(table.tenantId, table.lastMessageAt),
  }),
);

export const commEmailMessagesTable = pgTable(
  "comm_email_messages",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    direction: text("direction").notNull(),
    status: text("status").notNull().default("draft"),
    subject: text("subject").notNull().default(""),
    bodyHtml: text("body_html"),
    bodyText: text("body_text"),
    fromAddress: text("from_address").notNull(),
    replyTo: text("reply_to"),
    messageId: text("message_id"),
    inReplyTo: text("in_reply_to"),
    referencesHeader: text("references_header"),
    conversationId: text("conversation_id").references(() => commEmailConversationsTable.id, { onDelete: "set null" }),
    parentMessageId: text("parent_message_id"),
    templateId: text("template_id").references(() => commEmailTemplatesTable.id, { onDelete: "set null" }),
    templateVersionId: text("template_version_id").references(() => commEmailTemplateVersionsTable.id, { onDelete: "set null" }),
    mailboxConfigId: text("mailbox_config_id").references(() => commOutboundMailboxConfigsTable.id, { onDelete: "set null" }),
    providerName: text("provider_name"),
    providerMessageId: text("provider_message_id"),
    idempotencyKey: text("idempotency_key"),
    approvalStatus: text("approval_status").notNull().default("not_required"),
    requiresApproval: boolean("requires_approval").notNull().default(false),
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at"),
    sendAfter: timestamp("send_after"),
    sourceModule: text("source_module"),
    sourceAction: text("source_action"),
    createdBy: text("created_by"),
    isImmutable: boolean("is_immutable").notNull().default(false),
    lastError: text("last_error"),
    tenantId: text("tenant_id").notNull().default("default"),
    companyId: text("company_id"),
    siteId: text("site_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    queuedAt: timestamp("queued_at"),
    sentAt: timestamp("sent_at"),
    receivedAt: timestamp("received_at"),
    archivedAt: timestamp("archived_at"),
  },
  (table) => ({
    messageIdUnique: uniqueIndex("uq_comm_email_messages_tenant_message_id").on(table.tenantId, table.messageId),
    idempotencyUnique: uniqueIndex("uq_comm_email_messages_tenant_idempotency").on(table.tenantId, table.idempotencyKey),
    statusIdx: index("idx_comm_email_messages_status").on(table.status, table.queuedAt),
    conversationIdx: index("idx_comm_email_messages_conversation").on(table.conversationId, table.createdAt),
    providerIdx: index("idx_comm_email_messages_provider").on(table.providerName, table.providerMessageId),
    recordSourceIdx: index("idx_comm_email_messages_source").on(table.sourceModule, table.sourceAction),
  }),
);

export const commEmailRecipientsTable = pgTable(
  "comm_email_recipients",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    messageId: text("message_id")
      .notNull()
      .references(() => commEmailMessagesTable.id, { onDelete: "cascade" }),
    recipientType: text("recipient_type").notNull(),
    emailAddress: text("email_address").notNull(),
    displayName: text("display_name"),
    deliveryStatus: text("delivery_status"),
    deliveredAt: timestamp("delivered_at"),
    openedAt: timestamp("opened_at"),
    bounceReason: text("bounce_reason"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    messageRecipientIdx: index("idx_comm_email_recipients_message_type").on(table.messageId, table.recipientType, table.sortOrder),
    recipientLookupIdx: index("idx_comm_email_recipients_email").on(table.emailAddress),
  }),
);

export const commEmailAttachmentsTable = pgTable(
  "comm_email_attachments",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    checksum: text("checksum"),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id"),
    objectStorageKey: text("object_storage_key").notNull(),
    objectStorageBucket: text("object_storage_bucket"),
    createdBy: text("created_by"),
    visibilityMetadata: jsonb("visibility_metadata"),
    metadata: jsonb("metadata"),
    tenantId: text("tenant_id").notNull().default("default"),
    companyId: text("company_id"),
    siteId: text("site_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    sourceIdx: index("idx_comm_email_attachments_source").on(table.sourceType, table.sourceId),
    objectKeyIdx: index("idx_comm_email_attachments_object_key").on(table.objectStorageKey),
  }),
);

export const commEmailMessageAttachmentsTable = pgTable(
  "comm_email_message_attachments",
  {
    messageId: text("message_id")
      .notNull()
      .references(() => commEmailMessagesTable.id, { onDelete: "cascade" }),
    attachmentId: text("attachment_id")
      .notNull()
      .references(() => commEmailAttachmentsTable.id, { onDelete: "restrict" }),
    disposition: text("disposition").notNull().default("attachment"),
    inlineCid: text("inline_cid"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.messageId, table.attachmentId] }),
    attachmentIdx: index("idx_comm_email_message_attachments_attachment").on(table.attachmentId),
  }),
);

export const commEmailContextLinksTable = pgTable(
  "comm_email_context_links",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    messageId: text("message_id")
      .notNull()
      .references(() => commEmailMessagesTable.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    relatedEntityType: text("related_entity_type"),
    relatedEntityId: text("related_entity_id"),
    linkRole: text("link_role").notNull().default("primary"),
    tenantId: text("tenant_id").notNull().default("default"),
    companyId: text("company_id"),
    siteId: text("site_id"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    entityIdx: index("idx_comm_email_context_links_entity").on(table.entityType, table.entityId, table.createdAt),
    messageIdx: index("idx_comm_email_context_links_message").on(table.messageId),
  }),
);

export const commEmailSendAttemptsTable = pgTable(
  "comm_email_send_attempts",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    messageId: text("message_id")
      .notNull()
      .references(() => commEmailMessagesTable.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull(),
    providerName: text("provider_name").notNull(),
    providerMessageId: text("provider_message_id"),
    status: text("status").notNull(),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    requestPayload: jsonb("request_payload"),
    responsePayload: jsonb("response_payload"),
    latencyMs: integer("latency_ms"),
    nextRetryAt: timestamp("next_retry_at"),
    attemptedAt: timestamp("attempted_at").defaultNow().notNull(),
  },
  (table) => ({
    messageAttemptIdx: index("idx_comm_email_send_attempts_message_attempt").on(table.messageId, table.attemptNumber),
    statusRetryIdx: index("idx_comm_email_send_attempts_status_retry").on(table.status, table.nextRetryAt),
  }),
);

export const commEmailProviderEventsTable = pgTable(
  "comm_email_provider_events",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    messageId: text("message_id").references(() => commEmailMessagesTable.id, { onDelete: "set null" }),
    providerName: text("provider_name").notNull(),
    providerEventId: text("provider_event_id"),
    eventType: text("event_type").notNull(),
    eventStatus: text("event_status"),
    payload: jsonb("payload"),
    headers: jsonb("headers"),
    tenantId: text("tenant_id").notNull().default("default"),
    companyId: text("company_id"),
    siteId: text("site_id"),
    receivedAt: timestamp("received_at").defaultNow().notNull(),
    processedAt: timestamp("processed_at"),
    processingError: text("processing_error"),
  },
  (table) => ({
    providerEventUnique: uniqueIndex("uq_comm_email_provider_events_provider_event").on(table.providerName, table.providerEventId),
    receivedIdx: index("idx_comm_email_provider_events_received").on(table.receivedAt),
  }),
);

export const commCommunicationAuditLogsTable = pgTable(
  "comm_communication_audit_logs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    action: text("action").notNull(),
    actorId: text("actor_id"),
    actorName: text("actor_name"),
    actorRole: text("actor_role"),
    messageId: text("message_id").references(() => commEmailMessagesTable.id, { onDelete: "set null" }),
    templateId: text("template_id").references(() => commEmailTemplatesTable.id, { onDelete: "set null" }),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    details: jsonb("details"),
    source: text("source").notNull().default("api"),
    immutable: boolean("immutable").notNull().default(true),
    tenantId: text("tenant_id").notNull().default("default"),
    companyId: text("company_id"),
    siteId: text("site_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    actionIdx: index("idx_comm_communication_audit_logs_action").on(table.action, table.createdAt),
    entityIdx: index("idx_comm_communication_audit_logs_entity").on(table.entityType, table.entityId, table.createdAt),
  }),
);

export const commEmailOutboxTable = pgTable(
  "comm_email_outbox",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    messageId: text("message_id")
      .notNull()
      .references(() => commEmailMessagesTable.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("queued"),
    availableAt: timestamp("available_at").notNull().defaultNow(),
    lockedAt: timestamp("locked_at"),
    lockedBy: text("locked_by"),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    messageUnique: uniqueIndex("uq_comm_email_outbox_message").on(table.messageId),
    statusAvailableIdx: index("idx_comm_email_outbox_status_available").on(table.status, table.availableAt),
  }),
);

export type CommEmailMessage = typeof commEmailMessagesTable.$inferSelect;
export type CommEmailRecipient = typeof commEmailRecipientsTable.$inferSelect;
export type CommEmailAttachment = typeof commEmailAttachmentsTable.$inferSelect;
export type CommEmailTemplate = typeof commEmailTemplatesTable.$inferSelect;
export type CommEmailTemplateVersion = typeof commEmailTemplateVersionsTable.$inferSelect;
export type CommEmailContextLink = typeof commEmailContextLinksTable.$inferSelect;
export type CommEmailSendAttempt = typeof commEmailSendAttemptsTable.$inferSelect;
export type CommEmailConversation = typeof commEmailConversationsTable.$inferSelect;
export type CommEmailProviderEvent = typeof commEmailProviderEventsTable.$inferSelect;
export type CommInboundMailboxConfig = typeof commInboundMailboxConfigsTable.$inferSelect;
export type CommOutboundMailboxConfig = typeof commOutboundMailboxConfigsTable.$inferSelect;
export type CommCommunicationAuditLog = typeof commCommunicationAuditLogsTable.$inferSelect;
export type CommEmailOutbox = typeof commEmailOutboxTable.$inferSelect;
