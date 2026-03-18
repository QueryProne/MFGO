import type { InboundEmailInput, ProviderDeliveryUpdate, EmailRecipientInput, EmailStatus } from "./types";

export interface ProviderSendAttachment {
  filename: string;
  mimeType: string;
  byteSize: number;
  objectStorageKey: string;
  objectStorageBucket?: string | null;
  checksum?: string | null;
}

export interface ProviderSendPayload {
  messageId: string;
  fromAddress: string;
  replyTo?: string | null;
  subject: string;
  bodyHtml?: string | null;
  bodyText?: string | null;
  to: EmailRecipientInput[];
  cc: EmailRecipientInput[];
  bcc: EmailRecipientInput[];
  attachments: ProviderSendAttachment[];
  headers?: Record<string, string>;
}

export interface ProviderSendResult {
  accepted: boolean;
  providerMessageId?: string;
  messageId?: string;
  status: "queued" | "sent";
  responsePayload?: Record<string, unknown>;
}

export class ProviderSendError extends Error {
  readonly code: string;
  readonly transient: boolean;
  readonly details?: Record<string, unknown>;

  constructor(message: string, options: { code?: string; transient?: boolean; details?: Record<string, unknown> } = {}) {
    super(message);
    this.name = "ProviderSendError";
    this.code = options.code ?? "provider_error";
    this.transient = options.transient ?? false;
    this.details = options.details;
  }
}

export interface ParsedWebhookPayload {
  deliveryUpdates: ProviderDeliveryUpdate[];
  inboundEmails: InboundEmailInput[];
}

export interface ProviderValidationResult {
  valid: boolean;
  errors: string[];
}

export interface CommunicationProvider {
  name: string;
  sendEmail(payload: ProviderSendPayload): Promise<ProviderSendResult>;
  parseWebhook(payload: unknown, headers: Record<string, string | undefined>): Promise<ParsedWebhookPayload>;
  validateConfiguration(config: unknown): Promise<ProviderValidationResult>;
}

const providerRegistry = new Map<string, CommunicationProvider>();

export function registerCommunicationProvider(provider: CommunicationProvider): void {
  providerRegistry.set(provider.name.toLowerCase(), provider);
}

export function getCommunicationProvider(providerName: string): CommunicationProvider | null {
  return providerRegistry.get(providerName.toLowerCase()) ?? null;
}

export function listCommunicationProviders(): CommunicationProvider[] {
  return Array.from(providerRegistry.values());
}

export function normalizeHeaders(inputHeaders: Record<string, string | string[] | undefined>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(inputHeaders)) {
    if (Array.isArray(value)) {
      normalized[key.toLowerCase()] = value.join(",");
      continue;
    }
    if (typeof value === "string") {
      normalized[key.toLowerCase()] = value;
    }
  }
  return normalized;
}

export function mapProviderEventToInternalStatus(eventType: string): EmailStatus {
  const normalized = eventType.toLowerCase();
  if (normalized.includes("deliver")) return "delivered";
  if (normalized.includes("open")) return "opened";
  if (normalized.includes("bounce")) return "bounced";
  if (normalized.includes("fail")) return "failed";
  if (normalized.includes("receive")) return "received";
  return "sent";
}
