import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, AlertTriangle, CheckCircle, Clock, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingTable, EmptyState } from "@/components/ui-patterns";
import { api, WorkOrder, WorkOrderMaterial } from "@/lib/api";
import { format, parseISO } from "date-fns";
import { CustomFormsPanel } from "@/components/custom/custom-forms-panel";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground border-border",
    released: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    in_progress: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    complete: "bg-green-500/10 text-green-400 border-green-500/20",
    cancelled: "bg-muted text-muted-foreground border-border",
  };
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider border ${map[status] ?? "bg-muted text-muted-foreground"}`}>{status.replace(/_/g, " ")}</span>;
}

function SupplyTypeBadge({ supplyType }: { supplyType?: string }) {
  const map: Record<string, string> = {
    purchased: "bg-blue-500/10 text-blue-400",
    manufactured: "bg-violet-500/10 text-violet-400",
    subassembly_stocked: "bg-cyan-500/10 text-cyan-400",
    subassembly_order_built: "bg-orange-500/10 text-orange-400",
    phantom: "bg-muted/50 text-muted-foreground",
  };
  const label = supplyType?.replace(/_/g, " ") ?? "—";
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider ${map[supplyType ?? ""] ?? "bg-muted text-muted-foreground"}`}>{label}</span>;
}

export default function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const { data: wo, isLoading } = useQuery<WorkOrder>({
    queryKey: ["workorder", id],
    queryFn: () => api.get(`/workorders/${id}`),
  });

  const { data: materialsData, isLoading: matLoading } = useQuery<{ data: WorkOrderMaterial[] }>({
    queryKey: ["wo-materials", id],
    queryFn: () => api.get(`/workorders/${id}/materials`),
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading work order...</div>;
  if (!wo) return <div className="p-8 text-destructive">Work order not found</div>;

  const pct = wo.quantityOrdered && Number(wo.quantityOrdered) > 0
    ? Math.round((Number(wo.quantityCompleted ?? 0) / Number(wo.quantityOrdered)) * 100)
    : 0;

  const materials = materialsData?.data ?? [];
  const totalShortage = materials.reduce((s, m) => s + Number(m.shortageQty ?? 0), 0);
  const shortItems = materials.filter(m => Number(m.shortageQty ?? 0) > 0);

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/workorders")} className="text-muted-foreground h-8 px-2">
          <ArrowLeft className="w-4 h-4 mr-1" /> Work Orders
        </Button>
        <span className="text-muted-foreground/40">/</span>
        <span className="font-mono text-sm font-semibold">{wo.number}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-display font-bold">{wo.number}</h1>
            <StatusBadge status={wo.status} />
            {wo.priority === "urgent" && <span className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">Urgent</span>}
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            <span className="font-mono font-semibold">{wo.itemNumber}</span> — {wo.itemName}
          </p>
          {wo.salesOrderNumber && (
            <p className="text-xs text-muted-foreground mt-0.5">From Sales Order: <span className="font-mono">{wo.salesOrderNumber}</span></p>
          )}
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold">{pct}%</p>
          <p className="text-xs text-muted-foreground">{wo.quantityCompleted ?? 0} / {wo.quantityOrdered} {wo.uom}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Qty Ordered", value: wo.quantityOrdered ?? "—", cls: "" },
          { label: "Qty Completed", value: wo.quantityCompleted ?? "0", cls: "text-green-400" },
          { label: "Material Lines", value: materials.length, cls: "" },
          { label: "Shortages", value: shortItems.length, cls: shortItems.length > 0 ? "text-red-400" : "text-muted-foreground" },
        ].map(k => (
          <Card key={k.label} className="border-border/50">
            <CardContent className="p-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">{k.label}</p>
              <p className={`text-2xl font-bold mt-1 ${k.cls}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {shortItems.length > 0 && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-sm">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-red-400 font-medium">{shortItems.length} component shortage{shortItems.length !== 1 ? "s" : ""} detected</span>
          <span className="text-muted-foreground text-xs">
            — {shortItems.map(m => m.itemNumber).join(", ")}
          </span>
        </div>
      )}

      <Tabs defaultValue="materials">
        <TabsList className="border border-border/50 bg-card/50">
          <TabsTrigger value="materials">Materials <span className="ml-1.5 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">{materials.length}</span></TabsTrigger>
          <TabsTrigger value="operations">Operations <span className="ml-1.5 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">{wo.operations?.length ?? 0}</span></TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>

        {/* MATERIALS TAB */}
        <TabsContent value="materials">
          <Card className="border-border/50 overflow-hidden">
            {matLoading ? (
              <div className="p-6"><LoadingTable /></div>
            ) : !materials.length ? (
              <EmptyState icon={Boxes} title="No materials" description="Materials are generated when a BOM is attached and the work order is released." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-secondary/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-semibold text-xs">Component</TableHead>
                      <TableHead className="font-semibold text-xs">Supply Type</TableHead>
                      <TableHead className="font-semibold text-xs text-right">Required</TableHead>
                      <TableHead className="font-semibold text-xs text-right">Allocated</TableHead>
                      <TableHead className="font-semibold text-xs text-right">Issued</TableHead>
                      <TableHead className="font-semibold text-xs text-right">Shortage</TableHead>
                      <TableHead className="font-semibold text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materials.map((m) => {
                      const shortage = Number(m.shortageQty ?? 0);
                      const issued = Number(m.issuedQty ?? 0);
                      const required = Number(m.requiredQty);
                      const isFullyIssued = issued >= required;
                      return (
                        <TableRow key={m.id} className={`hover:bg-secondary/20 transition-colors ${shortage > 0 ? "bg-red-500/5" : ""}`}>
                          <TableCell>
                            <p className="font-mono text-xs font-semibold">{m.itemNumber}</p>
                            <p className="text-xs text-muted-foreground">{m.itemName}</p>
                          </TableCell>
                          <TableCell><SupplyTypeBadge supplyType={m.supplyTypeSnapshot ?? m.supplyType} /></TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold">{required.toLocaleString()} {m.uom}</TableCell>
                          <TableCell className="text-right font-mono text-sm text-blue-400">{Number(m.allocatedQty ?? 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono text-sm text-green-400">{issued.toLocaleString()}</TableCell>
                          <TableCell className={`text-right font-mono text-sm font-bold ${shortage > 0 ? "text-red-400" : "text-muted-foreground"}`}>
                            {shortage > 0 ? `-${shortage.toLocaleString()}` : "—"}
                          </TableCell>
                          <TableCell>
                            {isFullyIssued
                              ? <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Fully Issued</span>
                              : shortage > 0
                                ? <span className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Short</span>
                                : <span className="text-xs text-amber-400 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Pending</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* OPERATIONS TAB */}
        <TabsContent value="operations">
          <Card className="border-border/50 overflow-hidden">
            {!wo.operations?.length ? (
              <EmptyState icon={Clock} title="No operations" description="Operations are copied from the routing when the work order is created." />
            ) : (
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold text-xs">Seq</TableHead>
                    <TableHead className="font-semibold text-xs">Operation</TableHead>
                    <TableHead className="font-semibold text-xs">Work Center</TableHead>
                    <TableHead className="font-semibold text-xs text-right">Setup Hrs</TableHead>
                    <TableHead className="font-semibold text-xs text-right">Run Hrs</TableHead>
                    <TableHead className="font-semibold text-xs text-right">Labor Hrs</TableHead>
                    <TableHead className="font-semibold text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wo.operations.map((op) => (
                    <TableRow key={op.id} className="hover:bg-secondary/20 transition-colors">
                      <TableCell className="font-mono text-xs text-muted-foreground">{op.sequence}</TableCell>
                      <TableCell className="font-medium text-sm">{op.name}</TableCell>
                      <TableCell className="text-sm">{op.workcenterName ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{op.setupTime ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{op.runTime ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{op.laborHours ?? "—"}</TableCell>
                      <TableCell>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider border ${op.status === "complete" ? "bg-green-500/10 text-green-400 border-green-500/20" : op.status === "in_progress" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-muted text-muted-foreground border-border"}`}>
                          {op.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* DETAILS TAB */}
        <TabsContent value="details">
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Schedule</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {[
                  ["Scheduled Start", wo.scheduledStart ? format(parseISO(wo.scheduledStart), "MMM d, yyyy") : "—"],
                  ["Scheduled End", wo.scheduledEnd ? format(parseISO(wo.scheduledEnd), "MMM d, yyyy") : "—"],
                  ["Actual Start", wo.actualStart ? format(parseISO(wo.actualStart), "MMM d, yyyy") : "—"],
                  ["Actual End", wo.actualEnd ? format(parseISO(wo.actualEnd), "MMM d, yyyy") : "—"],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{val}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Traceability</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {[
                  ["Type", wo.type],
                  ["BOM ID", wo.bomId ? wo.bomId.substring(0, 8) + "..." : "—"],
                  ["Routing ID", wo.routingId ? wo.routingId.substring(0, 8) + "..." : "—"],
                  ["Parent WO", wo.parentWorkOrderId ? wo.parentWorkOrderId.substring(0, 8) + "..." : "—"],
                  ["Sales Order", wo.salesOrderNumber ?? "—"],
                  ["Notes", wo.notes ?? "—"],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium font-mono text-xs">{val}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="custom">
          <CustomFormsPanel entityType="workorder" entityId={wo.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
