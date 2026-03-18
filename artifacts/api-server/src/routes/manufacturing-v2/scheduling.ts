import { Router } from "express";
import {
  db,
  itemsTable,
  mfgEventsTable,
  mfgJobMaterialConstraintsTable,
  mfgJobOperationsTable,
  mfgJobsTable,
  mfgQueueEntriesTable,
  mfgRoutingOperationsTable,
  mfgScheduleAssignmentsTable,
  mfgSchedulesTable,
  mfgWorkCenterCalendarsTable,
  mfgWorkCentersTable,
} from "@workspace/db";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { auditLog } from "../../lib/audit";
import { getNextNumber } from "../../lib/counter";
import { parseDateParam, parsePagination } from "../../modules/mfg-v2/http";
import { publishManufacturingEvent, type ManufacturingEventType } from "../../modules/mfg-v2/event-bus";
import { scheduleFiniteCapacity, type DispatchRule, type SchedulingInput } from "../../modules/mfg-v2/scheduler";
import { SUPPORTED_DISPATCH_RULES, SUPPORTED_EVENT_TYPES, asNumber, asString, toIsoDate, toNumericString } from "./shared";

const router = Router();

async function ensureQueueEntryForOperation(job: { id: string; dueDate: Date; releaseDate: Date }, operation: {
  id: string;
  workCenterId: string;
  setupMinutes: number;
  runMinutes: number;
  materialReady: boolean;
}) {
  const [existing] = await db
    .select({ id: mfgQueueEntriesTable.id })
    .from(mfgQueueEntriesTable)
    .where(eq(mfgQueueEntriesTable.jobOperationId, operation.id))
    .limit(1);

  if (existing) {
    return;
  }

  await db.insert(mfgQueueEntriesTable).values({
    workCenterId: operation.workCenterId,
    jobId: job.id,
    jobOperationId: operation.id,
    dueDate: job.dueDate,
    releaseDate: job.releaseDate,
    processingMinutes: operation.setupMinutes + operation.runMinutes,
    materialReady: operation.materialReady,
    constraintBlocked: false,
    status: "queued",
    dispatchRuleSnapshot: "FIFO",
  });
}

async function buildSchedulingInput(payload: {
  scheduleMode: "forward" | "backward";
  dispatchRule: DispatchRule;
  horizonStart: Date;
  horizonEnd: Date;
  jobIds?: string[];
}): Promise<SchedulingInput> {
  const jobConditions = [
    gte(mfgJobsTable.releaseDate, new Date(payload.horizonStart.getTime() - 30 * 24 * 60 * 60 * 1000)),
    lte(mfgJobsTable.dueDate, new Date(payload.horizonEnd.getTime() + 365 * 24 * 60 * 60 * 1000)),
  ];

  if (payload.jobIds && payload.jobIds.length > 0) {
    jobConditions.push(inArray(mfgJobsTable.id, payload.jobIds));
  }

  const jobs = await db
    .select({ id: mfgJobsTable.id, dueDate: mfgJobsTable.dueDate, releaseDate: mfgJobsTable.releaseDate })
    .from(mfgJobsTable)
    .where(and(...jobConditions));

  if (jobs.length === 0) {
    return { direction: payload.scheduleMode, dispatchRule: payload.dispatchRule, now: new Date().toISOString(), jobs: [], capacityByWorkCenterByDay: {} };
  }

  const jobIds = jobs.map((job) => job.id);

  const operations = await db
    .select({
      id: mfgJobOperationsTable.id,
      jobId: mfgJobOperationsTable.jobId,
      workCenterId: mfgJobOperationsTable.workCenterId,
      sequenceNumber: mfgJobOperationsTable.sequenceNumber,
      setupMinutes: mfgJobOperationsTable.setupMinutes,
      runMinutes: mfgJobOperationsTable.runMinutes,
      predecessorOperationId: mfgJobOperationsTable.predecessorOperationId,
      materialReady: mfgJobOperationsTable.materialReady,
    })
    .from(mfgJobOperationsTable)
    .where(inArray(mfgJobOperationsTable.jobId, jobIds));

  const operationIds = operations.map((operation) => operation.id);

  const constraints = operationIds.length
    ? await db
        .select({
          jobOperationId: mfgJobMaterialConstraintsTable.jobOperationId,
          requiredQty: mfgJobMaterialConstraintsTable.requiredQty,
          availableQty: mfgJobMaterialConstraintsTable.availableQty,
          isBlocking: mfgJobMaterialConstraintsTable.isBlocking,
        })
        .from(mfgJobMaterialConstraintsTable)
        .where(inArray(mfgJobMaterialConstraintsTable.jobOperationId, operationIds))
    : [];

  const materialReadyMap = new Map<string, boolean>();
  for (const operation of operations) {
    materialReadyMap.set(operation.id, operation.materialReady);
  }

  for (const constraint of constraints) {
    if (!constraint.isBlocking) continue;
    const current = materialReadyMap.get(constraint.jobOperationId) ?? true;
    const ready = asNumber(constraint.availableQty) >= asNumber(constraint.requiredQty);
    materialReadyMap.set(constraint.jobOperationId, current && ready);
  }

  const workCenterIds = Array.from(new Set(operations.map((operation) => operation.workCenterId)));

  const calendars = workCenterIds.length
    ? await db
        .select({
          workCenterId: mfgWorkCenterCalendarsTable.workCenterId,
          calendarDate: mfgWorkCenterCalendarsTable.calendarDate,
          availableMinutes: mfgWorkCenterCalendarsTable.availableMinutes,
        })
        .from(mfgWorkCenterCalendarsTable)
        .where(
          and(
            inArray(mfgWorkCenterCalendarsTable.workCenterId, workCenterIds),
            gte(mfgWorkCenterCalendarsTable.calendarDate, toIsoDate(payload.horizonStart)),
            lte(mfgWorkCenterCalendarsTable.calendarDate, toIsoDate(payload.horizonEnd)),
          ),
        )
    : [];

  const capacityByWorkCenterByDay: Record<string, Record<string, number>> = {};
  for (const workCenterId of workCenterIds) {
    capacityByWorkCenterByDay[workCenterId] = {};
  }
  for (const calendar of calendars) {
    capacityByWorkCenterByDay[calendar.workCenterId] ??= {};
    capacityByWorkCenterByDay[calendar.workCenterId][calendar.calendarDate] = calendar.availableMinutes;
  }

  const dayCursor = new Date(payload.horizonStart);
  while (dayCursor <= payload.horizonEnd) {
    const day = toIsoDate(dayCursor);
    for (const workCenterId of workCenterIds) {
      capacityByWorkCenterByDay[workCenterId] ??= {};
      if (capacityByWorkCenterByDay[workCenterId][day] === undefined) {
        capacityByWorkCenterByDay[workCenterId][day] = 480;
      }
    }
    dayCursor.setUTCDate(dayCursor.getUTCDate() + 1);
  }

  const operationsByJobId = new Map<string, typeof operations>();
  for (const operation of operations) {
    const group = operationsByJobId.get(operation.jobId) ?? [];
    group.push(operation);
    operationsByJobId.set(operation.jobId, group);
  }

  const schedulingJobs = jobs.map((job) => {
    const jobOperations = (operationsByJobId.get(job.id) ?? []).sort((left, right) => left.sequenceNumber - right.sequenceNumber);

    return {
      jobId: job.id,
      dueDate: job.dueDate.toISOString(),
      releaseDate: job.releaseDate.toISOString(),
      operations: jobOperations.map((operation, idx) => ({
        operationId: operation.id,
        workCenterId: operation.workCenterId,
        sequence: operation.sequenceNumber,
        setupMinutes: operation.setupMinutes,
        runMinutes: operation.runMinutes,
        materialReady: materialReadyMap.get(operation.id) ?? operation.materialReady,
        predecessors: operation.predecessorOperationId ? [operation.predecessorOperationId] : idx > 0 ? [jobOperations[idx - 1]?.id as string] : [],
      })),
    };
  });

  return {
    direction: payload.scheduleMode,
    dispatchRule: payload.dispatchRule,
    now: new Date().toISOString(),
    jobs: schedulingJobs,
    capacityByWorkCenterByDay,
  };
}

async function processEventRecord(eventId: string) {
  const [eventRecord] = await db.select().from(mfgEventsTable).where(eq(mfgEventsTable.id, eventId)).limit(1);
  if (!eventRecord) {
    throw new Error(`Event not found: ${eventId}`);
  }

  const eventType = eventRecord.eventType as ManufacturingEventType;

  if (eventType === "job.released") {
    const [job] = await db.select().from(mfgJobsTable).where(eq(mfgJobsTable.id, eventRecord.aggregateId)).limit(1);
    if (!job) {
      throw new Error("Job not found for event");
    }
    const operations = await db
      .select()
      .from(mfgJobOperationsTable)
      .where(eq(mfgJobOperationsTable.jobId, job.id))
      .orderBy(asc(mfgJobOperationsTable.sequenceNumber));

    for (const operation of operations.filter((op) => !op.predecessorOperationId)) {
      await ensureQueueEntryForOperation(job, operation);
    }

    await db.update(mfgJobsTable).set({ status: "released", updatedAt: new Date() }).where(eq(mfgJobsTable.id, job.id));
  }

  if (eventType === "operation.completed") {
    const [operation] = await db
      .select()
      .from(mfgJobOperationsTable)
      .where(eq(mfgJobOperationsTable.id, eventRecord.aggregateId))
      .limit(1);

    if (!operation) {
      throw new Error("Operation not found for completion event");
    }

    await db
      .update(mfgJobOperationsTable)
      .set({ status: "completed", actualEnd: new Date(), updatedAt: new Date() })
      .where(eq(mfgJobOperationsTable.id, operation.id));

    await db
      .update(mfgQueueEntriesTable)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(mfgQueueEntriesTable.jobOperationId, operation.id));

    const [job] = await db.select().from(mfgJobsTable).where(eq(mfgJobsTable.id, operation.jobId)).limit(1);
    if (!job) {
      throw new Error("Parent job not found");
    }

    const successors = await db
      .select()
      .from(mfgJobOperationsTable)
      .where(eq(mfgJobOperationsTable.predecessorOperationId, operation.id));

    for (const successor of successors) {
      await db.update(mfgJobOperationsTable).set({ status: "queued", updatedAt: new Date() }).where(eq(mfgJobOperationsTable.id, successor.id));
      await ensureQueueEntryForOperation(job, successor);
    }
  }

  if (eventType === "machine.downtime") {
    await db
      .update(mfgWorkCentersTable)
      .set({ runtimeStatus: "down", updatedAt: new Date() })
      .where(eq(mfgWorkCentersTable.id, eventRecord.aggregateId));

    await db
      .update(mfgQueueEntriesTable)
      .set({ constraintBlocked: true })
      .where(and(eq(mfgQueueEntriesTable.workCenterId, eventRecord.aggregateId), eq(mfgQueueEntriesTable.status, "queued")));
  }

  await db.update(mfgEventsTable).set({ status: "processed", processedAt: new Date() }).where(eq(mfgEventsTable.id, eventRecord.id));

  publishManufacturingEvent({
    eventType,
    aggregateType: eventRecord.aggregateType,
    aggregateId: eventRecord.aggregateId,
    payload: (eventRecord.payload as Record<string, unknown> | null) ?? undefined,
    occurredAt: eventRecord.occurredAt,
  });
}

router.get("/jobs", async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>);
    const conditions = [];
    if (asString(req.query.status)) conditions.push(eq(mfgJobsTable.status, String(req.query.status)));
    if (asString(req.query.itemId)) conditions.push(eq(mfgJobsTable.itemId, String(req.query.itemId)));
    const whereClause = conditions.length ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db
        .select({
          id: mfgJobsTable.id,
          jobNumber: mfgJobsTable.jobNumber,
          itemId: mfgJobsTable.itemId,
          itemNumber: itemsTable.number,
          itemName: itemsTable.name,
          quantity: mfgJobsTable.quantity,
          uom: mfgJobsTable.uom,
          priority: mfgJobsTable.priority,
          releaseDate: mfgJobsTable.releaseDate,
          dueDate: mfgJobsTable.dueDate,
          status: mfgJobsTable.status,
          selectedBomId: mfgJobsTable.selectedBomId,
          selectedRoutingId: mfgJobsTable.selectedRoutingId,
          createdAt: mfgJobsTable.createdAt,
          updatedAt: mfgJobsTable.updatedAt,
        })
        .from(mfgJobsTable)
        .leftJoin(itemsTable, eq(mfgJobsTable.itemId, itemsTable.id))
        .where(whereClause)
        .orderBy(desc(mfgJobsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(mfgJobsTable).where(whereClause),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});
router.post("/jobs", async (req, res) => {
  try {
    const body = req.body as {
      sourceType?: string;
      sourceId?: string;
      itemId: string;
      quantity: number | string;
      uom?: string;
      priority?: string;
      releaseDate: string;
      dueDate: string;
      selectedBomId?: string;
      selectedRoutingId?: string;
      metadata?: Record<string, unknown>;
      operations?: Array<{
        sequenceNumber: number;
        workCenterId: string;
        setupMinutes?: number;
        runMinutes?: number;
        materialReady?: boolean;
        predecessorOperationId?: string | null;
        operationCode?: string;
      }>;
    };

    const jobNumber = getNextNumber("JOB");

    const [createdJob] = await db
      .insert(mfgJobsTable)
      .values({
        jobNumber,
        sourceType: body.sourceType ?? "work_order",
        sourceId: body.sourceId ?? null,
        itemId: body.itemId,
        quantity: toNumericString(body.quantity, "0"),
        uom: body.uom ?? "EA",
        priority: body.priority ?? "normal",
        releaseDate: new Date(body.releaseDate),
        dueDate: new Date(body.dueDate),
        status: "released",
        selectedBomId: body.selectedBomId ?? null,
        selectedRoutingId: body.selectedRoutingId ?? null,
        metadata: body.metadata ?? null,
      })
      .returning();

    if (!createdJob) {
      throw new Error("Failed to create job");
    }

    let operationsInput = body.operations ?? [];
    if (operationsInput.length === 0 && body.selectedRoutingId) {
      const routingOperations = await db
        .select()
        .from(mfgRoutingOperationsTable)
        .where(eq(mfgRoutingOperationsTable.routingId, body.selectedRoutingId))
        .orderBy(asc(mfgRoutingOperationsTable.sequenceNumber));

      operationsInput = routingOperations.map((operation) => ({
        sequenceNumber: operation.sequenceNumber,
        workCenterId: operation.workCenterId,
        setupMinutes: asNumber(operation.setupTimeMinutes),
        runMinutes: asNumber(operation.standardTimeMinutes),
        materialReady: true,
        predecessorOperationId: null,
        operationCode: operation.operationCode ?? undefined,
      }));
    }

    const insertedOperations = await db
      .insert(mfgJobOperationsTable)
      .values(
        operationsInput.map((operation, idx) => ({
          jobId: createdJob.id,
          sequenceNumber: operation.sequenceNumber,
          workCenterId: operation.workCenterId,
          setupMinutes: Math.max(0, Math.floor(operation.setupMinutes ?? 0)),
          runMinutes: Math.max(1, Math.floor(operation.runMinutes ?? 1)),
          materialReady: operation.materialReady ?? true,
          predecessorOperationId: operation.predecessorOperationId ?? null,
          operationCode: operation.operationCode ?? null,
          status: idx === 0 ? "queued" : "waiting",
        })),
      )
      .returning();

    const orderedOperations = [...insertedOperations].sort((left, right) => left.sequenceNumber - right.sequenceNumber);

    for (let idx = 1; idx < orderedOperations.length; idx += 1) {
      const op = orderedOperations[idx] as (typeof orderedOperations)[number];
      const predecessor = orderedOperations[idx - 1] as (typeof orderedOperations)[number];
      await db
        .update(mfgJobOperationsTable)
        .set({ predecessorOperationId: predecessor.id, updatedAt: new Date() })
        .where(eq(mfgJobOperationsTable.id, op.id));
    }

    const firstOperation = orderedOperations[0];
    if (firstOperation) {
      await ensureQueueEntryForOperation(createdJob, firstOperation);
    }

    const [event] = await db
      .insert(mfgEventsTable)
      .values({
        eventType: "job.released",
        aggregateType: "job",
        aggregateId: createdJob.id,
        payload: { jobNumber: createdJob.jobNumber },
        status: "pending",
      })
      .returning({ id: mfgEventsTable.id });

    if (event?.id) {
      await processEventRecord(event.id);
    }

    await auditLog({ entity: "mfg_job", entityId: createdJob.id, action: "create", fieldChanges: body as Record<string, unknown> }, req);

    res.status(201).json({ ...createdJob, operations: orderedOperations });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/schedules/run", async (req, res) => {
  try {
    const body = req.body as {
      name?: string;
      scheduleMode?: "forward" | "backward";
      dispatchRule?: DispatchRule;
      horizonStart?: string;
      horizonEnd?: string;
      jobIds?: string[];
      createdBy?: string;
    };

    const scheduleMode = body.scheduleMode ?? "forward";
    const dispatchRule = body.dispatchRule ?? "EDD";

    if (!SUPPORTED_DISPATCH_RULES.includes(dispatchRule)) {
      res.status(400).json({ error: "bad_request", message: `Unsupported dispatch rule: ${dispatchRule}` });
      return;
    }

    const horizonStart = parseDateParam(body.horizonStart, new Date()) ?? new Date();
    const horizonEnd = parseDateParam(body.horizonEnd, new Date(horizonStart.getTime() + 30 * 24 * 60 * 60 * 1000)) ?? new Date(horizonStart.getTime() + 30 * 24 * 60 * 60 * 1000);

    const schedulingInput = await buildSchedulingInput({ scheduleMode, dispatchRule, horizonStart, horizonEnd, jobIds: body.jobIds });
    const result = scheduleFiniteCapacity(schedulingInput);

    const [schedule] = await db
      .insert(mfgSchedulesTable)
      .values({
        name: body.name ?? `schedule-${new Date().toISOString()}`,
        scheduleMode,
        dispatchRule,
        horizonStart: toIsoDate(horizonStart),
        horizonEnd: toIsoDate(horizonEnd),
        status: "completed",
        isSimulation: false,
        scenarioName: null,
        requestPayload: body,
        resultSummary: { assignments: result.assignments.length, unscheduled: result.unscheduled.length },
        createdBy: body.createdBy ?? req.header("x-user") ?? "system-user",
      })
      .returning({ id: mfgSchedulesTable.id });

    if (!schedule?.id) {
      throw new Error("Failed to create schedule");
    }

    if (result.assignments.length > 0) {
      await db.insert(mfgScheduleAssignmentsTable).values(
        result.assignments.map((assignment) => ({
          scheduleId: schedule.id,
          jobId: assignment.jobId,
          jobOperationId: assignment.operationId,
          workCenterId: assignment.workCenterId,
          scheduledDate: assignment.scheduledDate,
          consumedMinutes: assignment.consumedMinutes,
          dispatchSequence: assignment.dispatchSequence,
          constraintSummary: null,
        })),
      );

      for (const assignment of result.assignments) {
        const start = new Date(`${assignment.scheduledDate}T08:00:00.000Z`);
        const end = new Date(start.getTime() + assignment.consumedMinutes * 60 * 1000);
        await db
          .update(mfgJobOperationsTable)
          .set({ plannedStart: start, plannedEnd: end, status: "planned", updatedAt: new Date() })
          .where(eq(mfgJobOperationsTable.id, assignment.operationId));
      }
    }

    res.json({ data: { scheduleId: schedule.id, mode: scheduleMode, dispatchRule, assignments: result.assignments, unscheduled: result.unscheduled } });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/schedules/simulate", async (req, res) => {
  try {
    const body = req.body as {
      scenarioName?: string;
      scheduleMode?: "forward" | "backward";
      dispatchRule?: DispatchRule;
      horizonStart?: string;
      horizonEnd?: string;
      jobIds?: string[];
      capacityOverrides?: Record<string, Record<string, number>>;
    };

    const scheduleMode = body.scheduleMode ?? "forward";
    const dispatchRule = body.dispatchRule ?? "EDD";

    if (!SUPPORTED_DISPATCH_RULES.includes(dispatchRule)) {
      res.status(400).json({ error: "bad_request", message: `Unsupported dispatch rule: ${dispatchRule}` });
      return;
    }

    const horizonStart = parseDateParam(body.horizonStart, new Date()) ?? new Date();
    const horizonEnd = parseDateParam(body.horizonEnd, new Date(horizonStart.getTime() + 30 * 24 * 60 * 60 * 1000)) ?? new Date(horizonStart.getTime() + 30 * 24 * 60 * 60 * 1000);

    const schedulingInput = await buildSchedulingInput({ scheduleMode, dispatchRule, horizonStart, horizonEnd, jobIds: body.jobIds });

    if (body.capacityOverrides) {
      for (const [workCenterId, dayMap] of Object.entries(body.capacityOverrides)) {
        schedulingInput.capacityByWorkCenterByDay[workCenterId] ??= {};
        for (const [day, minutes] of Object.entries(dayMap)) {
          schedulingInput.capacityByWorkCenterByDay[workCenterId][day] = Math.max(0, Math.floor(minutes));
        }
      }
    }

    const result = scheduleFiniteCapacity(schedulingInput);

    const [schedule] = await db
      .insert(mfgSchedulesTable)
      .values({
        name: body.scenarioName ?? `simulation-${new Date().toISOString()}`,
        scheduleMode,
        dispatchRule,
        horizonStart: toIsoDate(horizonStart),
        horizonEnd: toIsoDate(horizonEnd),
        status: "completed",
        isSimulation: true,
        scenarioName: body.scenarioName ?? "what-if",
        requestPayload: body,
        resultSummary: { assignments: result.assignments.length, unscheduled: result.unscheduled.length },
        createdBy: req.header("x-user") ?? "system-user",
      })
      .returning({ id: mfgSchedulesTable.id });

    res.json({ data: { scheduleId: schedule?.id, mode: scheduleMode, dispatchRule, assignments: result.assignments, unscheduled: result.unscheduled, remainingCapacity: result.remainingCapacity } });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.get("/schedules/:id", async (req, res) => {
  try {
    const [schedule] = await db.select().from(mfgSchedulesTable).where(eq(mfgSchedulesTable.id, req.params.id)).limit(1);
    if (!schedule) {
      res.status(404).json({ error: "not_found", message: "Schedule not found" });
      return;
    }

    const assignments = await db
      .select({
        id: mfgScheduleAssignmentsTable.id,
        scheduleId: mfgScheduleAssignmentsTable.scheduleId,
        jobId: mfgScheduleAssignmentsTable.jobId,
        jobOperationId: mfgScheduleAssignmentsTable.jobOperationId,
        workCenterId: mfgScheduleAssignmentsTable.workCenterId,
        workCenterCode: mfgWorkCentersTable.code,
        workCenterName: mfgWorkCentersTable.name,
        scheduledDate: mfgScheduleAssignmentsTable.scheduledDate,
        consumedMinutes: mfgScheduleAssignmentsTable.consumedMinutes,
        dispatchSequence: mfgScheduleAssignmentsTable.dispatchSequence,
      })
      .from(mfgScheduleAssignmentsTable)
      .leftJoin(mfgWorkCentersTable, eq(mfgScheduleAssignmentsTable.workCenterId, mfgWorkCentersTable.id))
      .where(eq(mfgScheduleAssignmentsTable.scheduleId, req.params.id))
      .orderBy(asc(mfgScheduleAssignmentsTable.dispatchSequence));

    res.json({ ...schedule, assignments });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/events", async (req, res) => {
  try {
    const body = req.body as { eventType: ManufacturingEventType; aggregateType: string; aggregateId: string; payload?: Record<string, unknown> };

    if (!SUPPORTED_EVENT_TYPES.includes(body.eventType)) {
      res.status(400).json({ error: "bad_request", message: `Unsupported event type: ${body.eventType}` });
      return;
    }

    const [event] = await db
      .insert(mfgEventsTable)
      .values({ eventType: body.eventType, aggregateType: body.aggregateType, aggregateId: body.aggregateId, payload: body.payload ?? null, status: "pending" })
      .returning({ id: mfgEventsTable.id });

    if (!event?.id) {
      throw new Error("Failed to persist event");
    }

    try {
      await processEventRecord(event.id);
    } catch (processingError) {
      await db.update(mfgEventsTable).set({ status: "failed", errorMessage: String(processingError), processedAt: new Date() }).where(eq(mfgEventsTable.id, event.id));
      throw processingError;
    }

    res.status(202).json({ message: "Event processed", eventId: event.id });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

export default router;
