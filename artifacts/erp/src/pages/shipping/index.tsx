import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Truck } from "lucide-react";
import { PageHeader, EmptyState, LoadingTable } from "@/components/ui-patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { api, PaginatedResponse, Shipment } from "@/lib/api";
import { format, parseISO } from "date-fns";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground border border-border",
    packed: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    shipped: "bg-green-500/10 text-green-400 border border-green-500/20",
    delivered: "bg-green-600/10 text-green-500 border border-green-600/20",
    cancelled: "bg-red-500/10 text-red-400 border border-red-500/20",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function ShippingPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery<PaginatedResponse<Shipment>>({
    queryKey: ["shipments", { search }],
    queryFn: () => api.get(`/shipments?limit=50`),
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Shipping & Fulfillment"
        description="Track outbound shipments, carriers, and delivery status."
        action={<Button size="sm"><Plus className="w-4 h-4 mr-2" /> New Shipment</Button>}
      />
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/50 flex gap-4 items-center bg-card/50">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search shipments..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 bg-background" />
          </div>
        </div>
        {isLoading ? (
          <div className="p-6"><LoadingTable /></div>
        ) : !data?.data?.length ? (
          <EmptyState icon={Truck} title="No shipments" description="Create a shipment to start fulfillment tracking." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-secondary/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">Shipment #</TableHead>
                  <TableHead className="font-semibold">Customer</TableHead>
                  <TableHead className="font-semibold">Sales Order</TableHead>
                  <TableHead className="font-semibold">Ship Date</TableHead>
                  <TableHead className="font-semibold">Carrier</TableHead>
                  <TableHead className="font-semibold">Tracking</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((s) => (
                  <TableRow key={s.id} className="hover:bg-secondary/20 transition-colors">
                    <TableCell className="font-mono text-sm font-medium text-primary">{s.number}</TableCell>
                    <TableCell className="font-medium">{s.customerName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm font-mono">{s.salesOrderNumber}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {s.shippedDate ? format(parseISO(s.shippedDate), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{s.carrier ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-blue-400">{s.trackingNumber ?? "—"}</TableCell>
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
