import { Router } from "express";
import { db } from "@workspace/db";
import {
  quotesTable, quoteLinesTable, salesOrdersTable, salesOrderLinesTable, itemsTable,
  customersTable, workOrdersTable, serviceOrdersTable, bomsTable,
} from "@workspace/db";
import { eq, ilike, or, sql, and } from "drizzle-orm";
import { getNextNumber } from "../lib/counter";
import { auditLog } from "../lib/audit";

const router = Router();

// QUOTES
router.get("/quotes", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const status = req.query.status as string;
    const customerId = req.query.customerId as string;

    const conditions: any[] = [];
    if (search) conditions.push(or(ilike(quotesTable.number, `%${search}%`)));
    if (status) conditions.push(eq(quotesTable.status, status));
    if (customerId) conditions.push(eq(quotesTable.customerId, customerId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db.select({
      id: quotesTable.id, number: quotesTable.number,
      customerId: quotesTable.customerId, customerName: customersTable.name,
      status: quotesTable.status, quoteDate: quotesTable.quoteDate,
      expiryDate: quotesTable.expiryDate, totalAmount: quotesTable.totalAmount,
      notes: quotesTable.notes, createdAt: quotesTable.createdAt, updatedAt: quotesTable.updatedAt,
    }).from(quotesTable).leftJoin(customersTable, eq(quotesTable.customerId, customersTable.id))
      .where(where).limit(limit).offset(offset).orderBy(sql`${quotesTable.createdAt} desc`);

    const countResult = await db.select({ count: sql<number>`count(*)` }).from(quotesTable).where(where);
    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/quotes", async (req, res) => {
  try {
    const { customerId, quoteDate, expiryDate, lines, notes, terms } = req.body;
    const number = getNextNumber("Q");
    const quote = await db.insert(quotesTable).values({ customerId, number, quoteDate, expiryDate, notes, terms }).returning();

    if (lines?.length) {
      await db.insert(quoteLinesTable).values(lines.map((l: any, i: number) => ({
        quoteId: quote[0].id, lineNumber: i + 1,
        itemId: l.itemId, description: l.description,
        quantity: l.quantity, unitPrice: l.unitPrice,
        discount: l.discount ?? "0",
        lineTotal: (Number(l.quantity) * Number(l.unitPrice) * (1 - Number(l.discount ?? 0) / 100)).toFixed(2),
        requestedDate: l.requestedDate, notes: l.notes,
      })));
      const lineTotal = lines.reduce((s: number, l: any) => s + Number(l.quantity) * Number(l.unitPrice), 0);
      await db.update(quotesTable).set({ subtotal: lineTotal.toFixed(2), totalAmount: lineTotal.toFixed(2) }).where(eq(quotesTable.id, quote[0].id));
    }
    const result = await getQuoteWithLines(quote[0].id);
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.get("/quotes/:id", async (req, res) => {
  try {
    const result = await getQuoteWithLines(req.params.id);
    if (!result) return res.status(404).json({ error: "not_found", message: "Quote not found" });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.put("/quotes/:id", async (req, res) => {
  try {
    await db.update(quotesTable).set({ ...req.body, updatedAt: new Date() }).where(eq(quotesTable.id, req.params.id));
    const result = await getQuoteWithLines(req.params.id);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/quotes/:id/convert", async (req, res) => {
  try {
    const quote = await getQuoteWithLines(req.params.id);
    if (!quote) return res.status(404).json({ error: "not_found", message: "Quote not found" });

    const soNumber = getNextNumber("SO");
    const so = await db.insert(salesOrdersTable).values({
      number: soNumber,
      customerId: quote.customerId,
      quoteId: quote.id,
      status: "confirmed",
      orderDate: new Date().toISOString().split("T")[0],
      subtotal: quote.subtotal,
      taxAmount: quote.taxAmount,
      totalAmount: quote.totalAmount,
      notes: quote.notes,
      terms: quote.terms,
    }).returning();

    if ((quote as any).lines?.length) {
      await db.insert(salesOrderLinesTable).values((quote as any).lines.map((l: any, i: number) => ({
        salesOrderId: so[0].id, lineNumber: i + 1,
        itemId: l.itemId, description: l.description,
        quantity: l.quantity, unitPrice: l.unitPrice,
        discount: l.discount, lineTotal: l.lineTotal,
        requestedDate: l.requestedDate, notes: l.notes,
      })));
    }

    await db.update(quotesTable).set({ status: "converted" }).where(eq(quotesTable.id, req.params.id));
    const result = await getSalesOrderWithLines(so[0].id);
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

async function getQuoteWithLines(id: string) {
  const quote = await db.select({
    id: quotesTable.id, number: quotesTable.number,
    customerId: quotesTable.customerId, customerName: customersTable.name,
    status: quotesTable.status, quoteDate: quotesTable.quoteDate,
    expiryDate: quotesTable.expiryDate, subtotal: quotesTable.subtotal,
    taxAmount: quotesTable.taxAmount, totalAmount: quotesTable.totalAmount,
    notes: quotesTable.notes, terms: quotesTable.terms,
    createdAt: quotesTable.createdAt, updatedAt: quotesTable.updatedAt,
  }).from(quotesTable).leftJoin(customersTable, eq(quotesTable.customerId, customersTable.id)).where(eq(quotesTable.id, id)).limit(1);

  if (!quote[0]) return null;
  const lines = await db.select({
    id: quoteLinesTable.id, lineNumber: quoteLinesTable.lineNumber,
    itemId: quoteLinesTable.itemId, itemNumber: itemsTable.number,
    itemName: itemsTable.name, description: quoteLinesTable.description,
    quantity: quoteLinesTable.quantity, uom: quoteLinesTable.uom,
    unitPrice: quoteLinesTable.unitPrice, discount: quoteLinesTable.discount,
    lineTotal: quoteLinesTable.lineTotal, requestedDate: quoteLinesTable.requestedDate,
    notes: quoteLinesTable.notes,
  }).from(quoteLinesTable).leftJoin(itemsTable, eq(quoteLinesTable.itemId, itemsTable.id)).where(eq(quoteLinesTable.quoteId, id));

  return { ...quote[0], lines };
}

// SALES ORDERS
router.get("/salesorders", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const status = req.query.status as string;
    const customerId = req.query.customerId as string;

    const conditions: any[] = [];
    if (search) conditions.push(ilike(salesOrdersTable.number, `%${search}%`));
    if (status) conditions.push(eq(salesOrdersTable.status, status));
    if (customerId) conditions.push(eq(salesOrdersTable.customerId, customerId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db.select({
      id: salesOrdersTable.id, number: salesOrdersTable.number,
      customerId: salesOrdersTable.customerId, customerName: customersTable.name,
      status: salesOrdersTable.status, orderDate: salesOrdersTable.orderDate,
      requestedDate: salesOrdersTable.requestedDate, promisedDate: salesOrdersTable.promisedDate,
      totalAmount: salesOrdersTable.totalAmount, notes: salesOrdersTable.notes,
      createdAt: salesOrdersTable.createdAt, updatedAt: salesOrdersTable.updatedAt,
    }).from(salesOrdersTable).leftJoin(customersTable, eq(salesOrdersTable.customerId, customersTable.id))
      .where(where).limit(limit).offset(offset).orderBy(sql`${salesOrdersTable.createdAt} desc`);

    const countResult = await db.select({ count: sql<number>`count(*)` }).from(salesOrdersTable).where(where);
    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/salesorders", async (req, res) => {
  try {
    const { customerId, orderDate, requestedDate, lines, shippingAddress, notes, terms } = req.body;
    const number = getNextNumber("SO");
    const so = await db.insert(salesOrdersTable).values({ customerId, number, orderDate, requestedDate, shippingAddress, notes, terms, status: "draft" }).returning();

    if (lines?.length) {
      await db.insert(salesOrderLinesTable).values(lines.map((l: any, i: number) => ({
        salesOrderId: so[0].id, lineNumber: i + 1,
        itemId: l.itemId, quantity: l.quantity,
        unitPrice: l.unitPrice, discount: l.discount ?? "0",
        lineTotal: (Number(l.quantity) * Number(l.unitPrice)).toFixed(2),
        requestedDate: l.requestedDate, notes: l.notes,
      })));
      const total = lines.reduce((s: number, l: any) => s + Number(l.quantity) * Number(l.unitPrice), 0);
      await db.update(salesOrdersTable).set({ totalAmount: total.toFixed(2), subtotal: total.toFixed(2) }).where(eq(salesOrdersTable.id, so[0].id));
    }
    const result = await getSalesOrderWithLines(so[0].id);
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.get("/salesorders/:id", async (req, res) => {
  try {
    const result = await getSalesOrderWithLines(req.params.id);
    if (!result) return res.status(404).json({ error: "not_found", message: "Sales order not found" });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.put("/salesorders/:id", async (req, res) => {
  try {
    await db.update(salesOrdersTable).set({ ...req.body, updatedAt: new Date() }).where(eq(salesOrdersTable.id, req.params.id));
    const result = await getSalesOrderWithLines(req.params.id);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// SALES ORDER CONVERSION (convert lines to work orders / service orders)
router.post("/salesorders/:id/convert-to-downstream", async (req, res) => {
  try {
    const { lineConversions, warehouseId } = req.body;
    // lineConversions: [{ salesOrderLineId, mode: 'work_order'|'service_order'|'both'|'none' }]

    const so = await getSalesOrderWithLines(req.params.id);
    if (!so) return res.status(404).json({ error: "not_found", message: "Sales order not found" });

    const results: any[] = [];

    for (const conv of (lineConversions ?? [])) {
      const line = so.lines.find((l: any) => l.id === conv.salesOrderLineId);
      if (!line || conv.mode === "none") continue;

      const item = await db.select().from(itemsTable).where(eq(itemsTable.id, line.itemId)).limit(1);
      const itm = item[0];
      if (!itm) continue;

      const createWO = conv.mode === "work_order" || conv.mode === "both"
        || (conv.mode === undefined && itm.supplyType === "manufactured");
      const createSVC = conv.mode === "service_order" || conv.mode === "both"
        || (conv.mode === undefined && itm.supplyType === "service");

      if (createWO) {
        // Find BOM
        const bom = await db.select().from(bomsTable)
          .where(and(eq(bomsTable.itemId, line.itemId), eq(bomsTable.status, "active"))).limit(1);

        const wo = await db.insert(workOrdersTable).values({
          number: getNextNumber("WO"),
          itemId: line.itemId,
          bomId: bom[0]?.id ?? null,
          salesOrderId: req.params.id,
          salesOrderLineId: line.id,
          status: "draft",
          type: "standard",
          quantityOrdered: line.quantity,
          scheduledEnd: line.requestedDate ?? line.promisedDate,
          warehouseId: warehouseId ?? null,
          priority: "normal",
          notes: `Converted from ${so.number} line ${line.lineNumber}`,
        }).returning();

        await auditLog({ entity: "work_order", entityId: wo[0].id, action: "create",
          fieldChanges: { source: "so_conversion", salesOrderId: req.params.id, salesOrderLineId: line.id } }, req);

        results.push({ type: "work_order", lineId: line.id, record: wo[0] });
      }

      if (createSVC) {
        const svc = await db.insert(serviceOrdersTable).values({
          number: getNextNumber("SVC"),
          salesOrderId: req.params.id,
          salesOrderLineId: line.id,
          customerId: so.customerId,
          itemId: line.itemId,
          serviceType: "standard",
          status: "draft",
          requestedDate: line.requestedDate,
          notes: `Converted from ${so.number} line ${line.lineNumber}`,
        }).returning();

        await auditLog({ entity: "service_order", entityId: svc[0].id, action: "create",
          fieldChanges: { source: "so_conversion", salesOrderId: req.params.id, salesOrderLineId: line.id } }, req);

        results.push({ type: "service_order", lineId: line.id, record: svc[0] });
      }
    }

    await auditLog({ entity: "sales_order", entityId: req.params.id, action: "convert",
      fieldChanges: { convertedLines: results.length, results: results.map(r => ({ type: r.type, number: r.record.number })) } }, req);

    res.status(201).json({ salesOrderId: req.params.id, results });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

async function getSalesOrderWithLines(id: string) {
  const so = await db.select({
    id: salesOrdersTable.id, number: salesOrdersTable.number,
    customerId: salesOrdersTable.customerId, customerName: customersTable.name,
    status: salesOrdersTable.status, orderDate: salesOrdersTable.orderDate,
    requestedDate: salesOrdersTable.requestedDate, promisedDate: salesOrdersTable.promisedDate,
    subtotal: salesOrdersTable.subtotal, taxAmount: salesOrdersTable.taxAmount,
    totalAmount: salesOrdersTable.totalAmount, shippingAddress: salesOrdersTable.shippingAddress,
    notes: salesOrdersTable.notes, terms: salesOrdersTable.terms,
    quoteId: salesOrdersTable.quoteId, createdAt: salesOrdersTable.createdAt,
    updatedAt: salesOrdersTable.updatedAt,
  }).from(salesOrdersTable).leftJoin(customersTable, eq(salesOrdersTable.customerId, customersTable.id)).where(eq(salesOrdersTable.id, id)).limit(1);

  if (!so[0]) return null;
  const lines = await db.select({
    id: salesOrderLinesTable.id, lineNumber: salesOrderLinesTable.lineNumber,
    itemId: salesOrderLinesTable.itemId, itemNumber: itemsTable.number,
    itemName: itemsTable.name, description: salesOrderLinesTable.description,
    quantity: salesOrderLinesTable.quantity, uom: salesOrderLinesTable.uom,
    unitPrice: salesOrderLinesTable.unitPrice, discount: salesOrderLinesTable.discount,
    lineTotal: salesOrderLinesTable.lineTotal, requestedDate: salesOrderLinesTable.requestedDate,
    promisedDate: salesOrderLinesTable.promisedDate, notes: salesOrderLinesTable.notes,
  }).from(salesOrderLinesTable).leftJoin(itemsTable, eq(salesOrderLinesTable.itemId, itemsTable.id)).where(eq(salesOrderLinesTable.salesOrderId, id));

  return { ...so[0], lines };
}

export default router;
