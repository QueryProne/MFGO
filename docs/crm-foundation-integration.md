# MFGO CRM + Copilot Integration Guide

This guide explains how to plug shared Tasks, Email, Timeline, and AI Copilot into any MFGO module page.

## 1) Use Shared Tasks on Any Entity

Frontend:

```tsx
import { TaskList } from "@/components/tasks/task-list";

<TaskList entityType="workorder" entityId={workOrderId} />
```

Backend data model:
- `tasks.entity_type`
- `tasks.entity_id`

API:
- `GET /api/tasks/entity/:type/:id`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`

## 2) Use Shared Email Composer on Any Entity

Frontend:

```tsx
import { EmailComposer } from "@/components/email/email-composer";

<EmailComposer entityType="vendor" entityId={vendorId} defaultTo={vendorEmail} />
```

API:
- `POST /api/emails` (draft/send/queue)
- `PATCH /api/emails/:id`
- `POST /api/emails/:id/send`
- `POST /api/emails/:id/queue`
- `GET /api/emails/entity/:type/:id`

Notes:
- Uses existing communications subsystem under the hood.
- Context links are created with `entityType/entityId`.

## 3) Show Unified Activity Timeline

Frontend:

```tsx
import { UnifiedActivityTimeline } from "@/components/activity/unified-activity-timeline";

<UnifiedActivityTimeline entityType="customer" entityId={customerId} />
```

API:
- `GET /api/timeline/:entityType/:entityId`

Timeline merges:
- Tasks
- Emails (context-linked)
- AI chat logs
- Explicit timeline activities

## 4) Add Read-Only AI Copilot

Frontend:

```tsx
import { AICopilotChat } from "@/components/ai/ai-copilot-chat";

<AICopilotChat entityType="opportunity" entityId={opportunityId} />
```

API:
- `POST /api/chat` (`stream: true` enabled)
- `GET /api/chat/logs`

Security:
- Backend-only LLM call
- Query/context logging in `chat_logs`
- Sensitive text redaction before provider call

## 5) CRM Funnel Endpoints

Leads:
- `GET /api/leads`
- `POST /api/leads`
- `GET /api/leads/:id`
- `PATCH /api/leads/:id`
- `POST /api/leads/:id/score`
- `POST /api/leads/:id/convert`

Opportunities:
- `GET /api/opportunities`
- `POST /api/opportunities`
- `GET /api/opportunities/:id`
- `PATCH /api/opportunities/:id`
- `GET /api/opportunities/:id/stage-history`
- `GET /api/opportunities-forecast`

Automation:
- `GET /api/automation-rules`
- `POST /api/automation-rules`
- `PATCH /api/automation-rules/:id`

## 6) PWA Basics

Files added:
- `artifacts/erp/public/manifest.webmanifest`
- `artifacts/erp/public/sw.js`

`main.tsx` registers the service worker in production builds.
