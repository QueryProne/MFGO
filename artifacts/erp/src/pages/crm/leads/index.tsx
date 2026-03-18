import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Plus, Sparkles, Filter } from "lucide-react";

import { PageHeader, EmptyState, StatusBadge } from "@/components/ui-patterns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCreateLeadMutation, useLeads } from "@/hooks/use-shared-workflows";

export default function LeadsListPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const { data, isLoading } = useLeads({ search, status: statusFilter || undefined, limit: 100 });
  const createLead = useCreateLeadMutation();

  const leads = useMemo(() => data?.data ?? [], [data]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Leads"
        description="Capture, qualify, and convert opportunities into customers."
        action={
          <div className="flex items-center gap-2">
            <Input
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="New lead company"
              className="w-[220px] bg-background"
            />
            <Input
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              placeholder="Contact email"
              className="w-[220px] bg-background"
            />
            <Button
              className="gap-2"
              disabled={!companyName.trim() || createLead.isPending}
              onClick={() => {
                createLead.mutate(
                  {
                    companyName: companyName.trim(),
                    email: contactEmail.trim() || undefined,
                    status: "new",
                    source: "manual",
                  },
                  {
                    onSuccess: () => {
                      setCompanyName("");
                      setContactEmail("");
                    },
                  },
                );
              }}
            >
              <Plus className="w-4 h-4" />
              Add Lead
            </Button>
          </div>
        }
      />

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/50 flex flex-col md:flex-row gap-2 md:items-center md:justify-between bg-card/40">
          <div className="flex gap-2 w-full md:w-auto">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search leads..." className="w-[280px] bg-background" />
            <Input value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} placeholder="Status filter..." className="w-[180px] bg-background" />
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </Button>
        </div>
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading leads...</div>
        ) : leads.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Sparkles}
              title="No leads found"
              description="Create your first lead to begin pipeline tracking."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-secondary/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead>Lead</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id} className="hover:bg-secondary/20">
                    <TableCell>
                      <div className="flex flex-col">
                        <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                          {lead.number}
                        </Link>
                        <span className="text-xs text-muted-foreground">{lead.email || "No email"}</span>
                      </div>
                    </TableCell>
                    <TableCell>{lead.companyName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{lead.source || "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={lead.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(lead.updatedAt).toLocaleString()}</TableCell>
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
