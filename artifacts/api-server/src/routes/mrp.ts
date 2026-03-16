import { Router } from "express";
import { db } from "@workspace/db";
import { mrpRunsTable, mrpRecommendationsTable, planningScenariosTable, itemsTable, inventoryBalancesTable, salesOrdersTable, purchaseOrdersTable, workOrdersTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";

const router = Router();

// MRP RUNS
router.get("/mrp/runs", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;
    const data = await db.select().from(mrpRunsTable).orderBy(sql`${mrpRunsTable.createdAt} desc`).limit(limit).offset(offset);
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(mrpRunsTable);
    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/mrp/runs", async (req, res) => {
  try {
    const { type, planningHorizon } = req.body;
    const run = await db.insert(mrpRunsTable).values({
      type: type ?? "full_regen",
      planningHorizon: planningHorizon ?? 90,
      status: "running",
      startedAt: new Date(),
    }).returning();

    // Simple MRP simulation
    setTimeout(async () => {
      try {
        await runMrpSimulation(run[0].id, planningHorizon ?? 90);
      } catch {}
    }, 100);

    res.status(201).json(run[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.get("/mrp/runs/:id", async (req, res) => {
  try {
    const run = await db.select().from(mrpRunsTable).where(eq(mrpRunsTable.id, req.params.id)).limit(1);
    if (!run[0]) return res.status(404).json({ error: "not_found", message: "MRP run not found" });
    res.json(run[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// MRP RECOMMENDATIONS
router.get("/mrp/recommendations", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;
    const conditions: any[] = [];
    if (req.query.runId) conditions.push(eq(mrpRecommendationsTable.runId, req.query.runId as string));
    if (req.query.type) conditions.push(eq(mrpRecommendationsTable.type, req.query.type as string));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db.select({
      id: mrpRecommendationsTable.id, runId: mrpRecommendationsTable.runId,
      type: mrpRecommendationsTable.type, itemId: mrpRecommendationsTable.itemId,
      itemNumber: itemsTable.number, itemName: itemsTable.name,
      quantity: mrpRecommendationsTable.quantity, neededDate: mrpRecommendationsTable.neededDate,
      vendorId: mrpRecommendationsTable.vendorId, priority: mrpRecommendationsTable.priority,
      message: mrpRecommendationsTable.message, status: mrpRecommendationsTable.status,
    }).from(mrpRecommendationsTable)
      .leftJoin(itemsTable, eq(mrpRecommendationsTable.itemId, itemsTable.id))
      .where(where).limit(limit).offset(offset);

    const countResult = await db.select({ count: sql<number>`count(*)` }).from(mrpRecommendationsTable).where(where);
    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// PLANNING SCENARIOS
router.get("/planning/scenarios", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;
    const data = await db.select().from(planningScenariosTable).orderBy(sql`${planningScenariosTable.createdAt} desc`).limit(limit).offset(offset);
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(planningScenariosTable);
    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/planning/scenarios", async (req, res) => {
  try {
    const scenario = await db.insert(planningScenariosTable).values(req.body).returning();
    res.status(201).json(scenario[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.get("/planning/scenarios/:id", async (req, res) => {
  try {
    const scenario = await db.select().from(planningScenariosTable).where(eq(planningScenariosTable.id, req.params.id)).limit(1);
    if (!scenario[0]) return res.status(404).json({ error: "not_found", message: "Scenario not found" });
    res.json(scenario[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

async function runMrpSimulation(runId: string, horizon: number) {
  // Get all manufactured items
  const items = await db.select().from(itemsTable).where(eq(itemsTable.type, "manufactured"));
  const recommendations: any[] = [];

  for (const item of items) {
    // Get current inventory
    const balances = await db.select().from(inventoryBalancesTable).where(eq(inventoryBalancesTable.itemId, item.id));
    const onHand = balances.reduce((s, b) => s + Number(b.quantityOnHand), 0);
    const safetyStock = Number(item.safetyStock ?? 0);

    if (onHand < safetyStock) {
      const qty = Math.max(Number(item.reorderQty ?? 10), safetyStock - onHand);
      const neededDate = new Date();
      neededDate.setDate(neededDate.getDate() + (item.leadTime ?? 14));

      recommendations.push({
        runId, type: "planned_wo", itemId: item.id,
        quantity: qty.toFixed(0),
        neededDate: neededDate.toISOString().split("T")[0],
        priority: onHand === 0 ? "urgent" : "normal",
        message: `Safety stock shortage: ${onHand} on hand, ${safetyStock} required`,
        status: "open",
      });
    }
  }

  // Check purchased items for reorder
  const purchItems = await db.select().from(itemsTable).where(eq(itemsTable.type, "purchased_part"));
  for (const item of purchItems) {
    const balances = await db.select().from(inventoryBalancesTable).where(eq(inventoryBalancesTable.itemId, item.id));
    const onHand = balances.reduce((s, b) => s + Number(b.quantityOnHand), 0);
    const reorderPoint = Number(item.reorderPoint ?? 0);

    if (onHand <= reorderPoint) {
      const qty = Number(item.reorderQty ?? 50);
      const neededDate = new Date();
      neededDate.setDate(neededDate.getDate() + (item.leadTime ?? 7));

      recommendations.push({
        runId, type: "planned_po", itemId: item.id,
        quantity: qty.toFixed(0),
        neededDate: neededDate.toISOString().split("T")[0],
        priority: onHand === 0 ? "urgent" : "normal",
        message: `Below reorder point: ${onHand} on hand, reorder at ${reorderPoint}`,
        status: "open",
      });
    }
  }

  if (recommendations.length > 0) {
    await db.insert(mrpRecommendationsTable).values(recommendations);
  }

  await db.update(mrpRunsTable).set({
    status: "complete",
    completedAt: new Date(),
    summaryStats: {
      plannedPOs: recommendations.filter(r => r.type === "planned_po").length,
      plannedWOs: recommendations.filter(r => r.type === "planned_wo").length,
      shortages: recommendations.filter(r => r.priority === "urgent").length,
      rescheduleMessages: 0,
    },
  }).where(eq(mrpRunsTable.id, runId));
}

export default router;
