import { Router } from "express";
import { db } from "@workspace/db";
import {
  workOrdersTable, workOrderOperationsTable, workOrderMaterialsTable, serviceOrdersTable,
  itemsTable, workcentersTable, salesOrdersTable, salesOrderLinesTable,
  inventoryTransactionsTable, inventoryBalancesTable, bomsTable, bomLinesTable,
  customersTable,
} from "@workspace/db";
import { eq, ilike, sql, and } from "drizzle-orm";
import { getNextNumber } from "../lib/counter";
import { auditLog } from "../lib/audit";

const router = Router();

// ─── WORK ORDERS ─────────────────────────────────────────────────────────────
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
      parentWorkOrderId: workOrdersTable.parentWorkOrderId,
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
    const { itemId, bomId, routingId, salesOrderId, salesOrderLineId, parentWorkOrderId,
      type, quantityOrdered, scheduledStart, scheduledEnd, warehouseId, priority, notes } = req.body;
    const number = getNextNumber("WO");
    const wo = await db.insert(workOrdersTable).values({
      itemId, bomId, routingId, salesOrderId, salesOrderLineId, parentWorkOrderId,
      type: type ?? "standard", number, quantityOrdered, scheduledStart, scheduledEnd,
      warehouseId, priority: priority ?? "normal", notes,
    }).returning();

    // Explode BOM into work order materials
    if (bomId && quantityOrdered) {
      await explodeBomToMaterials(wo[0].id, bomId, Number(quantityOrdered));
    }

    await auditLog({ entity: "work_order", entityId: wo[0].id, action: "create",
      fieldChanges: { number: wo[0].number, itemId, salesOrderId, quantityOrdered } }, req);

    const result = await getWOWithDetails(wo[0].id);
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.get("/workorders/:id", async (req, res) => {
  try {
    const result = await getWOWithDetails(req.params.id);
    if (!result) return res.status(404).json({ error: "not_found", message: "Work order not found" });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.put("/workorders/:id", async (req, res) => {
  try {
    await db.update(workOrdersTable).set({ ...req.body, updatedAt: new Date() }).where(eq(workOrdersTable.id, req.params.id));
    await auditLog({ entity: "work_order", entityId: req.params.id, action: "update",
      fieldChanges: req.body }, req);
    const result = await getWOWithDetails(req.params.id);
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
      actualEnd: actualEnd ?? new Date().toISOString().split("T")[0], updatedAt: new Date(),
    }).where(eq(workOrdersTable.id, req.params.id));

    if (wo[0].warehouseId && quantityCompleted > 0) {
      await db.insert(inventoryTransactionsTable).values({
        type: "receipt", itemId: wo[0].itemId,
        warehouseId: wo[0].warehouseId, quantity: quantityCompleted,
        reference: wo[0].number, notes: `WO Completion: ${notes ?? ""}`, createdBy: "system",
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

    await auditLog({ entity: "work_order", entityId: req.params.id, action: "complete",
      fieldChanges: { quantityCompleted, quantityScrapped } }, req);
    res.json({ message: "Work order completed successfully" });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// WO Materials
router.get("/workorders/:id/materials", async (req, res) => {
  try {
    const materials = await db.select({
      id: workOrderMaterialsTable.id,
      workOrderId: workOrderMaterialsTable.workOrderId,
      bomLineId: workOrderMaterialsTable.bomLineId,
      itemId: workOrderMaterialsTable.itemId,
      itemNumber: itemsTable.number,
      itemName: itemsTable.name,
      itemType: itemsTable.type,
      supplyType: itemsTable.supplyType,
      requiredQty: workOrderMaterialsTable.requiredQty,
      issuedQty: workOrderMaterialsTable.issuedQty,
      allocatedQty: workOrderMaterialsTable.allocatedQty,
      shortageQty: workOrderMaterialsTable.shortageQty,
      supplyTypeSnapshot: workOrderMaterialsTable.supplyTypeSnapshot,
      sourceWorkOrderId: workOrderMaterialsTable.sourceWorkOrderId,
      uom: workOrderMaterialsTable.uom,
      notes: workOrderMaterialsTable.notes,
    }).from(workOrderMaterialsTable)
      .leftJoin(itemsTable, eq(workOrderMaterialsTable.itemId, itemsTable.id))
      .where(eq(workOrderMaterialsTable.workOrderId, req.params.id));
    res.json({ data: materials });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/workorders/:id/materials/:materialId/issue", async (req, res) => {
  try {
    const { issuedQty } = req.body;
    const mat = await db.select().from(workOrderMaterialsTable)
      .where(and(eq(workOrderMaterialsTable.id, req.params.materialId), eq(workOrderMaterialsTable.workOrderId, req.params.id))).limit(1);
    if (!mat[0]) return res.status(404).json({ error: "not_found", message: "Material not found" });

    const newIssued = Number(mat[0].issuedQty ?? 0) + Number(issuedQty);
    const newShortage = Math.max(0, Number(mat[0].requiredQty) - newIssued);
    await db.update(workOrderMaterialsTable).set({
      issuedQty: newIssued.toString(), shortageQty: newShortage.toString(),
    }).where(eq(workOrderMaterialsTable.id, req.params.materialId));

    res.json({ success: true, issuedQty: newIssued, shortageQty: newShortage });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// ─── SERVICE ORDERS ───────────────────────────────────────────────────────────
router.get("/serviceorders", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;
    const conditions: any[] = [];
    if (req.query.status) conditions.push(eq(serviceOrdersTable.status, req.query.status as string));
    if (req.query.customerId) conditions.push(eq(serviceOrdersTable.customerId, req.query.customerId as string));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db.select({
      id: serviceOrdersTable.id,
      number: serviceOrdersTable.number,
      salesOrderId: serviceOrdersTable.salesOrderId,
      salesOrderNumber: salesOrdersTable.number,
      customerId: serviceOrdersTable.customerId,
      customerName: customersTable.name,
      itemId: serviceOrdersTable.itemId,
      itemNumber: itemsTable.number,
      itemName: itemsTable.name,
      serviceType: serviceOrdersTable.serviceType,
      status: serviceOrdersTable.status,
      requestedDate: serviceOrdersTable.requestedDate,
      scheduledDate: serviceOrdersTable.scheduledDate,
      completionDate: serviceOrdersTable.completionDate,
      customerSite: serviceOrdersTable.customerSite,
      assetReference: serviceOrdersTable.assetReference,
      plannedHours: serviceOrdersTable.plannedHours,
      actualHours: serviceOrdersTable.actualHours,
      notes: serviceOrdersTable.notes,
      createdAt: serviceOrdersTable.createdAt,
    }).from(serviceOrdersTable)
      .leftJoin(customersTable, eq(serviceOrdersTable.customerId, customersTable.id))
      .leftJoin(itemsTable, eq(serviceOrdersTable.itemId, itemsTable.id))
      .leftJoin(salesOrdersTable, eq(serviceOrdersTable.salesOrderId, salesOrdersTable.id))
      .where(where).limit(limit).offset(offset).orderBy(sql`${serviceOrdersTable.createdAt} desc`);

    const countResult = await db.select({ count: sql<number>`count(*)` }).from(serviceOrdersTable).where(where);
    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/serviceorders", async (req, res) => {
  try {
    const number = getNextNumber("SVC");
    const so = await db.insert(serviceOrdersTable).values({ ...req.body, number }).returning();
    await auditLog({ entity: "service_order", entityId: so[0].id, action: "create",
      fieldChanges: { number: so[0].number, salesOrderId: so[0].salesOrderId } }, req);
    res.status(201).json(so[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.get("/serviceorders/:id", async (req, res) => {
  try {
    const data = await db.select({
      id: serviceOrdersTable.id,
      number: serviceOrdersTable.number,
      salesOrderId: serviceOrdersTable.salesOrderId,
      customerId: serviceOrdersTable.customerId,
      customerName: customersTable.name,
      itemId: serviceOrdersTable.itemId,
      itemNumber: itemsTable.number,
      itemName: itemsTable.name,
      serviceType: serviceOrdersTable.serviceType,
      status: serviceOrdersTable.status,
      requestedDate: serviceOrdersTable.requestedDate,
      scheduledDate: serviceOrdersTable.scheduledDate,
      completionDate: serviceOrdersTable.completionDate,
      customerSite: serviceOrdersTable.customerSite,
      assetReference: serviceOrdersTable.assetReference,
      plannedHours: serviceOrdersTable.plannedHours,
      actualHours: serviceOrdersTable.actualHours,
      notes: serviceOrdersTable.notes,
      createdAt: serviceOrdersTable.createdAt,
    }).from(serviceOrdersTable)
      .leftJoin(customersTable, eq(serviceOrdersTable.customerId, customersTable.id))
      .leftJoin(itemsTable, eq(serviceOrdersTable.itemId, itemsTable.id))
      .where(eq(serviceOrdersTable.id, req.params.id)).limit(1);

    if (!data[0]) return res.status(404).json({ error: "not_found", message: "Service order not found" });
    res.json(data[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.put("/serviceorders/:id", async (req, res) => {
  try {
    const updated = await db.update(serviceOrdersTable).set({ ...req.body, updatedAt: new Date() })
      .where(eq(serviceOrdersTable.id, req.params.id)).returning();
    res.json(updated[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────
async function explodeBomToMaterials(workOrderId: string, bomId: string, woQty: number) {
  const lines = await db.select({
    id: bomLinesTable.id,
    itemId: bomLinesTable.itemId,
    quantity: bomLinesTable.quantity,
    uom: bomLinesTable.uom,
    isPhantom: bomLinesTable.isPhantom,
    supplyType: itemsTable.supplyType,
  }).from(bomLinesTable)
    .leftJoin(itemsTable, eq(bomLinesTable.itemId, itemsTable.id))
    .where(eq(bomLinesTable.bomId, bomId));

  const materials = [];
  for (const line of lines) {
    if (line.isPhantom) continue; // phantom explodes in parent
    const requiredQty = Number(line.quantity) * woQty;
    const bal = await db.select().from(inventoryBalancesTable)
      .where(eq(inventoryBalancesTable.itemId, line.itemId)).limit(1);
    const onHand = Number(bal[0]?.quantityOnHand ?? 0);
    const shortage = Math.max(0, requiredQty - onHand);

    materials.push({
      workOrderId, bomLineId: line.id, itemId: line.itemId,
      requiredQty: requiredQty.toString(), issuedQty: "0",
      allocatedQty: Math.min(onHand, requiredQty).toString(),
      shortageQty: shortage.toString(),
      supplyTypeSnapshot: line.supplyType ?? "purchased",
      uom: line.uom ?? "EA",
    });
  }

  if (materials.length > 0) {
    await db.insert(workOrderMaterialsTable).values(materials);
  }
}

async function getWOWithDetails(id: string) {
  const wo = await db.select({
    id: workOrdersTable.id, number: workOrdersTable.number,
    itemId: workOrdersTable.itemId, itemNumber: itemsTable.number,
    itemName: itemsTable.name, bomId: workOrdersTable.bomId,
    routingId: workOrdersTable.routingId, salesOrderId: workOrdersTable.salesOrderId,
    salesOrderNumber: salesOrdersTable.number,
    parentWorkOrderId: workOrdersTable.parentWorkOrderId,
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

  const [operations, materials] = await Promise.all([
    db.select({
      id: workOrderOperationsTable.id, sequence: workOrderOperationsTable.sequence,
      name: workOrderOperationsTable.name, workcenterId: workOrderOperationsTable.workcenterId,
      workcenterName: workcentersTable.name, status: workOrderOperationsTable.status,
      scheduledStart: workOrderOperationsTable.scheduledStart, scheduledEnd: workOrderOperationsTable.scheduledEnd,
      actualStart: workOrderOperationsTable.actualStart, actualEnd: workOrderOperationsTable.actualEnd,
      setupTime: workOrderOperationsTable.setupTime, runTime: workOrderOperationsTable.runTime,
      laborHours: workOrderOperationsTable.laborHours,
    }).from(workOrderOperationsTable)
      .leftJoin(workcentersTable, eq(workOrderOperationsTable.workcenterId, workcentersTable.id))
      .where(eq(workOrderOperationsTable.workOrderId, id)),

    db.select({
      id: workOrderMaterialsTable.id,
      itemId: workOrderMaterialsTable.itemId,
      itemNumber: itemsTable.number,
      itemName: itemsTable.name,
      supplyType: itemsTable.supplyType,
      requiredQty: workOrderMaterialsTable.requiredQty,
      issuedQty: workOrderMaterialsTable.issuedQty,
      shortageQty: workOrderMaterialsTable.shortageQty,
      uom: workOrderMaterialsTable.uom,
    }).from(workOrderMaterialsTable)
      .leftJoin(itemsTable, eq(workOrderMaterialsTable.itemId, itemsTable.id))
      .where(eq(workOrderMaterialsTable.workOrderId, id)),
  ]);

  return { ...wo[0], operations, materials };
}

export default router;
