import { useState } from "react";
import { useParams } from "wouter";
import { ArrowRight } from "lucide-react";

import { PageHeader, StatusBadge } from "@/components/ui-patterns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AICopilotChat } from "@/components/ai/ai-copilot-chat";
import { EmailComposer } from "@/components/email/email-composer";
import { TaskList } from "@/components/tasks/task-list";
import { UnifiedActivityTimeline } from "@/components/activity/unified-activity-timeline";
import { useOpportunity, useUpdateOpportunityMutation } from "@/hooks/use-shared-workflows";

export default function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: opportunity, isLoading } = useOpportunity(id || "");
  const updateOpportunity = useUpdateOpportunityMutation();

  const [stage, setStage] = useState("");
  const [status, setStatus] = useState("");
  const [probability, setProbability] = useState("");

  if (isLoading) {
    return <div className="p-6 md:p-8 text-muted-foreground">Loading opportunity...</div>;
  }
  if (!opportunity) {
    return <div className="p-6 md:p-8 text-destructive">Opportunity not found</div>;
  }

  const activeStage = stage || opportunity.stage;
  const activeStatus = status || opportunity.status;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title={opportunity.name}
        description={`Opportunity ${opportunity.number}`}
        backUrl="/opportunities"
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={activeStatus} />
            <Button
              size="sm"
              onClick={() =>
                updateOpportunity.mutate({
                  id: opportunity.id,
                  stage: activeStage,
                  status: activeStatus,
                  probability: probability ? Number(probability) : undefined,
                })
              }
            >
              Save Stage
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">Pipeline Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={stage} onChange={(event) => setStage(event.target.value)} placeholder={`Stage: ${opportunity.stage}`} className="bg-background" />
            <Input value={status} onChange={(event) => setStatus(event.target.value)} placeholder={`Status: ${opportunity.status}`} className="bg-background" />
            <Input
              value={probability}
              onChange={(event) => setProbability(event.target.value)}
              placeholder={`Probability: ${opportunity.probability}`}
              className="bg-background"
            />
            <div className="text-xs text-muted-foreground space-y-1.5 pt-2">
              <p>Amount: ${Number(opportunity.amount ?? 0).toLocaleString()}</p>
              <p>Expected close: {opportunity.expectedCloseDate ? new Date(opportunity.expectedCloseDate).toLocaleDateString() : "—"}</p>
              <p>Owner: {opportunity.ownerId || "—"}</p>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Tabs defaultValue="timeline" className="w-full">
            <TabsList className="grid w-full grid-cols-5 bg-secondary/40">
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="history">Stage History</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="copilot">Copilot</TabsTrigger>
            </TabsList>
            <TabsContent value="timeline" className="mt-4">
              <UnifiedActivityTimeline entityType="opportunity" entityId={opportunity.id} />
            </TabsContent>
            <TabsContent value="history" className="mt-4">
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-display">Stage History</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(opportunity.stageHistory ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No stage history entries yet.</p>
                  ) : (
                    (opportunity.stageHistory ?? []).map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{entry.fromStage || "start"}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-medium">{entry.toStage}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{new Date(entry.changedAt).toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="tasks" className="mt-4">
              <TaskList entityType="opportunity" entityId={opportunity.id} />
            </TabsContent>
            <TabsContent value="email" className="mt-4">
              <EmailComposer entityType="opportunity" entityId={opportunity.id} />
            </TabsContent>
            <TabsContent value="copilot" className="mt-4">
              <AICopilotChat entityType="opportunity" entityId={opportunity.id} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
