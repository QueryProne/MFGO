import { Router } from "express";
import { db } from "@workspace/db";
import { purchaseOrdersTable, purchaseOrderLinesTable, itemsTable, vendorsTable, inventoryTransactionsTable, inventoryBalancesTable } from "@workspace/db";
import { eq, ilike, or, sql, and } from "drizzle-orm";
import { getNextNumber } from "../lib/counter";

const router = Router();

router.get("/purchaseorders", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;
    const conditions: any[] = [];
    if (req.query.status) conditions.push(eq(purchaseOrdersTable.status, req.query.status as string));
    if (req.query.vendorId) conditions.push(eq(purchaseOrdersTable.vendorId, req.query.vendorId as string));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db.select({
      id: purchaseOrdersTable.id, number: purchaseOrdersTable.number,
      vendorId: purchaseOrdersTable.vendorId, vendorName: vendorsTable.name,
      status: purchaseOrdersTable.status, orderDate: purchaseOrdersTable.orderDate,
      requestedDate: purchaseOrdersTable.requestedDate, promisedDate: purchaseOrdersTable.promisedDate,
      totalAmount: purchaseOrdersTable.totalAmount, notes: purchaseOrdersTable.notes,
      createdAt: purchaseOrdersTable.createdAt, updatedAt: purchaseOrdersTable.updatedAt,
    }).from(purchaseOrdersTable).leftJoin(vendorsTable, eq(purchaseOrdersTable.vendorId, vendorsTable.id))
      .where(where).limit(limit).offset(offset).orderBy(sql`${purchaseOrdersTable.createdAt} desc`);

    const countResult = await db.select({ count: sql<number>`count(*)` }).from(purchaseOrdersTable).where(where);
    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/purchaseorders", async (req, res) => {
  try {
    const { vendorId, orderDate, requestedDate, warehouseId, lines, notes, terms } = req.body;
    const number = getNextNumber("PO");
    const po = await db.insert(purchaseOrdersTable).values({ vendorId, number, orderDate, requestedDate, warehouseId, notes, terms }).returning();

    if (lines?.length) {
      await db.insert(purchaseOrderLinesTable).values(lines.map((l: any, i: number) => ({
        purchaseOrderId: po[0].id, lineNumber: i + 1,
        itemId: l.itemId, quantity: l.quantity,
        unitCost: l.unitCost, lineTotal: (Number(l.quantity) * Number(l.unitCost)).toFixed(2),
        requestedDate: l.requestedDate, notes: l.notes,
      })));
      const total = lines.reduce((s: number, l: any) => s + Number(l.quantity) * Number(l.unitCost), 0);
      await db.update(purchaseOrdersTable).set({ totalAmount: total.toFixed(2), subtotal: total.toFixed(2) }).where(eq(purchaseOrdersTable.id, po[0].id));
    }
    const result = await getPOWithLines(po[0].id);
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.get("/purchaseorders/:id", async (req, res) => {
  try {
    const result = await getPOWithLines(req.params.id);
    if (!result) return res.status(404).json({ error: "not_found", message: "PO not found" });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.put("/purchaseorders/:id", async (req, res) => {
  try {
    await db.update(purchaseOrdersTable).set({ ...req.body, updatedAt: new Date() }).where(eq(purchaseOrdersTable.id, req.params.id));
    const result = await getPOWithLines(req.params.id);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/purchaseorders/:id/receive", async (req, res) => {
  try {
    const po = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, req.params.id)).limit(1);
    if (!po[0]) return res.status(404).json({ error: "not_found", message: "PO not found" });

    const { lines } = req.body;
    for (const recv of lines) {
      await db.update(purchaseOrderLinesTable)
        .set({ quantityReceived: sql`${purchaseOrderLinesTable.quantityReceived} + ${recv.quantityReceived}` })
        .where(eq(purchaseOrderLinesTable.id, recv.lineId));

      const line = await db.select().from(purchaseOrderLinesTable).where(eq(purchaseOrderLinesTable.id, recv.lineId)).limit(1);
      if (line[0] && po[0].warehouseId) {
        await db.insert(inventoryTransactionsTable).values({
          type: "receipt", itemId: line[0].itemId,
          warehouseId: po[0].warehouseId,
          quantity: recv.quantityReceived,
          unitCost: line[0].unitCost,
          reference: po[0].number,
          lotNumber: recv.lotNumber,
          createdBy: "system",
        });

        const existing = await db.select().from(inventoryBalancesTable)
          .where(and(eq(inventoryBalancesTable.itemId, line[0].itemId), eq(inventoryBalancesTable.warehouseId, po[0].warehouseId!))).limit(1);

        if (existing[0]) {
          await db.update(inventoryBalancesTable).set({
            quantityOnHand: sql`${inventoryBalancesTable.quantityOnHand} + ${recv.quantityReceived}`,
            updatedAt: new Date(),
          }).where(eq(inventoryBalancesTable.id, existing[0].id));
        } else {
          await db.insert(inventoryBalancesTable).values({
            itemId: line[0].itemId, warehouseId: po[0].warehouseId!,
            quantityOnHand: recv.quantityReceived, quantityAllocated: "0", quantityOnOrder: "0",
          });
        }
      }
    }

    await db.update(purchaseOrdersTable).set({ status: "partially_received", updatedAt: new Date() }).where(eq(purchaseOrdersTable.id, req.params.id));
    res.json({ message: "Receipt posted successfully" });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

async function getPOWithLines(id: string) {
  const po = await db.select({
    id: purchaseOrdersTable.id, number: purchaseOrdersTable.number,
    vendorId: purchaseOrdersTable.vendorId, vendorName: vendorsTable.name,
    status: purchaseOrdersTable.status, orderDate: purchaseOrdersTable.orderDate,
    requestedDate: purchaseOrdersTable.requestedDate, promisedDate: purchaseOrdersTable.promisedDate,
    subtotal: purchaseOrdersTable.subtotal, taxAmount: purchaseOrdersTable.taxAmount,
    totalAmount: purchaseOrdersTable.totalAmount, warehouseId: purchaseOrdersTable.warehouseId,
    notes: purchaseOrdersTable.notes, terms: purchaseOrdersTable.terms,
    createdAt: purchaseOrdersTable.createdAt, updatedAt: purchaseOrdersTable.updatedAt,
  }).from(purchaseOrdersTable).leftJoin(vendorsTable, eq(purchaseOrdersTable.vendorId, vendorsTable.id)).where(eq(purchaseOrdersTable.id, id)).limit(1);

  if (!po[0]) return null;
  const lines = await db.select({
    id: purchaseOrderLinesTable.id, lineNumber: purchaseOrderLinesTable.lineNumber,
    itemId: purchaseOrderLinesTable.itemId, itemNumber: itemsTable.number,
    itemName: itemsTable.name, quantity: purchaseOrderLinesTable.quantity,
    quantityReceived: purchaseOrderLinesTable.quantityReceived, uom: purchaseOrderLinesTable.uom,
    unitCost: purchaseOrderLinesTable.unitCost, lineTotal: purchaseOrderLinesTable.lineTotal,
    requestedDate: purchaseOrderLinesTable.requestedDate, promisedDate: purchaseOrderLinesTable.promisedDate,
    notes: purchaseOrderLinesTable.notes,
  }).from(purchaseOrderLinesTable).leftJoin(itemsTable, eq(purchaseOrderLinesTable.itemId, itemsTable.id)).where(eq(purchaseOrderLinesTable.purchaseOrderId, id));

  return { ...po[0], lines };
}

export default router;
