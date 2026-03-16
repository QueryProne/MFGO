import { Play, Settings2, AlertCircle, Clock, Zap } from "lucide-react";
import { PageHeader, StatusBadge } from "@/components/ui-patterns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useListMrpRuns, useRunMrp } from "@workspace/api-client-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function MrpDashboard() {
  const { data: runs, isLoading } = useListMrpRuns({ limit: 5 });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const runMutation = useRunMrp({
    mutation: {
      onSuccess: () => {
        toast({ title: "MRP Run Started", description: "The planning engine is processing." });
        queryClient.invalidateQueries({ queryKey: ['/api/mrp/runs'] });
      }
    }
  });

  const handleRun = () => {
    runMutation.mutate({ data: { type: 'net_change', planningHorizon: 30 } });
  };

  const lastRun = runs?.data?.[0];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Material Requirements Planning" 
        description="Advanced engine to calculate material and capacity needs."
        action={
          <div className="flex gap-2">
            <Button variant="outline" className="shadow-sm font-medium border-border/50 bg-background"><Settings2 className="w-4 h-4 mr-2" /> Parameters</Button>
            <Button 
              onClick={handleRun} 
              disabled={runMutation.isPending || lastRun?.status === 'running'}
              className="shadow-md font-semibold bg-gradient-to-r from-primary to-primary/90"
            >
              <Zap className="w-4 h-4 mr-2" /> 
              {runMutation.isPending || lastRun?.status === 'running' ? "Engine Running..." : "Run MRP Engine"}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 border-border/50 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
            <Zap className="w-32 h-32" />
          </div>
          <CardHeader>
            <CardTitle className="text-xl font-display">Engine Status</CardTitle>
            <CardDescription>Results from the most recent planning calculation</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-32 animate-pulse bg-secondary/50 rounded-lg"></div>
            ) : lastRun ? (
              <div className="space-y-6 relative z-10">
                <div className="flex items-center justify-between border-b border-border/50 pb-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    <div className="mt-1"><StatusBadge status={lastRun.status} /></div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground text-right">Last Run Type</p>
                    <p className="text-sm font-semibold capitalize mt-1 text-right text-foreground">{lastRun.type.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground text-right">Completed</p>
                    <p className="text-sm font-mono mt-1 text-right text-foreground">
                      {lastRun.completedAt ? format(new Date(lastRun.completedAt), 'MMM d, HH:mm') : 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                  <div className="bg-secondary/40 p-3 rounded-lg border border-border/40">
                    <p className="text-xs text-muted-foreground font-medium mb-1">Planned POs</p>
                    <p className="text-2xl font-display font-bold text-foreground">{lastRun.summaryStats?.plannedPOs || 0}</p>
                  </div>
                  <div className="bg-secondary/40 p-3 rounded-lg border border-border/40">
                    <p className="text-xs text-muted-foreground font-medium mb-1">Planned WOs</p>
                    <p className="text-2xl font-display font-bold text-foreground">{lastRun.summaryStats?.plannedWOs || 0}</p>
                  </div>
                  <div className="bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                    <p className="text-xs text-red-500 font-medium mb-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Shortages</p>
                    <p className="text-2xl font-display font-bold text-red-500">{lastRun.summaryStats?.shortages || 0}</p>
                  </div>
                  <div className="bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20">
                    <p className="text-xs text-yellow-500 font-medium mb-1 flex items-center gap-1"><Clock className="w-3 h-3"/> Reschedules</p>
                    <p className="text-2xl font-display font-bold text-yellow-500">{lastRun.summaryStats?.rescheduleMessages || 0}</p>
                  </div>
                </div>
                
                <div className="pt-2">
                  <Button className="w-full shadow-sm">View Planner Workbench</Button>
                </div>
              </div>
            ) : (
               <div className="text-center py-8 text-muted-foreground">No MRP runs recorded yet.</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-display">Run History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {runs?.data?.slice(0, 5).map((run) => (
                <div key={run.id} className="flex justify-between items-center text-sm p-2 rounded-md hover:bg-secondary/50 border border-transparent hover:border-border/50 transition-colors">
                  <div>
                    <p className="font-medium text-foreground capitalize">{run.type.replace('_', ' ')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">{run.createdAt ? format(new Date(run.createdAt), 'MM/dd HH:mm') : '-'}</p>
                  </div>
                  <StatusBadge status={run.status} />
                </div>
              ))}
              {(!runs?.data || runs.data.length === 0) && (
                <p className="text-sm text-muted-foreground text-center">No history</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
