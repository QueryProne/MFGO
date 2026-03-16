import { Router } from "express";
import { db } from "@workspace/db";
import { workOrdersTable, workOrderOperationsTable, itemsTable, workcentersTable, salesOrdersTable, inventoryTransactionsTable, inventoryBalancesTable } from "@workspace/db";
import { eq, ilike, sql, and } from "drizzle-orm";
import { getNextNumber } from "../lib/counter";

const router = Router();

router.get("/workorders", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;
    const conditions: any[] = [];
    if (req.query.status) conditions.push(eq(workOrdersTable.status, req.query.status as string));
    if (req.query.itemId) conditions.push(eq(workOrdersTable.itemId, req.query.itemId as string));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db.select({
      id: workOrdersTable.id, number: workOrdersTable.number,
      itemId: workOrdersTable.itemId, itemNumber: itemsTable.number,
      itemName: itemsTable.name, salesOrderId: workOrdersTable.salesOrderId,
      salesOrderNumber: salesOrdersTable.number,
      status: workOrdersTable.status, type: workOrdersTable.type,
      quantityOrdered: workOrdersTable.quantityOrdered,
      quantityCompleted: workOrdersTable.quantityCompleted,
      scheduledStart: workOrdersTable.scheduledStart,
      scheduledEnd: workOrdersTable.scheduledEnd,
      priority: workOrdersTable.priority, notes: workOrdersTable.notes,
      createdAt: workOrdersTable.createdAt, updatedAt: workOrdersTable.updatedAt,
    }).from(workOrdersTable)
      .leftJoin(itemsTable, eq(workOrdersTable.itemId, itemsTable.id))
      .leftJoin(salesOrdersTable, eq(workOrdersTable.salesOrderId, salesOrdersTable.id))
      .where(where).limit(limit).offset(offset).orderBy(sql`${workOrdersTable.createdAt} desc`);

    const countResult = await db.select({ count: sql<number>`count(*)` }).from(workOrdersTable).where(where);
    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/workorders", async (req, res) => {
  try {
    const { itemId, bomId, routingId, salesOrderId, type, quantityOrdered, scheduledStart, scheduledEnd, warehouseId, priority, notes } = req.body;
    const number = getNextNumber("WO");
    const wo = await db.insert(workOrdersTable).values({
      itemId, bomId, routingId, salesOrderId, type: type ?? "standard",
      number, quantityOrdered, scheduledStart, scheduledEnd,
      warehouseId, priority: priority ?? "normal", notes,
    }).returning();
    const result = await getWOWithOps(wo[0].id);
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.get("/workorders/:id", async (req, res) => {
  try {
    const result = await getWOWithOps(req.params.id);
    if (!result) return res.status(404).json({ error: "not_found", message: "Work order not found" });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.put("/workorders/:id", async (req, res) => {
  try {
    await db.update(workOrdersTable).set({ ...req.body, updatedAt: new Date() }).where(eq(workOrdersTable.id, req.params.id));
    const result = await getWOWithOps(req.params.id);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/workorders/:id/complete", async (req, res) => {
  try {
    const { quantityCompleted, quantityScrapped, actualEnd, notes } = req.body;
    const wo = await db.select().from(workOrdersTable).where(eq(workOrdersTable.id, req.params.id)).limit(1);
    if (!wo[0]) return res.status(404).json({ error: "not_found", message: "WO not found" });

    await db.update(workOrdersTable).set({
      status: "complete", quantityCompleted, quantityScrapped: quantityScrapped ?? "0",
      actualEnd: actualEnd ?? new Date().toISOString().split("T")[0],
      updatedAt: new Date(),
    }).where(eq(workOrdersTable.id, req.params.id));

    if (wo[0].warehouseId && quantityCompleted > 0) {
      await db.insert(inventoryTransactionsTable).values({
        type: "receipt", itemId: wo[0].itemId,
        warehouseId: wo[0].warehouseId, quantity: quantityCompleted,
        reference: wo[0].number, notes: `WO Completion: ${notes ?? ""}`,
        createdBy: "system",
      });
      const existing = await db.select().from(inventoryBalancesTable)
        .where(and(eq(inventoryBalancesTable.itemId, wo[0].itemId), eq(inventoryBalancesTable.warehouseId, wo[0].warehouseId))).limit(1);
      if (existing[0]) {
        await db.update(inventoryBalancesTable).set({
          quantityOnHand: sql`${inventoryBalancesTable.quantityOnHand} + ${quantityCompleted}`,
          updatedAt: new Date(),
        }).where(eq(inventoryBalancesTable.id, existing[0].id));
      } else {
        await db.insert(inventoryBalancesTable).values({
          itemId: wo[0].itemId, warehouseId: wo[0].warehouseId,
          quantityOnHand: quantityCompleted, quantityAllocated: "0", quantityOnOrder: "0",
        });
      }
    }

    res.json({ message: "Work order completed successfully" });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

async function getWOWithOps(id: string) {
  const wo = await db.select({
    id: workOrdersTable.id, number: workOrdersTable.number,
    itemId: workOrdersTable.itemId, itemNumber: itemsTable.number,
    itemName: itemsTable.name, bomId: workOrdersTable.bomId,
    routingId: workOrdersTable.routingId, salesOrderId: workOrdersTable.salesOrderId,
    salesOrderNumber: salesOrdersTable.number,
    status: workOrdersTable.status, type: workOrdersTable.type,
    quantityOrdered: workOrdersTable.quantityOrdered,
    quantityCompleted: workOrdersTable.quantityCompleted,
    quantityScrapped: workOrdersTable.quantityScrapped,
    uom: itemsTable.uom, scheduledStart: workOrdersTable.scheduledStart,
    scheduledEnd: workOrdersTable.scheduledEnd, actualStart: workOrdersTable.actualStart,
    actualEnd: workOrdersTable.actualEnd, warehouseId: workOrdersTable.warehouseId,
    priority: workOrdersTable.priority, notes: workOrdersTable.notes,
    createdAt: workOrdersTable.createdAt, updatedAt: workOrdersTable.updatedAt,
  }).from(workOrdersTable)
    .leftJoin(itemsTable, eq(workOrdersTable.itemId, itemsTable.id))
    .leftJoin(salesOrdersTable, eq(workOrdersTable.salesOrderId, salesOrdersTable.id))
    .where(eq(workOrdersTable.id, id)).limit(1);

  if (!wo[0]) return null;
  const operations = await db.select({
    id: workOrderOperationsTable.id, sequence: workOrderOperationsTable.sequence,
    name: workOrderOperationsTable.name, workcenterId: workOrderOperationsTable.workcenterId,
    workcenterName: workcentersTable.name, status: workOrderOperationsTable.status,
    scheduledStart: workOrderOperationsTable.scheduledStart,
    scheduledEnd: workOrderOperationsTable.scheduledEnd,
    actualStart: workOrderOperationsTable.actualStart,
    actualEnd: workOrderOperationsTable.actualEnd,
    setupTime: workOrderOperationsTable.setupTime,
    runTime: workOrderOperationsTable.runTime, laborHours: workOrderOperationsTable.laborHours,
  }).from(workOrderOperationsTable)
    .leftJoin(workcentersTable, eq(workOrderOperationsTable.workcenterId, workcentersTable.id))
    .where(eq(workOrderOperationsTable.workOrderId, id));

  return { ...wo[0], operations };
}

export default router;
