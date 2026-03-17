import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { api, type Vendor, type PaginatedResponse } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  Building2, Search, ChevronRight, Plus, Star, BadgeCheck, RefreshCw, Truck,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_COLOR: Record<string, string> = {
  active:   "bg-emerald-900/60 text-emerald-200",
  inactive: "bg-zinc-700 text-zinc-300",
  hold:     "bg-red-900/60 text-red-200",
};

export default function VendorsList() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), limit: "25" });
  if (search) params.set("search", search);

  const { data, isLoading } = useQuery<PaginatedResponse<Vendor>>({
    queryKey: ["vendors", page, search],
    queryFn: () => api.get(`/vendors?${params}`),
  });

  const vendors = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/40">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Truck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold font-display text-foreground">Vendors</h1>
            <p className="text-xs text-muted-foreground">Supplier and vendor master records</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["vendors"] })}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
          <Button size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New Vendor
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-card/20">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search vendors..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-8 h-8 text-sm bg-background/60"
          />
        </div>
        {meta && (
          <span className="text-xs text-muted-foreground ml-auto">{meta.total} vendor{meta.total !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-xs font-medium text-muted-foreground w-24">Number</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">Name</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground w-32">Type</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground w-24">Status</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground w-40">Email</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground w-28">Terms</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground w-20 text-right">Lead Days</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground w-20 text-center">Flags</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i} className="border-border">
                  {Array.from({ length: 9 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 bg-muted/40 rounded animate-pulse" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : vendors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <Building2 className="h-10 w-10 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No vendors found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              vendors.map((v) => (
                <TableRow key={v.id} className="border-border hover:bg-muted/20 cursor-pointer">
                  <TableCell className="font-mono text-xs text-muted-foreground">{v.number}</TableCell>
                  <TableCell>
                    <Link to={`/vendors/${v.id}`} className="text-sm font-medium text-foreground hover:text-primary">
                      {v.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{v.vendorType?.replace("_", " ") ?? "—"}</TableCell>
                  <TableCell>
                    <Badge className={cn("text-xs", STATUS_COLOR[v.status] ?? "bg-zinc-700 text-zinc-200")}>
                      {v.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-[160px]">
                    {v.email ? <a href={`mailto:${v.email}`} className="hover:text-primary">{v.email}</a> : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{v.paymentTerms ?? "—"}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{v.leadTime ?? "—"}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      {v.isPreferred && <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" title="Preferred" />}
                      {v.isApproved && <BadgeCheck className="h-3.5 w-3.5 text-emerald-400" title="Approved" />}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link to={`/vendors/${v.id}`}>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-card/20">
          <span className="text-xs text-muted-foreground">Page {meta.page} of {meta.totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
