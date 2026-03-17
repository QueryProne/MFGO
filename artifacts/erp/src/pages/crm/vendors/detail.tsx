import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type Vendor, type VendorAddress, type VendorContact } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Building2, ArrowLeft, Mail, Phone, Globe, MapPin, Star,
  CheckCircle, Users, ClipboardList, Plus, Trash2, User,
  ShieldCheck, BadgeCheck,
} from "lucide-react";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">{label}</div>
      <div className="text-sm text-foreground">{children || "—"}</div>
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  active:   "bg-emerald-900/60 text-emerald-200",
  inactive: "bg-zinc-700 text-zinc-300",
  hold:     "bg-red-900/60 text-red-200",
};

const PO_STATUS_COLOR: Record<string, string> = {
  draft:    "bg-zinc-700 text-zinc-300",
  sent:     "bg-blue-900/60 text-blue-200",
  partial:  "bg-amber-900/60 text-amber-200",
  received: "bg-emerald-900/60 text-emerald-200",
  closed:   "bg-zinc-800 text-zinc-400",
};

function AddressCard({ addr, onDelete }: { addr: VendorAddress; onDelete: () => void }) {
  return (
    <div className="bg-muted/20 border border-border rounded-lg p-3 space-y-1 relative group">
      {addr.isDefault && (
        <Badge className="absolute top-2 right-2 text-[10px] bg-primary/20 text-primary border border-primary/30">Default</Badge>
      )}
      <div className="text-xs font-semibold uppercase text-muted-foreground/70 tracking-wide">
        {addr.addressType.replace("_", " ")}
      </div>
      {addr.name && <div className="text-sm font-medium text-foreground">{addr.name}</div>}
      <div className="text-sm text-muted-foreground">
        <div>{addr.line1}</div>
        {addr.line2 && <div>{addr.line2}</div>}
        <div>{[addr.city, addr.state, addr.postalCode].filter(Boolean).join(", ")} {addr.country}</div>
      </div>
      <button
        onClick={onDelete}
        className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-400"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ContactRow({ contact, onDelete }: { contact: VendorContact; onDelete: () => void }) {
  return (
    <TableRow className="border-border hover:bg-muted/20 group">
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-medium text-primary">
            {contact.firstName[0]}{contact.lastName[0]}
          </div>
          <div>
            <div className="text-sm font-medium text-foreground">
              {contact.firstName} {contact.lastName}
              {contact.isPrimary && <Star className="inline h-3 w-3 ml-1 text-amber-400 fill-amber-400" />}
            </div>
            {contact.title && <div className="text-xs text-muted-foreground">{contact.title}</div>}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{contact.department ?? "—"}</TableCell>
      <TableCell>
        {contact.email ? (
          <a href={`mailto:${contact.email}`} className="text-xs text-primary hover:underline">{contact.email}</a>
        ) : <span className="text-xs text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{contact.phone ?? "—"}</TableCell>
      <TableCell>
        <div className="flex gap-1 flex-wrap">
          {contact.isPurchasingContact && <Badge className="text-[10px] bg-blue-900/40 text-blue-300">Purchasing</Badge>}
          {contact.isQualityContact && <Badge className="text-[10px] bg-purple-900/40 text-purple-300">Quality</Badge>}
          {contact.isAccountingContact && <Badge className="text-[10px] bg-amber-900/40 text-amber-300">Accounting</Badge>}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function VendorDetail() {
  const [, params] = useRoute("/vendors/:id");
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("overview");

  const { data: vendor, isLoading } = useQuery<Vendor>({
    queryKey: ["vendor", params?.id],
    queryFn: () => api.get(`/vendors/${params!.id}`),
    enabled: !!params?.id,
  });

  const deleteAddr = useMutation({
    mutationFn: (addrId: string) => api.delete(`/vendors/${params!.id}/addresses/${addrId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vendor", params?.id] }); toast({ title: "Address removed" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteContact = useMutation({
    mutationFn: (cid: string) => api.delete(`/vendors/${params!.id}/contacts/${cid}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vendor", params?.id] }); toast({ title: "Contact removed" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
    </div>
  );
  if (!vendor) return <div className="p-8 text-muted-foreground">Vendor not found.</div>;

  const addresses = vendor.addresses ?? [];
  const contacts = vendor.contacts ?? [];
  const recentPOs = vendor.recentPOs ?? [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-border bg-card/40">
        <Link to="/vendors">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Vendors
          </Button>
        </Link>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-3 flex-1">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold font-display text-foreground">{vendor.name}</h1>
            <p className="text-xs text-muted-foreground font-mono">{vendor.number} · {vendor.vendorType?.replace("_", " ")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {vendor.isPreferred && (
            <Badge className="gap-1 bg-amber-900/40 text-amber-300 border-amber-700/40">
              <Star className="h-3 w-3 fill-amber-400" /> Preferred
            </Badge>
          )}
          {vendor.isApproved && (
            <Badge className="gap-1 bg-emerald-900/40 text-emerald-300 border-emerald-700/40">
              <BadgeCheck className="h-3 w-3" /> Approved
            </Badge>
          )}
          <Badge className={cn("text-xs", STATUS_COLOR[vendor.status] ?? "bg-zinc-700 text-zinc-200")}>
            {vendor.status}
          </Badge>
          <Button size="sm" variant="outline">Edit</Button>
          <Link to="/purchaseorders">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New PO
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="mx-6 mt-3 mb-0 self-start bg-muted/30 border border-border/50">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="addresses" className="text-xs">
              Addresses {addresses.length > 0 && <Badge variant="outline" className="ml-1 text-[10px] px-1">{addresses.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="contacts" className="text-xs">
              Contacts {contacts.length > 0 && <Badge variant="outline" className="ml-1 text-[10px] px-1">{contacts.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="pos" className="text-xs">
              Purchase Orders {recentPOs.length > 0 && <Badge variant="outline" className="ml-1 text-[10px] px-1">{recentPOs.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto p-6 pt-4">
            {/* ── OVERVIEW ── */}
            <TabsContent value="overview" className="space-y-4 mt-0">
              <div className="grid grid-cols-3 gap-4">
                {/* Contact Info */}
                <div className="col-span-1 bg-card border border-border rounded-lg p-4 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Contact Info</h3>
                  {vendor.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <a href={`mailto:${vendor.email}`} className="text-primary hover:underline truncate">{vendor.email}</a>
                    </div>
                  )}
                  {vendor.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0" />{vendor.phone}
                    </div>
                  )}
                  {vendor.website && (
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">{vendor.website}</a>
                    </div>
                  )}
                  {vendor.billingAddress && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span className="text-xs leading-relaxed">{vendor.billingAddress}</span>
                    </div>
                  )}
                </div>

                {/* Purchasing Terms */}
                <div className="col-span-1 bg-card border border-border rounded-lg p-4 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Purchasing Terms</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Payment Terms">{vendor.paymentTerms}</Field>
                    <Field label="Currency">{vendor.currency}</Field>
                    <Field label="Lead Time">{vendor.leadTime ? `${vendor.leadTime} days` : "—"}</Field>
                    <Field label="Type">{vendor.vendorType?.replace("_", " ")}</Field>
                  </div>
                </div>

                {/* Status / Stats */}
                <div className="col-span-1 bg-card border border-border rounded-lg p-4 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Status</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Approved</span>
                      <div className={cn("h-2 w-2 rounded-full", vendor.isApproved ? "bg-emerald-400" : "bg-zinc-600")} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Preferred</span>
                      <div className={cn("h-2 w-2 rounded-full", vendor.isPreferred ? "bg-amber-400" : "bg-zinc-600")} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Open POs</span>
                      <span className="text-sm font-medium tabular-nums text-foreground">
                        {recentPOs.filter(p => !["closed", "received"].includes(p.status)).length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Contacts</span>
                      <span className="text-sm font-medium tabular-nums text-foreground">{contacts.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Primary contact preview */}
              {contacts.filter(c => c.isPrimary).map(c => (
                <div key={c.id} className="bg-card border border-border rounded-lg p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" /> Primary Contact
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-medium text-primary">
                      {c.firstName[0]}{c.lastName[0]}
                    </div>
                    <div className="flex-1 grid grid-cols-4 gap-3">
                      <Field label="Name">{c.firstName} {c.lastName}</Field>
                      <Field label="Title">{c.title}</Field>
                      <Field label="Email">{c.email ? <a href={`mailto:${c.email}`} className="text-primary hover:underline">{c.email}</a> : "—"}</Field>
                      <Field label="Phone">{c.phone}</Field>
                    </div>
                  </div>
                </div>
              ))}

              {vendor.notes && (
                <div className="bg-card border border-border rounded-lg p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2">Notes</h3>
                  <p className="text-sm text-muted-foreground">{vendor.notes}</p>
                </div>
              )}
            </TabsContent>

            {/* ── ADDRESSES ── */}
            <TabsContent value="addresses" className="mt-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-foreground">Addresses ({addresses.length})</h3>
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add Address
                </Button>
              </div>
              {addresses.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                  <MapPin className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No addresses on file.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {addresses.map(a => (
                    <AddressCard key={a.id} addr={a} onDelete={() => deleteAddr.mutate(a.id)} />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── CONTACTS ── */}
            <TabsContent value="contacts" className="mt-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-foreground">Contacts ({contacts.length})</h3>
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add Contact
                </Button>
              </div>
              {contacts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No contacts on file.
                </div>
              ) : (
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-xs text-muted-foreground">Name</TableHead>
                        <TableHead className="text-xs text-muted-foreground">Department</TableHead>
                        <TableHead className="text-xs text-muted-foreground">Email</TableHead>
                        <TableHead className="text-xs text-muted-foreground">Phone</TableHead>
                        <TableHead className="text-xs text-muted-foreground">Roles</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contacts.map(c => (
                        <ContactRow key={c.id} contact={c} onDelete={() => deleteContact.mutate(c.id)} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* ── PURCHASE ORDERS ── */}
            <TabsContent value="pos" className="mt-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-foreground">Recent Purchase Orders</h3>
                <Link to="/purchaseorders">
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> New PO
                  </Button>
                </Link>
              </div>
              {recentPOs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                  <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No purchase orders found for this vendor.
                </div>
              ) : (
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-xs text-muted-foreground">PO Number</TableHead>
                        <TableHead className="text-xs text-muted-foreground">Status</TableHead>
                        <TableHead className="text-xs text-muted-foreground">Order Date</TableHead>
                        <TableHead className="text-xs text-muted-foreground">Needed By</TableHead>
                        <TableHead className="text-xs text-muted-foreground text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentPOs.map(po => (
                        <TableRow key={po.id} className="border-border hover:bg-muted/20">
                          <TableCell>
                            <Link to={`/purchaseorders/${po.id}`} className="font-mono text-xs text-primary hover:underline">
                              {po.number}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("text-xs", PO_STATUS_COLOR[po.status] ?? "bg-zinc-700 text-zinc-300")}>
                              {po.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{po.orderDate ?? "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{po.requestedDate ?? "—"}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums text-foreground">
                            {po.totalAmount ? `$${Number(po.totalAmount).toLocaleString()}` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
