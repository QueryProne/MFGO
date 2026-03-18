import { Router } from "express";
import { and, desc, eq, ilike, sql } from "drizzle-orm";

import {
  aiLeadScoresTable,
  automationRulesTable,
  customersTable,
  db,
  leadsTable,
  opportunitiesTable,
  opportunityForecastSnapshotsTable,
  opportunityStageHistoryTable,
} from "@workspace/db";

import { getNextNumber } from "../lib/counter";
import { parsePagination } from "../modules/communications/http";
import { getActorContext } from "../modules/communications/security";
import { recordTimelineActivity } from "../modules/timeline";

const router = Router();

function toProbability(stage: string): number {
  const normalized = stage.toLowerCase();
  if (normalized.includes("qualif")) return 20;
  if (normalized.includes("discovery")) return 35;
  if (normalized.includes("proposal")) return 55;
  if (normalized.includes("negotiation")) return 75;
  if (normalized.includes("commit")) return 90;
  if (normalized.includes("won")) return 100;
  return 30;
}

function toLeadScore(input: {
  status: string;
  source?: string | null;
  companyName: string;
  email?: string | null;
  phone?: string | null;
}) {
  let score = 50;
  const factors: string[] = [];

  if (input.status === "qualified") {
    score += 20;
    factors.push("qualified_status");
  }
  if (input.status === "new") {
    score += 5;
    factors.push("new_status");
  }
  if (input.source?.toLowerCase().includes("referral")) {
    score += 15;
    factors.push("referral_source");
  }
  if (input.email) {
    score += 8;
    factors.push("email_present");
  }
  if (input.phone) {
    score += 6;
    factors.push("phone_present");
  }
  if (input.companyName.length > 12) {
    score += 5;
    factors.push("company_detail");
  }

  score = Math.max(1, Math.min(100, score));
  return { score, factors };
}

router.get("/leads", async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>, { limit: 50 });
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    const whereClause = and(
      ...(status ? [eq(leadsTable.status, status)] : []),
      ...(search ? [ilike(leadsTable.companyName, `%${search}%`)] : []),
    );

    const [data, countRows] = await Promise.all([
      db.select().from(leadsTable).where(whereClause).orderBy(desc(leadsTable.createdAt)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(leadsTable).where(whereClause),
    ]);

    const total = Number(countRows[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/leads", async (req, res) => {
  try {
    const actor = getActorContext(req);
    const payload = req.body as {
      firstName?: string | null;
      lastName?: string | null;
      companyName: string;
      email?: string | null;
      phone?: string | null;
      source?: string | null;
      status?: string;
      ownerId?: string | null;
      notes?: string | null;
    };

    const [lead] = await db
      .insert(leadsTable)
      .values({
        number: getNextNumber("LD"),
        firstName: payload.firstName ?? null,
        lastName: payload.lastName ?? null,
        companyName: payload.companyName,
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        source: payload.source ?? null,
        status: payload.status ?? "new",
        ownerId: payload.ownerId ?? actor.userId,
        notes: payload.notes ?? null,
      })
      .returning();

    await recordTimelineActivity({
      entityType: "lead",
      entityId: lead.id,
      activityType: "lead",
      sourceType: "lead",
      sourceId: lead.id,
      title: `Lead created: ${lead.companyName}`,
      body: lead.notes,
      actorId: actor.userId,
    });

    res.status(201).json(lead);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.get("/leads/:id", async (req, res) => {
  try {
    const [lead, latestScore] = await Promise.all([
      db.select().from(leadsTable).where(eq(leadsTable.id, String(req.params.id))).limit(1),
      db
        .select()
        .from(aiLeadScoresTable)
        .where(eq(aiLeadScoresTable.leadId, String(req.params.id)))
        .orderBy(desc(aiLeadScoresTable.createdAt))
        .limit(1),
    ]);

    if (!lead[0]) {
      res.status(404).json({ error: "not_found", message: "Lead not found" });
      return;
    }

    res.json({ ...lead[0], latestScore: latestScore[0] ?? null });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.patch("/leads/:id", async (req, res) => {
  try {
    const [updated] = await db
      .update(leadsTable)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(eq(leadsTable.id, String(req.params.id)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "not_found", message: "Lead not found" });
      return;
    }

    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.post("/leads/:id/score", async (req, res) => {
  try {
    const actor = getActorContext(req);
    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, String(req.params.id))).limit(1);
    if (!lead) {
      res.status(404).json({ error: "not_found", message: "Lead not found" });
      return;
    }

    const scoreData = toLeadScore({
      status: lead.status,
      source: lead.source,
      companyName: lead.companyName,
      email: lead.email,
      phone: lead.phone,
    });

    const [scored] = await db
      .insert(aiLeadScoresTable)
      .values({
        leadId: lead.id,
        modelName: "heuristic-v1",
        score: scoreData.score,
        confidence: 70,
        reasoning: `Lead score calculated from status/source/completeness (${scoreData.factors.join(", ")})`,
        factors: JSON.stringify(scoreData.factors),
        scoredBy: actor.userId,
      })
      .returning();

    await recordTimelineActivity({
      entityType: "lead",
      entityId: lead.id,
      activityType: "ai_score",
      sourceType: "ai_lead_score",
      sourceId: scored.id,
      title: `AI lead score updated: ${scoreData.score}`,
      metadata: {
        factors: scoreData.factors,
      },
      actorId: actor.userId,
    });

    res.json(scored);
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/leads/:id/convert", async (req, res) => {
  try {
    const actor = getActorContext(req);
    const payload = req.body as {
      createOpportunity?: boolean;
      opportunityName?: string;
      opportunityStage?: string;
      opportunityAmount?: string;
    };

    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, String(req.params.id))).limit(1);
    if (!lead) {
      res.status(404).json({ error: "not_found", message: "Lead not found" });
      return;
    }

    const [customer] = await db
      .insert(customersTable)
      .values({
        number: getNextNumber("C"),
        name: lead.companyName,
        type: "customer",
        status: "active",
        email: lead.email,
        phone: lead.phone,
        notes: lead.notes,
      })
      .returning();

    let opportunityId: string | null = null;
    if (payload.createOpportunity ?? true) {
      const stage = payload.opportunityStage ?? "qualification";
      const [opportunity] = await db
        .insert(opportunitiesTable)
        .values({
          number: getNextNumber("OPP"),
          name: payload.opportunityName ?? `${lead.companyName} - New Opportunity`,
          stage,
          status: "open",
          amount: payload.opportunityAmount ?? "0",
          probability: toProbability(stage),
          customerId: customer.id,
          leadId: lead.id,
          ownerId: lead.ownerId ?? actor.userId,
          notes: lead.notes,
        })
        .returning();

      opportunityId = opportunity.id;

      await db.insert(opportunityStageHistoryTable).values({
        opportunityId: opportunity.id,
        fromStage: null,
        toStage: stage,
        changedBy: actor.userId,
        note: "Created during lead conversion",
      });
    }

    const [updatedLead] = await db
      .update(leadsTable)
      .set({
        status: "converted",
        convertedCustomerId: customer.id,
        convertedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(leadsTable.id, lead.id))
      .returning();

    await recordTimelineActivity({
      entityType: "lead",
      entityId: lead.id,
      relatedEntityType: "customer",
      relatedEntityId: customer.id,
      activityType: "lead",
      sourceType: "lead_conversion",
      sourceId: lead.id,
      title: `Lead converted to customer ${customer.number}`,
      body: opportunityId ? `Opportunity created: ${opportunityId}` : null,
      actorId: actor.userId,
    });

    await recordTimelineActivity({
      entityType: "customer",
      entityId: customer.id,
      relatedEntityType: "lead",
      relatedEntityId: lead.id,
      activityType: "customer",
      sourceType: "lead_conversion",
      sourceId: lead.id,
      title: `Customer created from lead ${lead.number}`,
      actorId: actor.userId,
    });

    res.json({ lead: updatedLead, customer, opportunityId });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.get("/opportunities", async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>, { limit: 50 });
    const stage = typeof req.query.stage === "string" ? req.query.stage.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    const whereClause = and(
      ...(stage ? [eq(opportunitiesTable.stage, stage)] : []),
      ...(status ? [eq(opportunitiesTable.status, status)] : []),
      ...(search ? [ilike(opportunitiesTable.name, `%${search}%`)] : []),
    );

    const [data, countRows] = await Promise.all([
      db.select().from(opportunitiesTable).where(whereClause).orderBy(desc(opportunitiesTable.createdAt)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(opportunitiesTable).where(whereClause),
    ]);
    const total = Number(countRows[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/opportunities", async (req, res) => {
  try {
    const actor = getActorContext(req);
    const payload = req.body as {
      name: string;
      stage?: string;
      status?: string;
      amount?: string;
      probability?: number;
      expectedCloseDate?: string | null;
      customerId?: string | null;
      vendorId?: string | null;
      leadId?: string | null;
      ownerId?: string | null;
      notes?: string | null;
    };

    const stage = payload.stage ?? "qualification";
    const [created] = await db
      .insert(opportunitiesTable)
      .values({
        number: getNextNumber("OPP"),
        name: payload.name,
        stage,
        status: payload.status ?? "open",
        amount: payload.amount ?? "0",
        probability: payload.probability ?? toProbability(stage),
        expectedCloseDate: payload.expectedCloseDate ? new Date(payload.expectedCloseDate) : null,
        customerId: payload.customerId ?? null,
        vendorId: payload.vendorId ?? null,
        leadId: payload.leadId ?? null,
        ownerId: payload.ownerId ?? actor.userId,
        notes: payload.notes ?? null,
      })
      .returning();

    await db.insert(opportunityStageHistoryTable).values({
      opportunityId: created.id,
      fromStage: null,
      toStage: created.stage,
      changedBy: actor.userId,
      note: "Opportunity created",
    });

    const timelineEntityType = created.customerId ? "customer" : created.leadId ? "lead" : "opportunity";
    const timelineEntityId = created.customerId ?? created.leadId ?? created.id;
    await recordTimelineActivity({
      entityType: timelineEntityType,
      entityId: timelineEntityId,
      relatedEntityType: "opportunity",
      relatedEntityId: created.id,
      activityType: "opportunity",
      sourceType: "opportunity",
      sourceId: created.id,
      title: `Opportunity created: ${created.name}`,
      metadata: {
        stage: created.stage,
        amount: created.amount,
        probability: created.probability,
      },
      actorId: actor.userId,
    });

    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.get("/opportunities/:id", async (req, res) => {
  try {
    const [opportunity] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, String(req.params.id))).limit(1);
    if (!opportunity) {
      res.status(404).json({ error: "not_found", message: "Opportunity not found" });
      return;
    }

    const history = await db
      .select()
      .from(opportunityStageHistoryTable)
      .where(eq(opportunityStageHistoryTable.opportunityId, opportunity.id))
      .orderBy(desc(opportunityStageHistoryTable.changedAt));

    res.json({ ...opportunity, stageHistory: history });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.patch("/opportunities/:id", async (req, res) => {
  try {
    const actor = getActorContext(req);
    const payload = req.body as {
      name?: string;
      stage?: string;
      status?: string;
      amount?: string;
      probability?: number;
      expectedCloseDate?: string | null;
      notes?: string | null;
      wonReason?: string | null;
      lostReason?: string | null;
    };

    const [existing] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, String(req.params.id))).limit(1);
    if (!existing) {
      res.status(404).json({ error: "not_found", message: "Opportunity not found" });
      return;
    }

    const nextStage = payload.stage ?? existing.stage;
    const nextStatus = payload.status ?? existing.status;

    const [updated] = await db
      .update(opportunitiesTable)
      .set({
        ...payload,
        expectedCloseDate:
          payload.expectedCloseDate !== undefined
            ? payload.expectedCloseDate
              ? new Date(payload.expectedCloseDate)
              : null
            : existing.expectedCloseDate,
        probability: payload.probability ?? (payload.stage ? toProbability(payload.stage) : existing.probability),
        closedAt: nextStatus === "won" || nextStatus === "lost" ? new Date() : existing.closedAt,
        updatedAt: new Date(),
      })
      .where(eq(opportunitiesTable.id, existing.id))
      .returning();

    if (nextStage !== existing.stage) {
      await db.insert(opportunityStageHistoryTable).values({
        opportunityId: existing.id,
        fromStage: existing.stage,
        toStage: nextStage,
        changedBy: actor.userId,
        note: "Stage updated",
      });
    }

    await recordTimelineActivity({
      entityType: "opportunity",
      entityId: existing.id,
      relatedEntityType: existing.customerId ? "customer" : existing.leadId ? "lead" : null,
      relatedEntityId: existing.customerId ?? existing.leadId ?? null,
      activityType: "opportunity",
      sourceType: "opportunity",
      sourceId: existing.id,
      title: `Opportunity updated: ${updated.name}`,
      metadata: {
        fromStage: existing.stage,
        toStage: updated.stage,
        fromStatus: existing.status,
        toStatus: updated.status,
      },
      actorId: actor.userId,
    });

    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.get("/opportunities/:id/stage-history", async (req, res) => {
  try {
    const history = await db
      .select()
      .from(opportunityStageHistoryTable)
      .where(eq(opportunityStageHistoryTable.opportunityId, String(req.params.id)))
      .orderBy(desc(opportunityStageHistoryTable.changedAt));
    res.json({ data: history });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.get("/opportunities-forecast", async (_req, res) => {
  try {
    const stageBreakdown = await db
      .select({
        stage: opportunitiesTable.stage,
        status: opportunitiesTable.status,
        count: sql<number>`count(*)`,
        amount: sql<string>`coalesce(sum(${opportunitiesTable.amount}), '0')`,
        weightedAmount: sql<string>`coalesce(sum(${opportunitiesTable.amount} * (${opportunitiesTable.probability} / 100.0)), '0')`,
      })
      .from(opportunitiesTable)
      .groupBy(opportunitiesTable.stage, opportunitiesTable.status);

    const totals = stageBreakdown.reduce(
      (acc, row) => {
        const raw = Number(row.amount ?? 0);
        const weighted = Number(row.weightedAmount ?? 0);
        if (row.status === "open") {
          acc.pipelineAmount += raw;
          acc.weightedAmount += weighted;
          acc.openCount += Number(row.count ?? 0);
        } else if (row.status === "won") {
          acc.wonCount += Number(row.count ?? 0);
        } else if (row.status === "lost") {
          acc.lostCount += Number(row.count ?? 0);
        }
        return acc;
      },
      { pipelineAmount: 0, weightedAmount: 0, openCount: 0, wonCount: 0, lostCount: 0 },
    );

    const [snapshot] = await db
      .insert(opportunityForecastSnapshotsTable)
      .values({
        snapshotLabel: `snapshot-${Date.now()}`,
        periodStart: null,
        periodEnd: null,
        weightedAmount: String(totals.weightedAmount.toFixed(2)),
        pipelineAmount: String(totals.pipelineAmount.toFixed(2)),
        openCount: totals.openCount,
        wonCount: totals.wonCount,
        lostCount: totals.lostCount,
        metadata: JSON.stringify(stageBreakdown),
      })
      .returning();

    res.json({
      data: {
        totals,
        stages: stageBreakdown,
        snapshot,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.get("/automation-rules", async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>, { limit: 50 });
    const rows = await db
      .select()
      .from(automationRulesTable)
      .orderBy(desc(automationRulesTable.createdAt))
      .limit(limit)
      .offset(offset);
    res.json({
      data: rows,
      meta: {
        page,
        limit,
        total: rows.length,
        totalPages: Math.max(1, Math.ceil(rows.length / limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/automation-rules", async (req, res) => {
  try {
    const actor = getActorContext(req);
    const payload = req.body as {
      name: string;
      description?: string | null;
      triggerEvent: string;
      conditionJson?: Record<string, unknown>;
      actionJson?: Record<string, unknown>;
      isActive?: boolean;
    };
    const [created] = await db
      .insert(automationRulesTable)
      .values({
        name: payload.name,
        description: payload.description ?? null,
        triggerEvent: payload.triggerEvent,
        conditionJson: payload.conditionJson ?? {},
        actionJson: payload.actionJson ?? {},
        isActive: payload.isActive ?? true,
        createdBy: actor.userId,
      })
      .returning();
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.patch("/automation-rules/:id", async (req, res) => {
  try {
    const [updated] = await db
      .update(automationRulesTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(automationRulesTable.id, String(req.params.id)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "not_found", message: "Automation rule not found" });
      return;
    }
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

export default router;
