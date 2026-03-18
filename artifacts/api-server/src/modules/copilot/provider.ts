export interface CopilotLLMRequest {
  query: string;
  intent: string;
  contextRows: Array<Record<string, unknown>>;
  schemaHints: string[];
}

export interface CopilotLLMResponse {
  answer: string;
  provider: string;
  model: string;
  metadata: Record<string, unknown>;
}

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)[\d][-.\s]?[\d]{2,4}[-.\s]?[\d]{2,4}/g;

export function redactSensitiveText(input: string): string {
  return input.replace(EMAIL_REGEX, "[REDACTED_EMAIL]").replace(PHONE_REGEX, "[REDACTED_PHONE]");
}

export function redactSensitiveData(value: unknown): unknown {
  if (typeof value === "string") {
    return redactSensitiveText(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitiveData(entry));
  }
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      output[key] = redactSensitiveData(entry);
    }
    return output;
  }
  return value;
}

function buildSystemPrompt(): string {
  return [
    "You are MFGO ERP assistant.",
    "Only use provided data.",
    "Answer factually.",
    "If unsure, say: I need more details.",
    "Do not fabricate rows, IDs, dates, or metrics.",
    "Keep responses concise and actionable for ERP operators.",
  ].join(" ");
}

function buildUserPrompt(input: CopilotLLMRequest): string {
  const safeContext = redactSensitiveData(input.contextRows);
  return [
    `Intent: ${input.intent}`,
    `User query: ${redactSensitiveText(input.query)}`,
    `Schema hints: ${input.schemaHints.join(", ")}`,
    `Context rows (JSON): ${JSON.stringify(safeContext)}`,
  ].join("\n\n");
}

async function callOpenAiLike(
  endpoint: string,
  apiKey: string,
  model: string,
  input: CopilotLLMRequest,
): Promise<CopilotLLMResponse> {
  const response = await fetch(`${endpoint.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(input) },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LLM request failed: ${response.status} ${body}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: Record<string, unknown>;
  };
  const answer = payload.choices?.[0]?.message?.content?.trim() || "I need more details.";

  return {
    answer,
    provider: endpoint.includes("x.ai") ? "xai" : "openai-compatible",
    model,
    metadata: {
      usage: payload.usage ?? null,
    },
  };
}

async function callAnthropic(
  apiKey: string,
  model: string,
  input: CopilotLLMRequest,
): Promise<CopilotLLMResponse> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      temperature: 0.1,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: buildUserPrompt(input) }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic request failed: ${response.status} ${body}`);
  }

  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
    usage?: Record<string, unknown>;
  };
  const textChunks = payload.content?.filter((entry) => entry.type === "text").map((entry) => entry.text ?? "") ?? [];
  const answer = textChunks.join("\n").trim() || "I need more details.";

  return {
    answer,
    provider: "anthropic",
    model,
    metadata: {
      usage: payload.usage ?? null,
    },
  };
}

function localFallbackAnswer(input: CopilotLLMRequest): CopilotLLMResponse {
  if (input.contextRows.length === 0) {
    return {
      answer: "I need more details.",
      provider: "local-fallback",
      model: "none",
      metadata: { reason: "no_context_rows" },
    };
  }

  const preview = input.contextRows.slice(0, 5);
  return {
    answer: [
      "Using available ERP context, here is what I found:",
      ...preview.map((row, idx) => `${idx + 1}. ${JSON.stringify(redactSensitiveData(row))}`),
    ].join("\n"),
    provider: "local-fallback",
    model: "none",
    metadata: { reason: "missing_llm_api_key", contextCount: input.contextRows.length },
  };
}

export async function requestCopilotAnswer(input: CopilotLLMRequest): Promise<CopilotLLMResponse> {
  const openAiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const xaiKey = process.env.XAI_API_KEY;

  if (openAiKey) {
    return callOpenAiLike(
      process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      openAiKey,
      process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      input,
    );
  }

  if (xaiKey) {
    return callOpenAiLike(
      process.env.XAI_BASE_URL ?? "https://api.x.ai/v1",
      xaiKey,
      process.env.XAI_MODEL ?? "grok-3-mini",
      input,
    );
  }

  if (anthropicKey) {
    return callAnthropic(
      anthropicKey,
      process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-20241022",
      input,
    );
  }

  return localFallbackAnswer(input);
}
