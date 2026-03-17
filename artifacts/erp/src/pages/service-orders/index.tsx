import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Headphones } from "lucide-react";
import { PageHeader, EmptyState, LoadingTable } from "@/components/ui-patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { api, PaginatedResponse, ServiceOrder } from "@/lib/api";
import { format, parseISO } from "date-fns";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground border border-border",
    scheduled: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    in_progress: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    completed: "bg-green-500/10 text-green-400 border border-green-500/20",
    cancelled: "bg-muted text-muted-foreground border border-border",
    on_hold: "bg-red-500/10 text-red-400 border border-red-500/20",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function ServiceOrdersPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery<PaginatedResponse<ServiceOrder>>({
    queryKey: ["serviceorders", { search }],
    queryFn: () => api.get(`/serviceorders?limit=50`),
  });

  const filtered = (data?.data ?? []).filter(s =>
    !search || s.number.toLowerCase().includes(search.toLowerCase()) ||
    (s.customerName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Service Orders"
        description="Manage field service, repair, and maintenance work for customers."
        action={<Button size="sm"><Plus className="w-4 h-4 mr-2" /> New Service Order</Button>}
      />
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/50 flex gap-4 items-center bg-card/50">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search service orders..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 bg-background" />
          </div>
        </div>
        {isLoading ? (
          <div className="p-6"><LoadingTable /></div>
        ) : !filtered.length ? (
          <EmptyState icon={Headphones} title="No service orders" description="Service orders are created from sales order conversion or directly." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-secondary/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">SVC #</TableHead>
                  <TableHead className="font-semibold">Customer</TableHead>
                  <TableHead className="font-semibold">Sales Order</TableHead>
                  <TableHead className="font-semibold">Item</TableHead>
                  <TableHead className="font-semibold">Type</TableHead>
                  <TableHead className="font-semibold">Requested</TableHead>
                  <TableHead className="font-semibold">Scheduled</TableHead>
                  <TableHead className="font-semibold text-right">Planned Hrs</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id} className="hover:bg-secondary/20 transition-colors">
                    <TableCell className="font-mono text-sm font-medium text-primary">{s.number}</TableCell>
                    <TableCell className="font-medium">{s.customerName ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{s.salesOrderNumber ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{s.itemNumber ?? "—"}</TableCell>
                    <TableCell className="text-xs capitalize">{s.serviceType?.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.requestedDate ? format(parseISO(s.requestedDate), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.scheduledDate ? format(parseISO(s.scheduledDate), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{s.plannedHours ?? "—"}</TableCell>
                    <TableCell><StatusBadge status={s.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
