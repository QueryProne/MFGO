import type { CommEmailTemplateVersion } from "@workspace/db";

export interface RenderedTemplate {
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

export interface TemplateRenderInput {
  version: Pick<CommEmailTemplateVersion, "subjectTemplate" | "bodyHtmlTemplate" | "bodyTextTemplate">;
  templateData: Record<string, unknown>;
  branding?: Record<string, unknown> | null;
}

export function renderTemplate(input: TemplateRenderInput): RenderedTemplate {
  const context: Record<string, unknown> = {
    ...input.templateData,
    branding: input.branding ?? {},
    system: {
      generatedAt: new Date().toISOString(),
    },
  };

  const subject = renderTemplateString(input.version.subjectTemplate, context);
  const bodyHtml = renderTemplateString(input.version.bodyHtmlTemplate ?? "", context);
  const fallbackText = stripHtml(bodyHtml);
  const bodyTextTemplate = input.version.bodyTextTemplate ?? fallbackText;
  const bodyText = renderTemplateString(bodyTextTemplate, context);

  return {
    subject,
    bodyHtml,
    bodyText,
  };
}

export function renderTemplateString(template: string, context: Record<string, unknown>): string {
  return template.replace(/{{\s*([a-zA-Z0-9_.\-]+)\s*}}/g, (_match, rawPath: string) => {
    const value = resolvePath(context, rawPath);
    if (value === undefined || value === null) {
      return "";
    }
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return JSON.stringify(value);
  });
}

export function extractTemplateVariables(template: string): string[] {
  const vars = new Set<string>();
  const regex = /{{\s*([a-zA-Z0-9_.\-]+)\s*}}/g;
  let match: RegExpExecArray | null;
  while (true) {
    match = regex.exec(template);
    if (!match) {
      break;
    }
    vars.add(match[1] as string);
  }
  return Array.from(vars).sort();
}

function resolvePath(target: unknown, rawPath: string): unknown {
  if (rawPath.length === 0) {
    return undefined;
  }

  const segments = rawPath.split(".");
  let current: unknown = target;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== "object") {
      return undefined;
    }

    if (!(segment in current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function stripHtml(input: string): string {
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
