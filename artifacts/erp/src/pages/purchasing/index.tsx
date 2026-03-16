import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Package, MoreHorizontal } from "lucide-react";
import { PageHeader, EmptyState, LoadingTable } from "@/components/ui-patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, PaginatedResponse, PurchaseOrder } from "@/lib/api";
import { format, parseISO } from "date-fns";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground border border-border",
    sent: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    acknowledged: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
    partially_received: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    received: "bg-green-500/10 text-green-400 border border-green-500/20",
    closed: "bg-muted text-muted-foreground border border-border",
    cancelled: "bg-red-500/10 text-red-400 border border-red-500/20",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function PurchaseOrdersPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery<PaginatedResponse<PurchaseOrder>>({
    queryKey: ["purchaseorders", { search }],
    queryFn: () => api.get(`/purchaseorders?limit=50${search ? `&search=${search}` : ""}`),
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Purchase Orders"
        description="Manage supplier orders, receipts, and procurement."
        action={<Button className="shadow-md font-semibold"><Plus className="w-4 h-4 mr-2" /> New PO</Button>}
      />
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/50 flex gap-4 items-center bg-card/50">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search PO#..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 bg-background" />
          </div>
        </div>
        {isLoading ? (
          <div className="p-6"><LoadingTable /></div>
        ) : !data?.data?.length ? (
          <EmptyState icon={Package} title="No purchase orders" description="Create a PO to start procurement tracking." action={<Button variant="outline">Create PO</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-secondary/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">PO Number</TableHead>
                  <TableHead className="font-semibold">Vendor</TableHead>
                  <TableHead className="font-semibold">Order Date</TableHead>
                  <TableHead className="font-semibold">Required By</TableHead>
                  <TableHead className="font-semibold text-right">Total</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((po) => (
                  <TableRow key={po.id} className="hover:bg-secondary/20 transition-colors group">
                    <TableCell className="font-mono text-sm font-medium text-primary">{po.number}</TableCell>
                    <TableCell className="font-medium">{po.vendorName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {po.orderDate ? format(parseISO(po.orderDate), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {po.requestedDate ? format(parseISO(po.requestedDate), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold font-mono">
                      ${Number(po.totalAmount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell><StatusBadge status={po.status} /></TableCell>
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
