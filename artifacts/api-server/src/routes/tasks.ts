import { Router } from "express";
import { and, desc, eq, ilike, sql } from "drizzle-orm";

import { db, tasksTable } from "@workspace/db";

import { parsePagination } from "../modules/communications/http";
import { getActorContext } from "../modules/communications/security";
import { getUnifiedTimeline, recordTimelineActivity } from "../modules/timeline";

const router = Router();

router.get("/tasks", async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>, { limit: 50 });
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const assigneeId = typeof req.query.assigneeId === "string" ? req.query.assigneeId.trim() : "";
    const entityType = typeof req.query.entityType === "string" ? req.query.entityType.trim() : "";
    const entityId = typeof req.query.entityId === "string" ? req.query.entityId.trim() : "";

    const conditions = [];
    if (search.length > 0) {
      conditions.push(ilike(tasksTable.title, `%${search}%`));
    }
    if (status.length > 0) {
      conditions.push(eq(tasksTable.status, status));
    }
    if (assigneeId.length > 0) {
      conditions.push(eq(tasksTable.assigneeId, assigneeId));
    }
    if (entityType.length > 0) {
      conditions.push(eq(tasksTable.entityType, entityType));
    }
    if (entityId.length > 0) {
      conditions.push(eq(tasksTable.entityId, entityId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, countRows] = await Promise.all([
      db
        .select()
        .from(tasksTable)
        .where(whereClause)
        .orderBy(desc(tasksTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(tasksTable).where(whereClause),
    ]);

    const total = Number(countRows[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.get("/tasks/entity/:type/:id", async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>, { limit: 100 });
    const [data, countRows] = await Promise.all([
      db
        .select()
        .from(tasksTable)
        .where(and(eq(tasksTable.entityType, String(req.params.type)), eq(tasksTable.entityId, String(req.params.id))))
        .orderBy(desc(tasksTable.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(tasksTable)
        .where(and(eq(tasksTable.entityType, String(req.params.type)), eq(tasksTable.entityId, String(req.params.id)))),
    ]);

    const total = Number(countRows[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/tasks", async (req, res) => {
  try {
    const actor = getActorContext(req);
    const payload = req.body as {
      entityType: string;
      entityId: string;
      relatedEntityType?: string | null;
      relatedEntityId?: string | null;
      title: string;
      description?: string | null;
      dueDate?: string | null;
      status?: string;
      priority?: string;
      assigneeId?: string | null;
      reminders?: Array<Record<string, unknown>>;
      comments?: Array<Record<string, unknown>>;
      metadata?: Record<string, unknown>;
    };

    const [created] = await db
      .insert(tasksTable)
      .values({
        entityType: payload.entityType,
        entityId: payload.entityId,
        relatedEntityType: payload.relatedEntityType ?? null,
        relatedEntityId: payload.relatedEntityId ?? null,
        title: payload.title,
        description: payload.description ?? null,
        dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
        status: payload.status ?? "open",
        priority: payload.priority ?? "medium",
        assigneeId: payload.assigneeId ?? null,
        createdBy: actor.userId,
        reminders: payload.reminders ?? [],
        comments: payload.comments ?? [],
        metadata: payload.metadata ?? {},
      })
      .returning();

    await recordTimelineActivity({
      entityType: payload.entityType,
      entityId: payload.entityId,
      relatedEntityType: payload.relatedEntityType ?? null,
      relatedEntityId: payload.relatedEntityId ?? null,
      activityType: "task",
      sourceType: "task",
      sourceId: created.id,
      title: `Task created: ${created.title}`,
      body: created.description ?? null,
      metadata: { status: created.status, priority: created.priority, dueDate: created.dueDate },
      actorId: actor.userId,
    });

    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.patch("/tasks/:id", async (req, res) => {
  try {
    const actor = getActorContext(req);
    const payload = req.body as {
      title?: string;
      description?: string | null;
      dueDate?: string | null;
      status?: string;
      priority?: string;
      assigneeId?: string | null;
      reminders?: Array<Record<string, unknown>>;
      comments?: Array<Record<string, unknown>>;
      metadata?: Record<string, unknown>;
    };

    const [existing] = await db.select().from(tasksTable).where(eq(tasksTable.id, String(req.params.id))).limit(1);
    if (!existing) {
      res.status(404).json({ error: "not_found", message: "Task not found" });
      return;
    }

    const [updated] = await db
      .update(tasksTable)
      .set({
        title: payload.title ?? existing.title,
        description: payload.description !== undefined ? payload.description : existing.description,
        dueDate: payload.dueDate !== undefined ? (payload.dueDate ? new Date(payload.dueDate) : null) : existing.dueDate,
        status: payload.status ?? existing.status,
        priority: payload.priority ?? existing.priority,
        assigneeId: payload.assigneeId !== undefined ? payload.assigneeId : existing.assigneeId,
        reminders: payload.reminders ?? existing.reminders,
        comments: payload.comments ?? existing.comments,
        metadata: payload.metadata ?? (existing.metadata as Record<string, unknown> | null),
        completedAt: (payload.status ?? existing.status) === "done" ? new Date() : existing.completedAt,
        updatedAt: new Date(),
      })
      .where(eq(tasksTable.id, String(req.params.id)))
      .returning();

    await recordTimelineActivity({
      entityType: existing.entityType,
      entityId: existing.entityId,
      relatedEntityType: existing.relatedEntityType,
      relatedEntityId: existing.relatedEntityId,
      activityType: "task",
      sourceType: "task",
      sourceId: existing.id,
      title: `Task updated: ${updated.title}`,
      body: updated.description ?? null,
      metadata: { status: updated.status, priority: updated.priority, dueDate: updated.dueDate },
      actorId: actor.userId,
    });

    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.delete("/tasks/:id", async (req, res) => {
  try {
    const [existing] = await db.select().from(tasksTable).where(eq(tasksTable.id, String(req.params.id))).limit(1);
    if (!existing) {
      res.status(404).json({ error: "not_found", message: "Task not found" });
      return;
    }

    await db.delete(tasksTable).where(eq(tasksTable.id, String(req.params.id)));

    await recordTimelineActivity({
      entityType: existing.entityType,
      entityId: existing.entityId,
      relatedEntityType: existing.relatedEntityType,
      relatedEntityId: existing.relatedEntityId,
      activityType: "task",
      sourceType: "task",
      sourceId: existing.id,
      title: `Task deleted: ${existing.title}`,
      body: existing.description ?? null,
      metadata: { status: existing.status, priority: existing.priority },
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.get("/timeline/:entityType/:entityId", async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query as Record<string, unknown>, { limit: 100 });
    const timeline = await getUnifiedTimeline({
      entityType: String(req.params.entityType),
      entityId: String(req.params.entityId),
      page,
      limit,
    });
    res.json(timeline);
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

export default router;
