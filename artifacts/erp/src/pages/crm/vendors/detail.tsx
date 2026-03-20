import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";

import { PageHeader, StatusBadge } from "@/components/ui-patterns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AICopilotChat } from "@/components/ai/ai-copilot-chat";
import { EmailComposer } from "@/components/email/email-composer";
import { TaskList } from "@/components/tasks/task-list";
import { UnifiedActivityTimeline } from "@/components/activity/unified-activity-timeline";
import { api, Vendor } from "@/lib/api";
import { CustomFormsPanel } from "@/components/custom/custom-forms-panel";

export default function VendorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: vendor, isLoading } = useQuery<Vendor>({
    queryKey: ["vendor", id],
    queryFn: () => api.get(`/vendors/${id}`),
    enabled: Boolean(id),
  });

  if (isLoading) {
    return <div className="p-6 md:p-8 text-muted-foreground">Loading vendor...</div>;
  }
  if (!vendor) {
    return <div className="p-6 md:p-8 text-destructive">Vendor not found</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title={vendor.name}
        description={`Vendor ${vendor.number}`}
        backUrl="/vendors"
        action={<StatusBadge status={vendor.status} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">Supplier Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{vendor.email || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{vendor.phone || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Lead Time</span><span>{vendor.leadTime ? `${vendor.leadTime} days` : "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Terms</span><span>{vendor.paymentTerms || "—"}</span></div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Tabs defaultValue="timeline" className="w-full">
            <TabsList className="grid w-full grid-cols-5 bg-secondary/40">
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="custom">Custom</TabsTrigger>
              <TabsTrigger value="copilot">Copilot</TabsTrigger>
            </TabsList>
            <TabsContent value="timeline" className="mt-4">
              <UnifiedActivityTimeline entityType="vendor" entityId={vendor.id} />
            </TabsContent>
            <TabsContent value="tasks" className="mt-4">
              <TaskList entityType="vendor" entityId={vendor.id} />
            </TabsContent>
            <TabsContent value="email" className="mt-4">
              <EmailComposer entityType="vendor" entityId={vendor.id} defaultTo={vendor.email || undefined} />
            </TabsContent>
            <TabsContent value="custom" className="mt-4">
              <CustomFormsPanel entityType="vendor" entityId={vendor.id} />
            </TabsContent>
            <TabsContent value="copilot" className="mt-4">
              <AICopilotChat entityType="vendor" entityId={vendor.id} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
