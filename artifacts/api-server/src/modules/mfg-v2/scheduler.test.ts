import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  rankDispatchCandidates,
  scheduleFiniteCapacity,
  type DispatchCandidate,
  type SchedulingInput,
} from "./scheduler";

describe("rankDispatchCandidates", () => {
  const baseCandidates: DispatchCandidate[] = [
    {
      queueEntryId: "q-1",
      operationId: "op-1",
      workCenterId: "wc-1",
      dueDate: "2026-04-10T00:00:00.000Z",
      releaseDate: "2026-04-01T00:00:00.000Z",
      processingMinutes: 240,
      materialReady: true,
      constraintBlocked: false,
    },
    {
      queueEntryId: "q-2",
      operationId: "op-2",
      workCenterId: "wc-1",
      dueDate: "2026-04-05T00:00:00.000Z",
      releaseDate: "2026-04-03T00:00:00.000Z",
      processingMinutes: 60,
      materialReady: true,
      constraintBlocked: false,
    },
    {
      queueEntryId: "q-3",
      operationId: "op-3",
      workCenterId: "wc-1",
      dueDate: "2026-04-20T00:00:00.000Z",
      releaseDate: "2026-03-25T00:00:00.000Z",
      processingMinutes: 30,
      materialReady: true,
      constraintBlocked: false,
    },
    {
      queueEntryId: "q-4",
      operationId: "op-4",
      workCenterId: "wc-1",
      dueDate: "2026-04-02T00:00:00.000Z",
      releaseDate: "2026-03-30T00:00:00.000Z",
      processingMinutes: 300,
      materialReady: false,
      constraintBlocked: false,
    },
  ];

  it("filters blocked candidates and ranks FIFO", () => {
    const ranked = rankDispatchCandidates(baseCandidates, "FIFO", new Date("2026-04-01T08:00:00.000Z"));
    assert.deepEqual(ranked.map((c) => c.queueEntryId), ["q-3", "q-1", "q-2"]);
  });

  it("ranks EDD", () => {
    const ranked = rankDispatchCandidates(baseCandidates, "EDD", new Date("2026-04-01T08:00:00.000Z"));
    assert.deepEqual(ranked.map((c) => c.queueEntryId), ["q-2", "q-1", "q-3"]);
  });

  it("ranks SPT", () => {
    const ranked = rankDispatchCandidates(baseCandidates, "SPT", new Date("2026-04-01T08:00:00.000Z"));
    assert.deepEqual(ranked.map((c) => c.queueEntryId), ["q-3", "q-2", "q-1"]);
  });

  it("ranks CR", () => {
    const ranked = rankDispatchCandidates(baseCandidates, "CR", new Date("2026-04-01T08:00:00.000Z"));
    assert.deepEqual(ranked.map((c) => c.queueEntryId), ["q-1", "q-2", "q-3"]);
  });
});

describe("scheduleFiniteCapacity", () => {
  it("does forward finite-capacity scheduling with daily buckets", () => {
    const input: SchedulingInput = {
      direction: "forward",
      dispatchRule: "FIFO",
      now: "2026-04-01T08:00:00.000Z",
      jobs: [
        {
          jobId: "job-a",
          dueDate: "2026-04-04T17:00:00.000Z",
          releaseDate: "2026-04-01T08:00:00.000Z",
          operations: [
            {
              operationId: "op-a1",
              workCenterId: "wc-1",
              sequence: 10,
              setupMinutes: 30,
              runMinutes: 270,
              materialReady: true,
              predecessors: [],
            },
          ],
        },
        {
          jobId: "job-b",
          dueDate: "2026-04-05T17:00:00.000Z",
          releaseDate: "2026-04-01T08:00:00.000Z",
          operations: [
            {
              operationId: "op-b1",
              workCenterId: "wc-1",
              sequence: 10,
              setupMinutes: 0,
              runMinutes: 300,
              materialReady: true,
              predecessors: [],
            },
          ],
        },
      ],
      capacityByWorkCenterByDay: {
        "wc-1": {
          "2026-04-01": 480,
          "2026-04-02": 480,
        },
      },
    };

    const result = scheduleFiniteCapacity(input);
    assert.equal(result.assignments.length, 2);
    assert.equal(result.unscheduled.length, 0);
    const opA = result.assignments.find((a) => a.operationId === "op-a1");
    const opB = result.assignments.find((a) => a.operationId === "op-b1");
    assert.ok(opA);
    assert.ok(opB);
    assert.equal(opA?.scheduledDate, "2026-04-01");
    assert.equal(opB?.scheduledDate, "2026-04-02");
  });

  it("does backward scheduling and respects precedence", () => {
    const input: SchedulingInput = {
      direction: "backward",
      dispatchRule: "EDD",
      now: "2026-04-01T08:00:00.000Z",
      jobs: [
        {
          jobId: "job-c",
          dueDate: "2026-04-03T17:00:00.000Z",
          releaseDate: "2026-04-01T08:00:00.000Z",
          operations: [
            {
              operationId: "op-c1",
              workCenterId: "wc-1",
              sequence: 10,
              setupMinutes: 0,
              runMinutes: 180,
              materialReady: true,
              predecessors: [],
            },
            {
              operationId: "op-c2",
              workCenterId: "wc-1",
              sequence: 20,
              setupMinutes: 0,
              runMinutes: 120,
              materialReady: true,
              predecessors: ["op-c1"],
            },
          ],
        },
      ],
      capacityByWorkCenterByDay: {
        "wc-1": {
          "2026-04-01": 480,
          "2026-04-02": 480,
          "2026-04-03": 480,
        },
      },
    };

    const result = scheduleFiniteCapacity(input);
    assert.equal(result.unscheduled.length, 0);

    const op1 = result.assignments.find((a) => a.operationId === "op-c1");
    const op2 = result.assignments.find((a) => a.operationId === "op-c2");
    assert.ok(op1);
    assert.ok(op2);

    assert.equal(op2?.scheduledDate, "2026-04-03");
    assert.equal(op1?.scheduledDate, "2026-04-02");
  });

  it("marks blocked operations unscheduled", () => {
    const input: SchedulingInput = {
      direction: "forward",
      dispatchRule: "FIFO",
      now: "2026-04-01T08:00:00.000Z",
      jobs: [
        {
          jobId: "job-d",
          dueDate: "2026-04-03T17:00:00.000Z",
          releaseDate: "2026-04-01T08:00:00.000Z",
          operations: [
            {
              operationId: "op-d1",
              workCenterId: "wc-1",
              sequence: 10,
              setupMinutes: 15,
              runMinutes: 120,
              materialReady: false,
              predecessors: [],
            },
          ],
        },
      ],
      capacityByWorkCenterByDay: {
        "wc-1": {
          "2026-04-01": 480,
        },
      },
    };

    const result = scheduleFiniteCapacity(input);
    assert.equal(result.assignments.length, 0);
    assert.equal(result.unscheduled.length, 1);
    assert.equal(result.unscheduled[0]?.reason, "material_unavailable");
  });
});