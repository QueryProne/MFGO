import { useState } from "react";
import { Link } from "wouter";
import { Plus, Search, Filter, Boxes, MoreHorizontal } from "lucide-react";
import { PageHeader, StatusBadge, EmptyState, LoadingTable } from "@/components/ui-patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { useListItems } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";

export default function ItemsList() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useListItems({ search, limit: 50 });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Item Master" 
        description="Manage all parts, materials, and finished goods."
        action={
          <Button className="shadow-md font-semibold">
            <Plus className="w-4 h-4 mr-2" /> Create Item
          </Button>
        }
      />

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row gap-4 items-center justify-between bg-card/50">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search part numbers or names..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-background"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" className="w-full sm:w-auto bg-background"><Filter className="w-4 h-4 mr-2" /> Type</Button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-6"><LoadingTable /></div>
        ) : !data?.data?.length ? (
          <EmptyState 
            icon={Boxes}
            title="No items found" 
            description="Add your first item to build your master database."
            action={<Button variant="outline">Create Item</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-secondary/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold text-foreground">Part Number</TableHead>
                  <TableHead className="font-semibold text-foreground">Description</TableHead>
                  <TableHead className="font-semibold text-foreground">Type</TableHead>
                  <TableHead className="font-semibold text-foreground">UOM</TableHead>
                  <TableHead className="font-semibold text-foreground">Cost</TableHead>
                  <TableHead className="font-semibold text-foreground">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((item) => (
                  <TableRow key={item.id} className="group hover:bg-secondary/20 transition-colors">
                    <TableCell className="font-medium text-foreground">
                      <Link href={`/items/${item.id}`} className="hover:underline decoration-primary underline-offset-4 font-mono text-sm">
                        {item.number}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="truncate max-w-[250px]" title={item.name}>{item.name}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-secondary text-secondary-foreground font-normal rounded-sm">
                        {item.type.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs uppercase">{item.uom || 'EA'}</TableCell>
                    <TableCell className="font-mono text-sm">
                      ${Number(item.standardCost || 0).toFixed(2)}
                    </TableCell>
                    <TableCell><StatusBadge status={item.status} /></TableCell>
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
