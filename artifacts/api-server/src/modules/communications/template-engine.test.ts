import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractTemplateVariables, renderTemplate, renderTemplateString } from "./template-engine";

describe("communications template engine", () => {
  it("renders placeholders from nested context", () => {
    const rendered = renderTemplateString("PO {{po.number}} for {{vendor.name}}", {
      po: { number: "PO-1001" },
      vendor: { name: "Midwest Steel" },
    });

    assert.equal(rendered, "PO PO-1001 for Midwest Steel");
  });

  it("renders full template payload with html fallback", () => {
    const output = renderTemplate({
      version: {
        subjectTemplate: "Work Order {{wo.number}}",
        bodyHtmlTemplate: "<p>Hello {{recipient.name}}</p>",
        bodyTextTemplate: null,
      },
      templateData: {
        wo: { number: "WO-7781" },
        recipient: { name: "Alex" },
      },
      branding: {
        companyName: "ManufactureOS",
      },
    });

    assert.equal(output.subject, "Work Order WO-7781");
    assert.equal(output.bodyHtml, "<p>Hello Alex</p>");
    assert.equal(output.bodyText, "Hello Alex");
  });

  it("extracts unique variables", () => {
    const vars = extractTemplateVariables("Hi {{a.b}} {{a.b}} {{c}}");
    assert.deepEqual(vars, ["a.b", "c"]);
  });
});
