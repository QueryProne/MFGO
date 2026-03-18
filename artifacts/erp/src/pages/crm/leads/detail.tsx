import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowRightLeft, BrainCircuit } from "lucide-react";

import { PageHeader, StatusBadge } from "@/components/ui-patterns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AICopilotChat } from "@/components/ai/ai-copilot-chat";
import { EmailComposer } from "@/components/email/email-composer";
import { TaskList } from "@/components/tasks/task-list";
import { UnifiedActivityTimeline } from "@/components/activity/unified-activity-timeline";
import { useConvertLeadMutation, useLead, useScoreLeadMutation } from "@/hooks/use-shared-workflows";

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [convertToOpportunity, setConvertToOpportunity] = useState(true);

  const { data: lead, isLoading } = useLead(id || "");
  const scoreLead = useScoreLeadMutation();
  const convertLead = useConvertLeadMutation();

  if (isLoading) {
    return <div className="p-6 md:p-8 text-muted-foreground">Loading lead...</div>;
  }
  if (!lead) {
    return <div className="p-6 md:p-8 text-destructive">Lead not found</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title={lead.companyName}
        description={`Lead ${lead.number}`}
        backUrl="/leads"
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={lead.status} />
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => scoreLead.mutate(lead.id)}
              disabled={scoreLead.isPending}
            >
              <BrainCircuit className="w-4 h-4" />
              Score Lead
            </Button>
            <Button
              size="sm"
              className="gap-2"
              disabled={convertLead.isPending || lead.status === "converted"}
              onClick={() => {
                convertLead.mutate(
                  {
                    leadId: lead.id,
                    createOpportunity: convertToOpportunity,
                    opportunityName: `${lead.companyName} Expansion`,
                  },
                  {
                    onSuccess: (result: any) => {
                      if (result?.customer?.id) {
                        navigate(`/customers/${result.customer.id}`);
                      }
                    },
                  },
                );
              }}
            >
              <ArrowRightLeft className="w-4 h-4" />
              Convert
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">Lead Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Contact</span><span>{[lead.firstName, lead.lastName].filter(Boolean).join(" ") || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{lead.email || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{lead.phone || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Source</span><span>{lead.source || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Latest AI Score</span><span>{lead.latestScore?.score ?? "—"}</span></div>
            <div className="pt-2">
              <label className="text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={convertToOpportunity}
                  onChange={(event) => setConvertToOpportunity(event.target.checked)}
                />
                Create opportunity during conversion
              </label>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="timeline" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-secondary/40">
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="copilot">Copilot</TabsTrigger>
            </TabsList>
            <TabsContent value="timeline" className="mt-4">
              <UnifiedActivityTimeline entityType="lead" entityId={lead.id} />
            </TabsContent>
            <TabsContent value="tasks" className="mt-4">
              <TaskList entityType="lead" entityId={lead.id} />
            </TabsContent>
            <TabsContent value="email" className="mt-4">
              <EmailComposer entityType="lead" entityId={lead.id} defaultTo={lead.email || undefined} />
            </TabsContent>
            <TabsContent value="copilot" className="mt-4">
              <AICopilotChat entityType="lead" entityId={lead.id} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
