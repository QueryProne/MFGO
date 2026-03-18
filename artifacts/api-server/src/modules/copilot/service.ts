import { and, desc, eq, gte, ilike, inArray, lte, sql } from "drizzle-orm";

import {
  chatLogsTable,
  commEmailContextLinksTable,
  commEmailMessagesTable,
  customersTable,
  db,
  leadsTable,
  opportunitiesTable,
  opportunityStageHistoryTable,
  tasksTable,
  vendorsTable,
  workOrdersTable,
} from "@workspace/db";

import { detectCopilotIntent } from "./intent";
import { requestCopilotAnswer } from "./provider";

export interface CopilotQueryInput {
  query: string;
  entityType?: string | null;
  entityId?: string | null;
  userId: string;
}

export interface CopilotQueryOutput {
  answer: string;
  intent: string;
  contextRows: Array<Record<string, unknown>>;
  provider: string;
  model: string;
  metadata: Record<string, unknown>;
  chatLogId: string;
}

function startOfDay(date: Date): Date {
  const output = new Date(date);
  output.setHours(0, 0, 0, 0);
  return output;
}

function endOfDay(date: Date): Date {
  const output = new Date(date);
  output.setHours(23, 59, 59, 999);
  return output;
}

function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function findCustomerIdsByHint(entityHint: string | null): Promise<string[]> {
  if (!entityHint) return [];
  const rows = await db
    .select({ id: customersTable.id })
    .from(customersTable)
    .where(ilike(customersTable.name, `%${entityHint}%`))
    .limit(10);
  return rows.map((row) => row.id);
}

async function findVendorIdsByHint(entityHint: string | null): Promise<string[]> {
  if (!entityHint) return [];
  const rows = await db
    .select({ id: vendorsTable.id })
    .from(vendorsTable)
    .where(ilike(vendorsTable.name, `%${entityHint}%`))
    .limit(10);
  return rows.map((row) => row.id);
}

export async function runCopilotQuery(input: CopilotQueryInput): Promise<CopilotQueryOutput> {
  const intentResult = detectCopilotIntent(input.query);
  const schemaHints: string[] = [];
  let contextRows: Array<Record<string, unknown>> = [];

  if (intentResult.intent === "tasks_by_customer") {
    schemaHints.push("tasks(entity_type, entity_id, status, priority, due_date)", "customers(id, name)");
    const customerIds = await findCustomerIdsByHint(intentResult.entityHint);
    const filters = [
      eq(tasksTable.entityType, "customer"),
      eq(tasksTable.status, "open"),
    ];

    if (customerIds.length > 0) {
      filters.push(inArray(tasksTable.entityId, customerIds));
    }

    contextRows = await db
      .select({
        taskId: tasksTable.id,
        title: tasksTable.title,
        status: tasksTable.status,
        priority: tasksTable.priority,
        dueDate: tasksTable.dueDate,
        customerId: tasksTable.entityId,
      })
      .from(tasksTable)
      .where(and(...filters))
      .orderBy(desc(tasksTable.dueDate))
      .limit(50);
  } else if (intentResult.intent === "vendor_interactions") {
    schemaHints.push("vendors(id, name)", "tasks(entity_type, entity_id, ...)", "comm_email_messages + comm_email_context_links");
    const vendorIds = await findVendorIdsByHint(intentResult.entityHint);

    const vendorTasks = vendorIds.length
      ? await db
          .select({
            taskId: tasksTable.id,
            title: tasksTable.title,
            status: tasksTable.status,
            priority: tasksTable.priority,
            createdAt: tasksTable.createdAt,
            vendorId: tasksTable.entityId,
          })
          .from(tasksTable)
          .where(and(eq(tasksTable.entityType, "vendor"), inArray(tasksTable.entityId, vendorIds)))
          .orderBy(desc(tasksTable.createdAt))
          .limit(30)
      : [];

    const linkedEmailRows = vendorIds.length
      ? await db
          .select({
            messageId: commEmailMessagesTable.id,
            subject: commEmailMessagesTable.subject,
            status: commEmailMessagesTable.status,
            direction: commEmailMessagesTable.direction,
            createdAt: commEmailMessagesTable.createdAt,
            vendorId: commEmailContextLinksTable.entityId,
          })
          .from(commEmailContextLinksTable)
          .innerJoin(commEmailMessagesTable, eq(commEmailContextLinksTable.messageId, commEmailMessagesTable.id))
          .where(and(eq(commEmailContextLinksTable.entityType, "vendor"), inArray(commEmailContextLinksTable.entityId, vendorIds)))
          .orderBy(desc(commEmailMessagesTable.createdAt))
          .limit(30)
      : [];

    contextRows = [...vendorTasks, ...linkedEmailRows];
  } else if (intentResult.intent === "production_due_week") {
    schemaHints.push("work_orders(number, status, scheduled_end, priority, quantity_ordered, quantity_completed)");
    const now = startOfDay(new Date());
    const nextWeek = endOfDay(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
    const nowDate = toDateOnlyString(now);
    const nextWeekDate = toDateOnlyString(nextWeek);

    contextRows = await db
      .select({
        id: workOrdersTable.id,
        number: workOrdersTable.number,
        status: workOrdersTable.status,
        priority: workOrdersTable.priority,
        scheduledEnd: workOrdersTable.scheduledEnd,
        quantityOrdered: workOrdersTable.quantityOrdered,
        quantityCompleted: workOrdersTable.quantityCompleted,
      })
      .from(workOrdersTable)
      .where(and(gte(workOrdersTable.scheduledEnd, nowDate), lte(workOrdersTable.scheduledEnd, nextWeekDate)))
      .orderBy(desc(workOrdersTable.scheduledEnd))
      .limit(100);
  } else if (intentResult.intent === "lead_status") {
    schemaHints.push("leads(status)", "opportunities(stage, status, amount, probability)");
    const [leadStatuses, opportunityStages] = await Promise.all([
      db
        .select({
          status: leadsTable.status,
          count: sql<number>`count(*)`,
        })
        .from(leadsTable)
        .groupBy(leadsTable.status),
      db
        .select({
          stage: opportunitiesTable.stage,
          status: opportunitiesTable.status,
          count: sql<number>`count(*)`,
          totalAmount: sql<string>`coalesce(sum(${opportunitiesTable.amount}), '0')`,
        })
        .from(opportunitiesTable)
        .groupBy(opportunitiesTable.stage, opportunitiesTable.status),
    ]);

    contextRows = [
      { type: "lead_statuses", rows: leadStatuses },
      { type: "opportunity_pipeline", rows: opportunityStages },
    ];
  } else {
    schemaHints.push("tasks, leads, opportunities, work_orders, communications");
    const [openTasks, openLeads, openOpportunities, overdueTasks] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(tasksTable).where(eq(tasksTable.status, "open")),
      db.select({ count: sql<number>`count(*)` }).from(leadsTable),
      db.select({ count: sql<number>`count(*)` }).from(opportunitiesTable).where(eq(opportunitiesTable.status, "open")),
      db
        .select({ count: sql<number>`count(*)` })
        .from(tasksTable)
        .where(and(eq(tasksTable.status, "open"), lte(tasksTable.dueDate, new Date()))),
    ]);

    contextRows = [
      {
        openTasks: Number(openTasks[0]?.count ?? 0),
        openLeads: Number(openLeads[0]?.count ?? 0),
        openOpportunities: Number(openOpportunities[0]?.count ?? 0),
        overdueTasks: Number(overdueTasks[0]?.count ?? 0),
      },
    ];
  }

  if (input.entityType && input.entityId) {
    schemaHints.push("entity-scoped context");
    const [entityTasks, entityEmails, stageHistory] = await Promise.all([
      db
        .select({
          taskId: tasksTable.id,
          title: tasksTable.title,
          status: tasksTable.status,
          priority: tasksTable.priority,
          dueDate: tasksTable.dueDate,
        })
        .from(tasksTable)
        .where(and(eq(tasksTable.entityType, input.entityType), eq(tasksTable.entityId, input.entityId)))
        .orderBy(desc(tasksTable.createdAt))
        .limit(20),
      db
        .select({
          messageId: commEmailMessagesTable.id,
          subject: commEmailMessagesTable.subject,
          status: commEmailMessagesTable.status,
          direction: commEmailMessagesTable.direction,
          createdAt: commEmailMessagesTable.createdAt,
        })
        .from(commEmailContextLinksTable)
        .innerJoin(commEmailMessagesTable, eq(commEmailContextLinksTable.messageId, commEmailMessagesTable.id))
        .where(and(eq(commEmailContextLinksTable.entityType, input.entityType), eq(commEmailContextLinksTable.entityId, input.entityId)))
        .orderBy(desc(commEmailMessagesTable.createdAt))
        .limit(20),
      input.entityType === "opportunity"
        ? db
            .select({
              fromStage: opportunityStageHistoryTable.fromStage,
              toStage: opportunityStageHistoryTable.toStage,
              changedAt: opportunityStageHistoryTable.changedAt,
              note: opportunityStageHistoryTable.note,
            })
            .from(opportunityStageHistoryTable)
            .where(eq(opportunityStageHistoryTable.opportunityId, input.entityId))
            .orderBy(desc(opportunityStageHistoryTable.changedAt))
            .limit(15)
        : Promise.resolve([]),
    ]);

    contextRows = [
      ...contextRows,
      { scopedEntity: { type: input.entityType, id: input.entityId } },
      { scopedTasks: entityTasks },
      { scopedEmails: entityEmails },
      ...(stageHistory.length > 0 ? [{ scopedStageHistory: stageHistory }] : []),
    ];
  }

  const llmResponse = await requestCopilotAnswer({
    query: input.query,
    intent: intentResult.intent,
    contextRows,
    schemaHints,
  });

  const [chatLog] = await db
    .insert(chatLogsTable)
    .values({
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      queryText: input.query,
      responseText: llmResponse.answer,
      intent: intentResult.intent,
      provider: llmResponse.provider,
      model: llmResponse.model,
      contextRows,
      responseMetadata: llmResponse.metadata,
      createdBy: input.userId,
      redacted: true,
    })
    .returning({ id: chatLogsTable.id });

  return {
    answer: llmResponse.answer,
    intent: intentResult.intent,
    contextRows,
    provider: llmResponse.provider,
    model: llmResponse.model,
    metadata: llmResponse.metadata,
    chatLogId: chatLog.id,
  };
}
