import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Plus, Star, StarOff, Trash2, Package, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingTable, EmptyState } from "@/components/ui-patterns";
import { api, Item, ItemVendor, PaginatedResponse, Vendor } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const SUPPLY_TYPE_LABELS: Record<string, string> = {
  purchased: "Purchased",
  manufactured: "Manufactured",
  subassembly_stocked: "Subassembly (Stocked)",
  subassembly_order_built: "Subassembly (Order-Built)",
  phantom: "Phantom",
  service: "Service",
};

function ItemField({ label, value }: { label: string; value?: string | number | boolean | null }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">{label}</p>
      <p className="text-sm font-medium">{value == null || value === "" ? <span className="text-muted-foreground/50">—</span> : String(value)}</p>
    </div>
  );
}

function AddVendorDialog({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    vendorId: "", vendorPartNumber: "", isPreferred: false, isApproved: true,
    leadTimeDays: "", minOrderQty: "1", orderMultiple: "1", purchaseUom: "EA",
    safetyStockQty: "", reorderPointQty: "", lastCost: "", standardCost: "", notes: "",
  });

  const { data: vendors } = useQuery<PaginatedResponse<Vendor>>({
    queryKey: ["vendors-list"],
    queryFn: () => api.get("/vendors?limit=100"),
  });

  const save = useMutation({
    mutationFn: () => api.post(`/items/${itemId}/vendors`, {
      ...form,
      leadTimeDays: form.leadTimeDays ? Number(form.leadTimeDays) : null,
      isPreferred: form.isPreferred,
      isApproved: form.isApproved,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["item-vendors", itemId] });
      toast({ title: "Vendor assignment added" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const f = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-border/50">
        <DialogHeader><DialogTitle>Assign Vendor</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="col-span-2 space-y-2">
            <Label>Vendor *</Label>
            <Select value={form.vendorId} onValueChange={v => f("vendorId", v)}>
              <SelectTrigger className="bg-background"><SelectValue placeholder="Select vendor..." /></SelectTrigger>
              <SelectContent>
                {vendors?.data?.map(v => <SelectItem key={v.id} value={v.id}>{v.number} — {v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Vendor Part Number</Label>
            <Input value={form.vendorPartNumber} onChange={e => f("vendorPartNumber", e.target.value)} placeholder="VPN-001" className="bg-background" />
          </div>
          <div className="space-y-2">
            <Label>Purchase UOM</Label>
            <Input value={form.purchaseUom} onChange={e => f("purchaseUom", e.target.value)} placeholder="EA" className="bg-background" />
          </div>
          <div className="space-y-2">
            <Label>Lead Time (days)</Label>
            <Input type="number" value={form.leadTimeDays} onChange={e => f("leadTimeDays", e.target.value)} placeholder="7" className="bg-background" />
          </div>
          <div className="space-y-2">
            <Label>Min Order Qty</Label>
            <Input type="number" value={form.minOrderQty} onChange={e => f("minOrderQty", e.target.value)} className="bg-background" />
          </div>
          <div className="space-y-2">
            <Label>Safety Stock Qty</Label>
            <Input type="number" value={form.safetyStockQty} onChange={e => f("safetyStockQty", e.target.value)} className="bg-background" />
          </div>
          <div className="space-y-2">
            <Label>Reorder Point</Label>
            <Input type="number" value={form.reorderPointQty} onChange={e => f("reorderPointQty", e.target.value)} className="bg-background" />
          </div>
          <div className="space-y-2">
            <Label>Last Cost</Label>
            <Input type="number" value={form.lastCost} onChange={e => f("lastCost", e.target.value)} className="bg-background" />
          </div>
          <div className="space-y-2">
            <Label>Standard Cost</Label>
            <Input type="number" value={form.standardCost} onChange={e => f("standardCost", e.target.value)} className="bg-background" />
          </div>
          <div className="col-span-2 flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.isPreferred} onChange={e => f("isPreferred", e.target.checked)} className="rounded" />
              Preferred Vendor
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.isApproved} onChange={e => f("isApproved", e.target.checked)} className="rounded" />
              Approved
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!form.vendorId || save.isPending}>
            {save.isPending ? "Saving..." : "Add Vendor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [addVendor, setAddVendor] = useState(false);

  const { data: item, isLoading } = useQuery<Item>({
    queryKey: ["item", id],
    queryFn: () => api.get(`/items/${id}`),
  });

  const { data: vendorsData, isLoading: vendorsLoading } = useQuery<{ data: ItemVendor[] }>({
    queryKey: ["item-vendors", id],
    queryFn: () => api.get(`/items/${id}/vendors`),
  });

  const setPreferred = useMutation({
    mutationFn: ({ assignId, vendorId }: { assignId: string; vendorId: string }) =>
      api.put(`/items/${id}/vendors/${assignId}`, { isPreferred: true, vendorId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["item-vendors", id] }); toast({ title: "Preferred vendor updated" }); },
  });

  const removeVendor = useMutation({
    mutationFn: (assignId: string) => api.delete(`/items/${id}/vendors/${assignId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["item-vendors", id] }); toast({ title: "Vendor assignment removed" }); },
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading item...</div>;
  if (!item) return <div className="p-8 text-destructive">Item not found</div>;

  const vendors = vendorsData?.data ?? [];

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/items")} className="text-muted-foreground h-8 px-2">
          <ArrowLeft className="w-4 h-4 mr-1" /> Items
        </Button>
        <span className="text-muted-foreground/40">/</span>
        <span className="font-mono text-sm font-semibold">{item.number}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">{item.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">{item.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="font-mono text-xs bg-secondary/80 px-2 py-0.5 rounded border border-border/50">{item.number}</span>
            <span className="text-xs text-muted-foreground capitalize">{item.type?.replace(/_/g, " ")}</span>
            {item.revision && <span className="text-xs text-muted-foreground">Rev {item.revision}</span>}
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider border ${item.status === "active" ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-muted text-muted-foreground border-border"}`}>
              {item.status}
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm"><Pencil className="w-3.5 h-3.5 mr-2" />Edit</Button>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="border border-border/50 bg-card/50">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="purchasing">Purchasing <span className="ml-1.5 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">{vendors.length}</span></TabsTrigger>
          <TabsTrigger value="planning">Planning</TabsTrigger>
        </TabsList>

        {/* GENERAL TAB */}
        <TabsContent value="general">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Item Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <ItemField label="Part Number" value={item.number} />
                <ItemField label="Name" value={item.name} />
                <ItemField label="Type" value={item.type?.replace(/_/g, " ")} />
                <ItemField label="UOM" value={item.uom} />
                <ItemField label="Revision" value={item.revision} />
                <ItemField label="Status" value={item.status} />
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Supply & Costing</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <ItemField label="Supply Type" value={SUPPLY_TYPE_LABELS[item.supplyType ?? ""] ?? item.supplyType} />
                <ItemField label="Make / Buy" value={item.makeBuy} />
                <ItemField label="Standard Cost" value={item.standardCost ? `$${Number(item.standardCost).toFixed(4)}` : undefined} />
                <ItemField label="List Price" value={item.listPrice ? `$${Number(item.listPrice).toFixed(2)}` : undefined} />
                <ItemField label="Lead Time (days)" value={item.leadTime} />
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Inventory Control</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <ItemField label="Safety Stock" value={item.safetyStock} />
                <ItemField label="Reorder Point" value={item.reorderPoint} />
                <ItemField label="Reorder Qty" value={item.reorderQty} />
                <ItemField label="Lot Tracked" value={item.lotTracked ? "Yes" : "No"} />
                <ItemField label="Serial Tracked" value={item.serialTracked ? "Yes" : "No"} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* PURCHASING TAB */}
        <TabsContent value="purchasing">
          <Card className="border-border/50 overflow-hidden">
            <div className="p-4 border-b border-border/50 flex items-center justify-between bg-card/50">
              <div>
                <h3 className="font-semibold text-sm">Vendor Assignments</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Manage approved vendors, lead times, MOQs, and purchasing costs.</p>
              </div>
              <Button size="sm" onClick={() => setAddVendor(true)}><Plus className="w-4 h-4 mr-2" />Add Vendor</Button>
            </div>
            {vendorsLoading ? (
              <div className="p-6"><LoadingTable /></div>
            ) : !vendors.length ? (
              <EmptyState icon={Package} title="No vendors assigned" description="Assign approved vendors for purchasing control and MRP planning." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-secondary/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-semibold text-xs">Preferred</TableHead>
                      <TableHead className="font-semibold text-xs">Vendor</TableHead>
                      <TableHead className="font-semibold text-xs">Vendor Part #</TableHead>
                      <TableHead className="font-semibold text-xs text-right">Lead (days)</TableHead>
                      <TableHead className="font-semibold text-xs text-right">MOQ</TableHead>
                      <TableHead className="font-semibold text-xs">UOM</TableHead>
                      <TableHead className="font-semibold text-xs text-right">Safety Stock</TableHead>
                      <TableHead className="font-semibold text-xs text-right">Reorder Pt</TableHead>
                      <TableHead className="font-semibold text-xs text-right">Last Cost</TableHead>
                      <TableHead className="font-semibold text-xs text-right">Std Cost</TableHead>
                      <TableHead className="font-semibold text-xs">Approved</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendors.map((iv) => (
                      <TableRow key={iv.id} className={`hover:bg-secondary/20 transition-colors ${iv.isPreferred ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}>
                        <TableCell>
                          <button
                            onClick={() => !iv.isPreferred && setPreferred.mutate({ assignId: iv.id, vendorId: iv.vendorId })}
                            className={`transition-colors ${iv.isPreferred ? "text-amber-400" : "text-muted-foreground hover:text-amber-400"}`}
                            title={iv.isPreferred ? "Preferred" : "Set as preferred"}
                          >
                            {iv.isPreferred ? <Star className="w-4 h-4 fill-current" /> : <StarOff className="w-4 h-4" />}
                          </button>
                        </TableCell>
                        <TableCell>
                          <p className="font-mono text-xs font-semibold">{iv.vendorNumber}</p>
                          <p className="text-xs text-muted-foreground">{iv.vendorName}</p>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{iv.vendorPartNumber ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{iv.leadTimeDays ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{iv.minOrderQty ?? "—"}</TableCell>
                        <TableCell className="text-xs">{iv.purchaseUom ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{iv.safetyStockQty ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{iv.reorderPointQty ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {iv.lastCost ? `$${Number(iv.lastCost).toFixed(4)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {iv.standardCost ? `$${Number(iv.standardCost).toFixed(4)}` : "—"}
                        </TableCell>
                        <TableCell>
                          {iv.isApproved
                            ? <span className="text-green-400"><Check className="w-4 h-4" /></span>
                            : <span className="text-red-400"><X className="w-4 h-4" /></span>}
                        </TableCell>
                        <TableCell>
                          <button onClick={() => removeVendor.mutate(iv.id)} className="text-muted-foreground hover:text-red-400 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* PLANNING TAB */}
        <TabsContent value="planning">
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Default Planning Parameters</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <ItemField label="Supply Type" value={SUPPLY_TYPE_LABELS[item.supplyType ?? ""] ?? item.supplyType} />
                <ItemField label="Default Lead Time" value={item.leadTime ? `${item.leadTime} days` : undefined} />
                <ItemField label="Default Safety Stock" value={item.safetyStock} />
                <ItemField label="Default Reorder Point" value={item.reorderPoint} />
                <ItemField label="Default Reorder Qty" value={item.reorderQty} />
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Planning Notes</CardTitle></CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Item-level parameters are used as fallback defaults. Vendor-specific parameters (lead time, safety stock, reorder point) on the Purchasing tab take precedence during MRP runs when a preferred approved vendor is assigned.
                </p>
                {vendors.some(v => v.isPreferred && v.isApproved) ? (
                  <div className="mt-3 p-2 rounded bg-green-500/10 border border-green-500/20 text-xs text-green-400">
                    ✓ Preferred approved vendor assigned — vendor-level parameters active
                  </div>
                ) : (
                  <div className="mt-3 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                    ⚠ No preferred approved vendor — item-level defaults used, vendor exception raised in MRP
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {addVendor && <AddVendorDialog itemId={id!} onClose={() => setAddVendor(false)} />}
    </div>
  );
}
