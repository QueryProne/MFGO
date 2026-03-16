import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Boxes, ArrowUpDown } from "lucide-react";
import { PageHeader, EmptyState, LoadingTable } from "@/components/ui-patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, PaginatedResponse, InventoryBalance } from "@/lib/api";

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery<PaginatedResponse<InventoryBalance>>({
    queryKey: ["inventory", { search }],
    queryFn: () => api.get(`/inventory?limit=100${search ? `&search=${search}` : ""}`),
  });

  const getStockStatus = (bal: InventoryBalance) => {
    const onHand = Number(bal.quantityOnHand);
    if (onHand <= 0) return { label: "Out of Stock", cls: "bg-red-500/10 text-red-400 border border-red-500/20" };
    if (onHand < 10) return { label: "Low Stock", cls: "bg-amber-500/10 text-amber-400 border border-amber-500/20" };
    return { label: "In Stock", cls: "bg-green-500/10 text-green-400 border border-green-500/20" };
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Inventory Control"
        description="Real-time stock levels, allocations, and warehouse locations."
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm">Cycle Count</Button>
            <Button size="sm"><ArrowUpDown className="w-4 h-4 mr-2" /> Transfer</Button>
          </div>
        }
      />
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/50 flex gap-4 items-center bg-card/50">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 bg-background" />
          </div>
        </div>
        {isLoading ? (
          <div className="p-6"><LoadingTable /></div>
        ) : !data?.data?.length ? (
          <EmptyState icon={Boxes} title="No inventory records" description="Post a receipt or transfer to create inventory balances." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-secondary/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">Item</TableHead>
                  <TableHead className="font-semibold">Warehouse</TableHead>
                  <TableHead className="font-semibold text-right">On Hand</TableHead>
                  <TableHead className="font-semibold text-right">Allocated</TableHead>
                  <TableHead className="font-semibold text-right">On Order</TableHead>
                  <TableHead className="font-semibold text-right">Available</TableHead>
                  <TableHead className="font-semibold">UOM</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((bal) => {
                  const stockStatus = getStockStatus(bal);
                  return (
                    <TableRow key={bal.id} className="hover:bg-secondary/20 transition-colors">
                      <TableCell>
                        <div>
                          <p className="font-mono text-sm font-medium">{bal.itemNumber}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{bal.itemName}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{bal.warehouseName}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {Number(bal.quantityOnHand).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-amber-400">
                        {Number(bal.quantityAllocated).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-blue-400">
                        {Number(bal.quantityOnOrder).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-bold text-green-400">
                        {Number(bal.quantityAvailable).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs uppercase">{bal.uom ?? "EA"}</TableCell>
                      <TableCell>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${stockStatus.cls}`}>
                          {stockStatus.label}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
