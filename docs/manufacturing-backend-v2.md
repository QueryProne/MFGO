# Manufacturing Backend v2 (MES/ERP)

This document defines the modular backend implementation under `artifacts/api-server/src/routes/manufacturing-v2` and `lib/db/src/schema/manufacturing-v2.ts`.

## 1. Data Models (Schemas)

### Work Center Management
- `mfg_work_centers`
  - Core: `id`, `code`, `name`, `type` (`machine|labor|cell`), `capacity_model`, `efficiency_factor`, `default_setup_minutes`
  - Dispatching: `queue_policy` (`FIFO|EDD|SPT|CR`), `wip_limit`
  - Runtime: `runtime_status` (`idle|running|down|maintenance`), `lifecycle_status`
  - Setup config: `sequence_dependent_setup_matrix` (JSONB)
- `mfg_work_center_calendars`
  - Finite capacity buckets by day: `calendar_date`, `available_minutes`, `shift_windows`
- `mfg_work_center_resources`
  - Resource pool: machine/operator/tooling rows with `resource_type`, `quantity`, `skill_code`, `tooling_class`
- `mfg_work_center_state_transitions`
  - State-machine audit log for all runtime transitions
- `mfg_queue_entries`
  - Dispatch queue + constraints: `material_ready`, `constraint_blocked`, `processing_minutes`, `status`, `dispatch_rule_snapshot`

### BOM
- `mfg_boms`
  - Header: `parent_item_id`, `bom_type` (`engineering|manufacturing`), `alternate_code`, `version`, `effective_from/to`, `is_phantom`
- `mfg_bom_components`
  - Hierarchical lines: `parent_component_id`, `component_item_id`, `quantity`, `uom`, `operation_sequence`
  - Advanced: `is_phantom`, `is_optional`, `substitute_group`, effective dates
- `mfg_bom_version_history`
  - BOM snapshot/version control history

### Routing & Operations
- `mfg_routings_v2`
  - Routing header: `item_id`, `routing_type` (`primary|alternate|rework`), `alternate_code`, `version`
- `mfg_routing_operations_v2`
  - Step definition: `sequence_number`, `work_center_id`, `standard_time_minutes`, `setup_time_minutes`
  - Rework: `allow_rework`, `is_rework_operation`, `rework_loop_to_sequence`, `predecessor_sequence`
- `mfg_operation_materials`
  - Operation-level material consumption linked to routing operations

### Scheduling Engine
- `mfg_jobs`
  - Job/order abstraction for scheduling (`release_date`, `due_date`, selected BOM/routing)
- `mfg_job_operations`
  - Job operation instances with precedence, material readiness, planned/actual timestamps
- `mfg_job_material_constraints`
  - Constraint rows for material availability checks
- `mfg_schedules`
  - Schedule runs/simulations metadata
- `mfg_schedule_assignments`
  - Result assignments by work center/day/sequence
- `mfg_events`
  - Event store for `job.released`, `operation.completed`, `machine.downtime`

### Document / Knowledge Repository
- `mfg_doc_spaces`
- `mfg_doc_pages` (hierarchical via `parent_page_id`)
- `mfg_doc_page_versions` (markdown revision history)
- `mfg_doc_attachments` (S3-compatible metadata: `bucket`, `object_key`, `etag`)
- `mfg_doc_tags`, `mfg_doc_page_tags`
- `mfg_doc_links` (links to BOM/work center/routing operations)
- `mfg_doc_permissions` (role/permission ACL)
- `mfg_doc_audit_history`

## 2. API Route Definitions

Base path: `/api/v2/manufacturing`

### Versioning
- `GET /versions`

### Work Centers
- `GET /work-centers`
- `POST /work-centers`
- `GET /work-centers/:id`
- `PUT /work-centers/:id`
- `PATCH /work-centers/:id/status`
- `GET /work-centers/:id/queue`
- `POST /work-centers/:id/queue`
- `POST /work-centers/:id/dispatch-next`

### BOM
- `GET /boms`
- `POST /boms`
- `GET /boms/:id`
- `PUT /boms/:id`
- `GET /boms/:id/versions`
- `POST /boms/:id/versions`
- `POST /boms/:id/explode`

### Routing
- `GET /routings`
- `POST /routings`
- `GET /routings/:id`
- `PUT /routings/:id`

### Scheduling / Events
- `GET /jobs`
- `POST /jobs`
- `POST /schedules/run`
- `POST /schedules/simulate`
- `GET /schedules/:id`
- `POST /events`

### Knowledge Repository
- `GET /docs/spaces`
- `POST /docs/spaces`
- `GET /docs/pages`
- `POST /docs/pages`
- `GET /docs/pages/:id`
- `POST /docs/pages/:id/versions`
- `GET /docs/pages/:id/history`
- `POST /docs/pages/:id/attachments`
- `POST /docs/pages/:id/tags`
- `POST /docs/pages/:id/links`
- `POST /docs/permissions`
- `GET /docs/search`
- `GET /docs/audit`

## 3. Core Scheduling Logic

Implemented in `artifacts/api-server/src/modules/mfg-v2/scheduler.ts`.

### Dispatch Rules
- `FIFO`: earliest release first
- `EDD`: earliest due date first
- `SPT`: shortest processing time first
- `CR`: lowest critical ratio first, where:
  - `CR = (time until due in minutes) / processing minutes`

### Finite Capacity
- Capacity is modeled by work-center/day buckets (`available_minutes`)
- Each operation consumes `setup_minutes + run_minutes`
- Forward mode chooses earliest feasible day
- Backward mode chooses latest feasible day and enforces predecessor-before-successor

### Constraints
- Material constraints from `mfg_job_material_constraints`
- Operation precedence from `predecessor_operation_id` (or sequence chain fallback)
- Unscheduled reasons are captured as:
  - `material_unavailable`
  - `capacity_constrained`
  - `precedence_unsatisfied`

### Event-Driven Triggers
- `job.released`: enqueue first operations
- `operation.completed`: mark done, enqueue successors
- `machine.downtime`: force work center `down`, block queued operations

## 4. Example SQL (Physical Schema)

Representative SQL equivalents:

```sql
create table mfg_work_centers (
  id text primary key,
  code text unique not null,
  name text not null,
  type text not null default 'machine',
  efficiency_factor numeric(8,4) not null default 1.0000,
  queue_policy text not null default 'FIFO',
  runtime_status text not null default 'idle',
  wip_limit integer
);

create table mfg_boms (
  id text primary key,
  parent_item_id text not null references items(id),
  bom_type text not null default 'manufacturing',
  alternate_code text not null default 'PRIMARY',
  version text not null default '1.0',
  effective_from date,
  effective_to date
);

create table mfg_routing_operations_v2 (
  id text primary key,
  routing_id text not null references mfg_routings_v2(id) on delete cascade,
  sequence_number integer not null,
  work_center_id text not null references mfg_work_centers(id),
  standard_time_minutes numeric(12,2) not null,
  setup_time_minutes numeric(12,2) not null
);
```

## 5. Sample Workflow

### Create BOM -> Create Routing -> Schedule -> Dispatch
1. `POST /api/v2/manufacturing/boms`
  - Create hierarchical BOM + component lines
2. `POST /api/v2/manufacturing/routings`
  - Define operations, work centers, setup/run times, operation-level material consumption
3. `POST /api/v2/manufacturing/jobs`
  - Release a job against the BOM/routing
4. `POST /api/v2/manufacturing/schedules/run`
  - Run finite-capacity schedule using chosen dispatch rule and direction
5. `GET /api/v2/manufacturing/work-centers/:id/queue`
  - View prioritized queue
6. `POST /api/v2/manufacturing/work-centers/:id/dispatch-next`
  - Dispatch next eligible operation

## 6. Folder Structure

```text
lib/
  db/
    src/schema/
      manufacturing-v2.ts

artifacts/
  api-server/
    src/modules/mfg-v2/
      scheduler.ts
      scheduler.test.ts
      workcenter-state.ts
      workcenter-state.test.ts
      bom-explosion.ts
      event-bus.ts
      http.ts
    src/routes/
      manufacturing-v2/
        index.ts
        shared.ts
        work-centers.ts
        bom.ts
        routing.ts
        scheduling.ts
        docs.ts
```

## 7. Storage & Integrity Notes

- Core transactional data stays in PostgreSQL (`lib/db` Drizzle schema)
- Attachments are S3-compatible via metadata table (`bucket`, `object_key`, `etag`)
- Versioning is explicit in BOM/routing/doc page design
- Auditability is provided via transition/event/history tables
- Referential integrity is enforced by foreign keys for all core joins