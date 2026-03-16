import { Router } from "express";
import { db } from "@workspace/db";
import { inventoryBalancesTable, inventoryTransactionsTable, warehousesTable, itemsTable } from "@workspace/db";
import { eq, ilike, or, sql, and } from "drizzle-orm";
import { getNextNumber } from "../lib/counter";

const router = Router();

// INVENTORY BALANCES
router.get("/inventory", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;
    const itemId = req.query.itemId as string;
    const warehouseId = req.query.warehouseId as string;
    const search = req.query.search as string;

    const conditions: any[] = [];
    if (itemId) conditions.push(eq(inventoryBalancesTable.itemId, itemId));
    if (warehouseId) conditions.push(eq(inventoryBalancesTable.warehouseId, warehouseId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db.select({
      id: inventoryBalancesTable.id,
      itemId: inventoryBalancesTable.itemId,
      itemNumber: itemsTable.number,
      itemName: itemsTable.name,
      warehouseId: inventoryBalancesTable.warehouseId,
      warehouseName: warehousesTable.name,
      location: inventoryBalancesTable.location,
      quantityOnHand: inventoryBalancesTable.quantityOnHand,
      quantityAllocated: inventoryBalancesTable.quantityAllocated,
      quantityOnOrder: inventoryBalancesTable.quantityOnOrder,
      uom: itemsTable.uom,
      updatedAt: inventoryBalancesTable.updatedAt,
    }).from(inventoryBalancesTable)
      .leftJoin(itemsTable, eq(inventoryBalancesTable.itemId, itemsTable.id))
      .leftJoin(warehousesTable, eq(inventoryBalancesTable.warehouseId, warehousesTable.id))
      .where(where).limit(limit).offset(offset);

    const countResult = await db.select({ count: sql<number>`count(*)` }).from(inventoryBalancesTable).where(where);
    const total = Number(countResult[0]?.count ?? 0);

    const enriched = data.map(b => ({
      ...b,
      quantityAvailable: (Number(b.quantityOnHand) - Number(b.quantityAllocated)).toFixed(6),
    }));

    res.json({ data: enriched, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// INVENTORY TRANSACTIONS
router.get("/inventory/transactions", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;
    const itemId = req.query.itemId as string;
    const where = itemId ? eq(inventoryTransactionsTable.itemId, itemId) : undefined;

    const data = await db.select({
      id: inventoryTransactionsTable.id,
      type: inventoryTransactionsTable.type,
      itemId: inventoryTransactionsTable.itemId,
      itemNumber: itemsTable.number,
      itemName: itemsTable.name,
      warehouseId: inventoryTransactionsTable.warehouseId,
      quantity: inventoryTransactionsTable.quantity,
      unitCost: inventoryTransactionsTable.unitCost,
      totalCost: inventoryTransactionsTable.totalCost,
      reference: inventoryTransactionsTable.reference,
      notes: inventoryTransactionsTable.notes,
      lotNumber: inventoryTransactionsTable.lotNumber,
      serialNumber: inventoryTransactionsTable.serialNumber,
      createdBy: inventoryTransactionsTable.createdBy,
      createdAt: inventoryTransactionsTable.createdAt,
    }).from(inventoryTransactionsTable)
      .leftJoin(itemsTable, eq(inventoryTransactionsTable.itemId, itemsTable.id))
      .where(where)
      .orderBy(sql`${inventoryTransactionsTable.createdAt} desc`)
      .limit(limit).offset(offset);

    const countResult = await db.select({ count: sql<number>`count(*)` }).from(inventoryTransactionsTable).where(where);
    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/inventory/transactions", async (req, res) => {
  try {
    const { type, itemId, warehouseId, quantity, unitCost, reference, notes, lotNumber, serialNumber } = req.body;
    const totalCost = unitCost ? (Number(quantity) * Number(unitCost)).toFixed(4) : null;

    const txn = await db.insert(inventoryTransactionsTable).values({
      type, itemId, warehouseId, quantity, unitCost, totalCost, reference, notes, lotNumber, serialNumber,
      createdBy: "system",
    }).returning();

    // Update balance
    const existing = await db.select().from(inventoryBalancesTable)
      .where(and(eq(inventoryBalancesTable.itemId, itemId), eq(inventoryBalancesTable.warehouseId, warehouseId)))
      .limit(1);

    const qty = Number(quantity);
    const multiplier = ["issue", "scrap", "transfer"].includes(type) ? -1 : 1;
    const delta = (qty * multiplier).toFixed(6);

    if (existing[0]) {
      await db.update(inventoryBalancesTable).set({
        quantityOnHand: sql`${inventoryBalancesTable.quantityOnHand} + ${delta}`,
        updatedAt: new Date(),
      }).where(eq(inventoryBalancesTable.id, existing[0].id));
    } else {
      await db.insert(inventoryBalancesTable).values({
        itemId, warehouseId,
        quantityOnHand: delta,
        quantityAllocated: "0",
        quantityOnOrder: "0",
      });
    }

    res.status(201).json(txn[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// WAREHOUSES
router.get("/inventory/warehouses", async (req, res) => {
  try {
    const data = await db.select().from(warehousesTable);
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/inventory/warehouses", async (req, res) => {
  try {
    const wh = await db.insert(warehousesTable).values(req.body).returning();
    res.status(201).json(wh[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

export default router;
