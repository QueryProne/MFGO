import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Plus, TrendingUp } from "lucide-react";

import { PageHeader, StatusBadge } from "@/components/ui-patterns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCreateOpportunityMutation, useOpportunities, useOpportunityForecast } from "@/hooks/use-shared-workflows";

const pipelineStages = ["qualification", "discovery", "proposal", "negotiation", "commit", "won", "lost"];

export default function OpportunitiesPage() {
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState("qualification");

  const { data, isLoading } = useOpportunities({ search, limit: 200 });
  const { data: forecast } = useOpportunityForecast();
  const createOpportunity = useCreateOpportunityMutation();

  const opportunities = useMemo(() => data?.data ?? [], [data]);

  const grouped = useMemo(() => {
    const byStage = new Map<string, typeof opportunities>();
    for (const stageName of pipelineStages) {
      byStage.set(stageName, opportunities.filter((item) => item.stage === stageName));
    }
    return byStage;
  }, [opportunities]);

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Opportunities"
        description="Pipeline management, forecasting, and stage history."
        action={
          <div className="flex items-center gap-2">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Opportunity name" className="w-[220px] bg-background" />
            <Input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Amount" className="w-[120px] bg-background" />
            <Input value={stage} onChange={(event) => setStage(event.target.value)} placeholder="Stage" className="w-[130px] bg-background" />
            <Button
              className="gap-2"
              disabled={!name.trim() || createOpportunity.isPending}
              onClick={() => {
                createOpportunity.mutate(
                  {
                    name: name.trim(),
                    amount: amount || "0",
                    stage,
                    status: stage === "won" || stage === "lost" ? stage : "open",
                  },
                  {
                    onSuccess: () => {
                      setName("");
                      setAmount("");
                      setStage("qualification");
                    },
                  },
                );
              }}
            >
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Pipeline Amount</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">${forecast?.data?.totals.pipelineAmount.toLocaleString() ?? 0}</CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Weighted Forecast</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">${forecast?.data?.totals.weightedAmount.toLocaleString() ?? 0}</CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Open Opportunities</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{forecast?.data?.totals.openCount ?? 0}</CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display">Pipeline Kanban</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading opportunities...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {pipelineStages.map((stageName) => {
                const stageItems = grouped.get(stageName) ?? [];
                return (
                  <div key={stageName} className="rounded-lg border border-border/50 bg-secondary/20 min-h-[180px] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{stageName}</p>
                      <span className="text-xs text-muted-foreground">{stageItems.length}</span>
                    </div>
                    <div className="space-y-2">
                      {stageItems.map((opp) => (
                        <Link key={opp.id} href={`/opportunities/${opp.id}`} className="block rounded-md border border-border/60 bg-background p-2 hover:border-primary/40 transition-colors">
                          <p className="text-sm font-medium text-foreground line-clamp-2">{opp.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">${Number(opp.amount ?? 0).toLocaleString()}</p>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50 overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-card/40">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search opportunities..." className="max-w-sm bg-background" />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-secondary/40">
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Probability</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Expected Close</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opportunities.map((opp) => (
                <TableRow key={opp.id} className="hover:bg-secondary/20">
                  <TableCell>
                    <Link href={`/opportunities/${opp.id}`} className="font-medium hover:underline">
                      {opp.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{opp.number}</p>
                  </TableCell>
                  <TableCell className="text-sm">{opp.stage}</TableCell>
                  <TableCell><StatusBadge status={opp.status} /></TableCell>
                  <TableCell className="text-sm">{opp.probability}%</TableCell>
                  <TableCell className="font-mono text-sm">${Number(opp.amount ?? 0).toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{opp.expectedCloseDate ? new Date(opp.expectedCloseDate).toLocaleDateString() : "—"}</TableCell>
                </TableRow>
              ))}
              {!opportunities.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                    <TrendingUp className="w-5 h-5 mx-auto mb-2 text-muted-foreground/50" />
                    No opportunities yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
