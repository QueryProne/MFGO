import { Router } from "express";
import { db } from "@workspace/db";
import { itemsTable, bomsTable, bomLinesTable, routingsTable, routingOperationsTable, workcentersTable } from "@workspace/db";
import { eq, ilike, or, sql, and } from "drizzle-orm";
import { getNextNumber } from "../lib/counter";

const router = Router();

// ITEMS
router.get("/items", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const search = req.query.search as string;
    const type = req.query.type as string;
    const status = req.query.status as string;
    const offset = (page - 1) * limit;

    const conditions: any[] = [];
    if (search) conditions.push(or(ilike(itemsTable.name, `%${search}%`), ilike(itemsTable.number, `%${search}%`)));
    if (type) conditions.push(eq(itemsTable.type, type));
    if (status) conditions.push(eq(itemsTable.status, status));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db.select().from(itemsTable).where(where).limit(limit).offset(offset).orderBy(sql`${itemsTable.updatedAt} desc`),
      db.select({ count: sql<number>`count(*)` }).from(itemsTable).where(where),
    ]);
    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/items", async (req, res) => {
  try {
    const number = req.body.number || getNextNumber("ITM");
    const item = await db.insert(itemsTable).values({ ...req.body, number }).returning();
    res.status(201).json(item[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.get("/items/:id", async (req, res) => {
  try {
    const item = await db.select().from(itemsTable).where(eq(itemsTable.id, req.params.id)).limit(1);
    if (!item[0]) return res.status(404).json({ error: "not_found", message: "Item not found" });
    res.json(item[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.put("/items/:id", async (req, res) => {
  try {
    const updated = await db.update(itemsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(itemsTable.id, req.params.id)).returning();
    res.json(updated[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// BOMS
router.get("/boms", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;
    const itemId = req.query.itemId as string;
    const where = itemId ? eq(bomsTable.itemId, itemId) : undefined;

    const boms = await db.select({
      id: bomsTable.id,
      number: bomsTable.number,
      itemId: bomsTable.itemId,
      itemNumber: itemsTable.number,
      itemName: itemsTable.name,
      revision: bomsTable.revision,
      status: bomsTable.status,
      effectiveDate: bomsTable.effectiveDate,
      notes: bomsTable.notes,
      createdAt: bomsTable.createdAt,
      updatedAt: bomsTable.updatedAt,
    }).from(bomsTable).leftJoin(itemsTable, eq(bomsTable.itemId, itemsTable.id)).where(where).limit(limit).offset(offset);

    const countResult = await db.select({ count: sql<number>`count(*)` }).from(bomsTable).where(where);
    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data: boms, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/boms", async (req, res) => {
  try {
    const { itemId, revision, effectiveDate, lines, notes } = req.body;
    const number = getNextNumber("BOM");
    const bom = await db.insert(bomsTable).values({ itemId, revision, effectiveDate, notes, number }).returning();
    if (lines?.length) {
      await db.insert(bomLinesTable).values(lines.map((l: any, i: number) => ({
        bomId: bom[0].id,
        sequence: l.sequence ?? (i + 1) * 10,
        itemId: l.itemId,
        quantity: l.quantity,
        uom: l.uom ?? "EA",
        scrapFactor: l.scrapFactor ?? "0",
        notes: l.notes,
      })));
    }
    const result = await getBomWithLines(bom[0].id);
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.get("/boms/:id", async (req, res) => {
  try {
    const result = await getBomWithLines(req.params.id);
    if (!result) return res.status(404).json({ error: "not_found", message: "BOM not found" });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.put("/boms/:id", async (req, res) => {
  try {
    const { revision, status, effectiveDate, notes } = req.body;
    await db.update(bomsTable).set({ revision, status, effectiveDate, notes, updatedAt: new Date() }).where(eq(bomsTable.id, req.params.id));
    const result = await getBomWithLines(req.params.id);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

async function getBomWithLines(id: string) {
  const bom = await db.select({
    id: bomsTable.id,
    number: bomsTable.number,
    itemId: bomsTable.itemId,
    itemNumber: itemsTable.number,
    itemName: itemsTable.name,
    revision: bomsTable.revision,
    status: bomsTable.status,
    effectiveDate: bomsTable.effectiveDate,
    notes: bomsTable.notes,
    createdAt: bomsTable.createdAt,
    updatedAt: bomsTable.updatedAt,
  }).from(bomsTable).leftJoin(itemsTable, eq(bomsTable.itemId, itemsTable.id)).where(eq(bomsTable.id, id)).limit(1);

  if (!bom[0]) return null;
  const lines = await db.select({
    id: bomLinesTable.id,
    sequence: bomLinesTable.sequence,
    itemId: bomLinesTable.itemId,
    itemNumber: itemsTable.number,
    itemName: itemsTable.name,
    quantity: bomLinesTable.quantity,
    uom: bomLinesTable.uom,
    scrapFactor: bomLinesTable.scrapFactor,
    notes: bomLinesTable.notes,
  }).from(bomLinesTable).leftJoin(itemsTable, eq(bomLinesTable.itemId, itemsTable.id)).where(eq(bomLinesTable.bomId, id));

  return { ...bom[0], lines };
}

// ROUTINGS
router.get("/routings", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;
    const itemId = req.query.itemId as string;
    const where = itemId ? eq(routingsTable.itemId, itemId) : undefined;

    const routings = await db.select({
      id: routingsTable.id,
      itemId: routingsTable.itemId,
      itemNumber: itemsTable.number,
      itemName: itemsTable.name,
      revision: routingsTable.revision,
      status: routingsTable.status,
      createdAt: routingsTable.createdAt,
    }).from(routingsTable).leftJoin(itemsTable, eq(routingsTable.itemId, itemsTable.id)).where(where).limit(limit).offset(offset);

    const countResult = await db.select({ count: sql<number>`count(*)` }).from(routingsTable).where(where);
    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data: routings, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/routings", async (req, res) => {
  try {
    const { itemId, revision, operations } = req.body;
    const routing = await db.insert(routingsTable).values({ itemId, revision }).returning();
    if (operations?.length) {
      await db.insert(routingOperationsTable).values(operations.map((op: any) => ({
        routingId: routing[0].id,
        sequence: op.sequence,
        name: op.name,
        workcenterId: op.workcenterId,
        setupTime: op.setupTime,
        runTime: op.runTime,
        queueTime: op.queueTime,
        notes: op.notes,
      })));
    }
    const result = await getRoutingWithOps(routing[0].id);
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.get("/routings/:id", async (req, res) => {
  try {
    const result = await getRoutingWithOps(req.params.id);
    if (!result) return res.status(404).json({ error: "not_found", message: "Routing not found" });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

async function getRoutingWithOps(id: string) {
  const routing = await db.select({
    id: routingsTable.id,
    itemId: routingsTable.itemId,
    itemNumber: itemsTable.number,
    itemName: itemsTable.name,
    revision: routingsTable.revision,
    status: routingsTable.status,
    createdAt: routingsTable.createdAt,
  }).from(routingsTable).leftJoin(itemsTable, eq(routingsTable.itemId, itemsTable.id)).where(eq(routingsTable.id, id)).limit(1);

  if (!routing[0]) return null;
  const operations = await db.select({
    id: routingOperationsTable.id,
    sequence: routingOperationsTable.sequence,
    name: routingOperationsTable.name,
    workcenterId: routingOperationsTable.workcenterId,
    workcenterName: workcentersTable.name,
    setupTime: routingOperationsTable.setupTime,
    runTime: routingOperationsTable.runTime,
    queueTime: routingOperationsTable.queueTime,
    notes: routingOperationsTable.notes,
    status: sql<string>`'pending'`,
  }).from(routingOperationsTable)
    .leftJoin(workcentersTable, eq(routingOperationsTable.workcenterId, workcentersTable.id))
    .where(eq(routingOperationsTable.routingId, id));

  return { ...routing[0], operations };
}

// WORKCENTERS
router.get("/workcenters", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;
    const [data, countResult] = await Promise.all([
      db.select().from(workcentersTable).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(workcentersTable),
    ]);
    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/workcenters", async (req, res) => {
  try {
    const wc = await db.insert(workcentersTable).values(req.body).returning();
    res.status(201).json(wc[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

export default router;
