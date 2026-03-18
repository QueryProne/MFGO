import { db, commCommunicationAuditLogsTable } from "@workspace/db";

export interface CommunicationAuditEntry {
  action: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  messageId?: string | null;
  templateId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  source?: string;
  tenantId: string;
  companyId?: string | null;
  siteId?: string | null;
}

export async function writeCommunicationAuditLog(entry: CommunicationAuditEntry): Promise<void> {
  try {
    await db.insert(commCommunicationAuditLogsTable).values({
      action: entry.action,
      actorId: entry.actorId ?? null,
      actorName: entry.actorName ?? null,
      actorRole: entry.actorRole ?? null,
      messageId: entry.messageId ?? null,
      templateId: entry.templateId ?? null,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      details: entry.details ?? null,
      source: entry.source ?? "api",
      tenantId: entry.tenantId,
      companyId: entry.companyId ?? null,
      siteId: entry.siteId ?? null,
    });
  } catch (error) {
    console.error("[communications.audit] failed to persist log", error);
  }
}
