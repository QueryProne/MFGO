import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, vendorsTable, itemsTable, salesOrdersTable, purchaseOrdersTable, workOrdersTable, invoicesTable } from "@workspace/db";
import { ilike, or, sql } from "drizzle-orm";

const router = Router();

router.get("/search", async (req, res) => {
  try {
    const q = (req.query.q as string) ?? "";
    const limit = parseInt(req.query.limit as string) || 20;
    const entity = req.query.entity as string;

    if (!q.trim()) return res.json({ results: [], total: 0, query: q });

    // Support quick syntax: so:123, item:ABC, po:456
    let searchTerm = q;
    let forceEntity: string | null = null;
    const syntaxMatch = q.match(/^(so|po|wo|item|customer|vendor|invoice):(.+)/i);
    if (syntaxMatch) {
      const [, prefix, term] = syntaxMatch;
      searchTerm = term;
      const prefixMap: Record<string, string> = {
        so: "salesorder", po: "purchaseorder", wo: "workorder",
        item: "item", customer: "customer", vendor: "vendor", invoice: "invoice",
      };
      forceEntity = prefixMap[prefix.toLowerCase()] ?? null;
    }

    const results: any[] = [];
    const pat = `%${searchTerm}%`;

    if (!forceEntity || forceEntity === "customer") {
      const customers = await db.select({ id: customersTable.id, number: customersTable.number, name: customersTable.name, status: customersTable.status })
        .from(customersTable).where(or(ilike(customersTable.name, pat), ilike(customersTable.number, pat))).limit(5);
      customers.forEach(c => results.push({ entity: "customer", ...c, metadata: { type: "Customer" }, score: 1 }));
    }

    if (!forceEntity || forceEntity === "vendor") {
      const vendors = await db.select({ id: vendorsTable.id, number: vendorsTable.number, name: vendorsTable.name, status: vendorsTable.status })
        .from(vendorsTable).where(or(ilike(vendorsTable.name, pat), ilike(vendorsTable.number, pat))).limit(5);
      vendors.forEach(v => results.push({ entity: "vendor", ...v, metadata: { type: "Vendor" }, score: 1 }));
    }

    if (!forceEntity || forceEntity === "item") {
      const items = await db.select({ id: itemsTable.id, number: itemsTable.number, name: itemsTable.name, status: itemsTable.status })
        .from(itemsTable).where(or(ilike(itemsTable.name, pat), ilike(itemsTable.number, pat))).limit(5);
      items.forEach(i => results.push({ entity: "item", ...i, metadata: { type: "Item", itemType: i.status }, score: 1 }));
    }

    if (!forceEntity || forceEntity === "salesorder") {
      const orders = await db.select({ id: salesOrdersTable.id, number: salesOrdersTable.number, status: salesOrdersTable.status })
        .from(salesOrdersTable).where(ilike(salesOrdersTable.number, pat)).limit(5);
      orders.forEach(o => results.push({ entity: "salesorder", id: o.id, number: o.number, name: o.number, status: o.status, metadata: { type: "Sales Order" }, score: 1 }));
    }

    if (!forceEntity || forceEntity === "purchaseorder") {
      const pos = await db.select({ id: purchaseOrdersTable.id, number: purchaseOrdersTable.number, status: purchaseOrdersTable.status })
        .from(purchaseOrdersTable).where(ilike(purchaseOrdersTable.number, pat)).limit(5);
      pos.forEach(p => results.push({ entity: "purchaseorder", id: p.id, number: p.number, name: p.number, status: p.status, metadata: { type: "Purchase Order" }, score: 1 }));
    }

    if (!forceEntity || forceEntity === "workorder") {
      const wos = await db.select({ id: workOrdersTable.id, number: workOrdersTable.number, status: workOrdersTable.status })
        .from(workOrdersTable).where(ilike(workOrdersTable.number, pat)).limit(5);
      wos.forEach(w => results.push({ entity: "workorder", id: w.id, number: w.number, name: w.number, status: w.status, metadata: { type: "Work Order" }, score: 1 }));
    }

    if (!forceEntity || forceEntity === "invoice") {
      const invs = await db.select({ id: invoicesTable.id, number: invoicesTable.number, status: invoicesTable.status })
        .from(invoicesTable).where(ilike(invoicesTable.number, pat)).limit(5);
      invs.forEach(i => results.push({ entity: "invoice", id: i.id, number: i.number, name: i.number, status: i.status, metadata: { type: "Invoice" }, score: 1 }));
    }

    res.json({ results: results.slice(0, limit), total: results.length, query: q });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

export default router;
