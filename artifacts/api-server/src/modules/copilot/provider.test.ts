import test from "node:test";
import assert from "node:assert/strict";

import { redactSensitiveText } from "./provider";

test("redacts email addresses", () => {
  const output = redactSensitiveText("Contact jane.doe@example.com for updates.");
  assert.equal(output.includes("example.com"), false);
  assert.equal(output.includes("[REDACTED_EMAIL]"), true);
});

test("redacts phone-like patterns", () => {
  const output = redactSensitiveText("Call +1 (313) 555-1010 now.");
  assert.equal(output.includes("555"), false);
  assert.equal(output.includes("[REDACTED_PHONE]"), true);
});
