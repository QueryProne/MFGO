import type { Request } from "express";
import { asc, eq, sql } from "drizzle-orm";

import {
  db,
  commEmailAttachmentsTable,
  commEmailMessageAttachmentsTable,
  commEmailMessagesTable,
} from "@workspace/db";
import type { EmailAttachmentInput } from "./types";
import { assertAttachmentAccess } from "./security";

export interface AttachToMessageInput {
  sourceType: string;
  sourceId?: string | null;
  filename?: string;
  mimeType?: string;
  byteSize?: number;
  checksum?: string | null;
  objectStorageKey?: string;
  objectStorageBucket?: string | null;
  visibilityMetadata?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  disposition?: string;
  inlineCid?: string | null;
}

export async function addAttachmentToMessage(
  req: Request,
  messageId: string,
  actor: { tenantId: string; companyId?: string | null; siteId?: string | null; userId: string },
  input: AttachToMessageInput,
): Promise<{ attachmentId: string }> {
  const [message] = await db
    .select({ id: commEmailMessagesTable.id, status: commEmailMessagesTable.status })
    .from(commEmailMessagesTable)
    .where(eq(commEmailMessagesTable.id, messageId))
    .limit(1);

  if (!message) {
    throw new Error("Message not found");
  }

  if (message.status !== "draft" && message.status !== "queued") {
    throw new Error("Attachments can only be modified on draft or queued messages");
  }

  const access = await assertAttachmentAccess(req, input.sourceType, input.sourceId ?? null);
  if (!access.allowed) {
    throw new Error(access.message ?? "Attachment access denied");
  }

  const payload = buildAttachmentPayload(input, access.resolvedAttachment);

  const [created] = await db
    .insert(commEmailAttachmentsTable)
    .values({
      filename: payload.filename,
      mimeType: payload.mimeType,
      byteSize: payload.byteSize,
      checksum: payload.checksum ?? null,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      objectStorageKey: payload.objectStorageKey,
      objectStorageBucket: payload.objectStorageBucket ?? null,
      createdBy: actor.userId,
      visibilityMetadata: input.visibilityMetadata ?? null,
      metadata: payload.metadata ?? null,
      tenantId: actor.tenantId,
      companyId: actor.companyId ?? null,
      siteId: actor.siteId ?? null,
    })
    .returning({ id: commEmailAttachmentsTable.id });

  if (!created) {
    throw new Error("Failed to create attachment metadata");
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(commEmailMessageAttachmentsTable)
    .where(eq(commEmailMessageAttachmentsTable.messageId, messageId));

  const sortOrder = Number(count ?? 0);

  await db.insert(commEmailMessageAttachmentsTable).values({
    messageId,
    attachmentId: created.id,
    disposition: input.disposition ?? "attachment",
    inlineCid: input.inlineCid ?? null,
    sortOrder,
  });

  return {
    attachmentId: created.id,
  };
}

export async function listMessageAttachments(messageId: string) {
  return db
    .select({
      id: commEmailAttachmentsTable.id,
      filename: commEmailAttachmentsTable.filename,
      mimeType: commEmailAttachmentsTable.mimeType,
      byteSize: commEmailAttachmentsTable.byteSize,
      checksum: commEmailAttachmentsTable.checksum,
      sourceType: commEmailAttachmentsTable.sourceType,
      sourceId: commEmailAttachmentsTable.sourceId,
      objectStorageKey: commEmailAttachmentsTable.objectStorageKey,
      objectStorageBucket: commEmailAttachmentsTable.objectStorageBucket,
      metadata: commEmailAttachmentsTable.metadata,
      disposition: commEmailMessageAttachmentsTable.disposition,
      inlineCid: commEmailMessageAttachmentsTable.inlineCid,
      sortOrder: commEmailMessageAttachmentsTable.sortOrder,
    })
    .from(commEmailMessageAttachmentsTable)
    .leftJoin(commEmailAttachmentsTable, eq(commEmailMessageAttachmentsTable.attachmentId, commEmailAttachmentsTable.id))
    .where(eq(commEmailMessageAttachmentsTable.messageId, messageId))
    .orderBy(asc(commEmailMessageAttachmentsTable.sortOrder));
}

function buildAttachmentPayload(
  input: AttachToMessageInput,
  resolved:
    | {
        filename: string;
        mimeType: string;
        byteSize: number;
        objectStorageKey: string;
        objectStorageBucket?: string | null;
        checksum?: string | null;
        metadata?: Record<string, unknown> | null;
      }
    | undefined,
): EmailAttachmentInput {
  const filename = resolved?.filename ?? input.filename;
  const mimeType = resolved?.mimeType ?? input.mimeType;
  const byteSize = resolved?.byteSize ?? input.byteSize;
  const objectStorageKey = resolved?.objectStorageKey ?? input.objectStorageKey;

  if (!filename || !mimeType || !Number.isFinite(Number(byteSize)) || !objectStorageKey) {
    throw new Error("Attachment metadata is incomplete");
  }

  return {
    filename,
    mimeType,
    byteSize: Math.max(0, Math.floor(Number(byteSize))),
    checksum: resolved?.checksum ?? input.checksum ?? null,
    sourceType: input.sourceType,
    sourceId: input.sourceId ?? null,
    objectStorageKey,
    objectStorageBucket: resolved?.objectStorageBucket ?? input.objectStorageBucket ?? null,
    visibilityMetadata: input.visibilityMetadata ?? null,
    metadata: resolved?.metadata ?? input.metadata ?? null,
  };
}
