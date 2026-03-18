# ERP Communication Subsystem (Production Design + Implementation)

## 1. High-Level Architecture

The communication platform is implemented as a shared backend subsystem centered on a domain service and DB-backed outbox pipeline.

- API/Application layer: [`artifacts/api-server/src/routes/communications.ts`](../artifacts/api-server/src/routes/communications.ts)
- Domain/service layer: [`artifacts/api-server/src/modules/communications/service.ts`](../artifacts/api-server/src/modules/communications/service.ts)
- Template renderer: [`artifacts/api-server/src/modules/communications/template-engine.ts`](../artifacts/api-server/src/modules/communications/template-engine.ts)
- Attachment resolution/security: [`artifacts/api-server/src/modules/communications/attachments.ts`](../artifacts/api-server/src/modules/communications/attachments.ts), [`security.ts`](../artifacts/api-server/src/modules/communications/security.ts)
- Outbound provider abstraction: [`provider.ts`](../artifacts/api-server/src/modules/communications/provider.ts), [`providers/mock-provider.ts`](../artifacts/api-server/src/modules/communications/providers/mock-provider.ts)
- Persistence/audit model: [`lib/db/src/schema/communications.ts`](../lib/db/src/schema/communications.ts)
- Background processing model: DB outbox + worker trigger (`processOutboxBatch`) with retry/dead-letter logic

## 2. Detailed Domain/Data Model

Implemented normalized entities:

- `comm_email_messages` (`EmailMessage`)
- `comm_email_recipients` (`EmailRecipient`)
- `comm_email_attachments` (`EmailAttachment`)
- `comm_email_templates` (`EmailTemplate`)
- `comm_email_template_versions` (`EmailTemplateVersion`)
- `comm_email_context_links` (`EmailContextLink`)
- `comm_email_send_attempts` (`EmailSendAttempt`)
- `comm_email_conversations` (`EmailConversation`)
- `comm_email_provider_events` (`EmailProviderEvent`)
- `comm_inbound_mailbox_configs` (`InboundMailboxConfig`)
- `comm_outbound_mailbox_configs` (`OutboundMailboxConfig`)
- `comm_communication_audit_logs` (`CommunicationAuditLog`)
- `comm_email_outbox` (queue/retry/dead-letter support)
- `comm_email_message_attachments` (many-to-many attachment linking)

## 3. Database Schema

Schema is implemented in:

- [`lib/db/src/schema/communications.ts`](../lib/db/src/schema/communications.ts)
- Exported via [`lib/db/src/schema/index.ts`](../lib/db/src/schema/index.ts)

Design notes:

- UUID text PKs (`crypto.randomUUID`), timestamp audit columns
- Tenant/company/site scoping columns for ERP multi-context
- Referential integrity with cascading deletes where appropriate
- Indexes for timeline/search (`status`, `conversation`, `provider`, `entity_type/entity_id`, outbox `status+available_at`)
- Uniqueness for template code per tenant and conversation/thread keys

## 4. Provider Abstraction Interfaces

Provider abstraction in:

- [`artifacts/api-server/src/modules/communications/provider.ts`](../artifacts/api-server/src/modules/communications/provider.ts)

Interface supports:

- `sendEmail(payload)`
- `parseWebhook(payload, headers)`
- `validateConfiguration(config)`
- internal status mapping (`mapProviderEventToInternalStatus`)

Reference provider implementation:

- [`artifacts/api-server/src/modules/communications/providers/mock-provider.ts`](../artifacts/api-server/src/modules/communications/providers/mock-provider.ts)

This is compatible with adding SMTP, Microsoft Graph, Gmail API, SES/SendGrid/Mailgun adapters later.

## 5. Queueing / Retry Workflow

Implemented workflow:

1. Draft created in `comm_email_messages` (`status=draft`)
2. Queue action inserts/updates `comm_email_outbox` (`status=queued`, `available_at`)
3. Worker (`processOutboxBatch`) claims entries (`status=processing`, lock metadata)
4. Provider send attempt recorded in `comm_email_send_attempts`
5. On success: message -> `sent`, outbox -> `completed`
6. On transient failure: outbox -> `retry_wait` with exponential backoff
7. On permanent/unrecoverable failure: outbox -> `dead_letter`, message -> `failed`

Retry policy normalization/backoff:

- [`types.ts`](../artifacts/api-server/src/modules/communications/types.ts)
- [`service.ts`](../artifacts/api-server/src/modules/communications/service.ts)

## 6. API Routes and Shapes

Implemented routes in:

- [`artifacts/api-server/src/routes/communications.ts`](../artifacts/api-server/src/routes/communications.ts)

### Core email APIs

- `POST /communications/emails/drafts`
- `PATCH /communications/emails/{id}`
- `POST /communications/emails/{id}/approve`
- `POST /communications/emails/{id}/queue`
- `POST /communications/emails/{id}/send`
- `POST /communications/emails/{id}/attachments`
- `POST /communications/emails/{id}/resend`
- `POST /communications/emails/{id}/retry`
- `PATCH /communications/emails/{id}/status`

### Timeline/thread APIs

- `GET /communications/records/{entityType}/{entityId}/emails`
- `GET /communications/conversations/{conversationId}`
- `GET /communications/search`

### Template APIs

- `POST /communications/templates/render`
- `GET /communications/admin/templates`
- `POST /communications/admin/templates`
- `POST /communications/admin/templates/{templateId}/versions`
- `POST /communications/admin/templates/{templateId}/activate/{versionId}`

### Mailbox/provider/admin APIs

- `GET /communications/admin/mailboxes/outbound`
- `POST /communications/admin/mailboxes/outbound`
- `GET /communications/admin/mailboxes/inbound`
- `POST /communications/admin/mailboxes/inbound`
- `POST /communications/inbound/webhook/{provider}`
- `GET /communications/admin/provider-events`
- `GET /communications/admin/outbox`
- `POST /communications/admin/queue/process`
- `GET /communications/admin/metrics`

## 7. Attachment Management Design

Attachment handling supports:

- uploaded/generated/external objects via metadata (`object_storage_key`, bucket)
- repository/doc attachments with explicit permission checks
- reusing prior email attachments (`source_type=email_attachment`)
- one attachment linked to multiple messages via `comm_email_message_attachments`

Key implementation:

- [`attachments.ts`](../artifacts/api-server/src/modules/communications/attachments.ts)
- [`security.ts`](../artifacts/api-server/src/modules/communications/security.ts)

Security property: repository access is verified independently and is not implied by email compose permission.

## 8. Template Engine Design

Template system supports:

- categorized/module-scoped templates
- multi-version templates with active-version promotion
- subject/html/text templates
- placeholder rendering with nested context (`{{record.field}}`)
- branding context injection
- preview endpoint

Implementation:

- [`template-engine.ts`](../artifacts/api-server/src/modules/communications/template-engine.ts)
- template CRUD/version APIs in routes/service

## 9. Record-Linking Strategy

Normalized context link model:

- `entity_type`, `entity_id`
- `related_entity_type`, `related_entity_id`
- `link_role`
- tenant/company/site dimensions

A single email can link to multiple records (e.g., PO + vendor + item + work order).

Implementation:

- [`comm_email_context_links` schema](../lib/db/src/schema/communications.ts)
- [`context-links.ts`](../artifacts/api-server/src/modules/communications/context-links.ts)

## 10. Inbound Email Processing Design

Inbound path:

1. Provider webhook -> `parseWebhook`
2. Delivery events written to `comm_email_provider_events`
3. Delivery states mapped to internal statuses
4. Inbound emails persisted as `direction=inbound`, `status=received`
5. Thread resolution via `in_reply_to`/`references`
6. Context linking by explicit token parsing (`[ctx:entityType:entityId]`) or parent-thread inheritance
7. Inbound attachments captured as metadata records

Implementation:

- [`service.ts` inbound methods](../artifacts/api-server/src/modules/communications/service.ts)

## 11. Security / RBAC Model

RBAC permissions added in:

- [`artifacts/api-server/src/lib/permissions.ts`](../artifacts/api-server/src/lib/permissions.ts)

New permissions include:

- `communications.view`, `compose`, `attach`, `send`, `retry`, `resend`, `approve`, `manage_status`, `templates.view`, `admin`

Controls implemented:

- route-level permission middleware
- recipient domain allow/deny policies per outbound mailbox
- approval gate (`requiresApproval` + `approvalStatus`)
- immutable communication audit events (`comm_communication_audit_logs`)
- attachment-source permission checks for repository attachments

## 12. End-to-End Workflow Examples

### A. Send BOM packet to supplier

1. Create draft with context links:
   - `entity_type=bom`, `entity_id=<bomId>`
   - `related_entity_type=vendor`, `related_entity_id=<vendorId>`
2. Attach BOM export and drawing/spec attachments
3. Queue/send
4. Delivery/retry status visible in record timeline

### B. Purchase order transmittal with specs

1. Draft from PO screen
2. Link to `purchase_order`, `vendor`, optional `item`
3. Attach generated PO PDF + repository specs
4. Queue + outbox processing
5. Provider events update status to delivered/opened/bounced

### C. Work order packet from scheduling screen

1. Draft linked to `work_order` and `routing_step`
2. Attach work instructions + drawing docs
3. Use template category `manufacturing`
4. Send now or schedule send-later (`send_after`)

### D. Engineering revision notice

1. Draft linked to document page + ECO entity
2. Select engineering-change template version
3. Bulk recipients by customer/vendor context
4. Inbound replies thread to same conversation

## 13. Recommended Folder Structure

Implemented structure:

- `lib/db/src/schema/communications.ts`
- `artifacts/api-server/src/modules/communications/`
  - `service.ts`
  - `provider.ts`
  - `providers/index.ts`
  - `providers/mock-provider.ts`
  - `template-engine.ts`
  - `attachments.ts`
  - `security.ts`
  - `context-links.ts`
  - `audit.ts`
  - `metrics.ts`
  - `http.ts`
  - `types.ts`
- `artifacts/api-server/src/routes/communications.ts`

## 14. Sample Core Service Implementation

Core service location:

- [`artifacts/api-server/src/modules/communications/service.ts`](../artifacts/api-server/src/modules/communications/service.ts)

Includes:

- draft lifecycle (create/update/approve)
- queue/send/retry/resend
- outbox processing with retry/dead-letter
- conversation/thread retrieval
- inbound webhook and inbound ingestion
- template and mailbox administration
- metrics snapshot retrieval

## 15. Scalability, Auditability, ERP Robustness Notes

Scalability and reliability features in this implementation:

- DB-backed outbox enables durable processing/recovery
- explicit send-at scheduling and retry windows
- idempotency fields on messages
- provider event persistence for forensic traceability
- normalized context links for cross-module timeline queries
- immutable communication audit log stream

Recommended next production hardening steps:

1. Move queue worker invocation from admin endpoint to dedicated worker process/cron loop.
2. Add real provider adapters (SES/Graph/SMTP/Gmail) and signature verification for webhooks.
3. Add OpenAPI specs + generated client bindings for communications routes.
4. Add retention/purge jobs for payloads/attachments per policy.
5. Add tracing/metrics export (Prometheus/OpenTelemetry) and alerting rules for dead-letter growth, webhook failures, and provider latency.
