export type CopilotIntent =
  | "tasks_by_customer"
  | "vendor_interactions"
  | "production_due_week"
  | "lead_status"
  | "generic";

export interface CopilotIntentResult {
  intent: CopilotIntent;
  entityHint: string | null;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function extractEntityHint(input: string, keyword: "customer" | "vendor"): string | null {
  const normalized = normalize(input);
  const pattern = new RegExp(`${keyword}\\s+([^?.!\\n]{2,120})`, "i");
  const match = normalized.match(pattern);
  if (!match?.[1]) {
    return null;
  }
  let raw = match[1].trim().replace(/^for\\s+/, "");

  const suffixPatterns = [
    /\s+(recent|latest)\s+(interactions?|emails?|activity|timeline).*$/i,
    /\s+(open|active|pending|overdue)\s+(tasks?|orders?|items?).*$/i,
    /\s+(status|pipeline|due|summary|details?).*$/i,
  ];

  for (const suffixPattern of suffixPatterns) {
    raw = raw.replace(suffixPattern, "").trim();
  }

  const trimmed = raw.replace(/[^a-z0-9\\-_. ]/g, "").replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function detectCopilotIntent(query: string): CopilotIntentResult {
  const text = normalize(query);

  const referencesTask = text.includes("task") || text.includes("todo") || text.includes("to-do");
  const referencesCustomer = text.includes("customer");
  if (referencesTask && referencesCustomer) {
    return {
      intent: "tasks_by_customer",
      entityHint: extractEntityHint(query, "customer"),
    };
  }

  if (text.includes("vendor") && (text.includes("interaction") || text.includes("email") || text.includes("timeline"))) {
    return {
      intent: "vendor_interactions",
      entityHint: extractEntityHint(query, "vendor"),
    };
  }

  if (
    (text.includes("production order") || text.includes("work order") || text.includes("production")) &&
    (text.includes("due this week") || text.includes("this week"))
  ) {
    return {
      intent: "production_due_week",
      entityHint: null,
    };
  }

  if (text.includes("lead") && (text.includes("status") || text.includes("pipeline") || text.includes("opportunit"))) {
    return {
      intent: "lead_status",
      entityHint: null,
    };
  }

  return {
    intent: "generic",
    entityHint: null,
  };
}
