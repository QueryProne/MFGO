import { Router } from "express";
import { db } from "@workspace/db";
import {
  itemsTable, bomsTable, bomLinesTable, routingsTable, routingOperationsTable,
  workcentersTable, itemVendorsTable, vendorsTable,
} from "@workspace/db";
import { eq, ilike, or, sql, and } from "drizzle-orm";
import { getNextNumber } from "../lib/counter";
import { auditLog } from "../lib/audit";

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
    await auditLog({ entity: "item", entityId: item[0].id, action: "create", fieldChanges: item[0] }, req);
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
    const before = await db.select().from(itemsTable).where(eq(itemsTable.id, req.params.id)).limit(1);
    const updated = await db.update(itemsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(itemsTable.id, req.params.id)).returning();
    await auditLog({ entity: "item", entityId: req.params.id, action: "update",
      fieldChanges: { before: before[0], after: updated[0] } }, req);
    res.json(updated[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// ITEM VENDORS
router.get("/items/:id/vendors", async (req, res) => {
  try {
    const vendors = await db.select({
      id: itemVendorsTable.id,
      itemId: itemVendorsTable.itemId,
      vendorId: itemVendorsTable.vendorId,
      vendorNumber: vendorsTable.number,
      vendorName: vendorsTable.name,
      vendorPartNumber: itemVendorsTable.vendorPartNumber,
      isPreferred: itemVendorsTable.isPreferred,
      isApproved: itemVendorsTable.isApproved,
      leadTimeDays: itemVendorsTable.leadTimeDays,
      minOrderQty: itemVendorsTable.minOrderQty,
      orderMultiple: itemVendorsTable.orderMultiple,
      purchaseUom: itemVendorsTable.purchaseUom,
      uomConversionToStock: itemVendorsTable.uomConversionToStock,
      safetyStockQty: itemVendorsTable.safetyStockQty,
      reorderPointQty: itemVendorsTable.reorderPointQty,
      lastCost: itemVendorsTable.lastCost,
      standardCost: itemVendorsTable.standardCost,
      effectiveFrom: itemVendorsTable.effectiveFrom,
      effectiveTo: itemVendorsTable.effectiveTo,
      notes: itemVendorsTable.notes,
      createdAt: itemVendorsTable.createdAt,
    }).from(itemVendorsTable)
      .leftJoin(vendorsTable, eq(itemVendorsTable.vendorId, vendorsTable.id))
      .where(eq(itemVendorsTable.itemId, req.params.id))
      .orderBy(sql`${itemVendorsTable.isPreferred} desc`);
    res.json({ data: vendors });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/items/:id/vendors", async (req, res) => {
  try {
    const { vendorId, vendorPartNumber, isPreferred, isApproved, leadTimeDays, minOrderQty,
      orderMultiple, purchaseUom, uomConversionToStock, safetyStockQty, reorderPointQty,
      lastCost, standardCost, effectiveFrom, effectiveTo, notes } = req.body;

    if (isPreferred) {
      await db.update(itemVendorsTable).set({ isPreferred: false }).where(eq(itemVendorsTable.itemId, req.params.id));
    }

    const iv = await db.insert(itemVendorsTable).values({
      itemId: req.params.id, vendorId, vendorPartNumber,
      isPreferred: isPreferred ?? false, isApproved: isApproved ?? true,
      leadTimeDays, minOrderQty, orderMultiple, purchaseUom,
      uomConversionToStock, safetyStockQty, reorderPointQty,
      lastCost, standardCost, effectiveFrom, effectiveTo, notes,
    }).returning();

    await auditLog({ entity: "item_vendor", entityId: iv[0].id, action: "create",
      fieldChanges: { itemId: req.params.id, vendorId } }, req);
    res.status(201).json(iv[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.put("/items/:itemId/vendors/:vendorAssignId", async (req, res) => {
  try {
    if (req.body.isPreferred) {
      await db.update(itemVendorsTable).set({ isPreferred: false }).where(eq(itemVendorsTable.itemId, req.params.itemId));
    }
    const updated = await db.update(itemVendorsTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(itemVendorsTable.id, req.params.vendorAssignId), eq(itemVendorsTable.itemId, req.params.itemId)))
      .returning();
    await auditLog({ entity: "item_vendor", entityId: req.params.vendorAssignId, action: "update",
      fieldChanges: req.body }, req);
    res.json(updated[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.delete("/items/:itemId/vendors/:vendorAssignId", async (req, res) => {
  try {
    await db.delete(itemVendorsTable)
      .where(and(eq(itemVendorsTable.id, req.params.vendorAssignId), eq(itemVendorsTable.itemId, req.params.itemId)));
    await auditLog({ entity: "item_vendor", entityId: req.params.vendorAssignId, action: "delete" }, req);
    res.json({ success: true });
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
      id: bomsTable.id, number: bomsTable.number, itemId: bomsTable.itemId,
      itemNumber: itemsTable.number, itemName: itemsTable.name,
      revision: bomsTable.revision, status: bomsTable.status,
      effectiveDate: bomsTable.effectiveDate, notes: bomsTable.notes,
      createdAt: bomsTable.createdAt, updatedAt: bomsTable.updatedAt,
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
        lineType: l.lineType ?? "standard",
        componentIssuePolicy: l.componentIssuePolicy ?? "push",
        scrapFactor: l.scrapFactor ?? "0",
        effectiveFrom: l.effectiveFrom,
        effectiveTo: l.effectiveTo,
        isPhantom: l.isPhantom ?? false,
        referenceNotes: l.referenceNotes,
        notes: l.notes,
      })));
    }
    await auditLog({ entity: "bom", entityId: bom[0].id, action: "create",
      fieldChanges: { itemId, revision, lineCount: lines?.length ?? 0 } }, req);
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
    await auditLog({ entity: "bom", entityId: req.params.id, action: "update",
      fieldChanges: { revision, status, effectiveDate } }, req);
    const result = await getBomWithLines(req.params.id);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// BOM LINES
router.post("/boms/:id/lines", async (req, res) => {
  try {
    const l = req.body;
    // Support inline item creation
    let itemId = l.itemId;
    if (!itemId && l.newItem) {
      const ni = l.newItem;
      const number = ni.number || getNextNumber(ni.type === "purchased_part" ? "RM" : ni.type === "manufactured" ? "MFG" : "ITM");
      const created = await db.insert(itemsTable).values({
        number, name: ni.name, description: ni.description,
        type: ni.type ?? "purchased_part",
        supplyType: ni.supplyType ?? "purchased",
        makeBuy: ni.makeBuy ?? "buy",
        uom: ni.uom ?? "EA", revision: ni.revision ?? "A",
        leadTime: ni.leadTime, safetyStock: ni.safetyStock,
        reorderPoint: ni.reorderPoint, lotTracked: ni.lotTracked ?? false,
        serialTracked: ni.serialTracked ?? false, status: "active",
      }).returning();
      itemId = created[0].id;
      await auditLog({ entity: "item", entityId: itemId, action: "create",
        fieldChanges: { source: "bom_inline_create", ...created[0] } }, req);
    }
    if (!itemId) return res.status(400).json({ error: "bad_request", message: "itemId or newItem required" });

    const maxSeq = await db.select({ max: sql<number>`coalesce(max(sequence), 0)` })
      .from(bomLinesTable).where(eq(bomLinesTable.bomId, req.params.id));
    const sequence = (Number(maxSeq[0]?.max ?? 0)) + 10;

    const line = await db.insert(bomLinesTable).values({
      bomId: req.params.id, sequence, itemId,
      quantity: l.quantity ?? "1",
      uom: l.uom ?? "EA",
      lineType: l.lineType ?? "standard",
      componentIssuePolicy: l.componentIssuePolicy ?? "push",
      scrapFactor: l.scrapFactor ?? "0",
      effectiveFrom: l.effectiveFrom,
      effectiveTo: l.effectiveTo,
      isPhantom: l.isPhantom ?? false,
      referenceNotes: l.referenceNotes,
      notes: l.notes,
    }).returning();

    await auditLog({ entity: "bom_line", entityId: line[0].id, action: "create",
      fieldChanges: { bomId: req.params.id, itemId, quantity: l.quantity } }, req);

    const item = await db.select().from(itemsTable).where(eq(itemsTable.id, itemId)).limit(1);
    res.status(201).json({ ...line[0], itemNumber: item[0]?.number, itemName: item[0]?.name });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.put("/boms/:id/lines/:lineId", async (req, res) => {
  try {
    const updated = await db.update(bomLinesTable)
      .set({
        quantity: req.body.quantity, uom: req.body.uom, lineType: req.body.lineType,
        componentIssuePolicy: req.body.componentIssuePolicy, scrapFactor: req.body.scrapFactor,
        effectiveFrom: req.body.effectiveFrom, effectiveTo: req.body.effectiveTo,
        isPhantom: req.body.isPhantom, referenceNotes: req.body.referenceNotes, notes: req.body.notes,
      })
      .where(and(eq(bomLinesTable.id, req.params.lineId), eq(bomLinesTable.bomId, req.params.id)))
      .returning();
    await auditLog({ entity: "bom_line", entityId: req.params.lineId, action: "update",
      fieldChanges: req.body }, req);
    res.json(updated[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.delete("/boms/:id/lines/:lineId", async (req, res) => {
  try {
    await db.delete(bomLinesTable)
      .where(and(eq(bomLinesTable.id, req.params.lineId), eq(bomLinesTable.bomId, req.params.id)));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

async function getBomWithLines(id: string) {
  const bom = await db.select({
    id: bomsTable.id, number: bomsTable.number, itemId: bomsTable.itemId,
    itemNumber: itemsTable.number, itemName: itemsTable.name,
    revision: bomsTable.revision, status: bomsTable.status,
    effectiveDate: bomsTable.effectiveDate, notes: bomsTable.notes,
    createdAt: bomsTable.createdAt, updatedAt: bomsTable.updatedAt,
  }).from(bomsTable).leftJoin(itemsTable, eq(bomsTable.itemId, itemsTable.id)).where(eq(bomsTable.id, id)).limit(1);

  if (!bom[0]) return null;

  const aliasItem = itemsTable;
  const lines = await db.select({
    id: bomLinesTable.id, sequence: bomLinesTable.sequence,
    itemId: bomLinesTable.itemId, itemNumber: aliasItem.number, itemName: aliasItem.name,
    itemType: aliasItem.type, supplyType: aliasItem.supplyType,
    quantity: bomLinesTable.quantity, uom: bomLinesTable.uom,
    lineType: bomLinesTable.lineType, componentIssuePolicy: bomLinesTable.componentIssuePolicy,
    scrapFactor: bomLinesTable.scrapFactor, effectiveFrom: bomLinesTable.effectiveFrom,
    effectiveTo: bomLinesTable.effectiveTo, isPhantom: bomLinesTable.isPhantom,
    referenceNotes: bomLinesTable.referenceNotes, notes: bomLinesTable.notes,
  }).from(bomLinesTable)
    .leftJoin(aliasItem, eq(bomLinesTable.itemId, aliasItem.id))
    .where(eq(bomLinesTable.bomId, id))
    .orderBy(bomLinesTable.sequence);

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
      id: routingsTable.id, itemId: routingsTable.itemId,
      itemNumber: itemsTable.number, itemName: itemsTable.name,
      revision: routingsTable.revision, status: routingsTable.status, createdAt: routingsTable.createdAt,
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
        routingId: routing[0].id, sequence: op.sequence, name: op.name,
        workcenterId: op.workcenterId, setupTime: op.setupTime, runTime: op.runTime,
        queueTime: op.queueTime, notes: op.notes,
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
    id: routingsTable.id, itemId: routingsTable.itemId,
    itemNumber: itemsTable.number, itemName: itemsTable.name,
    revision: routingsTable.revision, status: routingsTable.status, createdAt: routingsTable.createdAt,
  }).from(routingsTable).leftJoin(itemsTable, eq(routingsTable.itemId, itemsTable.id)).where(eq(routingsTable.id, id)).limit(1);

  if (!routing[0]) return null;
  const operations = await db.select({
    id: routingOperationsTable.id, sequence: routingOperationsTable.sequence,
    name: routingOperationsTable.name, workcenterId: routingOperationsTable.workcenterId,
    workcenterName: workcentersTable.name, setupTime: routingOperationsTable.setupTime,
    runTime: routingOperationsTable.runTime, queueTime: routingOperationsTable.queueTime,
    notes: routingOperationsTable.notes, status: sql<string>`'pending'`,
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
