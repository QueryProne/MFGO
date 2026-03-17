import { Router } from "express";
import { db } from "@workspace/db";
import {
  receiptsTable, receiptLinesTable, purchaseOrdersTable, purchaseOrderLinesTable,
  vendorsTable, itemsTable, warehousesTable, stockLocationsTable, binsTable,
} from "@workspace/db";
import { eq, ilike, or, sql, and, desc } from "drizzle-orm";
import { getNextNumber } from "../lib/counter";

const router = Router();

// ─── RECEIPTS LIST ────────────────────────────────────────────────────────────
router.get("/receiving", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const status = req.query.status as string;

    const conditions: any[] = [];
    if (status) conditions.push(eq(receiptsTable.status, status));
    if (search) conditions.push(or(ilike(receiptsTable.number, `%${search}%`), ilike(receiptsTable.packingSlipNumber, `%${search}%`)));

    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const [data, countResult] = await Promise.all([
      db.select({
        receipt: receiptsTable,
        vendor: { id: vendorsTable.id, name: vendorsTable.name, number: vendorsTable.number },
      })
        .from(receiptsTable)
        .leftJoin(vendorsTable, eq(receiptsTable.vendorId, vendorsTable.id))
        .where(where)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(receiptsTable.createdAt)),
      db.select({ count: sql<number>`count(*)` }).from(receiptsTable).where(where),
    ]);

    const enriched = await Promise.all(
      data.map(async (row) => {
        const lines = await db.select({ count: sql<number>`count(*)` }).from(receiptLinesTable).where(eq(receiptLinesTable.receiptId, row.receipt.id));
        return { ...row.receipt, vendorName: row.vendor?.name, vendorNumber: row.vendor?.number, lineCount: Number(lines[0]?.count ?? 0) };
      })
    );

    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data: enriched, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// ─── SINGLE RECEIPT ───────────────────────────────────────────────────────────
router.get("/receiving/:id", async (req, res) => {
  try {
    const receipt = await db.select().from(receiptsTable).where(eq(receiptsTable.id, req.params.id)).limit(1);
    if (!receipt[0]) return res.status(404).json({ error: "not_found", message: "Receipt not found" });

    const [lines, vendor, po] = await Promise.all([
      db.select({
        line: receiptLinesTable,
        item: { id: itemsTable.id, number: itemsTable.number, name: itemsTable.name, uom: itemsTable.uom },
      })
        .from(receiptLinesTable)
        .leftJoin(itemsTable, eq(receiptLinesTable.itemId, itemsTable.id))
        .where(eq(receiptLinesTable.receiptId, receipt[0].id))
        .orderBy(receiptLinesTable.lineNumber),
      receipt[0].vendorId ? db.select().from(vendorsTable).where(eq(vendorsTable.id, receipt[0].vendorId)).limit(1) : Promise.resolve([]),
      receipt[0].purchaseOrderId ? db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, receipt[0].purchaseOrderId)).limit(1) : Promise.resolve([]),
    ]);

    const formattedLines = lines.map(r => ({ ...r.line, itemNumber: r.item?.number, itemName: r.item?.name, itemUom: r.item?.uom }));

    res.json({ ...receipt[0], vendor: (vendor as any[])[0] ?? null, purchaseOrder: (po as any[])[0] ?? null, lines: formattedLines });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// ─── CREATE RECEIPT ───────────────────────────────────────────────────────────
router.post("/receiving", async (req, res) => {
  try {
    const number = getNextNumber("RCV");
    const { lines, ...receiptData } = req.body;
    const [receipt] = await db.insert(receiptsTable).values({ ...receiptData, number }).returning();

    if (lines && Array.isArray(lines) && lines.length > 0) {
      const linesWithReceiptId = lines.map((l: any, i: number) => ({
        ...l,
        receiptId: receipt.id,
        lineNumber: i + 1,
      }));
      await db.insert(receiptLinesTable).values(linesWithReceiptId);
    }

    res.status(201).json(receipt);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// ─── UPDATE RECEIPT ───────────────────────────────────────────────────────────
router.put("/receiving/:id", async (req, res) => {
  try {
    const { lines, ...receiptData } = req.body;
    const [updated] = await db.update(receiptsTable).set({ ...receiptData, updatedAt: new Date() }).where(eq(receiptsTable.id, req.params.id)).returning();
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// ─── CONFIRM RECEIPT (post & update PO quantities) ────────────────────────────
router.post("/receiving/:id/confirm", async (req, res) => {
  try {
    const receipt = await db.select().from(receiptsTable).where(eq(receiptsTable.id, req.params.id)).limit(1);
    if (!receipt[0]) return res.status(404).json({ error: "not_found", message: "Receipt not found" });
    if (receipt[0].status === "confirmed") return res.status(400).json({ error: "already_confirmed", message: "Receipt already confirmed" });

    const lines = await db.select().from(receiptLinesTable).where(eq(receiptLinesTable.receiptId, req.params.id));

    // Update PO lines with received quantities
    for (const line of lines) {
      if (line.purchaseOrderLineId) {
        const [poLine] = await db.select().from(purchaseOrderLinesTable).where(eq(purchaseOrderLinesTable.id, line.purchaseOrderLineId));
        if (poLine) {
          const newReceived = Number(poLine.quantityReceived ?? 0) + Number(line.acceptedQty);
          await db.update(purchaseOrderLinesTable)
            .set({ quantityReceived: String(newReceived) })
            .where(eq(purchaseOrderLinesTable.id, poLine.id));
        }
      }
      await db.update(receiptLinesTable).set({ receiptStatus: "accepted" }).where(eq(receiptLinesTable.id, line.id));
    }

    const [updated] = await db.update(receiptsTable)
      .set({ status: "confirmed", updatedAt: new Date() })
      .where(eq(receiptsTable.id, req.params.id))
      .returning();

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// ─── RECEIPT LINES (standalone) ───────────────────────────────────────────────
router.post("/receiving/:id/lines", async (req, res) => {
  try {
    const lines = await db.select().from(receiptLinesTable).where(eq(receiptLinesTable.receiptId, req.params.id)).orderBy(receiptLinesTable.lineNumber);
    const nextLine = (lines.at(-1)?.lineNumber ?? 0) + 1;
    const [line] = await db.insert(receiptLinesTable).values({ ...req.body, receiptId: req.params.id, lineNumber: nextLine }).returning();
    res.status(201).json(line);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.put("/receiving/:id/lines/:lineId", async (req, res) => {
  try {
    const [updated] = await db.update(receiptLinesTable).set(req.body).where(eq(receiptLinesTable.id, req.params.lineId)).returning();
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// ─── WAREHOUSES & STOCK LOCATIONS for receiving UI ────────────────────────────
router.get("/warehouses", async (req, res) => {
  try {
    const data = await db.select().from(warehousesTable).orderBy(warehousesTable.code);
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.get("/stock-locations", async (req, res) => {
  try {
    const warehouseId = req.query.warehouseId as string;
    const where = warehouseId ? eq(stockLocationsTable.warehouseId, warehouseId) : undefined;
    const data = await db.select().from(stockLocationsTable).where(where).orderBy(stockLocationsTable.code);
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.get("/bins", async (req, res) => {
  try {
    const stockLocationId = req.query.stockLocationId as string;
    const warehouseId = req.query.warehouseId as string;
    const where = stockLocationId
      ? eq(binsTable.stockLocationId, stockLocationId)
      : warehouseId ? eq(binsTable.warehouseId, warehouseId) : undefined;
    const data = await db.select().from(binsTable).where(where).orderBy(binsTable.code);
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// ─── INVENTORY LOTS & SERIALS for receiving/items ─────────────────────────────
router.get("/inventory-lots", async (req, res) => {
  try {
    const { inventoryLotsTable } = await import("@workspace/db");
    const itemId = req.query.itemId as string;
    const where = itemId ? eq(inventoryLotsTable.itemId, itemId) : undefined;
    const data = await db.select().from(inventoryLotsTable).where(where).orderBy(desc(inventoryLotsTable.createdAt));
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.get("/inventory-serials", async (req, res) => {
  try {
    const { inventorySerialsTable } = await import("@workspace/db");
    const itemId = req.query.itemId as string;
    const where = itemId ? eq(inventorySerialsTable.itemId, itemId) : undefined;
    const data = await db.select().from(inventorySerialsTable).where(where).orderBy(desc(inventorySerialsTable.createdAt));
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

export default router;
