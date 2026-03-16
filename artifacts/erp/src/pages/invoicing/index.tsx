import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, FileText, DollarSign } from "lucide-react";
import { PageHeader, EmptyState, LoadingTable } from "@/components/ui-patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { api, PaginatedResponse, Invoice } from "@/lib/api";
import { format, parseISO } from "date-fns";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground border border-border",
    sent: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    partially_paid: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    paid: "bg-green-500/10 text-green-400 border border-green-500/20",
    overdue: "bg-red-500/10 text-red-400 border border-red-500/20",
    cancelled: "bg-muted text-muted-foreground border border-border",
    voided: "bg-muted text-muted-foreground border border-border",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function InvoicingPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery<PaginatedResponse<Invoice>>({
    queryKey: ["invoices", { search }],
    queryFn: () => api.get(`/invoices?limit=50`),
  });

  const totalOutstanding = data?.data
    .filter(i => !["paid", "cancelled", "voided"].includes(i.status))
    .reduce((s, i) => s + Number(i.totalAmount ?? 0) - Number(i.amountPaid ?? 0), 0) ?? 0;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Invoicing"
        description="Manage accounts receivable, payments, and billing."
        action={<Button size="sm"><Plus className="w-4 h-4 mr-2" /> New Invoice</Button>}
      />

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Outstanding A/R", value: `$${totalOutstanding.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, cls: "text-amber-400" },
          { label: "Total Invoices", value: (data?.meta?.total ?? 0).toString(), cls: "text-foreground" },
          { label: "Overdue", value: (data?.data?.filter(i => i.status === "overdue").length ?? 0).toString(), cls: "text-red-400" },
        ].map((kpi) => (
          <Card key={kpi.label} className="border-border/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{kpi.label}</p>
              <p className={`text-2xl font-bold mt-1 ${kpi.cls}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/50 flex gap-4 items-center bg-card/50">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search invoices..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 bg-background" />
          </div>
        </div>
        {isLoading ? (
          <div className="p-6"><LoadingTable /></div>
        ) : !data?.data?.length ? (
          <EmptyState icon={FileText} title="No invoices" description="Invoices are generated from shipped orders." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-secondary/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">Invoice #</TableHead>
                  <TableHead className="font-semibold">Customer</TableHead>
                  <TableHead className="font-semibold">Sales Order</TableHead>
                  <TableHead className="font-semibold">Invoice Date</TableHead>
                  <TableHead className="font-semibold">Due Date</TableHead>
                  <TableHead className="font-semibold text-right">Total</TableHead>
                  <TableHead className="font-semibold text-right">Paid</TableHead>
                  <TableHead className="font-semibold text-right">Balance</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((inv) => {
                  const balance = Number(inv.totalAmount ?? 0) - Number(inv.amountPaid ?? 0);
                  return (
                    <TableRow key={inv.id} className="hover:bg-secondary/20 transition-colors">
                      <TableCell className="font-mono text-sm font-medium text-primary">{inv.number}</TableCell>
                      <TableCell className="font-medium">{inv.customerName}</TableCell>
                      <TableCell className="text-muted-foreground text-sm font-mono">{inv.salesOrderNumber ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {inv.invoiceDate ? format(parseISO(inv.invoiceDate), "MMM d, yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {inv.dueDate ? format(parseISO(inv.dueDate), "MMM d, yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        ${Number(inv.totalAmount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-green-400">
                        ${Number(inv.amountPaid ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm font-bold ${balance > 0 ? "text-amber-400" : "text-green-400"}`}>
                        ${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell><StatusBadge status={inv.status} /></TableCell>
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
