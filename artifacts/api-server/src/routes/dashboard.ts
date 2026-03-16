import { Router } from "express";
import { db } from "@workspace/db";
import { dashboardWidgetsTable, salesOrdersTable, purchaseOrdersTable, workOrdersTable, inspectionsTable, nonconformancesTable, inventoryBalancesTable, invoicesTable, itemsTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";

const router = Router();

router.get("/dashboard/widgets", async (req, res) => {
  try {
    const userId = (req.query.userId as string) ?? "default";
    const widgets = await db.select().from(dashboardWidgetsTable).where(eq(dashboardWidgetsTable.userId, userId));

    if (widgets.length === 0) {
      // Default layout
      const defaults = [
        { id: "1", type: "kpi", title: "Open Sales Orders", config: { metric: "open_sales_orders" }, position: { x: 0, y: 0, w: 3, h: 1 } },
        { id: "2", type: "kpi", title: "Open Work Orders", config: { metric: "open_work_orders" }, position: { x: 3, y: 0, w: 3, h: 1 } },
        { id: "3", type: "kpi", title: "Open Purchase Orders", config: { metric: "open_pos" }, position: { x: 6, y: 0, w: 3, h: 1 } },
        { id: "4", type: "kpi", title: "Overdue Invoices", config: { metric: "overdue_invoices" }, position: { x: 9, y: 0, w: 3, h: 1 } },
        { id: "5", type: "production_status", title: "Production Status", config: {}, position: { x: 0, y: 1, w: 6, h: 2 } },
        { id: "6", type: "recent_orders", title: "Recent Sales Orders", config: {}, position: { x: 6, y: 1, w: 6, h: 2 } },
        { id: "7", type: "inventory_alerts", title: "Inventory Alerts", config: {}, position: { x: 0, y: 3, w: 12, h: 2 } },
      ];
      return res.json({ widgets: defaults });
    }

    res.json({ widgets });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.put("/dashboard/widgets", async (req, res) => {
  try {
    const userId = "default";
    const { widgets } = req.body;
    await db.delete(dashboardWidgetsTable).where(eq(dashboardWidgetsTable.userId, userId));
    if (widgets?.length) {
      await db.insert(dashboardWidgetsTable).values(widgets.map((w: any) => ({
        id: w.id, userId, type: w.type, title: w.title,
        config: w.config, position: w.position,
      })));
    }
    res.json({ widgets });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.get("/dashboard/kpis", async (req, res) => {
  try {
    const [openSO, openWO, openPO, pendingInsp, openNC, overdue] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(salesOrdersTable).where(sql`${salesOrdersTable.status} NOT IN ('shipped','invoiced','closed','cancelled')`),
      db.select({ count: sql<number>`count(*)` }).from(workOrdersTable).where(sql`${workOrdersTable.status} NOT IN ('complete','cancelled')`),
      db.select({ count: sql<number>`count(*)` }).from(purchaseOrdersTable).where(sql`${purchaseOrdersTable.status} NOT IN ('received','closed','cancelled')`),
      db.select({ count: sql<number>`count(*)` }).from(inspectionsTable).where(eq(inspectionsTable.status, "pending")),
      db.select({ count: sql<number>`count(*)` }).from(nonconformancesTable).where(sql`${nonconformancesTable.status} NOT IN ('closed','voided')`),
      db.select({ count: sql<number>`count(*)` }).from(invoicesTable).where(eq(invoicesTable.status, "overdue")),
    ]);

    const lowInventory = await db.select({ count: sql<number>`count(*)` })
      .from(inventoryBalancesTable)
      .where(sql`${inventoryBalancesTable.quantityOnHand} <= 0`);

    const recentRevenue = await db.select({ total: sql<number>`COALESCE(sum(${invoicesTable.amountPaid}), 0)` })
      .from(invoicesTable)
      .where(sql`${invoicesTable.invoiceDate} >= CURRENT_DATE - INTERVAL '30 days'`);

    const kpis = [
      { key: "open_sales_orders", label: "Open Sales Orders", value: Number(openSO[0]?.count ?? 0), unit: "", trend: 0, trendLabel: "vs last month", status: "neutral" },
      { key: "open_work_orders", label: "Open Work Orders", value: Number(openWO[0]?.count ?? 0), unit: "", trend: 0, trendLabel: "vs last month", status: "neutral" },
      { key: "open_pos", label: "Open Purchase Orders", value: Number(openPO[0]?.count ?? 0), unit: "", trend: 0, trendLabel: "vs last month", status: "neutral" },
      { key: "pending_inspections", label: "Pending Inspections", value: Number(pendingInsp[0]?.count ?? 0), unit: "", trend: 0, trendLabel: "", status: Number(pendingInsp[0]?.count ?? 0) > 0 ? "warning" : "good" },
      { key: "open_ncr", label: "Open Nonconformances", value: Number(openNC[0]?.count ?? 0), unit: "", trend: 0, trendLabel: "", status: Number(openNC[0]?.count ?? 0) > 5 ? "critical" : "neutral" },
      { key: "revenue_30d", label: "Revenue (30 days)", value: Number(recentRevenue[0]?.total ?? 0), unit: "$", trend: 0, trendLabel: "", status: "good" },
    ];

    res.json({
      kpis,
      openSalesOrders: Number(openSO[0]?.count ?? 0),
      openPurchaseOrders: Number(openPO[0]?.count ?? 0),
      openWorkOrders: Number(openWO[0]?.count ?? 0),
      pendingInspections: Number(pendingInsp[0]?.count ?? 0),
      openNonconformances: Number(openNC[0]?.count ?? 0),
      lowInventoryItems: Number(lowInventory[0]?.count ?? 0),
      overdueInvoices: Number(overdue[0]?.count ?? 0),
      recentRevenue: Number(recentRevenue[0]?.total ?? 0),
    });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

export default router;
