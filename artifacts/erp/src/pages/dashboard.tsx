import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  ShoppingCart,
  Package,
  AlertTriangle,
  ArrowRight,
  Factory,
  ClipboardCheck,
  BadgeAlert,
  DollarSign,
  Loader2,
} from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui-patterns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { api, DashboardKpis, SalesOrder, WorkOrder, PaginatedResponse } from "@/lib/api";
import { formatDistanceToNow, parseISO } from "date-fns";
import { AICopilotChat } from "@/components/ai/ai-copilot-chat";

const revenueData = [
  { name: "Oct", revenue: 82000 },
  { name: "Nov", revenue: 95000 },
  { name: "Dec", revenue: 88000 },
  { name: "Jan", revenue: 112000 },
  { name: "Feb", revenue: 98000 },
  { name: "Mar", revenue: 124500 },
];

const woStatusData = [
  { name: "Mon", released: 4, inProgress: 8, complete: 3 },
  { name: "Tue", released: 6, inProgress: 9, complete: 5 },
  { name: "Wed", released: 3, inProgress: 11, complete: 7 },
  { name: "Thu", released: 5, inProgress: 8, complete: 6 },
  { name: "Fri", released: 7, inProgress: 7, complete: 9 },
];

function KpiCard({ title, value, icon: Icon, status, unit = "", subtitle }: {
  title: string; value: number | string; icon: any;
  status?: string; unit?: string; subtitle?: string;
}) {
  const colorMap: Record<string, string> = {
    good: "text-green-500",
    warning: "text-amber-500",
    critical: "text-red-500",
    neutral: "text-blue-400",
  };
  const bgMap: Record<string, string> = {
    good: "bg-green-500/10",
    warning: "bg-amber-500/10",
    critical: "bg-red-500/10",
    neutral: "bg-blue-400/10",
  };
  const color = colorMap[status ?? "neutral"];
  const bg = bgMap[status ?? "neutral"];

  return (
    <Card className="hover:shadow-lg transition-all duration-300 border-border/50 bg-card/60 backdrop-blur-sm overflow-hidden relative group">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-15 transition-opacity">
        <Icon className="w-20 h-20 text-foreground" />
      </div>
      <CardContent className="p-5 relative z-10">
        <div className="flex justify-between items-start mb-3">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{title}</p>
          <div className={`p-1.5 rounded-md ${bg}`}>
            <Icon className={`w-4 h-4 ${color}`} />
          </div>
        </div>
        <p className="text-3xl font-bold text-foreground tracking-tight">
          {unit}{typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {subtitle && <p className="text-xs mt-2 text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    confirmed: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    in_production: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    released: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    in_progress: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    complete: "bg-green-500/10 text-green-400 border border-green-500/20",
    shipped: "bg-green-500/10 text-green-400 border border-green-500/20",
    cancelled: "bg-red-500/10 text-red-400 border border-red-500/20",
  };
  return (
    <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function Dashboard() {
  const { data: kpis, isLoading: kpisLoading } = useQuery<DashboardKpis>({
    queryKey: ["dashboard", "kpis"],
    queryFn: () => api.get("/dashboard/kpis"),
    refetchInterval: 30000,
  });

  const { data: salesOrders } = useQuery<PaginatedResponse<SalesOrder>>({
    queryKey: ["salesorders", { limit: 5 }],
    queryFn: () => api.get("/salesorders?limit=5"),
  });

  const { data: workOrders } = useQuery<PaginatedResponse<WorkOrder>>({
    queryKey: ["workorders", { limit: 5 }],
    queryFn: () => api.get("/workorders?limit=5"),
  });

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Command Center"
        description="Real-time manufacturing operations overview."
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="border-border/50">Export Report</Button>
            <Link href="/salesorders">
              <Button size="sm" className="bg-primary text-primary-foreground">New Sales Order</Button>
            </Link>
          </div>
        }
      />

      {/* KPI Grid */}
      {kpisLoading ? (
        <div className="flex items-center justify-center h-28">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Open Sales Orders" value={kpis?.openSalesOrders ?? 0} icon={ShoppingCart}
            status="neutral" subtitle="Active customer demand" />
          <KpiCard title="Open Work Orders" value={kpis?.openWorkOrders ?? 0} icon={Factory}
            status="neutral" subtitle="In production queue" />
          <KpiCard title="Open Purchase Orders" value={kpis?.openPurchaseOrders ?? 0} icon={Package}
            status="neutral" subtitle="Pending receipt" />
          <KpiCard title="Quality Alerts" value={(kpis?.pendingInspections ?? 0) + (kpis?.openNonconformances ?? 0)}
            icon={BadgeAlert}
            status={(kpis?.openNonconformances ?? 0) > 5 ? "critical" : (kpis?.pendingInspections ?? 0) > 0 ? "warning" : "good"}
            subtitle={`${kpis?.pendingInspections ?? 0} inspections · ${kpis?.openNonconformances ?? 0} NCRs`} />
        </div>
      )}

      {/* Charts + Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Revenue Trend</CardTitle>
            <CardDescription className="text-xs">6-month rolling revenue (USD)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} dy={8} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))", fontSize: "12px" }}
                    formatter={(v: any) => [`$${Number(v).toLocaleString()}`, "Revenue"]}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5}
                    dot={{ r: 3, fill: "hsl(var(--background))", strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: "hsl(var(--primary))" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Action Items</CardTitle>
            <CardDescription className="text-xs">Needs your attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {kpis && [
                kpis.pendingInspections > 0 && {
                  title: `${kpis.pendingInspections} pending inspection${kpis.pendingInspections > 1 ? "s" : ""}`,
                  href: "/quality", type: "quality",
                },
                kpis.openNonconformances > 0 && {
                  title: `${kpis.openNonconformances} open nonconformance${kpis.openNonconformances > 1 ? "s" : ""}`,
                  href: "/quality", type: "quality",
                },
                kpis.lowInventoryItems > 0 && {
                  title: `${kpis.lowInventoryItems} items at zero stock`,
                  href: "/inventory", type: "inventory",
                },
                kpis.overdueInvoices > 0 && {
                  title: `${kpis.overdueInvoices} overdue invoice${kpis.overdueInvoices > 1 ? "s" : ""}`,
                  href: "/invoices", type: "finance",
                },
                kpis.openPurchaseOrders > 0 && {
                  title: `${kpis.openPurchaseOrders} open purchase order${kpis.openPurchaseOrders > 1 ? "s" : ""}`,
                  href: "/purchaseorders", type: "purchasing",
                },
              ].filter(Boolean).slice(0, 6).map((item: any, i) => (
                <Link key={i} href={item.href}>
                  <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/60 transition-colors cursor-pointer group">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      item.type === "quality" ? "bg-purple-500" :
                      item.type === "inventory" ? "bg-orange-500" :
                      item.type === "finance" ? "bg-red-500" : "bg-blue-500"
                    }`} />
                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors flex-1">{item.title}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
              {kpis && kpis.pendingInspections === 0 && kpis.openNonconformances === 0 && kpis.lowInventoryItems === 0 && kpis.overdueInvoices === 0 && (
                <div className="text-center py-6 text-muted-foreground">
                  <ClipboardCheck className="w-8 h-8 mx-auto mb-2 text-green-500/50" />
                  <p className="text-sm">All clear — no action items</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold">Recent Sales Orders</CardTitle>
              <CardDescription className="text-xs mt-0.5">Latest customer orders</CardDescription>
            </div>
            <Link href="/salesorders">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground -mr-2">
                View all <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {salesOrders?.data.map((so) => (
                <div key={so.id} className="flex items-center gap-4 px-6 py-3 hover:bg-secondary/40 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{so.number}</p>
                    <p className="text-xs text-muted-foreground truncate">{so.customerName}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-foreground">${Number(so.totalAmount ?? 0).toLocaleString()}</p>
                    <StatusBadge status={so.status} />
                  </div>
                </div>
              ))}
              {!salesOrders?.data.length && (
                <p className="text-sm text-muted-foreground text-center py-8">No sales orders yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold">Active Work Orders</CardTitle>
              <CardDescription className="text-xs mt-0.5">Current production queue</CardDescription>
            </div>
            <Link href="/workorders">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground -mr-2">
                View all <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {workOrders?.data.map((wo) => (
                <div key={wo.id} className="flex items-center gap-4 px-6 py-3 hover:bg-secondary/40 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{wo.number}</p>
                    <p className="text-xs text-muted-foreground truncate">{wo.itemName}</p>
                  </div>
                  <div className="text-right flex-shrink-0 space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {wo.quantityCompleted ?? 0} / {wo.quantityOrdered ?? 0}
                    </p>
                    <StatusBadge status={wo.status} />
                  </div>
                </div>
              ))}
              {!workOrders?.data.length && (
                <p className="text-sm text-muted-foreground text-center py-8">No work orders yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <AICopilotChat className="max-w-4xl" />
    </div>
  );
}
