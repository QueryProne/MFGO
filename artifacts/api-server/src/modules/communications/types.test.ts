import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDefaultRetryPolicy, nextRetryDelaySeconds } from "./types";

describe("communications retry policy", () => {
  it("uses exponential backoff bounded by max delay", () => {
    const policy = getDefaultRetryPolicy();

    const first = nextRetryDelaySeconds(policy, 1);
    const second = nextRetryDelaySeconds(policy, 2);
    const sixth = nextRetryDelaySeconds(policy, 6);

    assert.equal(first, policy.initialDelaySeconds);
    assert.ok(second > first);
    assert.ok(sixth <= policy.maxDelaySeconds);
  });
});
