import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, CheckSquare, AlertTriangle, ClipboardCheck } from "lucide-react";
import { PageHeader, EmptyState, LoadingTable } from "@/components/ui-patterns";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, PaginatedResponse, Inspection, Nonconformance } from "@/lib/api";
import { format, parseISO } from "date-fns";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    passed: "bg-green-500/10 text-green-400 border border-green-500/20",
    failed: "bg-red-500/10 text-red-400 border border-red-500/20",
    open: "bg-red-500/10 text-red-400 border border-red-500/20",
    in_review: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    resolved: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    closed: "bg-muted text-muted-foreground border border-border",
    voided: "bg-muted text-muted-foreground border border-border",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    minor: "bg-blue-500/10 text-blue-400",
    major: "bg-amber-500/10 text-amber-400",
    critical: "bg-red-500/10 text-red-400",
  };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider ${map[severity] ?? ""}`}>{severity}</span>;
}

export default function QualityPage() {
  const { data: inspections, isLoading: insLoading } = useQuery<PaginatedResponse<Inspection>>({
    queryKey: ["inspections"],
    queryFn: () => api.get("/quality/inspections?limit=50"),
  });

  const { data: ncrs, isLoading: ncrLoading } = useQuery<PaginatedResponse<Nonconformance>>({
    queryKey: ["nonconformances"],
    queryFn: () => api.get("/quality/nonconformances?limit=50"),
  });

  const passRate = inspections?.data.length
    ? Math.round((inspections.data.filter(i => i.status === "passed").length / inspections.data.length) * 100)
    : 0;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Quality Management"
        description="Manage inspections, nonconformances, and corrective actions."
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm">New NCR</Button>
            <Button size="sm"><Plus className="w-4 h-4 mr-2" /> New Inspection</Button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Inspections", value: inspections?.meta?.total ?? 0, icon: ClipboardCheck, cls: "text-foreground" },
          { label: "First Pass Rate", value: `${passRate}%`, icon: CheckSquare, cls: "text-green-400" },
          { label: "Open NCRs", value: ncrs?.data?.filter(n => !["closed", "voided"].includes(n.status)).length ?? 0, icon: AlertTriangle, cls: "text-red-400" },
        ].map((kpi) => (
          <Card key={kpi.label} className="border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 rounded-lg bg-secondary">
                <kpi.icon className={`w-5 h-5 ${kpi.cls}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{kpi.label}</p>
                <p className={`text-2xl font-bold ${kpi.cls}`}>{kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="inspections">
        <TabsList className="border border-border/50 bg-card/50">
          <TabsTrigger value="inspections">Inspections ({inspections?.meta?.total ?? 0})</TabsTrigger>
          <TabsTrigger value="ncr">Nonconformances ({ncrs?.meta?.total ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="inspections">
          <Card className="border-border/50 shadow-sm overflow-hidden">
            {insLoading ? (
              <div className="p-6"><LoadingTable /></div>
            ) : !inspections?.data?.length ? (
              <EmptyState icon={ClipboardCheck} title="No inspections" description="Log an inspection to track quality results." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-secondary/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-semibold">INS #</TableHead>
                      <TableHead className="font-semibold">Type</TableHead>
                      <TableHead className="font-semibold">Item</TableHead>
                      <TableHead className="font-semibold">Reference</TableHead>
                      <TableHead className="font-semibold text-right">Qty</TableHead>
                      <TableHead className="font-semibold text-right">Passed</TableHead>
                      <TableHead className="font-semibold text-right">Failed</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inspections.data.map((ins) => (
                      <TableRow key={ins.id} className="hover:bg-secondary/20 transition-colors">
                        <TableCell className="font-mono text-sm font-medium">{ins.number}</TableCell>
                        <TableCell className="text-xs capitalize">{ins.type.replace(/_/g, " ")}</TableCell>
                        <TableCell>
                          <p className="font-mono text-xs">{ins.itemNumber}</p>
                          <p className="text-xs text-muted-foreground">{ins.itemName}</p>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm font-mono">{ins.reference ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{ins.quantity}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-green-400">{ins.quantityPassed}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-red-400">{ins.quantityFailed}</TableCell>
                        <TableCell><StatusBadge status={ins.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="ncr">
          <Card className="border-border/50 shadow-sm overflow-hidden">
            {ncrLoading ? (
              <div className="p-6"><LoadingTable /></div>
            ) : !ncrs?.data?.length ? (
              <EmptyState icon={AlertTriangle} title="No nonconformances" description="No quality defects have been reported." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-secondary/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-semibold">NCR #</TableHead>
                      <TableHead className="font-semibold">Title</TableHead>
                      <TableHead className="font-semibold">Item</TableHead>
                      <TableHead className="font-semibold">Severity</TableHead>
                      <TableHead className="font-semibold">Defect Code</TableHead>
                      <TableHead className="font-semibold">Disposition</TableHead>
                      <TableHead className="font-semibold">Reported By</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ncrs.data.map((ncr) => (
                      <TableRow key={ncr.id} className="hover:bg-secondary/20 transition-colors">
                        <TableCell className="font-mono text-sm font-medium">{ncr.number}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">{ncr.title}</TableCell>
                        <TableCell className="font-mono text-xs">{ncr.itemNumber ?? "—"}</TableCell>
                        <TableCell><SeverityBadge severity={ncr.severity} /></TableCell>
                        <TableCell className="text-muted-foreground text-xs font-mono">{ncr.defectCode ?? "—"}</TableCell>
                        <TableCell className="text-xs capitalize">{ncr.disposition?.replace(/_/g, " ") ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{ncr.reportedBy ?? "—"}</TableCell>
                        <TableCell><StatusBadge status={ncr.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
