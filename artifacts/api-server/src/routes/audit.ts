import { Router } from "express";
import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";

const router = Router();

router.get("/audit", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;

    const data = await db.select().from(auditLogsTable).orderBy(sql`${auditLogsTable.createdAt} desc`).limit(limit).offset(offset);
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(auditLogsTable);
    const total = Number(countResult[0]?.count ?? 0);

    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

export async function logAudit(params: {
  entity: string;
  entityId: string;
  action: string;
  userId?: string;
  userName?: string;
  fieldChanges?: Record<string, any>;
  source?: string;
}) {
  try {
    await db.insert(auditLogsTable).values({
      entity: params.entity,
      entityId: params.entityId,
      action: params.action,
      userId: params.userId ?? "system",
      userName: params.userName ?? "System",
      fieldChanges: params.fieldChanges ?? {},
      source: params.source ?? "api",
    });
  } catch {}
}

export default router;
