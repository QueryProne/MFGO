import type { Request } from "express";
import { and, eq, isNull, or } from "drizzle-orm";

import { db, mfgDocPermissionsTable } from "@workspace/db";
import type { DispatchRule } from "../../modules/mfg-v2/scheduler";
import type { ManufacturingEventType } from "../../modules/mfg-v2/event-bus";

export const SUPPORTED_DISPATCH_RULES: readonly DispatchRule[] = ["FIFO", "EDD", "SPT", "CR"];

export const SUPPORTED_EVENT_TYPES: readonly ManufacturingEventType[] = [
  "job.released",
  "operation.completed",
  "machine.downtime",
];

export function asNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function toNumericString(value: number | string | undefined | null, fallback = "0"): string {
  if (value === undefined || value === null) {
    return fallback;
  }
  const n = asNumber(value, Number.NaN);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return n.toString();
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function nextVersionString(currentVersion: string): string {
  const parsed = Number(currentVersion);
  if (!Number.isFinite(parsed)) {
    return `${currentVersion}.1`;
  }
  return (parsed + 0.1).toFixed(1);
}

export async function ensureDocumentPermission(
  req: Request,
  permission: string,
  scope: { spaceId?: string | null; pageId?: string | null },
): Promise<boolean> {
  const role = String(req.header("x-role") ?? "planner");
  if (role.toLowerCase() === "admin") {
    return true;
  }

  const conditions = [
    eq(mfgDocPermissionsTable.role, role),
    eq(mfgDocPermissionsTable.permission, permission),
    or(
      scope.spaceId ? eq(mfgDocPermissionsTable.spaceId, scope.spaceId) : isNull(mfgDocPermissionsTable.spaceId),
      isNull(mfgDocPermissionsTable.spaceId),
    ),
    or(
      scope.pageId ? eq(mfgDocPermissionsTable.pageId, scope.pageId) : isNull(mfgDocPermissionsTable.pageId),
      isNull(mfgDocPermissionsTable.pageId),
    ),
  ];

  const rows = await db
    .select({ granted: mfgDocPermissionsTable.granted })
    .from(mfgDocPermissionsTable)
    .where(and(...conditions));

  if (rows.some((row) => row.granted === false)) {
    return false;
  }

  return rows.some((row) => row.granted === true);
}