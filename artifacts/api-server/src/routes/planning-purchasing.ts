import { Router } from "express";
import { db } from "@workspace/db";
import {
  mrpRunsTable, mrpRecommendationsTable, itemsTable, inventoryBalancesTable,
  salesOrdersTable, salesOrderLinesTable, purchaseOrdersTable, purchaseOrderLinesTable,
  workOrdersTable, itemVendorsTable, vendorsTable,
} from "@workspace/db";
import { eq, sql, and, or, ilike, inArray } from "drizzle-orm";
import { getNextNumber } from "../lib/counter";
import { auditLog } from "../lib/audit";

const router = Router();

// ─── WORKBENCH ────────────────────────────────────────────────────────────────
router.get("/planning-purchasing/workbench", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const filterType = req.query.type as string;
    const filterStatus = req.query.status as string;
    const filterItemId = req.query.itemId as string;
    const filterVendorId = req.query.vendorId as string;

    const latestRun = await db.select().from(mrpRunsTable)
      .where(eq(mrpRunsTable.status, "complete"))
      .orderBy(sql`${mrpRunsTable.completedAt} desc`)
      .limit(1);

    if (!latestRun[0]) {
      return res.json({ data: [], meta: { page, limit, total: 0, totalPages: 0 }, latestRun: null });
    }

    const conditions: any[] = [eq(mrpRecommendationsTable.runId, latestRun[0].id)];
    if (filterType) conditions.push(eq(mrpRecommendationsTable.type, filterType));
    if (filterStatus) conditions.push(eq(mrpRecommendationsTable.status, filterStatus));
    if (filterItemId) conditions.push(eq(mrpRecommendationsTable.itemId, filterItemId));
    if (filterVendorId) conditions.push(eq(mrpRecommendationsTable.vendorId, filterVendorId));
    const where = and(...conditions);

    const recs = await db.select({
      id: mrpRecommendationsTable.id,
      runId: mrpRecommendationsTable.runId,
      type: mrpRecommendationsTable.type,
      itemId: mrpRecommendationsTable.itemId,
      itemNumber: itemsTable.number,
      itemName: itemsTable.name,
      supplyType: itemsTable.supplyType,
      quantity: mrpRecommendationsTable.quantity,
      neededDate: mrpRecommendationsTable.neededDate,
      vendorId: mrpRecommendationsTable.vendorId,
      priority: mrpRecommendationsTable.priority,
      message: mrpRecommendationsTable.message,
      status: mrpRecommendationsTable.status,
      salesOrderId: mrpRecommendationsTable.salesOrderId,
      salesOrderLineId: mrpRecommendationsTable.salesOrderLineId,
      parentWorkOrderId: mrpRecommendationsTable.parentWorkOrderId,
      peggingContext: mrpRecommendationsTable.peggingContext,
      vendorException: mrpRecommendationsTable.vendorException,
      releasedPurchaseOrderId: mrpRecommendationsTable.releasedPurchaseOrderId,
      releasedWorkOrderId: mrpRecommendationsTable.releasedWorkOrderId,
      releasedAt: mrpRecommendationsTable.releasedAt,
    }).from(mrpRecommendationsTable)
      .leftJoin(itemsTable, eq(mrpRecommendationsTable.itemId, itemsTable.id))
      .where(where)
      .orderBy(
        sql`CASE WHEN ${mrpRecommendationsTable.priority} = 'urgent' THEN 0 WHEN ${mrpRecommendationsTable.priority} = 'high' THEN 1 ELSE 2 END`,
        sql`${mrpRecommendationsTable.neededDate} asc nulls last`
      )
      .limit(limit).offset(offset);

    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(mrpRecommendationsTable).where(where);
    const total = Number(countResult[0]?.count ?? 0);

    // Enrich with inventory and preferred vendor info
    const itemIds = [...new Set(recs.map(r => r.itemId))];
    let balanceMap: Record<string, { onHand: number; allocated: number; onOrder: number }> = {};
    let preferredVendorMap: Record<string, { vendorId: string; vendorName: string; leadTimeDays: number | null }> = {};

    if (itemIds.length > 0) {
      const balances = await db.select({
        itemId: inventoryBalancesTable.itemId,
        onHand: inventoryBalancesTable.quantityOnHand,
        allocated: inventoryBalancesTable.quantityAllocated,
        onOrder: inventoryBalancesTable.quantityOnOrder,
      }).from(inventoryBalancesTable).where(inArray(inventoryBalancesTable.itemId, itemIds));

      for (const b of balances) {
        if (!balanceMap[b.itemId]) balanceMap[b.itemId] = { onHand: 0, allocated: 0, onOrder: 0 };
        balanceMap[b.itemId].onHand += Number(b.onHand ?? 0);
        balanceMap[b.itemId].allocated += Number(b.allocated ?? 0);
        balanceMap[b.itemId].onOrder += Number(b.onOrder ?? 0);
      }

      const prefVendors = await db.select({
        itemId: itemVendorsTable.itemId,
        vendorId: itemVendorsTable.vendorId,
        vendorName: vendorsTable.name,
        leadTimeDays: itemVendorsTable.leadTimeDays,
      }).from(itemVendorsTable)
        .leftJoin(vendorsTable, eq(itemVendorsTable.vendorId, vendorsTable.id))
        .where(and(inArray(itemVendorsTable.itemId, itemIds), eq(itemVendorsTable.isPreferred, true)));

      for (const pv of prefVendors) {
        preferredVendorMap[pv.itemId] = {
          vendorId: pv.vendorId,
          vendorName: pv.vendorName ?? "",
          leadTimeDays: pv.leadTimeDays,
        };
      }
    }

    const enriched = recs.map(r => {
      const bal = balanceMap[r.itemId] ?? { onHand: 0, allocated: 0, onOrder: 0 };
      const pv = preferredVendorMap[r.itemId];
      const suggestedQty = Number(r.quantity);
      const shortage = Math.max(0, suggestedQty - bal.onHand - bal.onOrder);
      return {
        ...r,
        currentOnHand: bal.onHand,
        currentAllocated: bal.allocated,
        currentOnOrder: bal.onOrder,
        currentAvailable: bal.onHand - bal.allocated,
        shortageQty: shortage,
        preferredVendorId: pv?.vendorId ?? r.vendorId ?? null,
        preferredVendorName: pv?.vendorName ?? null,
        preferredVendorLeadDays: pv?.leadTimeDays ?? null,
        vendorMissing: r.type === "planned_po" && !pv && !r.vendorId,
      };
    });

    res.json({ data: enriched, meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, latestRun: latestRun[0] });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// ─── RELEASE RECOMMENDATION TO PO OR WO ──────────────────────────────────────
router.post("/planning-purchasing/release", async (req, res) => {
  try {
    const { recommendationId, releaseType, vendorId } = req.body;

    const rec = await db.select().from(mrpRecommendationsTable)
      .where(eq(mrpRecommendationsTable.id, recommendationId)).limit(1);
    if (!rec[0]) return res.status(404).json({ error: "not_found", message: "Recommendation not found" });
    if (rec[0].status === "released") return res.status(400).json({ error: "already_released", message: "Recommendation already released" });

    const item = await db.select().from(itemsTable).where(eq(itemsTable.id, rec[0].itemId)).limit(1);
    const qty = Number(rec[0].quantity);
    const type = releaseType ?? (rec[0].type === "planned_po" ? "po" : "wo");

    if (type === "po") {
      const effectiveVendorId = vendorId ?? rec[0].vendorId;
      if (!effectiveVendorId) return res.status(400).json({ error: "vendor_required", message: "vendorId required to release a PO" });

      const vendor = await db.select().from(vendorsTable).where(eq(vendorsTable.id, effectiveVendorId)).limit(1);
      const po = await db.insert(purchaseOrdersTable).values({
        number: getNextNumber("PO"),
        vendorId: effectiveVendorId,
        status: "draft",
        orderDate: new Date().toISOString().split("T")[0],
        subtotal: (qty * Number(item[0]?.standardCost ?? 0)).toFixed(2),
        totalAmount: (qty * Number(item[0]?.standardCost ?? 0)).toFixed(2),
        notes: `Released from MRP recommendation ${recommendationId}`,
      }).returning();

      await db.insert(purchaseOrderLinesTable).values({
        purchaseOrderId: po[0].id,
        lineNumber: 1,
        itemId: rec[0].itemId,
        quantity: qty.toString(),
        unitCost: (item[0]?.standardCost ?? "0").toString(),
        lineTotal: (qty * Number(item[0]?.standardCost ?? 0)).toFixed(2),
        requestedDate: rec[0].neededDate,
        mrpRecommendationId: recommendationId,
      });

      await db.update(mrpRecommendationsTable).set({
        status: "released",
        releasedPurchaseOrderId: po[0].id,
        releasedAt: new Date(),
      }).where(eq(mrpRecommendationsTable.id, recommendationId));

      await auditLog({ entity: "mrp_recommendation", entityId: recommendationId,
        action: "release_to_po", fieldChanges: { poId: po[0].id, poNumber: po[0].number } }, req);

      return res.status(201).json({ type: "po", record: po[0], recommendationId });
    }

    if (type === "wo") {
      const wo = await db.insert(workOrdersTable).values({
        number: getNextNumber("WO"),
        itemId: rec[0].itemId,
        status: "draft",
        type: "standard",
        quantityOrdered: qty.toString(),
        scheduledEnd: rec[0].neededDate,
        priority: rec[0].priority ?? "normal",
        notes: `Released from MRP recommendation ${recommendationId}`,
      }).returning();

      await db.update(mrpRecommendationsTable).set({
        status: "released",
        releasedWorkOrderId: wo[0].id,
        releasedAt: new Date(),
      }).where(eq(mrpRecommendationsTable.id, recommendationId));

      await auditLog({ entity: "mrp_recommendation", entityId: recommendationId,
        action: "release_to_wo", fieldChanges: { woId: wo[0].id, woNumber: wo[0].number } }, req);

      return res.status(201).json({ type: "wo", record: wo[0], recommendationId });
    }

    res.status(400).json({ error: "invalid_release_type", message: "releaseType must be 'po' or 'wo'" });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// ─── EXCEPTIONS ───────────────────────────────────────────────────────────────
router.get("/planning-purchasing/exceptions", async (req, res) => {
  try {
    const latestRun = await db.select().from(mrpRunsTable)
      .where(eq(mrpRunsTable.status, "complete"))
      .orderBy(sql`${mrpRunsTable.completedAt} desc`).limit(1);

    if (!latestRun[0]) return res.json({ data: [] });

    const exceptions = await db.select({
      id: mrpRecommendationsTable.id,
      type: mrpRecommendationsTable.type,
      itemNumber: itemsTable.number,
      itemName: itemsTable.name,
      vendorException: mrpRecommendationsTable.vendorException,
      message: mrpRecommendationsTable.message,
      priority: mrpRecommendationsTable.priority,
      neededDate: mrpRecommendationsTable.neededDate,
    }).from(mrpRecommendationsTable)
      .leftJoin(itemsTable, eq(mrpRecommendationsTable.itemId, itemsTable.id))
      .where(and(
        eq(mrpRecommendationsTable.runId, latestRun[0].id),
        eq(mrpRecommendationsTable.status, "open"),
      ))
      .orderBy(sql`CASE WHEN ${mrpRecommendationsTable.priority} = 'urgent' THEN 0 ELSE 1 END`);

    res.json({ data: exceptions, latestRun: latestRun[0] });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// ─── MRP RUNS ────────────────────────────────────────────────────────────────
router.get("/mrp/runs", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;
    const data = await db.select().from(mrpRunsTable).orderBy(sql`${mrpRunsTable.createdAt} desc`).limit(limit).offset(offset);
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(mrpRunsTable);
    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/mrp/runs", async (req, res) => {
  try {
    const { type, planningHorizon } = req.body;
    const run = await db.insert(mrpRunsTable).values({
      type: type ?? "full_regen",
      planningHorizon: planningHorizon ?? 90,
      status: "running",
      startedAt: new Date(),
    }).returning();

    setTimeout(async () => {
      try { await runEnhancedMrp(run[0].id, planningHorizon ?? 90); } catch {}
    }, 100);

    res.status(201).json(run[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.get("/mrp/runs/:id", async (req, res) => {
  try {
    const run = await db.select().from(mrpRunsTable).where(eq(mrpRunsTable.id, req.params.id)).limit(1);
    if (!run[0]) return res.status(404).json({ error: "not_found", message: "MRP run not found" });
    res.json(run[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.get("/mrp/recommendations", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;
    const conditions: any[] = [];
    if (req.query.runId) conditions.push(eq(mrpRecommendationsTable.runId, req.query.runId as string));
    if (req.query.type) conditions.push(eq(mrpRecommendationsTable.type, req.query.type as string));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db.select({
      id: mrpRecommendationsTable.id, runId: mrpRecommendationsTable.runId,
      type: mrpRecommendationsTable.type, itemId: mrpRecommendationsTable.itemId,
      itemNumber: itemsTable.number, itemName: itemsTable.name,
      quantity: mrpRecommendationsTable.quantity, neededDate: mrpRecommendationsTable.neededDate,
      vendorId: mrpRecommendationsTable.vendorId, priority: mrpRecommendationsTable.priority,
      message: mrpRecommendationsTable.message, status: mrpRecommendationsTable.status,
    }).from(mrpRecommendationsTable)
      .leftJoin(itemsTable, eq(mrpRecommendationsTable.itemId, itemsTable.id))
      .where(where).limit(limit).offset(offset);

    const countResult = await db.select({ count: sql<number>`count(*)` }).from(mrpRecommendationsTable).where(where);
    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// Planning scenarios
router.get("/planning/scenarios", async (req, res) => {
  try {
    const { planningScenariosTable } = await import("@workspace/db");
    const data = await db.select().from(planningScenariosTable).orderBy(sql`created_at desc`).limit(25);
    res.json({ data, meta: { total: data.length } });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// ─── ENHANCED MRP ENGINE ─────────────────────────────────────────────────────
async function runEnhancedMrp(runId: string, horizon: number) {
  const recommendations: any[] = [];
  const today = new Date();
  const horizonDate = new Date(today);
  horizonDate.setDate(horizonDate.getDate() + horizon);

  // All items except service/phantom
  const allItems = await db.select().from(itemsTable).where(
    sql`${itemsTable.status} = 'active' AND ${itemsTable.supplyType} != 'phantom'`
  );

  // Inventory balances
  const balances = await db.select().from(inventoryBalancesTable);
  const balMap: Record<string, { onHand: number; allocated: number; onOrder: number }> = {};
  for (const b of balances) {
    if (!balMap[b.itemId]) balMap[b.itemId] = { onHand: 0, allocated: 0, onOrder: 0 };
    balMap[b.itemId].onHand += Number(b.quantityOnHand ?? 0);
    balMap[b.itemId].allocated += Number(b.quantityAllocated ?? 0);
    balMap[b.itemId].onOrder += Number(b.quantityOnOrder ?? 0);
  }

  // Preferred vendors
  const prefVendors = await db.select({
    itemId: itemVendorsTable.itemId,
    vendorId: itemVendorsTable.vendorId,
    leadTimeDays: itemVendorsTable.leadTimeDays,
    minOrderQty: itemVendorsTable.minOrderQty,
    reorderPointQty: itemVendorsTable.reorderPointQty,
    safetyStockQty: itemVendorsTable.safetyStockQty,
  }).from(itemVendorsTable).where(and(eq(itemVendorsTable.isPreferred, true), eq(itemVendorsTable.isApproved, true)));
  const pvMap: Record<string, typeof prefVendors[0]> = {};
  for (const pv of prefVendors) pvMap[pv.itemId] = pv;

  // Open demand from sales orders
  const openSOLines = await db.select({
    id: salesOrderLinesTable.id,
    salesOrderId: salesOrderLinesTable.salesOrderId,
    itemId: salesOrderLinesTable.itemId,
    quantity: salesOrderLinesTable.quantity,
    quantityShipped: salesOrderLinesTable.quantityShipped,
    requestedDate: salesOrderLinesTable.requestedDate,
    soNumber: salesOrdersTable.number,
  }).from(salesOrderLinesTable)
    .leftJoin(salesOrdersTable, eq(salesOrderLinesTable.salesOrderId, salesOrdersTable.id))
    .where(sql`${salesOrdersTable.status} IN ('confirmed','in_production','partial')`);

  // Demand map per item
  const demandMap: Record<string, { qty: number; urgentDate: string | null; soId: string | null; soLineId: string | null }> = {};
  for (const line of openSOLines) {
    const openQty = Number(line.quantity) - Number(line.quantityShipped ?? 0);
    if (openQty <= 0) continue;
    if (!demandMap[line.itemId]) demandMap[line.itemId] = { qty: 0, urgentDate: null, soId: null, soLineId: null };
    demandMap[line.itemId].qty += openQty;
    if (!demandMap[line.itemId].urgentDate || (line.requestedDate && line.requestedDate < demandMap[line.itemId].urgentDate!)) {
      demandMap[line.itemId].urgentDate = line.requestedDate;
      demandMap[line.itemId].soId = line.salesOrderId;
      demandMap[line.itemId].soLineId = line.id;
    }
  }

  for (const item of allItems) {
    const bal = balMap[item.id] ?? { onHand: 0, allocated: 0, onOrder: 0 };
    const available = bal.onHand - bal.allocated;
    const pv = pvMap[item.id];

    const safetyStock = Number(pv?.safetyStockQty ?? item.safetyStock ?? 0);
    const reorderPoint = Number(pv?.reorderPointQty ?? item.reorderPoint ?? 0);
    const leadTimeDays = Number(pv?.leadTimeDays ?? item.leadTime ?? 7);
    const demand = demandMap[item.id];

    const neededDate = new Date(today);
    neededDate.setDate(neededDate.getDate() + leadTimeDays);
    const neededDateStr = demand?.urgentDate ?? neededDate.toISOString().split("T")[0];

    const effectiveSupply = available + bal.onOrder;
    const netDemand = Math.max(0, (demand?.qty ?? 0) + safetyStock - effectiveSupply);

    const isManufactured = item.supplyType === "manufactured" || item.supplyType === "subassembly_order_built";
    const isPurchased = item.supplyType === "purchased" || item.supplyType === "subassembly_stocked";

    if (available < reorderPoint || netDemand > 0) {
      const baseQty = Math.max(netDemand, Number(pv?.minOrderQty ?? item.reorderQty ?? 10));
      const priority = netDemand > 0 && demand ? "urgent" : available <= 0 ? "urgent" : "normal";

      if (isPurchased) {
        const vendorException = !pv ? "No approved preferred vendor assigned" : undefined;
        recommendations.push({
          runId, type: "planned_po", itemId: item.id,
          quantity: baseQty.toFixed(0),
          neededDate: neededDateStr,
          vendorId: pv?.vendorId ?? null,
          priority,
          message: vendorException ?? `Reorder triggered: ${available} available, ${reorderPoint} reorder point${demand ? `, ${demand.qty} demand` : ""}`,
          status: "open",
          salesOrderId: demand?.soId ?? null,
          salesOrderLineId: demand?.soLineId ?? null,
          vendorException: vendorException ?? null,
          peggingContext: demand ? { salesOrderId: demand.soId, demandQty: demand.qty } : null,
        });
      } else if (isManufactured) {
        recommendations.push({
          runId, type: "planned_wo", itemId: item.id,
          quantity: baseQty.toFixed(0),
          neededDate: neededDateStr,
          priority,
          message: `Production demand: ${available} available, ${safetyStock} safety stock${demand ? `, ${demand.qty} firm demand` : ""}`,
          status: "open",
          salesOrderId: demand?.soId ?? null,
          salesOrderLineId: demand?.soLineId ?? null,
          peggingContext: demand ? { salesOrderId: demand.soId, demandQty: demand.qty } : null,
        });
      }
    }
  }

  if (recommendations.length > 0) {
    await db.insert(mrpRecommendationsTable).values(recommendations);
  }

  await db.update(mrpRunsTable).set({
    status: "complete",
    completedAt: new Date(),
    summaryStats: {
      plannedPOs: recommendations.filter(r => r.type === "planned_po").length,
      plannedWOs: recommendations.filter(r => r.type === "planned_wo").length,
      shortages: recommendations.filter(r => r.priority === "urgent").length,
      vendorExceptions: recommendations.filter(r => r.vendorException).length,
      rescheduleMessages: 0,
    },
  }).where(eq(mrpRunsTable.id, runId));
}

export default router;
