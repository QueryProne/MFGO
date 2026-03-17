import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db";
import { Request } from "express";

export interface AuditEntry {
  entity: string;
  entityId: string;
  action: string;
  userId?: string;
  userName?: string;
  fieldChanges?: Record<string, any>;
  source?: string;
}

export async function auditLog(entry: AuditEntry, req?: Request) {
  try {
    await db.insert(auditLogsTable).values({
      entity: entry.entity,
      entityId: entry.entityId,
      action: entry.action,
      userId: entry.userId ?? "system-user",
      userName: entry.userName ?? "Admin User",
      fieldChanges: entry.fieldChanges ?? null,
      source: entry.source ?? "api",
    });
  } catch (e) {
    console.error("[audit] Failed to write audit log:", e);
  }
}

export function diffFields(before: Record<string, any>, after: Record<string, any>): Record<string, { before: any; after: any }> {
  const changes: Record<string, { before: any; after: any }> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes[key] = { before: before[key], after: after[key] };
    }
  }
  return changes;
}
