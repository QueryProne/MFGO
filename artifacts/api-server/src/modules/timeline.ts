import { and, desc, eq, inArray, sql } from "drizzle-orm";

import {
  activityTimelineTable,
  chatLogsTable,
  commEmailContextLinksTable,
  commEmailMessagesTable,
  db,
  tasksTable,
} from "@workspace/db";

export interface TimelineActivityInput {
  entityType: string;
  entityId: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  activityType: string;
  sourceType: string;
  sourceId?: string | null;
  title: string;
  body?: string | null;
  metadata?: Record<string, unknown> | null;
  actorId?: string | null;
}

export async function recordTimelineActivity(input: TimelineActivityInput) {
  await db.insert(activityTimelineTable).values({
    entityType: input.entityType,
    entityId: input.entityId,
    relatedEntityType: input.relatedEntityType ?? null,
    relatedEntityId: input.relatedEntityId ?? null,
    activityType: input.activityType,
    sourceType: input.sourceType,
    sourceId: input.sourceId ?? null,
    title: input.title,
    body: input.body ?? null,
    metadata: input.metadata ?? null,
    actorId: input.actorId ?? null,
  });
}

export async function getUnifiedTimeline(params: {
  entityType: string;
  entityId: string;
  page: number;
  limit: number;
}) {
  const offset = (params.page - 1) * params.limit;

  const [storedEvents, directTasks, contextLinks, chats, totalRes] = await Promise.all([
    db
      .select()
      .from(activityTimelineTable)
      .where(and(eq(activityTimelineTable.entityType, params.entityType), eq(activityTimelineTable.entityId, params.entityId)))
      .orderBy(desc(activityTimelineTable.createdAt))
      .limit(params.limit)
      .offset(offset),
    db
      .select({
        id: tasksTable.id,
        title: tasksTable.title,
        description: tasksTable.description,
        status: tasksTable.status,
        priority: tasksTable.priority,
        dueDate: tasksTable.dueDate,
        createdAt: tasksTable.createdAt,
      })
      .from(tasksTable)
      .where(and(eq(tasksTable.entityType, params.entityType), eq(tasksTable.entityId, params.entityId)))
      .orderBy(desc(tasksTable.createdAt))
      .limit(50),
    db
      .select({
        messageId: commEmailContextLinksTable.messageId,
        createdAt: commEmailContextLinksTable.createdAt,
      })
      .from(commEmailContextLinksTable)
      .where(and(eq(commEmailContextLinksTable.entityType, params.entityType), eq(commEmailContextLinksTable.entityId, params.entityId)))
      .orderBy(desc(commEmailContextLinksTable.createdAt))
      .limit(50),
    db
      .select({
        id: chatLogsTable.id,
        queryText: chatLogsTable.queryText,
        responseText: chatLogsTable.responseText,
        createdAt: chatLogsTable.createdAt,
      })
      .from(chatLogsTable)
      .where(and(eq(chatLogsTable.entityType, params.entityType), eq(chatLogsTable.entityId, params.entityId)))
      .orderBy(desc(chatLogsTable.createdAt))
      .limit(50),
    db
      .select({ count: sql<number>`count(*)` })
      .from(activityTimelineTable)
      .where(and(eq(activityTimelineTable.entityType, params.entityType), eq(activityTimelineTable.entityId, params.entityId))),
  ]);

  const messageIds = contextLinks.map((row) => row.messageId);
  const emails = messageIds.length
    ? await db
        .select({
          id: commEmailMessagesTable.id,
          subject: commEmailMessagesTable.subject,
          status: commEmailMessagesTable.status,
          direction: commEmailMessagesTable.direction,
          fromAddress: commEmailMessagesTable.fromAddress,
          createdAt: commEmailMessagesTable.createdAt,
          sentAt: commEmailMessagesTable.sentAt,
          receivedAt: commEmailMessagesTable.receivedAt,
        })
        .from(commEmailMessagesTable)
        .where(inArray(commEmailMessagesTable.id, messageIds))
    : [];

  const eventMap = new Map<string, Record<string, unknown>>();

  for (const event of storedEvents) {
    eventMap.set(`timeline:${event.id}`, {
      id: event.id,
      activityType: event.activityType,
      sourceType: event.sourceType,
      sourceId: event.sourceId,
      title: event.title,
      body: event.body,
      metadata: event.metadata,
      createdAt: event.createdAt,
    });
  }

  for (const task of directTasks) {
    eventMap.set(`task:${task.id}`, {
      id: task.id,
      activityType: "task",
      sourceType: "task",
      sourceId: task.id,
      title: task.title,
      body: task.description,
      metadata: {
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
      },
      createdAt: task.createdAt,
    });
  }

  for (const email of emails) {
    eventMap.set(`email:${email.id}`, {
      id: email.id,
      activityType: "email",
      sourceType: "email",
      sourceId: email.id,
      title: email.subject || "(No subject)",
      body: `${email.direction} · ${email.status} · ${email.fromAddress}`,
      metadata: {
        status: email.status,
        direction: email.direction,
        sentAt: email.sentAt,
        receivedAt: email.receivedAt,
      },
      createdAt: email.sentAt ?? email.receivedAt ?? email.createdAt,
    });
  }

  for (const chat of chats) {
    eventMap.set(`chat:${chat.id}`, {
      id: chat.id,
      activityType: "chat",
      sourceType: "chat",
      sourceId: chat.id,
      title: "AI queried",
      body: chat.queryText,
      metadata: {
        preview: chat.responseText.slice(0, 240),
      },
      createdAt: chat.createdAt,
    });
  }

  const merged = Array.from(eventMap.values()).sort((a, b) => {
    const aTs = new Date(String(a.createdAt)).getTime();
    const bTs = new Date(String(b.createdAt)).getTime();
    return bTs - aTs;
  });

  const total = Number(totalRes[0]?.count ?? merged.length);
  const totalPages = Math.max(1, Math.ceil(total / params.limit));
  const paged = merged.slice(offset, offset + params.limit);

  return {
    data: paged,
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
    },
  };
}
