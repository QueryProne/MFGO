import { useState } from "react";
import { Link } from "wouter";
import { Plus, Search, Filter, ShoppingCart } from "lucide-react";
import { PageHeader, StatusBadge, EmptyState, LoadingTable } from "@/components/ui-patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { useListSalesOrders } from "@workspace/api-client-react";
import { format } from "date-fns";

export default function SalesOrdersList() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useListSalesOrders({ search, limit: 50 });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Sales Orders" 
        description="Manage customer orders and fulfillment status."
        action={
          <Button className="shadow-md font-semibold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary">
            <Plus className="w-4 h-4 mr-2" /> New Order
          </Button>
        }
      />

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row gap-4 items-center justify-between bg-card/50">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by SO# or customer..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-background"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" className="w-full sm:w-auto bg-background"><Filter className="w-4 h-4 mr-2" /> Status</Button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-6"><LoadingTable /></div>
        ) : !data?.data?.length ? (
          <EmptyState 
            icon={ShoppingCart}
            title="No sales orders found" 
            description="Create a new sales order to get started."
            action={<Button variant="outline">Create Order</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-secondary/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold text-foreground">Order #</TableHead>
                  <TableHead className="font-semibold text-foreground">Customer</TableHead>
                  <TableHead className="font-semibold text-foreground">Date</TableHead>
                  <TableHead className="font-semibold text-foreground">Amount</TableHead>
                  <TableHead className="font-semibold text-foreground">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((order) => (
                  <TableRow key={order.id} className="group hover:bg-secondary/20 transition-colors cursor-pointer">
                    <TableCell className="font-medium text-foreground">
                      <Link href={`/salesorders/${order.id}`} className="hover:underline decoration-primary underline-offset-4">
                        {order.number}
                      </Link>
                    </TableCell>
                    <TableCell>{order.customerName || 'Unknown Customer'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {order.orderDate ? format(new Date(order.orderDate), 'MMM d, yyyy') : '-'}
                    </TableCell>
                    <TableCell className="font-mono text-sm font-medium">
                      ${(order.totalAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </TableCell>
                    <TableCell><StatusBadge status={order.status} /></TableCell>
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
