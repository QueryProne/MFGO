import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ChevronDown, Zap, PackagePlus, Wrench, AlertTriangle, Filter, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PageHeader, LoadingTable, EmptyState } from "@/components/ui-patterns";
import { api, WorkbenchItem, MrpRun, PaginatedResponse } from "@/lib/api";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    planned_po: { cls: "bg-blue-500/10 text-blue-400 border-blue-500/20", label: "Planned PO" },
    planned_wo: { cls: "bg-violet-500/10 text-violet-400 border-violet-500/20", label: "Planned WO" },
    shortage: { cls: "bg-red-500/10 text-red-400 border-red-500/20", label: "Shortage" },
    vendor_missing: { cls: "bg-amber-500/10 text-amber-400 border-amber-500/20", label: "No Vendor" },
  };
  const s = map[type] ?? { cls: "bg-muted text-muted-foreground", label: type };
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider border ${s.cls}`}>{s.label}</span>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    urgent: "bg-red-500/15 text-red-400 border-red-500/30",
    high: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    normal: "bg-muted/50 text-muted-foreground border-border/50",
  };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold uppercase tracking-wider ${map[priority] ?? map.normal}`}>{priority}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    released: "bg-green-500/10 text-green-400 border border-green-500/20",
    cancelled: "bg-muted text-muted-foreground border border-border",
  };
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${map[status] ?? map.open}`}>{status}</span>;
}

interface ReleaseDialogProps {
  item: WorkbenchItem | null;
  onClose: () => void;
  onRelease: (payload: { recommendationId: string; releaseType: string; vendorId?: string }) => void;
  isReleasing: boolean;
}

function ReleaseDialog({ item, onClose, onRelease, isReleasing }: ReleaseDialogProps) {
  const [releaseType, setReleaseType] = useState(item?.type === "planned_po" ? "po" : "wo");
  const [vendorId, setVendorId] = useState(item?.preferredVendorId ?? "");

  if (!item) return null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border/50">
        <DialogHeader>
          <DialogTitle>Release Recommendation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="p-3 rounded-lg bg-secondary/50 border border-border/50 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Item</span><span className="font-mono font-medium">{item.itemNumber}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Qty</span><span className="font-semibold">{item.quantity}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Need Date</span><span>{item.neededDate ? format(parseISO(item.neededDate), "MMM d, yyyy") : "—"}</span></div>
          </div>

          <div className="space-y-2">
            <Label>Release Type</Label>
            <Select value={releaseType} onValueChange={setReleaseType}>
              <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="po">Create Purchase Order</SelectItem>
                <SelectItem value="wo">Create Work Order</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {releaseType === "po" && (
            <div className="space-y-2">
              <Label>Vendor ID <span className="text-muted-foreground text-xs">(preferred: {item.preferredVendorName ?? "none"})</span></Label>
              <Input
                value={vendorId}
                onChange={e => setVendorId(e.target.value)}
                placeholder={item.preferredVendorId ?? "Enter vendor ID..."}
                className="bg-background font-mono text-sm"
              />
              {item.vendorMissing && (
                <p className="text-xs text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> No preferred vendor assigned — enter vendor ID manually
                </p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onRelease({ recommendationId: item.id, releaseType, vendorId: releaseType === "po" ? (vendorId || item.preferredVendorId || undefined) : undefined })} disabled={isReleasing}>
            <Play className="w-4 h-4 mr-2" />{isReleasing ? "Releasing..." : "Release"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PlanningPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("open");
  const [releasing, setReleasing] = useState<WorkbenchItem | null>(null);

  const { data, isLoading, refetch } = useQuery<{ data: WorkbenchItem[]; meta: any; latestRun: MrpRun | null }>({
    queryKey: ["workbench", { filterType, filterStatus }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterType !== "all") params.set("type", filterType);
      if (filterStatus !== "all") params.set("status", filterStatus);
      return api.get(`/planning-purchasing/workbench?${params}`);
    },
  });

  const { data: runsData } = useQuery<PaginatedResponse<MrpRun>>({
    queryKey: ["mrp-runs"],
    queryFn: () => api.get("/mrp/runs?limit=5"),
  });

  const runMrp = useMutation({
    mutationFn: () => api.post<MrpRun>("/mrp/runs", { type: "full_regen", planningHorizon: 90 }),
    onSuccess: () => {
      toast({ title: "MRP run started", description: "Generating recommendations..." });
      setTimeout(() => { qc.invalidateQueries({ queryKey: ["workbench"] }); qc.invalidateQueries({ queryKey: ["mrp-runs"] }); }, 2500);
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (payload: any) => api.post("/planning-purchasing/release", payload),
    onSuccess: (res: any) => {
      const docNum = res.record?.number ?? "";
      toast({ title: "Released", description: `${res.type === "po" ? "Purchase Order" : "Work Order"} ${docNum} created` });
      setReleasing(null);
      qc.invalidateQueries({ queryKey: ["workbench"] });
    },
    onError: (e: any) => toast({ title: "Release failed", description: e.message, variant: "destructive" }),
  });

  const workbench = data?.data ?? [];
  const run = data?.latestRun;
  const openCount = workbench.filter(r => r.status === "open").length;
  const urgentCount = workbench.filter(r => r.priority === "urgent").length;
  const vendorExCount = workbench.filter(r => r.vendorMissing).length;
  const releasedCount = workbench.filter(r => r.status === "released").length;

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Planning & Purchasing"
        description="Unified demand planning, shortage analysis, and purchasing release workbench."
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
            <Button size="sm" onClick={() => runMrp.mutate()} disabled={runMrp.isPending}>
              <Zap className="w-4 h-4 mr-2" />{runMrp.isPending ? "Running MRP..." : "Run MRP"}
            </Button>
          </div>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Open Recommendations", value: openCount, cls: "text-foreground" },
          { label: "Urgent / Past Due", value: urgentCount, cls: "text-red-400" },
          { label: "Vendor Exceptions", value: vendorExCount, cls: "text-amber-400" },
          { label: "Released Today", value: releasedCount, cls: "text-green-400" },
        ].map(k => (
          <Card key={k.label} className="border-border/50">
            <CardContent className="p-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">{k.label}</p>
              <p className={`text-3xl font-bold mt-1 ${k.cls}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {run && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          Last MRP run: {run.completedAt ? format(parseISO(run.completedAt as string), "MMM d, yyyy h:mm a") : "—"}
          {run.summaryStats && (
            <span className="ml-2 text-muted-foreground/70">
              · {(run.summaryStats as any).plannedPOs ?? 0} planned POs · {(run.summaryStats as any).plannedWOs ?? 0} planned WOs · {(run.summaryStats as any).vendorExceptions ?? 0} exceptions
            </span>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44 h-8 text-xs bg-card border-border/50"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="planned_po">Planned PO</SelectItem>
            <SelectItem value="planned_wo">Planned WO</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-8 text-xs bg-card border-border/50"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="released">Released</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main Table */}
      <Card className="border-border/50 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6"><LoadingTable /></div>
        ) : !workbench.length ? (
          <EmptyState icon={Zap} title="No recommendations" description="Run MRP to generate planning recommendations." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-secondary/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold text-xs w-28">Type</TableHead>
                  <TableHead className="font-semibold text-xs">Item</TableHead>
                  <TableHead className="font-semibold text-xs">Preferred Vendor</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Qty</TableHead>
                  <TableHead className="font-semibold text-xs text-right">On Hand</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Allocated</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Available</TableHead>
                  <TableHead className="font-semibold text-xs text-right">On Order</TableHead>
                  <TableHead className="font-semibold text-xs text-right w-20">Shortage</TableHead>
                  <TableHead className="font-semibold text-xs">Need Date</TableHead>
                  <TableHead className="font-semibold text-xs">Lead Days</TableHead>
                  <TableHead className="font-semibold text-xs w-16">Priority</TableHead>
                  <TableHead className="font-semibold text-xs w-20">Status</TableHead>
                  <TableHead className="font-semibold text-xs w-24">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workbench.map((row) => (
                  <TableRow key={row.id} className={`hover:bg-secondary/20 transition-colors ${row.priority === "urgent" ? "bg-red-500/5" : ""}`}>
                    <TableCell><TypeBadge type={row.type} /></TableCell>
                    <TableCell>
                      <p className="font-mono text-xs font-semibold">{row.itemNumber}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[160px]">{row.itemName}</p>
                    </TableCell>
                    <TableCell>
                      {row.vendorMissing ? (
                        <span className="text-xs text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> No vendor
                        </span>
                      ) : (
                        <span className="text-xs">{row.preferredVendorName ?? "—"}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">{Number(row.quantity).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{row.currentOnHand.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-amber-400">{row.currentAllocated.toLocaleString()}</TableCell>
                    <TableCell className={`text-right font-mono text-sm font-semibold ${row.currentAvailable < 0 ? "text-red-400" : "text-green-400"}`}>
                      {row.currentAvailable.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-blue-400">{row.currentOnOrder.toLocaleString()}</TableCell>
                    <TableCell className={`text-right font-mono text-sm font-bold ${row.shortageQty > 0 ? "text-red-400" : "text-muted-foreground"}`}>
                      {row.shortageQty > 0 ? `-${row.shortageQty.toLocaleString()}` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {row.neededDate ? format(parseISO(row.neededDate), "MMM d") : "—"}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {row.preferredVendorLeadDays != null ? `${row.preferredVendorLeadDays}d` : "—"}
                    </TableCell>
                    <TableCell><PriorityBadge priority={row.priority} /></TableCell>
                    <TableCell><StatusBadge status={row.status} /></TableCell>
                    <TableCell>
                      {row.status === "open" ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2 border-primary/30 text-primary hover:bg-primary/10"
                          onClick={() => setReleasing(row)}>
                          <Play className="w-3 h-3 mr-1" />Release
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {row.releasedPurchaseOrderId ? "→ PO" : row.releasedWorkOrderId ? "→ WO" : ""}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {releasing && (
        <ReleaseDialog
          item={releasing}
          onClose={() => setReleasing(null)}
          onRelease={releaseMutation.mutate}
          isReleasing={releaseMutation.isPending}
        />
      )}
    </div>
  );
}
