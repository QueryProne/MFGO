import { and, asc, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";

import {
  db,
  commEmailContextLinksTable,
  commEmailMessageAttachmentsTable,
  commEmailMessagesTable,
  commEmailRecipientsTable,
  commEmailTemplatesTable,
} from "@workspace/db";
import type { CommunicationContextLinkInput, EmailSearchFilters } from "./types";

export async function replaceContextLinks(
  messageId: string,
  actor: { tenantId: string; companyId?: string | null; siteId?: string | null; userId: string },
  links: CommunicationContextLinkInput[],
): Promise<void> {
  await db.delete(commEmailContextLinksTable).where(eq(commEmailContextLinksTable.messageId, messageId));

  if (links.length === 0) {
    return;
  }

  await db.insert(commEmailContextLinksTable).values(
    links.map((link) => ({
      messageId,
      entityType: link.entityType,
      entityId: link.entityId,
      relatedEntityType: link.relatedEntityType ?? null,
      relatedEntityId: link.relatedEntityId ?? null,
      linkRole: link.linkRole ?? "primary",
      tenantId: actor.tenantId,
      companyId: actor.companyId ?? null,
      siteId: actor.siteId ?? null,
      createdBy: actor.userId,
    })),
  );
}

export interface RecordHistoryQuery {
  entityType: string;
  entityId: string;
  tenantId: string;
  companyId?: string | null;
  siteId?: string | null;
  page: number;
  limit: number;
  sender?: string | null;
  recipient?: string | null;
  status?: string | null;
  templateId?: string | null;
  hasAttachments?: boolean | null;
  fromDate?: Date | null;
  toDate?: Date | null;
}

export async function getEmailHistoryForRecord(query: RecordHistoryQuery) {
  const conditions = [
    eq(commEmailContextLinksTable.entityType, query.entityType),
    eq(commEmailContextLinksTable.entityId, query.entityId),
    eq(commEmailMessagesTable.tenantId, query.tenantId),
  ];

  if (query.companyId) {
    conditions.push(eq(commEmailMessagesTable.companyId, query.companyId));
  }
  if (query.siteId) {
    conditions.push(eq(commEmailMessagesTable.siteId, query.siteId));
  }
  if (query.sender) {
    conditions.push(ilike(commEmailMessagesTable.fromAddress, `%${query.sender}%`));
  }
  if (query.status) {
    conditions.push(eq(commEmailMessagesTable.status, query.status));
  }
  if (query.templateId) {
    conditions.push(eq(commEmailMessagesTable.templateId, query.templateId));
  }
  if (query.fromDate) {
    conditions.push(gte(commEmailMessagesTable.createdAt, query.fromDate));
  }
  if (query.toDate) {
    conditions.push(lte(commEmailMessagesTable.createdAt, query.toDate));
  }

  const whereClause = and(...conditions);

  const offset = (query.page - 1) * query.limit;

  const rows = await db
    .select({
      messageId: commEmailMessagesTable.id,
      direction: commEmailMessagesTable.direction,
      status: commEmailMessagesTable.status,
      subject: commEmailMessagesTable.subject,
      fromAddress: commEmailMessagesTable.fromAddress,
      messageIdHeader: commEmailMessagesTable.messageId,
      providerName: commEmailMessagesTable.providerName,
      providerMessageId: commEmailMessagesTable.providerMessageId,
      templateId: commEmailMessagesTable.templateId,
      templateName: commEmailTemplatesTable.name,
      queuedAt: commEmailMessagesTable.queuedAt,
      sentAt: commEmailMessagesTable.sentAt,
      receivedAt: commEmailMessagesTable.receivedAt,
      createdAt: commEmailMessagesTable.createdAt,
      updatedAt: commEmailMessagesTable.updatedAt,
      recipientEmail: commEmailRecipientsTable.emailAddress,
      recipientType: commEmailRecipientsTable.recipientType,
      hasAttachments: sql<boolean>`exists (
        select 1 from ${commEmailMessageAttachmentsTable}
        where ${commEmailMessageAttachmentsTable.messageId} = ${commEmailMessagesTable.id}
      )`,
    })
    .from(commEmailContextLinksTable)
    .innerJoin(commEmailMessagesTable, eq(commEmailContextLinksTable.messageId, commEmailMessagesTable.id))
    .leftJoin(commEmailTemplatesTable, eq(commEmailMessagesTable.templateId, commEmailTemplatesTable.id))
    .leftJoin(commEmailRecipientsTable, eq(commEmailRecipientsTable.messageId, commEmailMessagesTable.id))
    .where(whereClause)
    .orderBy(desc(commEmailMessagesTable.createdAt), asc(commEmailRecipientsTable.sortOrder))
    .limit(query.limit)
    .offset(offset);

  const filteredByRecipient = query.recipient
    ? rows.filter((row) => (row.recipientEmail ?? "").toLowerCase().includes(query.recipient?.toLowerCase() ?? ""))
    : rows;

  const dedup = new Map<string, {
    id: string;
    direction: string;
    status: string;
    subject: string;
    fromAddress: string;
    messageId: string | null;
    providerName: string | null;
    providerMessageId: string | null;
    templateId: string | null;
    templateName: string | null;
    queuedAt: Date | null;
    sentAt: Date | null;
    receivedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    hasAttachments: boolean;
    recipients: Array<{ type: string; email: string }>;
  }>();

  for (const row of filteredByRecipient) {
    const existing = dedup.get(row.messageId);
    if (existing) {
      if (row.recipientEmail) {
        existing.recipients.push({ type: row.recipientType ?? "to", email: row.recipientEmail });
      }
      continue;
    }

    dedup.set(row.messageId, {
      id: row.messageId,
      direction: row.direction,
      status: row.status,
      subject: row.subject,
      fromAddress: row.fromAddress,
      messageId: row.messageIdHeader,
      providerName: row.providerName,
      providerMessageId: row.providerMessageId,
      templateId: row.templateId,
      templateName: row.templateName,
      queuedAt: row.queuedAt,
      sentAt: row.sentAt,
      receivedAt: row.receivedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      hasAttachments: row.hasAttachments,
      recipients: row.recipientEmail ? [{ type: row.recipientType ?? "to", email: row.recipientEmail }] : [],
    });
  }

  const data = Array.from(dedup.values());

  const [{ count }] = await db
    .select({ count: sql<number>`count(distinct ${commEmailMessagesTable.id})` })
    .from(commEmailContextLinksTable)
    .innerJoin(commEmailMessagesTable, eq(commEmailContextLinksTable.messageId, commEmailMessagesTable.id))
    .where(whereClause);

  const total = Number(count ?? 0);

  const filtered = query.hasAttachments === null || query.hasAttachments === undefined ? data : data.filter((row) => row.hasAttachments === query.hasAttachments);

  return {
    data: filtered,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function searchCommunications(filters: EmailSearchFilters, page: number, limit: number) {
  const conditions = [eq(commEmailMessagesTable.tenantId, filters.tenantId)];

  if (filters.companyId) {
    conditions.push(eq(commEmailMessagesTable.companyId, filters.companyId));
  }

  if (filters.siteId) {
    conditions.push(eq(commEmailMessagesTable.siteId, filters.siteId));
  }

  if (filters.status) {
    conditions.push(eq(commEmailMessagesTable.status, filters.status));
  }

  if (filters.templateId) {
    conditions.push(eq(commEmailMessagesTable.templateId, filters.templateId));
  }

  if (filters.sender) {
    conditions.push(ilike(commEmailMessagesTable.fromAddress, `%${filters.sender}%`));
  }

  if (filters.q) {
    const pattern = `%${filters.q}%`;
    conditions.push(sql`${commEmailMessagesTable.subject} ilike ${pattern} or coalesce(${commEmailMessagesTable.bodyText}, '') ilike ${pattern}`);
  }

  if (filters.recordEntityType) {
    if (filters.recordEntityId) {
      conditions.push(
        sql`exists (
          select 1 from ${commEmailContextLinksTable}
          where ${commEmailContextLinksTable.messageId} = ${commEmailMessagesTable.id}
            and ${commEmailContextLinksTable.entityType} = ${filters.recordEntityType}
            and ${commEmailContextLinksTable.entityId} = ${filters.recordEntityId}
        )`,
      );
    } else {
      conditions.push(
        sql`exists (
          select 1 from ${commEmailContextLinksTable}
          where ${commEmailContextLinksTable.messageId} = ${commEmailMessagesTable.id}
            and ${commEmailContextLinksTable.entityType} = ${filters.recordEntityType}
        )`,
      );
    }
  }

  if (filters.hasAttachments === true) {
    conditions.push(
      sql`exists (
        select 1 from ${commEmailMessageAttachmentsTable}
        where ${commEmailMessageAttachmentsTable.messageId} = ${commEmailMessagesTable.id}
      )`,
    );
  } else if (filters.hasAttachments === false) {
    conditions.push(
      sql`not exists (
        select 1 from ${commEmailMessageAttachmentsTable}
        where ${commEmailMessageAttachmentsTable.messageId} = ${commEmailMessagesTable.id}
      )`,
    );
  }

  if (filters.fromDate) {
    conditions.push(gte(commEmailMessagesTable.createdAt, filters.fromDate));
  }

  if (filters.toDate) {
    conditions.push(lte(commEmailMessagesTable.createdAt, filters.toDate));
  }

  const whereClause = and(...conditions);

  const offset = (page - 1) * limit;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(commEmailMessagesTable)
      .where(whereClause)
      .orderBy(desc(commEmailMessagesTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(commEmailMessagesTable).where(whereClause),
  ]);

  const total = Number(countResult[0]?.count ?? 0);

  return {
    data: rows,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
