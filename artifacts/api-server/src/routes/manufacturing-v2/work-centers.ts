import { Router } from "express";
import {
  db,
  itemsTable,
  mfgEventsTable,
  mfgJobsTable,
  mfgJobOperationsTable,
  mfgQueueEntriesTable,
  mfgWorkCenterCalendarsTable,
  mfgWorkCenterResourcesTable,
  mfgWorkCentersTable,
  mfgWorkCenterStateTransitionsTable,
} from "@workspace/db";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";

import { auditLog } from "../../lib/audit";
import { rankDispatchCandidates, type DispatchRule } from "../../modules/mfg-v2/scheduler";
import { canTransitionWorkCenterState, nextWorkCenterState, type WorkCenterRuntimeStatus } from "../../modules/mfg-v2/workcenter-state";
import { parseDateParam, parsePagination } from "../../modules/mfg-v2/http";
import { SUPPORTED_DISPATCH_RULES, asString, toNumericString } from "./shared";

const router = Router();

async function getWorkCenterDetails(workCenterId: string) {
  const [workCenter] = await db
    .select()
    .from(mfgWorkCentersTable)
    .where(eq(mfgWorkCentersTable.id, workCenterId))
    .limit(1);

  if (!workCenter) {
    return null;
  }

  const [calendars, resources] = await Promise.all([
    db
      .select()
      .from(mfgWorkCenterCalendarsTable)
      .where(eq(mfgWorkCenterCalendarsTable.workCenterId, workCenterId))
      .orderBy(asc(mfgWorkCenterCalendarsTable.calendarDate)),
    db
      .select()
      .from(mfgWorkCenterResourcesTable)
      .where(eq(mfgWorkCenterResourcesTable.workCenterId, workCenterId))
      .orderBy(asc(mfgWorkCenterResourcesTable.resourceType), asc(mfgWorkCenterResourcesTable.resourceName)),
  ]);

  return { ...workCenter, calendars, resources };
}

router.get("/work-centers", async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>);
    const conditions = [];

    if (asString(req.query.type)) {
      conditions.push(eq(mfgWorkCentersTable.type, String(req.query.type)));
    }
    if (asString(req.query.status)) {
      conditions.push(eq(mfgWorkCentersTable.runtimeStatus, String(req.query.status)));
    }
    if (asString(req.query.queuePolicy)) {
      conditions.push(eq(mfgWorkCentersTable.queuePolicy, String(req.query.queuePolicy)));
    }
    if (asString(req.query.search)) {
      const term = `%${String(req.query.search)}%`;
      conditions.push(or(ilike(mfgWorkCentersTable.name, term), ilike(mfgWorkCentersTable.code, term)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db
        .select()
        .from(mfgWorkCentersTable)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(asc(mfgWorkCentersTable.name)),
      db.select({ count: sql<number>`count(*)` }).from(mfgWorkCentersTable).where(whereClause),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/work-centers", async (req, res) => {
  try {
    const body = req.body as {
      code: string;
      name: string;
      type?: string;
      capacityModel?: string;
      efficiencyFactor?: number | string;
      defaultSetupMinutes?: number | string;
      sequenceDependentSetupMatrix?: Record<string, unknown>;
      runtimeStatus?: WorkCenterRuntimeStatus;
      lifecycleStatus?: string;
      queuePolicy?: DispatchRule;
      wipLimit?: number;
      notes?: string;
      calendars?: Array<{ calendarDate: string; availableMinutes: number; shiftWindows?: unknown; isWorkingDay?: boolean; reasonCode?: string }>;
      resources?: Array<{
        resourceType: string;
        resourceCode?: string;
        resourceName: string;
        quantity?: number | string;
        availabilityStatus?: string;
        skillCode?: string;
        toolingClass?: string;
        metadata?: Record<string, unknown>;
      }>;
    };

    const queuePolicy = body.queuePolicy ?? "FIFO";
    if (!SUPPORTED_DISPATCH_RULES.includes(queuePolicy)) {
      res.status(400).json({ error: "bad_request", message: `Unsupported queue policy: ${queuePolicy}` });
      return;
    }

    const inserted = await db
      .insert(mfgWorkCentersTable)
      .values({
        code: body.code,
        name: body.name,
        type: body.type ?? "machine",
        capacityModel: body.capacityModel ?? "calendar_finite",
        efficiencyFactor: toNumericString(body.efficiencyFactor, "1.0000"),
        defaultSetupMinutes: toNumericString(body.defaultSetupMinutes, "0"),
        sequenceDependentSetupMatrix: body.sequenceDependentSetupMatrix ?? null,
        runtimeStatus: body.runtimeStatus ?? "idle",
        lifecycleStatus: body.lifecycleStatus ?? "active",
        queuePolicy,
        wipLimit: body.wipLimit,
        notes: body.notes ?? null,
      })
      .returning({ id: mfgWorkCentersTable.id });

    const workCenterId = inserted[0]?.id;
    if (!workCenterId) {
      throw new Error("Failed to create work center");
    }

    if (body.calendars && body.calendars.length > 0) {
      await db.insert(mfgWorkCenterCalendarsTable).values(
        body.calendars.map((calendar) => ({
          workCenterId,
          calendarDate: calendar.calendarDate,
          availableMinutes: Math.max(0, Math.floor(calendar.availableMinutes)),
          shiftWindows: (calendar.shiftWindows as Record<string, unknown> | null) ?? null,
          isWorkingDay: calendar.isWorkingDay ?? true,
          reasonCode: calendar.reasonCode ?? null,
        })),
      );
    }

    if (body.resources && body.resources.length > 0) {
      await db.insert(mfgWorkCenterResourcesTable).values(
        body.resources.map((resource) => ({
          workCenterId,
          resourceType: resource.resourceType,
          resourceCode: resource.resourceCode ?? null,
          resourceName: resource.resourceName,
          quantity: toNumericString(resource.quantity, "1"),
          availabilityStatus: resource.availabilityStatus ?? "available",
          skillCode: resource.skillCode ?? null,
          toolingClass: resource.toolingClass ?? null,
          metadata: resource.metadata ?? null,
        })),
      );
    }

    await auditLog(
      {
        entity: "mfg_work_center",
        entityId: workCenterId,
        action: "create",
        fieldChanges: { code: body.code, name: body.name, type: body.type ?? "machine" },
      },
      req,
    );

    const result = await getWorkCenterDetails(workCenterId);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.get("/work-centers/:id", async (req, res) => {
  try {
    const result = await getWorkCenterDetails(req.params.id);
    if (!result) {
      res.status(404).json({ error: "not_found", message: "Work center not found" });
      return;
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.put("/work-centers/:id", async (req, res) => {
  try {
    const body = req.body as Partial<{
      name: string;
      type: string;
      capacityModel: string;
      efficiencyFactor: number | string;
      defaultSetupMinutes: number | string;
      sequenceDependentSetupMatrix: Record<string, unknown>;
      lifecycleStatus: string;
      queuePolicy: DispatchRule;
      wipLimit: number;
      notes: string;
    }>;

    if (body.queuePolicy && !SUPPORTED_DISPATCH_RULES.includes(body.queuePolicy)) {
      res.status(400).json({ error: "bad_request", message: `Unsupported queue policy: ${body.queuePolicy}` });
      return;
    }

    await db
      .update(mfgWorkCentersTable)
      .set({
        name: body.name,
        type: body.type,
        capacityModel: body.capacityModel,
        efficiencyFactor: body.efficiencyFactor !== undefined ? toNumericString(body.efficiencyFactor, "1.0000") : undefined,
        defaultSetupMinutes: body.defaultSetupMinutes !== undefined ? toNumericString(body.defaultSetupMinutes, "0") : undefined,
        sequenceDependentSetupMatrix: body.sequenceDependentSetupMatrix,
        lifecycleStatus: body.lifecycleStatus,
        queuePolicy: body.queuePolicy,
        wipLimit: body.wipLimit,
        notes: body.notes,
        updatedAt: new Date(),
      })
      .where(eq(mfgWorkCentersTable.id, req.params.id));

    const result = await getWorkCenterDetails(req.params.id);
    if (!result) {
      res.status(404).json({ error: "not_found", message: "Work center not found" });
      return;
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});
router.patch("/work-centers/:id/status", async (req, res) => {
  try {
    const body = req.body as { status: WorkCenterRuntimeStatus; reason?: string };
    const [workCenter] = await db
      .select()
      .from(mfgWorkCentersTable)
      .where(eq(mfgWorkCentersTable.id, req.params.id))
      .limit(1);

    if (!workCenter) {
      res.status(404).json({ error: "not_found", message: "Work center not found" });
      return;
    }

    if (!canTransitionWorkCenterState(workCenter.runtimeStatus as WorkCenterRuntimeStatus, body.status)) {
      res.status(400).json({
        error: "invalid_transition",
        message: `Invalid state transition: ${workCenter.runtimeStatus} -> ${body.status}`,
      });
      return;
    }

    const nextStatus = nextWorkCenterState(workCenter.runtimeStatus as WorkCenterRuntimeStatus, body.status);

    await db
      .update(mfgWorkCentersTable)
      .set({ runtimeStatus: nextStatus, updatedAt: new Date() })
      .where(eq(mfgWorkCentersTable.id, workCenter.id));

    await db.insert(mfgWorkCenterStateTransitionsTable).values({
      workCenterId: workCenter.id,
      fromStatus: workCenter.runtimeStatus,
      toStatus: nextStatus,
      reason: body.reason ?? null,
      changedBy: req.header("x-user") ?? "system-user",
    });

    if (nextStatus === "down") {
      await db.insert(mfgEventsTable).values({
        eventType: "machine.downtime",
        aggregateType: "work_center",
        aggregateId: workCenter.id,
        payload: { reason: body.reason ?? "unspecified" },
        status: "pending",
      });
    }

    const updated = await getWorkCenterDetails(workCenter.id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.get("/work-centers/:id/queue", async (req, res) => {
  try {
    const status = asString(req.query.status) ?? "queued";

    const [workCenter] = await db
      .select({ id: mfgWorkCentersTable.id, queuePolicy: mfgWorkCentersTable.queuePolicy })
      .from(mfgWorkCentersTable)
      .where(eq(mfgWorkCentersTable.id, req.params.id))
      .limit(1);

    if (!workCenter) {
      res.status(404).json({ error: "not_found", message: "Work center not found" });
      return;
    }

    const queue = await db
      .select({
        id: mfgQueueEntriesTable.id,
        workCenterId: mfgQueueEntriesTable.workCenterId,
        jobId: mfgQueueEntriesTable.jobId,
        jobOperationId: mfgQueueEntriesTable.jobOperationId,
        dueDate: mfgQueueEntriesTable.dueDate,
        releaseDate: mfgQueueEntriesTable.releaseDate,
        processingMinutes: mfgQueueEntriesTable.processingMinutes,
        priorityScore: mfgQueueEntriesTable.priorityScore,
        materialReady: mfgQueueEntriesTable.materialReady,
        constraintBlocked: mfgQueueEntriesTable.constraintBlocked,
        status: mfgQueueEntriesTable.status,
        dispatchRuleSnapshot: mfgQueueEntriesTable.dispatchRuleSnapshot,
        queuedAt: mfgQueueEntriesTable.queuedAt,
        itemId: mfgJobsTable.itemId,
        itemNumber: itemsTable.number,
        itemName: itemsTable.name,
        jobNumber: mfgJobsTable.jobNumber,
      })
      .from(mfgQueueEntriesTable)
      .leftJoin(mfgJobsTable, eq(mfgQueueEntriesTable.jobId, mfgJobsTable.id))
      .leftJoin(itemsTable, eq(mfgJobsTable.itemId, itemsTable.id))
      .where(and(eq(mfgQueueEntriesTable.workCenterId, req.params.id), eq(mfgQueueEntriesTable.status, status)))
      .orderBy(asc(mfgQueueEntriesTable.queuedAt));

    const ranked = rankDispatchCandidates(
      queue.map((entry) => ({
        queueEntryId: entry.id,
        operationId: entry.jobOperationId ?? entry.id,
        workCenterId: entry.workCenterId,
        dueDate: (entry.dueDate ?? new Date()).toISOString(),
        releaseDate: (entry.releaseDate ?? entry.queuedAt).toISOString(),
        processingMinutes: entry.processingMinutes,
        materialReady: entry.materialReady,
        constraintBlocked: entry.constraintBlocked,
      })),
      (workCenter.queuePolicy as DispatchRule) ?? "FIFO",
      new Date(),
    );

    const rankIndex = new Map(ranked.map((entry, idx) => [entry.queueEntryId, idx]));

    const prioritizedQueue = [...queue].sort((left, right) => {
      const leftRank = rankIndex.get(left.id);
      const rightRank = rankIndex.get(right.id);
      if (leftRank === undefined && rightRank === undefined) {
        return left.queuedAt.getTime() - right.queuedAt.getTime();
      }
      if (leftRank === undefined) {
        return 1;
      }
      if (rightRank === undefined) {
        return -1;
      }
      return leftRank - rightRank;
    });

    res.json({ data: prioritizedQueue, policy: workCenter.queuePolicy, total: prioritizedQueue.length });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/work-centers/:id/dispatch-next", async (req, res) => {
  try {
    const [workCenter] = await db
      .select({ id: mfgWorkCentersTable.id, queuePolicy: mfgWorkCentersTable.queuePolicy, runtimeStatus: mfgWorkCentersTable.runtimeStatus })
      .from(mfgWorkCentersTable)
      .where(eq(mfgWorkCentersTable.id, req.params.id))
      .limit(1);

    if (!workCenter) {
      res.status(404).json({ error: "not_found", message: "Work center not found" });
      return;
    }

    const queue = await db
      .select()
      .from(mfgQueueEntriesTable)
      .where(and(eq(mfgQueueEntriesTable.workCenterId, req.params.id), eq(mfgQueueEntriesTable.status, "queued")));

    if (queue.length === 0) {
      res.status(409).json({ error: "empty_queue", message: "No queued operations" });
      return;
    }

    const dispatchRule = (asString((req.body as Record<string, unknown> | undefined)?.rule) as DispatchRule | null) ??
      ((workCenter.queuePolicy as DispatchRule) ?? "FIFO");

    const ranked = rankDispatchCandidates(
      queue.map((entry) => ({
        queueEntryId: entry.id,
        operationId: entry.jobOperationId ?? entry.id,
        workCenterId: entry.workCenterId,
        dueDate: (entry.dueDate ?? new Date()).toISOString(),
        releaseDate: (entry.releaseDate ?? entry.queuedAt).toISOString(),
        processingMinutes: entry.processingMinutes,
        materialReady: entry.materialReady,
        constraintBlocked: entry.constraintBlocked,
      })),
      dispatchRule,
      new Date(),
    );

    const next = ranked[0];
    if (!next) {
      res.status(409).json({ error: "no_eligible_operation", message: "All queued operations are blocked" });
      return;
    }

    const [updated] = await db
      .update(mfgQueueEntriesTable)
      .set({ status: "dispatched", dispatchedAt: new Date(), dispatchRuleSnapshot: dispatchRule })
      .where(eq(mfgQueueEntriesTable.id, next.queueEntryId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "not_found", message: "Queue entry not found" });
      return;
    }

    if (updated.jobOperationId) {
      await db
        .update(mfgJobOperationsTable)
        .set({ status: "dispatched", updatedAt: new Date() })
        .where(eq(mfgJobOperationsTable.id, updated.jobOperationId));
    }

    if (workCenter.runtimeStatus === "idle") {
      await db
        .update(mfgWorkCentersTable)
        .set({ runtimeStatus: "running", updatedAt: new Date() })
        .where(eq(mfgWorkCentersTable.id, workCenter.id));
    }

    await auditLog(
      {
        entity: "mfg_queue_entry",
        entityId: updated.id,
        action: "dispatch",
        fieldChanges: { workCenterId: workCenter.id, dispatchRule },
      },
      req,
    );

    res.json({ message: "Operation dispatched", data: updated });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/work-centers/:id/queue", async (req, res) => {
  try {
    const body = req.body as {
      jobId?: string;
      jobOperationId?: string;
      dueDate?: string;
      releaseDate?: string;
      processingMinutes: number;
      priorityScore?: number;
      materialReady?: boolean;
      constraintBlocked?: boolean;
      dispatchRuleSnapshot?: DispatchRule;
      metadata?: Record<string, unknown>;
    };

    const [workCenter] = await db
      .select({ id: mfgWorkCentersTable.id })
      .from(mfgWorkCentersTable)
      .where(eq(mfgWorkCentersTable.id, req.params.id))
      .limit(1);

    if (!workCenter) {
      res.status(404).json({ error: "not_found", message: "Work center not found" });
      return;
    }

    const [inserted] = await db
      .insert(mfgQueueEntriesTable)
      .values({
        workCenterId: req.params.id,
        jobId: body.jobId ?? null,
        jobOperationId: body.jobOperationId ?? null,
        dueDate: parseDateParam(body.dueDate, null),
        releaseDate: parseDateParam(body.releaseDate, null),
        processingMinutes: Math.max(1, Math.floor(body.processingMinutes)),
        priorityScore: body.priorityScore !== undefined ? toNumericString(body.priorityScore, "0") : null,
        materialReady: body.materialReady ?? true,
        constraintBlocked: body.constraintBlocked ?? false,
        dispatchRuleSnapshot: body.dispatchRuleSnapshot ?? null,
        metadata: body.metadata ?? null,
      })
      .returning();

    res.status(201).json(inserted);
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

export default router;
