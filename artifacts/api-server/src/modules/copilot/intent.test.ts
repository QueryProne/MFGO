import test from "node:test";
import assert from "node:assert/strict";

import { detectCopilotIntent } from "./intent";

test("detects open task by customer intent", () => {
  const parsed = detectCopilotIntent("List open tasks for customer Acme");
  assert.equal(parsed.intent, "tasks_by_customer");
  assert.equal(parsed.entityHint, "acme");
});

test("detects vendor interactions intent", () => {
  const parsed = detectCopilotIntent("Show vendor XYZ recent interactions");
  assert.equal(parsed.intent, "vendor_interactions");
  assert.equal(parsed.entityHint, "xyz");
});

test("detects production due this week intent", () => {
  const parsed = detectCopilotIntent("Summarize production orders due this week");
  assert.equal(parsed.intent, "production_due_week");
});

test("falls back to generic when no known intent", () => {
  const parsed = detectCopilotIntent("Help me understand this account");
  assert.equal(parsed.intent, "generic");
});
