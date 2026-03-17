import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { api, type Receipt, type PaginatedResponse } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  PackageCheck, Search, ChevronRight, CheckCircle, Clock, AlertCircle,
  Truck, Plus, RefreshCw,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft:     { label: "Draft",     color: "bg-zinc-700 text-zinc-200",       icon: <Clock className="h-3 w-3" /> },
  pending:   { label: "Pending",   color: "bg-amber-900/60 text-amber-200",  icon: <Clock className="h-3 w-3" /> },
  confirmed: { label: "Confirmed", color: "bg-emerald-900/60 text-emerald-200", icon: <CheckCircle className="h-3 w-3" /> },
  rejected:  { label: "Rejected",  color: "bg-red-900/60 text-red-200",      icon: <AlertCircle className="h-3 w-3" /> },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "bg-zinc-700 text-zinc-200", icon: null };
  return (
    <Badge className={cn("gap-1 text-xs font-medium", cfg.color)}>
      {cfg.icon}{cfg.label}
    </Badge>
  );
}

export default function ReceivingPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), limit: "25" });
  if (search) params.set("search", search);
  if (statusFilter !== "all") params.set("status", statusFilter);

  const { data, isLoading } = useQuery<PaginatedResponse<Receipt>>({
    queryKey: ["receiving", page, search, statusFilter],
    queryFn: () => api.get(`/receiving?${params}`),
  });

  const confirmMut = useMutation({
    mutationFn: (id: string) => api.post(`/receiving/${id}/confirm`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["receiving"] });
      toast({ title: "Receipt confirmed", description: "Inventory has been updated." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const receipts = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/40">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <PackageCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold font-display text-foreground">Receiving</h1>
            <p className="text-xs text-muted-foreground">Incoming goods against purchase orders</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["receiving"] })}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
          <Button size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New Receipt
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-card/20">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search receipts..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-8 h-8 text-sm bg-background/60"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-36 h-8 text-sm bg-background/60">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        {meta && (
          <span className="text-xs text-muted-foreground ml-auto">{meta.total} receipt{meta.total !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-xs font-medium text-muted-foreground w-32">Number</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">Vendor</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground w-28">Status</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground w-32">Receipt Date</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground w-40">Packing Slip</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground w-20 text-right">Lines</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground w-24">Received By</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i} className="border-border">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 bg-muted/40 rounded animate-pulse" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : receipts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <Truck className="h-10 w-10 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No receipts found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              receipts.map((r) => (
                <TableRow key={r.id} className="border-border hover:bg-muted/20 cursor-pointer group">
                  <TableCell>
                    <Link to={`/receiving/${r.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
                      {r.number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="text-sm font-medium text-foreground">{r.vendorName ?? "—"}</div>
                      {r.vendorNumber && <div className="text-xs text-muted-foreground">{r.vendorNumber}</div>}
                    </div>
                  </TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.receiptDate ?? "—"}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{r.packingSlipNumber ?? "—"}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{r.lineCount ?? 0}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.receivedBy ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {r.status !== "confirmed" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40"
                          onClick={(e) => { e.stopPropagation(); confirmMut.mutate(r.id); }}
                          disabled={confirmMut.isPending}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" /> Confirm
                        </Button>
                      )}
                      <Link to={`/receiving/${r.id}`}>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-card/20">
          <span className="text-xs text-muted-foreground">
            Page {meta.page} of {meta.totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
