import { Router } from "express";
import { db } from "@workspace/db";
import { shipmentsTable, shipmentLinesTable, invoicesTable, invoiceLinesTable, itemsTable, customersTable, salesOrdersTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { getNextNumber } from "../lib/counter";

const router = Router();

// SHIPMENTS
router.get("/shipments", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;
    const conditions: any[] = [];
    if (req.query.status) conditions.push(eq(shipmentsTable.status, req.query.status as string));
    if (req.query.salesOrderId) conditions.push(eq(shipmentsTable.salesOrderId, req.query.salesOrderId as string));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db.select({
      id: shipmentsTable.id, number: shipmentsTable.number,
      salesOrderId: shipmentsTable.salesOrderId, salesOrderNumber: salesOrdersTable.number,
      customerId: shipmentsTable.customerId, customerName: customersTable.name,
      status: shipmentsTable.status, shippedDate: shipmentsTable.shippedDate,
      carrier: shipmentsTable.carrier, trackingNumber: shipmentsTable.trackingNumber,
      notes: shipmentsTable.notes, createdAt: shipmentsTable.createdAt,
    }).from(shipmentsTable)
      .leftJoin(customersTable, eq(shipmentsTable.customerId, customersTable.id))
      .leftJoin(salesOrdersTable, eq(shipmentsTable.salesOrderId, salesOrdersTable.id))
      .where(where).limit(limit).offset(offset).orderBy(sql`${shipmentsTable.createdAt} desc`);

    const countResult = await db.select({ count: sql<number>`count(*)` }).from(shipmentsTable).where(where);
    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/shipments", async (req, res) => {
  try {
    const { salesOrderId, shippedDate, carrier, trackingNumber, shippingAddress, lines, warehouseId, notes } = req.body;
    const so = await db.select().from(salesOrdersTable).where(eq(salesOrdersTable.id, salesOrderId)).limit(1);
    if (!so[0]) return res.status(404).json({ error: "not_found", message: "Sales order not found" });

    const number = getNextNumber("SHP");
    const shipment = await db.insert(shipmentsTable).values({
      number, salesOrderId, customerId: so[0].customerId,
      shippedDate, carrier, trackingNumber, shippingAddress, warehouseId, notes,
    }).returning();

    if (lines?.length) {
      await db.insert(shipmentLinesTable).values(lines.map((l: any) => ({
        shipmentId: shipment[0].id, salesOrderLineId: l.salesOrderLineId,
        itemId: l.itemId, quantity: l.quantity,
        lotNumber: l.lotNumber, serialNumber: l.serialNumber,
      })));
    }

    const result = await getShipmentWithLines(shipment[0].id);
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.get("/shipments/:id", async (req, res) => {
  try {
    const result = await getShipmentWithLines(req.params.id);
    if (!result) return res.status(404).json({ error: "not_found", message: "Shipment not found" });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

async function getShipmentWithLines(id: string) {
  const shipment = await db.select({
    id: shipmentsTable.id, number: shipmentsTable.number,
    salesOrderId: shipmentsTable.salesOrderId, salesOrderNumber: salesOrdersTable.number,
    customerId: shipmentsTable.customerId, customerName: customersTable.name,
    status: shipmentsTable.status, shippedDate: shipmentsTable.shippedDate,
    carrier: shipmentsTable.carrier, trackingNumber: shipmentsTable.trackingNumber,
    shippingAddress: shipmentsTable.shippingAddress, warehouseId: shipmentsTable.warehouseId,
    notes: shipmentsTable.notes, createdAt: shipmentsTable.createdAt,
  }).from(shipmentsTable)
    .leftJoin(customersTable, eq(shipmentsTable.customerId, customersTable.id))
    .leftJoin(salesOrdersTable, eq(shipmentsTable.salesOrderId, salesOrdersTable.id))
    .where(eq(shipmentsTable.id, id)).limit(1);

  if (!shipment[0]) return null;
  const lines = await db.select({
    id: shipmentLinesTable.id, salesOrderLineId: shipmentLinesTable.salesOrderLineId,
    itemId: shipmentLinesTable.itemId, itemNumber: itemsTable.number,
    itemName: itemsTable.name, quantity: shipmentLinesTable.quantity,
    uom: shipmentLinesTable.uom, lotNumber: shipmentLinesTable.lotNumber,
    serialNumber: shipmentLinesTable.serialNumber,
  }).from(shipmentLinesTable)
    .leftJoin(itemsTable, eq(shipmentLinesTable.itemId, itemsTable.id))
    .where(eq(shipmentLinesTable.shipmentId, id));

  return { ...shipment[0], lines };
}

// INVOICES
router.get("/invoices", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;
    const conditions: any[] = [];
    if (req.query.status) conditions.push(eq(invoicesTable.status, req.query.status as string));
    if (req.query.customerId) conditions.push(eq(invoicesTable.customerId, req.query.customerId as string));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db.select({
      id: invoicesTable.id, number: invoicesTable.number,
      customerId: invoicesTable.customerId, customerName: customersTable.name,
      salesOrderId: invoicesTable.salesOrderId, salesOrderNumber: salesOrdersTable.number,
      shipmentId: invoicesTable.shipmentId, status: invoicesTable.status,
      invoiceDate: invoicesTable.invoiceDate, dueDate: invoicesTable.dueDate,
      totalAmount: invoicesTable.totalAmount, amountPaid: invoicesTable.amountPaid,
      notes: invoicesTable.notes, createdAt: invoicesTable.createdAt,
    }).from(invoicesTable)
      .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
      .leftJoin(salesOrdersTable, eq(invoicesTable.salesOrderId, salesOrdersTable.id))
      .where(where).limit(limit).offset(offset).orderBy(sql`${invoicesTable.createdAt} desc`);

    const countResult = await db.select({ count: sql<number>`count(*)` }).from(invoicesTable).where(where);
    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/invoices", async (req, res) => {
  try {
    const { customerId, salesOrderId, shipmentId, invoiceDate, dueDate, lines, paymentTerms, notes } = req.body;
    const number = getNextNumber("INV");
    const total = lines?.reduce((s: number, l: any) => s + Number(l.quantity) * Number(l.unitPrice), 0) ?? 0;

    const invoice = await db.insert(invoicesTable).values({
      customerId, salesOrderId, shipmentId, invoiceDate, dueDate,
      number, totalAmount: total.toFixed(2), subtotal: total.toFixed(2),
      paymentTerms, notes,
    }).returning();

    if (lines?.length) {
      await db.insert(invoiceLinesTable).values(lines.map((l: any, i: number) => ({
        invoiceId: invoice[0].id, lineNumber: i + 1,
        itemId: l.itemId, description: l.description,
        quantity: l.quantity, unitPrice: l.unitPrice,
        discount: l.discount ?? "0", taxRate: l.taxRate ?? "0",
        lineTotal: (Number(l.quantity) * Number(l.unitPrice)).toFixed(2),
      })));
    }

    const result = await getInvoiceWithLines(invoice[0].id);
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.get("/invoices/:id", async (req, res) => {
  try {
    const result = await getInvoiceWithLines(req.params.id);
    if (!result) return res.status(404).json({ error: "not_found", message: "Invoice not found" });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

async function getInvoiceWithLines(id: string) {
  const inv = await db.select({
    id: invoicesTable.id, number: invoicesTable.number,
    customerId: invoicesTable.customerId, customerName: customersTable.name,
    salesOrderId: invoicesTable.salesOrderId, salesOrderNumber: salesOrdersTable.number,
    shipmentId: invoicesTable.shipmentId, status: invoicesTable.status,
    invoiceDate: invoicesTable.invoiceDate, dueDate: invoicesTable.dueDate,
    subtotal: invoicesTable.subtotal, taxAmount: invoicesTable.taxAmount,
    totalAmount: invoicesTable.totalAmount, amountPaid: invoicesTable.amountPaid,
    paymentTerms: invoicesTable.paymentTerms, notes: invoicesTable.notes,
    createdAt: invoicesTable.createdAt,
  }).from(invoicesTable)
    .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
    .leftJoin(salesOrdersTable, eq(invoicesTable.salesOrderId, salesOrdersTable.id))
    .where(eq(invoicesTable.id, id)).limit(1);

  if (!inv[0]) return null;
  const lines = await db.select({
    id: invoiceLinesTable.id, itemId: invoiceLinesTable.itemId,
    itemNumber: itemsTable.number, description: invoiceLinesTable.description,
    quantity: invoiceLinesTable.quantity, unitPrice: invoiceLinesTable.unitPrice,
    discount: invoiceLinesTable.discount, taxRate: invoiceLinesTable.taxRate,
    lineTotal: invoiceLinesTable.lineTotal,
  }).from(invoiceLinesTable)
    .leftJoin(itemsTable, eq(invoiceLinesTable.itemId, itemsTable.id))
    .where(eq(invoiceLinesTable.invoiceId, id));

  return { ...inv[0], amountDue: (Number(inv[0].totalAmount) - Number(inv[0].amountPaid)).toFixed(2), lines };
}

export default router;
