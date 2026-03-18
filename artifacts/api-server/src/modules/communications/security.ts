import type { Request } from "express";
import { and, eq, isNull, or } from "drizzle-orm";

import {
  db,
  commEmailAttachmentsTable,
  mfgDocAttachmentsTable,
  mfgDocPagesTable,
  mfgDocPermissionsTable,
} from "@workspace/db";
import { requirePermission } from "../../lib/permissions";

export interface ActorContext {
  userId: string;
  userName: string;
  userRole: string;
  tenantId: string;
  companyId?: string | null;
  siteId?: string | null;
}

export interface AttachmentAccessResult {
  allowed: boolean;
  message?: string;
  resolvedAttachment?: {
    filename: string;
    mimeType: string;
    byteSize: number;
    objectStorageKey: string;
    objectStorageBucket?: string | null;
    checksum?: string | null;
    metadata?: Record<string, unknown> | null;
  };
}

export function requireCommunicationPermission(permission: string) {
  return requirePermission(permission);
}

export function getActorContext(req: Request): ActorContext {
  return {
    userId: String(req.header("x-user") ?? "system-user"),
    userName: String(req.header("x-user-name") ?? "System User"),
    userRole: String(req.header("x-role") ?? "planner").toLowerCase(),
    tenantId: String(req.header("x-tenant-id") ?? "default"),
    companyId: normalizeNullable(req.header("x-company-id")),
    siteId: normalizeNullable(req.header("x-site-id")),
  };
}

export async function assertAttachmentAccess(
  req: Request,
  sourceType: string,
  sourceId: string | null | undefined,
): Promise<AttachmentAccessResult> {
  const actor = getActorContext(req);
  const normalizedSourceType = sourceType.toLowerCase();

  if (!sourceId) {
    return {
      allowed: normalizedSourceType !== "mfg_doc_attachment" && normalizedSourceType !== "repository_attachment",
      message: "sourceId is required for repository/doc/email attachments",
    };
  }

  if (normalizedSourceType === "mfg_doc_attachment" || normalizedSourceType === "repository_attachment") {
    return resolveRepositoryAttachmentAccess(actor.userRole, sourceId);
  }

  if (normalizedSourceType === "email_attachment") {
    const [existing] = await db
      .select()
      .from(commEmailAttachmentsTable)
      .where(eq(commEmailAttachmentsTable.id, sourceId))
      .limit(1);

    if (!existing) {
      return { allowed: false, message: "Referenced email attachment not found" };
    }

    return {
      allowed: true,
      resolvedAttachment: {
        filename: existing.filename,
        mimeType: existing.mimeType,
        byteSize: existing.byteSize,
        objectStorageKey: existing.objectStorageKey,
        objectStorageBucket: existing.objectStorageBucket,
        checksum: existing.checksum,
        metadata: (existing.metadata as Record<string, unknown> | null) ?? null,
      },
    };
  }

  return { allowed: true };
}

export function enforceRecipientDomainRestrictions(
  recipients: string[],
  policy: { allowedDomains?: string[]; blockedDomains?: string[] },
): { allowed: boolean; blockedRecipients: string[]; blockedReason?: string } {
  const normalizedAllowed = new Set((policy.allowedDomains ?? []).map(normalizeDomain).filter(Boolean));
  const normalizedBlocked = new Set((policy.blockedDomains ?? []).map(normalizeDomain).filter(Boolean));

  const blocked: string[] = [];

  for (const recipient of recipients) {
    const domain = normalizeDomain(extractDomain(recipient));
    if (!domain) {
      blocked.push(recipient);
      continue;
    }

    if (normalizedBlocked.has(domain)) {
      blocked.push(recipient);
      continue;
    }

    if (normalizedAllowed.size > 0 && !normalizedAllowed.has(domain)) {
      blocked.push(recipient);
    }
  }

  if (blocked.length > 0) {
    return {
      allowed: false,
      blockedRecipients: blocked,
      blockedReason: "recipient_domain_policy",
    };
  }

  return { allowed: true, blockedRecipients: [] };
}

function normalizeNullable(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

async function resolveRepositoryAttachmentAccess(role: string, sourceId: string): Promise<AttachmentAccessResult> {
  const [docAttachment] = await db
    .select({
      fileName: mfgDocAttachmentsTable.fileName,
      contentType: mfgDocAttachmentsTable.contentType,
      sizeBytes: mfgDocAttachmentsTable.sizeBytes,
      objectKey: mfgDocAttachmentsTable.objectKey,
      bucket: mfgDocAttachmentsTable.bucket,
      etag: mfgDocAttachmentsTable.etag,
      pageId: mfgDocAttachmentsTable.pageId,
      spaceId: mfgDocPagesTable.spaceId,
    })
    .from(mfgDocAttachmentsTable)
    .leftJoin(mfgDocPagesTable, eq(mfgDocAttachmentsTable.pageId, mfgDocPagesTable.id))
    .where(eq(mfgDocAttachmentsTable.id, sourceId))
    .limit(1);

  if (!docAttachment) {
    return { allowed: false, message: "Document attachment not found" };
  }

  if (role === "admin") {
    return {
      allowed: true,
      resolvedAttachment: {
        filename: docAttachment.fileName,
        mimeType: docAttachment.contentType,
        byteSize: docAttachment.sizeBytes,
        objectStorageKey: docAttachment.objectKey,
        objectStorageBucket: docAttachment.bucket,
        checksum: docAttachment.etag,
      },
    };
  }

  const permissionRows = await db
    .select({ granted: mfgDocPermissionsTable.granted })
    .from(mfgDocPermissionsTable)
    .where(
      and(
        eq(mfgDocPermissionsTable.role, role),
        eq(mfgDocPermissionsTable.permission, "read"),
        or(
          docAttachment.spaceId ? eq(mfgDocPermissionsTable.spaceId, docAttachment.spaceId) : isNull(mfgDocPermissionsTable.spaceId),
          isNull(mfgDocPermissionsTable.spaceId),
        ),
        or(
          docAttachment.pageId ? eq(mfgDocPermissionsTable.pageId, docAttachment.pageId) : isNull(mfgDocPermissionsTable.pageId),
          isNull(mfgDocPermissionsTable.pageId),
        ),
      ),
    );

  if (permissionRows.some((row) => row.granted === false)) {
    return { allowed: false, message: "Attachment permission denied by explicit deny rule" };
  }

  const granted = permissionRows.some((row) => row.granted === true);
  if (!granted) {
    return { allowed: false, message: "Attachment permission denied" };
  }

  return {
    allowed: true,
    resolvedAttachment: {
      filename: docAttachment.fileName,
      mimeType: docAttachment.contentType,
      byteSize: docAttachment.sizeBytes,
      objectStorageKey: docAttachment.objectKey,
      objectStorageBucket: docAttachment.bucket,
      checksum: docAttachment.etag,
    },
  };
}

function extractDomain(emailAddress: string): string | null {
  const atIndex = emailAddress.lastIndexOf("@");
  if (atIndex < 0) {
    return null;
  }
  return emailAddress.slice(atIndex + 1);
}

function normalizeDomain(value: string | null): string {
  if (!value) {
    return "";
  }
  return value.trim().toLowerCase();
}
