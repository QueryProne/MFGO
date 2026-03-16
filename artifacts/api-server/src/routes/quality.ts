import { Router } from "express";
import { db } from "@workspace/db";
import { inspectionsTable, nonconformancesTable, itemsTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { getNextNumber } from "../lib/counter";

const router = Router();

// INSPECTIONS
router.get("/quality/inspections", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;
    const conditions: any[] = [];
    if (req.query.type) conditions.push(eq(inspectionsTable.type, req.query.type as string));
    if (req.query.status) conditions.push(eq(inspectionsTable.status, req.query.status as string));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db.select({
      id: inspectionsTable.id, number: inspectionsTable.number,
      type: inspectionsTable.type, status: inspectionsTable.status,
      itemId: inspectionsTable.itemId, itemNumber: itemsTable.number,
      itemName: itemsTable.name, quantity: inspectionsTable.quantity,
      quantityPassed: inspectionsTable.quantityPassed,
      quantityFailed: inspectionsTable.quantityFailed,
      reference: inspectionsTable.reference, lotNumber: inspectionsTable.lotNumber,
      inspectedBy: inspectionsTable.inspectedBy, inspectedAt: inspectionsTable.inspectedAt,
      notes: inspectionsTable.notes, createdAt: inspectionsTable.createdAt,
    }).from(inspectionsTable)
      .leftJoin(itemsTable, eq(inspectionsTable.itemId, itemsTable.id))
      .where(where).limit(limit).offset(offset).orderBy(sql`${inspectionsTable.createdAt} desc`);

    const countResult = await db.select({ count: sql<number>`count(*)` }).from(inspectionsTable).where(where);
    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/quality/inspections", async (req, res) => {
  try {
    const number = getNextNumber("INS");
    const inspection = await db.insert(inspectionsTable).values({ ...req.body, number }).returning();
    res.status(201).json(inspection[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// NONCONFORMANCES
router.get("/quality/nonconformances", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;
    const where = req.query.status ? eq(nonconformancesTable.status, req.query.status as string) : undefined;

    const data = await db.select({
      id: nonconformancesTable.id, number: nonconformancesTable.number,
      title: nonconformancesTable.title, description: nonconformancesTable.description,
      status: nonconformancesTable.status, severity: nonconformancesTable.severity,
      itemId: nonconformancesTable.itemId, itemNumber: itemsTable.number,
      defectCode: nonconformancesTable.defectCode, disposition: nonconformancesTable.disposition,
      quantityAffected: nonconformancesTable.quantityAffected, lotNumber: nonconformancesTable.lotNumber,
      containmentAction: nonconformancesTable.containmentAction,
      rootCause: nonconformancesTable.rootCause, correctiveAction: nonconformancesTable.correctiveAction,
      reportedBy: nonconformancesTable.reportedBy, assignedTo: nonconformancesTable.assignedTo,
      closedAt: nonconformancesTable.closedAt, createdAt: nonconformancesTable.createdAt,
    }).from(nonconformancesTable)
      .leftJoin(itemsTable, eq(nonconformancesTable.itemId, itemsTable.id))
      .where(where).limit(limit).offset(offset).orderBy(sql`${nonconformancesTable.createdAt} desc`);

    const countResult = await db.select({ count: sql<number>`count(*)` }).from(nonconformancesTable).where(where);
    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/quality/nonconformances", async (req, res) => {
  try {
    const number = getNextNumber("NCR");
    const nc = await db.insert(nonconformancesTable).values({ ...req.body, number }).returning();
    res.status(201).json(nc[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

export default router;
