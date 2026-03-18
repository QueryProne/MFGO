import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Factory } from "lucide-react";

import { PageHeader, EmptyState, StatusBadge } from "@/components/ui-patterns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, PaginatedResponse, Vendor } from "@/lib/api";

export default function VendorsListPage() {
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const { data, isLoading, refetch } = useQuery<PaginatedResponse<Vendor>>({
    queryKey: ["vendors", { search }],
    queryFn: () => api.get(`/vendors?search=${encodeURIComponent(search)}&limit=100`),
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Vendors"
        description="Supplier master data and communication context."
        action={
          <div className="flex items-center gap-2">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="New vendor name" className="w-[220px] bg-background" />
            <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className="w-[220px] bg-background" />
            <Button
              className="gap-2"
              onClick={async () => {
                if (!name.trim()) return;
                await api.post("/vendors", { name: name.trim(), email: email.trim() || undefined, status: "active" });
                setName("");
                setEmail("");
                refetch();
              }}
            >
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>
        }
      />

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-card/40">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search vendors..." className="max-w-sm bg-background" />
        </div>
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading vendors...</div>
        ) : !data?.data?.length ? (
          <div className="p-6">
            <EmptyState icon={Factory} title="No vendors found" description="Create a vendor to start supplier collaboration." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-secondary/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((vendor) => (
                  <TableRow key={vendor.id} className="hover:bg-secondary/20">
                    <TableCell>
                      <Link href={`/vendors/${vendor.id}`} className="font-medium hover:underline">
                        {vendor.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{vendor.number}</TableCell>
                    <TableCell className="text-sm">{vendor.email || "—"}</TableCell>
                    <TableCell><StatusBadge status={vendor.status} /></TableCell>
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
