export type DispatchRule = "FIFO" | "EDD" | "SPT" | "CR";

export interface DispatchCandidate {
  queueEntryId: string;
  operationId: string;
  workCenterId: string;
  dueDate: string;
  releaseDate: string;
  processingMinutes: number;
  materialReady: boolean;
  constraintBlocked: boolean;
}

export interface SchedulingOperationInput {
  operationId: string;
  workCenterId: string;
  sequence: number;
  setupMinutes: number;
  runMinutes: number;
  materialReady: boolean;
  predecessors: string[];
}

export interface SchedulingJobInput {
  jobId: string;
  dueDate: string;
  releaseDate: string;
  operations: SchedulingOperationInput[];
}

export interface SchedulingInput {
  direction: "forward" | "backward";
  dispatchRule: DispatchRule;
  now: string;
  jobs: SchedulingJobInput[];
  capacityByWorkCenterByDay: Record<string, Record<string, number>>;
}

export interface ScheduledAssignment {
  jobId: string;
  operationId: string;
  workCenterId: string;
  scheduledDate: string;
  consumedMinutes: number;
  dispatchSequence: number;
}

export interface UnscheduledOperation {
  jobId: string;
  operationId: string;
  reason: "material_unavailable" | "capacity_constrained" | "precedence_unsatisfied";
}

export interface SchedulingResult {
  assignments: ScheduledAssignment[];
  unscheduled: UnscheduledOperation[];
  remainingCapacity: Record<string, Record<string, number>>;
}

interface FlattenedOperation extends SchedulingOperationInput {
  jobId: string;
  dueDate: string;
  releaseDate: string;
  processingMinutes: number;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function rankDispatchCandidates(
  candidates: DispatchCandidate[],
  rule: DispatchRule,
  now: Date,
): DispatchCandidate[] {
  const filtered = candidates.filter((candidate) => candidate.materialReady && !candidate.constraintBlocked);

  return [...filtered].sort((left, right) => {
    switch (rule) {
      case "FIFO": {
        return toTime(left.releaseDate) - toTime(right.releaseDate) || toTime(left.dueDate) - toTime(right.dueDate);
      }
      case "EDD": {
        return toTime(left.dueDate) - toTime(right.dueDate);
      }
      case "SPT": {
        return left.processingMinutes - right.processingMinutes;
      }
      case "CR": {
        const leftRatio = criticalRatio(left, now);
        const rightRatio = criticalRatio(right, now);
        return leftRatio - rightRatio;
      }
      default: {
        return 0;
      }
    }
  });
}

export function scheduleFiniteCapacity(input: SchedulingInput): SchedulingResult {
  const remainingCapacity = cloneCapacity(input.capacityByWorkCenterByDay);
  const assignments: ScheduledAssignment[] = [];
  const unscheduled: UnscheduledOperation[] = [];
  const scheduledByOperation = new Map<string, ScheduledAssignment>();

  const operationsById = new Map<string, FlattenedOperation>();
  const successorsByOperation = new Map<string, string[]>();

  for (const job of input.jobs) {
    for (const operation of job.operations) {
      const flattened: FlattenedOperation = {
        ...operation,
        jobId: job.jobId,
        dueDate: job.dueDate,
        releaseDate: job.releaseDate,
        processingMinutes: operation.setupMinutes + operation.runMinutes,
      };
      operationsById.set(operation.operationId, flattened);
      successorsByOperation.set(operation.operationId, []);
    }
  }

  for (const operation of operationsById.values()) {
    for (const predecessorId of operation.predecessors) {
      const successors = successorsByOperation.get(predecessorId);
      if (successors) {
        successors.push(operation.operationId);
      }
    }
  }

  const remainingOperationIds = new Set(operationsById.keys());
  const now = new Date(input.now);
  let dispatchSequence = 1;

  while (remainingOperationIds.size > 0) {
    const readyOperationIds = Array.from(remainingOperationIds).filter((operationId) => {
      const operation = mustGetOperation(operationsById, operationId);
      if (input.direction === "forward") {
        return operation.predecessors.every((predecessorId) => scheduledByOperation.has(predecessorId));
      }
      const successors = successorsByOperation.get(operationId) ?? [];
      return successors.every((successorId) => scheduledByOperation.has(successorId));
    });

    if (readyOperationIds.length === 0) {
      for (const operationId of remainingOperationIds) {
        const operation = mustGetOperation(operationsById, operationId);
        unscheduled.push({
          jobId: operation.jobId,
          operationId,
          reason: "precedence_unsatisfied",
        });
      }
      break;
    }

    const readyCandidates = readyOperationIds.map((operationId) => {
      const operation = mustGetOperation(operationsById, operationId);
      return {
        queueEntryId: operation.operationId,
        operationId: operation.operationId,
        workCenterId: operation.workCenterId,
        dueDate: operation.dueDate,
        releaseDate: operation.releaseDate,
        processingMinutes: operation.processingMinutes,
        materialReady: operation.materialReady,
        constraintBlocked: false,
      } satisfies DispatchCandidate;
    });

    for (const blocked of readyCandidates.filter((candidate) => !candidate.materialReady || candidate.constraintBlocked)) {
      const operation = mustGetOperation(operationsById, blocked.operationId);
      remainingOperationIds.delete(blocked.operationId);
      unscheduled.push({
        jobId: operation.jobId,
        operationId: blocked.operationId,
        reason: "material_unavailable",
      });
    }

    const ranked = rankDispatchCandidates(readyCandidates, input.dispatchRule, now);

    for (const candidate of ranked) {
      if (!remainingOperationIds.has(candidate.operationId)) {
        continue;
      }

      const operation = mustGetOperation(operationsById, candidate.operationId);

      const scheduledDate =
        input.direction === "forward"
          ? findForwardDate(operation, scheduledByOperation, remainingCapacity)
          : findBackwardDate(operation, scheduledByOperation, successorsByOperation, remainingCapacity);

      if (!scheduledDate) {
        remainingOperationIds.delete(operation.operationId);
        unscheduled.push({
          jobId: operation.jobId,
          operationId: operation.operationId,
          reason: "capacity_constrained",
        });
        continue;
      }

      const workCenterCapacity = remainingCapacity[operation.workCenterId] ?? {};
      workCenterCapacity[scheduledDate] = (workCenterCapacity[scheduledDate] ?? 0) - operation.processingMinutes;

      const assignment: ScheduledAssignment = {
        jobId: operation.jobId,
        operationId: operation.operationId,
        workCenterId: operation.workCenterId,
        scheduledDate,
        consumedMinutes: operation.processingMinutes,
        dispatchSequence,
      };

      dispatchSequence += 1;
      assignments.push(assignment);
      scheduledByOperation.set(operation.operationId, assignment);
      remainingOperationIds.delete(operation.operationId);
    }
  }

  return {
    assignments: assignments.sort((left, right) => left.dispatchSequence - right.dispatchSequence),
    unscheduled,
    remainingCapacity,
  };
}

function findForwardDate(
  operation: FlattenedOperation,
  scheduledByOperation: ReadonlyMap<string, ScheduledAssignment>,
  remainingCapacity: Record<string, Record<string, number>>,
): string | null {
  const predecessorDates = operation.predecessors
    .map((predecessorId) => scheduledByOperation.get(predecessorId)?.scheduledDate)
    .filter((value): value is string => Boolean(value));

  let earliestDate = dayOf(operation.releaseDate);

  if (predecessorDates.length > 0) {
    const latestPredecessorDate = predecessorDates.sort()[predecessorDates.length - 1] as string;
    if (latestPredecessorDate > earliestDate) {
      earliestDate = latestPredecessorDate;
    }
  }

  const workCenterCapacity = remainingCapacity[operation.workCenterId] ?? {};
  const candidateDays = Object.keys(workCenterCapacity).sort();

  for (const day of candidateDays) {
    if (day < earliestDate) {
      continue;
    }
    if ((workCenterCapacity[day] ?? 0) >= operation.processingMinutes) {
      return day;
    }
  }

  return null;
}

function findBackwardDate(
  operation: FlattenedOperation,
  scheduledByOperation: ReadonlyMap<string, ScheduledAssignment>,
  successorsByOperation: ReadonlyMap<string, string[]>,
  remainingCapacity: Record<string, Record<string, number>>,
): string | null {
  let latestDate = dayOf(operation.dueDate);
  const releaseDate = dayOf(operation.releaseDate);
  const successorDates = (successorsByOperation.get(operation.operationId) ?? [])
    .map((successorId) => scheduledByOperation.get(successorId)?.scheduledDate)
    .filter((value): value is string => Boolean(value));

  if (successorDates.length > 0) {
    const earliestSuccessor = successorDates.sort()[0] as string;
    latestDate = dayBefore(earliestSuccessor);
  }

  const workCenterCapacity = remainingCapacity[operation.workCenterId] ?? {};
  const candidateDays = Object.keys(workCenterCapacity)
    .filter((day) => day >= releaseDate)
    .sort();

  for (let idx = candidateDays.length - 1; idx >= 0; idx -= 1) {
    const day = candidateDays[idx] as string;
    if (day > latestDate) {
      continue;
    }
    if ((workCenterCapacity[day] ?? 0) >= operation.processingMinutes) {
      return day;
    }
  }

  return null;
}

function criticalRatio(candidate: DispatchCandidate, now: Date): number {
  const timeUntilDueMinutes = Math.max(1, (toTime(candidate.dueDate) - now.getTime()) / (1000 * 60));
  return timeUntilDueMinutes / Math.max(1, candidate.processingMinutes);
}

function mustGetOperation(
  operationsById: ReadonlyMap<string, FlattenedOperation>,
  operationId: string,
): FlattenedOperation {
  const operation = operationsById.get(operationId);
  if (!operation) {
    throw new Error(`Missing operation: ${operationId}`);
  }
  return operation;
}

function dayOf(isoDateTime: string): string {
  return new Date(isoDateTime).toISOString().slice(0, 10);
}

function dayBefore(day: string): string {
  const asDate = new Date(`${day}T00:00:00.000Z`);
  return new Date(asDate.getTime() - ONE_DAY_MS).toISOString().slice(0, 10);
}

function toTime(isoDateTime: string): number {
  return new Date(isoDateTime).getTime();
}

function cloneCapacity(capacityByWorkCenterByDay: Record<string, Record<string, number>>): Record<string, Record<string, number>> {
  const cloned: Record<string, Record<string, number>> = {};
  for (const [workCenterId, dayCapacity] of Object.entries(capacityByWorkCenterByDay)) {
    cloned[workCenterId] = { ...dayCapacity };
  }
  return cloned;
}