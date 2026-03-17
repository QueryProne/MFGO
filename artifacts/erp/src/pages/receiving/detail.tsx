import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Receipt } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  PackageCheck, ArrowLeft, CheckCircle, Building2, FileText,
  MapPin, User, ClipboardList,
} from "lucide-react";

const STATUS_COLOR: Record<string, string> = {
  draft:     "bg-zinc-700 text-zinc-200",
  pending:   "bg-amber-900/60 text-amber-200",
  confirmed: "bg-emerald-900/60 text-emerald-200",
  rejected:  "bg-red-900/60 text-red-200",
};
const INSPECT_COLOR: Record<string, string> = {
  not_required: "bg-zinc-700 text-zinc-300",
  pending:      "bg-amber-900/60 text-amber-200",
  passed:       "bg-emerald-900/60 text-emerald-200",
  failed:       "bg-red-900/60 text-red-200",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">{label}</div>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

export default function ReceiptDetail() {
  const [, params] = useRoute("/receiving/:id");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: receipt, isLoading } = useQuery<Receipt>({
    queryKey: ["receipt", params?.id],
    queryFn: () => api.get(`/receiving/${params!.id}`),
    enabled: !!params?.id,
  });

  const confirmMut = useMutation({
    mutationFn: () => api.post(`/receiving/${params!.id}/confirm`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["receipt", params?.id] });
      qc.invalidateQueries({ queryKey: ["receiving"] });
      toast({ title: "Receipt confirmed", description: "Inventory updated successfully." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
      </div>
    );
  }
  if (!receipt) return <div className="p-8 text-muted-foreground">Receipt not found.</div>;

  const lines = receipt.lines ?? [];
  const totalReceived = lines.reduce((s, l) => s + Number(l.receivedQty), 0);
  const totalAccepted = lines.reduce((s, l) => s + Number(l.acceptedQty), 0);
  const totalRejected = lines.reduce((s, l) => s + Number(l.rejectedQty), 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-border bg-card/40">
        <Link to="/receiving">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Receiving
          </Button>
        </Link>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-3 flex-1">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <PackageCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold font-display text-foreground font-mono">{receipt.number}</h1>
            <p className="text-xs text-muted-foreground">{receipt.vendor?.name ?? "—"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn("text-xs", STATUS_COLOR[receipt.status] ?? "bg-zinc-700 text-zinc-200")}>
            {receipt.status.charAt(0).toUpperCase() + receipt.status.slice(1)}
          </Badge>
          {receipt.status !== "confirmed" && (
            <Button
              size="sm"
              className="gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white"
              onClick={() => confirmMut.mutate()}
              disabled={confirmMut.isPending}
            >
              <CheckCircle className="h-3.5 w-3.5" />
              {confirmMut.isPending ? "Confirming…" : "Confirm Receipt"}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Received", val: totalReceived, cls: "text-foreground" },
            { label: "Accepted", val: totalAccepted, cls: "text-emerald-400" },
            { label: "Rejected", val: totalRejected, cls: "text-red-400" },
            { label: "Lines", val: lines.length, cls: "text-foreground" },
          ].map(({ label, val, cls }) => (
            <div key={label} className="bg-card border border-border rounded-lg p-3 text-center">
              <div className={cn("text-2xl font-bold tabular-nums", cls)}>{val}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>

        {/* Header Details */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Receipt Details
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Receipt Date">{receipt.receiptDate ?? "—"}</Field>
            <Field label="Packing Slip">{receipt.packingSlipNumber ?? "—"}</Field>
            <Field label="Inspection Required">{receipt.inspectionRequired ? "Yes" : "No"}</Field>
            <Field label="Received By">{receipt.receivedBy ?? "—"}</Field>
          </div>
        </div>

        {/* Vendor & PO */}
        <div className="grid grid-cols-2 gap-4">
          {receipt.vendor && (
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> Vendor
              </h3>
              <div className="space-y-2">
                <Field label="Name">
                  <Link to={`/vendors/${receipt.vendor.id}`} className="text-primary hover:underline">
                    {receipt.vendor.name}
                  </Link>
                </Field>
                <Field label="Vendor #">{receipt.vendor.number}</Field>
                {receipt.vendor.email && <Field label="Email">{receipt.vendor.email}</Field>}
                {receipt.vendor.phone && <Field label="Phone">{receipt.vendor.phone}</Field>}
              </div>
            </div>
          )}
          {receipt.purchaseOrder && (
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3 flex items-center gap-1.5">
                <ClipboardList className="h-3.5 w-3.5" /> Purchase Order
              </h3>
              <div className="space-y-2">
                <Field label="PO Number">
                  <Link to={`/purchaseorders/${receipt.purchaseOrder.id}`} className="text-primary hover:underline font-mono">
                    {receipt.purchaseOrder.number}
                  </Link>
                </Field>
                <Field label="PO Status">
                  <Badge className="text-xs">{receipt.purchaseOrder.status}</Badge>
                </Field>
                {receipt.purchaseOrder.orderDate && <Field label="Order Date">{receipt.purchaseOrder.orderDate}</Field>}
                {receipt.purchaseOrder.totalAmount && <Field label="Total">${Number(receipt.purchaseOrder.totalAmount).toLocaleString()}</Field>}
              </div>
            </div>
          )}
        </div>

        {/* Receipt Lines */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Received Lines</h3>
            <Badge variant="outline" className="text-xs">{lines.length}</Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs text-muted-foreground w-8">#</TableHead>
                <TableHead className="text-xs text-muted-foreground">Item</TableHead>
                <TableHead className="text-xs text-muted-foreground w-28 text-right">Received</TableHead>
                <TableHead className="text-xs text-muted-foreground w-28 text-right">Accepted</TableHead>
                <TableHead className="text-xs text-muted-foreground w-28 text-right">Rejected</TableHead>
                <TableHead className="text-xs text-muted-foreground w-28 text-right">Unit Cost</TableHead>
                <TableHead className="text-xs text-muted-foreground w-24">Lot / Serial</TableHead>
                <TableHead className="text-xs text-muted-foreground w-24">Inspection</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                    No lines on this receipt.
                  </TableCell>
                </TableRow>
              ) : (
                lines.map((line) => (
                  <TableRow key={line.id} className="border-border hover:bg-muted/20">
                    <TableCell className="text-xs text-muted-foreground">{line.lineNumber}</TableCell>
                    <TableCell>
                      <div>
                        <Link to={`/items/${line.itemId}`} className="text-sm font-medium text-primary hover:underline">
                          {line.itemNumber}
                        </Link>
                        <div className="text-xs text-muted-foreground">{line.itemName}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums font-mono">
                      {Number(line.receivedQty).toLocaleString()} {line.uom}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums font-mono text-emerald-400">
                      {Number(line.acceptedQty).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums font-mono text-red-400">
                      {Number(line.rejectedQty).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {line.unitCost ? `$${Number(line.unitCost).toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate" title={line.serialNumbers ?? line.lotNumber ?? undefined}>
                      {line.lotNumber ? <span className="text-amber-400">{line.lotNumber}</span> : null}
                      {line.serialNumbers ? <span className="text-blue-400">{line.serialNumbers.split(",").length} S/N</span> : null}
                      {!line.lotNumber && !line.serialNumbers ? "—" : null}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs", INSPECT_COLOR[line.inspectionStatus ?? "not_required"])}>
                        {(line.inspectionStatus ?? "not_required").replace("_", " ")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {receipt.notes && (
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2">Notes</h3>
            <p className="text-sm text-muted-foreground">{receipt.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
