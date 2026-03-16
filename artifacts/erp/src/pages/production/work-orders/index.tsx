import { useState } from "react";
import { Link } from "wouter";
import { Plus, Search, Filter, Factory, Play, CheckCircle2 } from "lucide-react";
import { PageHeader, StatusBadge, EmptyState, LoadingTable } from "@/components/ui-patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { useListWorkOrders } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";

export default function WorkOrdersList() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useListWorkOrders({ search, limit: 50 });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Production" 
        description="Track manufacturing work orders and shop floor progress."
        action={
          <Button className="shadow-md font-semibold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary">
            <Plus className="w-4 h-4 mr-2" /> Create WO
          </Button>
        }
      />

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row gap-4 items-center justify-between bg-card/50">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search WO# or Item..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-background"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-6"><LoadingTable /></div>
        ) : !data?.data?.length ? (
          <EmptyState 
            icon={Factory}
            title="No work orders" 
            description="Release a work order to start production tracking."
            action={<Button variant="outline">Create WO</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-secondary/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold text-foreground">WO Number</TableHead>
                  <TableHead className="font-semibold text-foreground">Item</TableHead>
                  <TableHead className="font-semibold text-foreground">Qty</TableHead>
                  <TableHead className="font-semibold text-foreground">Due Date</TableHead>
                  <TableHead className="font-semibold text-foreground w-[150px]">Progress</TableHead>
                  <TableHead className="font-semibold text-foreground">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((wo) => {
                  const qtyCompleted = Number(wo.quantityCompleted || 0);
                  const qtyOrdered = Number(wo.quantityOrdered || 1);
                  const progress = Math.min(100, (qtyCompleted / qtyOrdered) * 100);
                  
                  return (
                    <TableRow key={wo.id} className="group hover:bg-secondary/20 transition-colors">
                      <TableCell className="font-medium text-foreground">
                        <Link href={`/workorders/${wo.id}`} className="hover:underline decoration-primary underline-offset-4 font-mono text-sm">
                          {wo.number}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{wo.itemNumber}</span>
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">{wo.itemName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        <span className={qtyCompleted > 0 ? "text-foreground" : ""}>{qtyCompleted}</span> / {qtyOrdered}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {wo.scheduledEnd ? format(new Date(wo.scheduledEnd), 'MMM d') : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={progress} className="h-2 w-full" />
                          <span className="text-[10px] font-mono text-muted-foreground">{Math.round(progress)}%</span>
                        </div>
                      </TableCell>
                      <TableCell><StatusBadge status={wo.status} /></TableCell>
                      <TableCell className="text-right">
                        {wo.status === 'released' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs bg-secondary hover:bg-primary/20 hover:text-primary transition-colors border-border/50">
                            <Play className="w-3 h-3 mr-1.5" /> Start
                          </Button>
                        )}
                        {wo.status === 'in_progress' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20 transition-colors">
                            <CheckCircle2 className="w-3 h-3 mr-1.5" /> Complete
                          </Button>
                        )}
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
