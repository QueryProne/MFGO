export const EMAIL_DIRECTIONS = ["outbound", "inbound"] as const;
export type EmailDirection = (typeof EMAIL_DIRECTIONS)[number];

export const EMAIL_STATUSES = [
  "draft",
  "queued",
  "sending",
  "sent",
  "delivered",
  "opened",
  "bounced",
  "failed",
  "received",
  "archived",
] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export const EMAIL_RECIPIENT_TYPES = ["to", "cc", "bcc"] as const;
export type EmailRecipientType = (typeof EMAIL_RECIPIENT_TYPES)[number];

export const EMAIL_OUTBOX_STATUSES = ["queued", "processing", "retry_wait", "dead_letter", "completed"] as const;
export type EmailOutboxStatus = (typeof EMAIL_OUTBOX_STATUSES)[number];

export const PROVIDER_EVENT_TYPES = ["delivered", "opened", "bounced", "failed", "received", "unknown"] as const;
export type ProviderEventType = (typeof PROVIDER_EVENT_TYPES)[number];

export interface CommunicationContextLinkInput {
  entityType: string;
  entityId: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  linkRole?: string;
}

export interface EmailRecipientInput {
  recipientType: EmailRecipientType;
  emailAddress: string;
  displayName?: string | null;
}

export interface EmailAttachmentInput {
  filename: string;
  mimeType: string;
  byteSize: number;
  checksum?: string | null;
  sourceType: string;
  sourceId?: string | null;
  objectStorageKey: string;
  objectStorageBucket?: string | null;
  visibilityMetadata?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface DraftContext {
  tenantId: string;
  companyId?: string | null;
  siteId?: string | null;
  userId: string;
  userName: string;
  userRole: string;
}

export interface CreateDraftInput {
  subject?: string;
  bodyHtml?: string | null;
  bodyText?: string | null;
  fromAddress?: string | null;
  replyTo?: string | null;
  templateId?: string | null;
  templateVersionId?: string | null;
  conversationId?: string | null;
  parentMessageId?: string | null;
  inReplyTo?: string | null;
  referencesHeader?: string | null;
  mailboxConfigId?: string | null;
  providerName?: string | null;
  idempotencyKey?: string | null;
  sourceModule?: string | null;
  sourceAction?: string | null;
  sendAfter?: Date | null;
  requiresApproval?: boolean;
  recipients?: EmailRecipientInput[];
  contextLinks?: CommunicationContextLinkInput[];
  templateData?: Record<string, unknown>;
}

export interface UpdateDraftInput {
  subject?: string;
  bodyHtml?: string | null;
  bodyText?: string | null;
  fromAddress?: string | null;
  replyTo?: string | null;
  templateId?: string | null;
  templateVersionId?: string | null;
  inReplyTo?: string | null;
  referencesHeader?: string | null;
  mailboxConfigId?: string | null;
  providerName?: string | null;
  sendAfter?: Date | null;
  requiresApproval?: boolean;
  recipients?: EmailRecipientInput[];
  contextLinks?: CommunicationContextLinkInput[];
  templateData?: Record<string, unknown>;
}

export interface QueueEmailInput {
  mailboxConfigId?: string | null;
  sendAt?: Date | null;
  idempotencyKey?: string | null;
}

export interface EmailSearchFilters {
  tenantId: string;
  companyId?: string | null;
  siteId?: string | null;
  recordEntityType?: string | null;
  recordEntityId?: string | null;
  sender?: string | null;
  recipient?: string | null;
  status?: EmailStatus | null;
  templateId?: string | null;
  hasAttachments?: boolean | null;
  fromDate?: Date | null;
  toDate?: Date | null;
  q?: string | null;
}

export interface InboundAttachmentInput {
  filename: string;
  mimeType: string;
  byteSize: number;
  objectStorageKey: string;
  objectStorageBucket?: string | null;
  checksum?: string | null;
}

export interface InboundEmailInput {
  fromAddress: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  bodyHtml?: string | null;
  bodyText?: string | null;
  messageId?: string | null;
  inReplyTo?: string | null;
  referencesHeader?: string | null;
  providerName: string;
  providerMessageId?: string | null;
  tenantId: string;
  companyId?: string | null;
  siteId?: string | null;
  attachments?: InboundAttachmentInput[];
  receivedAt?: Date | null;
  rawPayload?: Record<string, unknown>;
}

export interface RetryPolicy {
  maxAttempts: number;
  initialDelaySeconds: number;
  maxDelaySeconds: number;
  backoffMultiplier: number;
}

export interface ProviderDeliveryUpdate {
  providerName: string;
  providerEventId?: string;
  providerMessageId?: string;
  messageId?: string;
  eventType: ProviderEventType;
  eventStatus?: string | null;
  occurredAt?: Date | null;
  payload?: Record<string, unknown>;
  headers?: Record<string, unknown>;
}

export function isEmailStatus(value: string): value is EmailStatus {
  return (EMAIL_STATUSES as readonly string[]).includes(value);
}

export function isEmailRecipientType(value: string): value is EmailRecipientType {
  return (EMAIL_RECIPIENT_TYPES as readonly string[]).includes(value);
}

export function getDefaultRetryPolicy(): RetryPolicy {
  return {
    maxAttempts: 5,
    initialDelaySeconds: 30,
    maxDelaySeconds: 60 * 30,
    backoffMultiplier: 2,
  };
}

export function nextRetryDelaySeconds(policy: RetryPolicy, attemptNumber: number): number {
  const raw = policy.initialDelaySeconds * Math.pow(policy.backoffMultiplier, Math.max(0, attemptNumber - 1));
  return Math.min(policy.maxDelaySeconds, Math.max(policy.initialDelaySeconds, Math.floor(raw)));
}
