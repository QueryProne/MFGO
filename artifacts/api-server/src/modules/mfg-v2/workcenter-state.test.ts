import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { canTransitionWorkCenterState, nextWorkCenterState } from "./workcenter-state";

describe("work center state machine", () => {
  it("allows idle to running", () => {
    assert.equal(canTransitionWorkCenterState("idle", "running"), true);
    assert.equal(nextWorkCenterState("idle", "running"), "running");
  });

  it("allows running to down", () => {
    assert.equal(canTransitionWorkCenterState("running", "down"), true);
  });

  it("blocks down to running without recovery", () => {
    assert.equal(canTransitionWorkCenterState("down", "running"), false);
    assert.throws(() => nextWorkCenterState("down", "running"));
  });

  it("allows maintenance to idle", () => {
    assert.equal(canTransitionWorkCenterState("maintenance", "idle"), true);
  });
});