import { MessageSquareText, ListChecks, Mail, Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTimeline } from "@/hooks/use-shared-workflows";
import { EmailTimelineItem } from "@/components/email/email-timeline-item";
import type { SharedEmail, TimelineEntry } from "@/lib/api";
import { useEntityEmails } from "@/hooks/use-shared-workflows";

function iconForActivity(activityType: string) {
  if (activityType === "task") return ListChecks;
  if (activityType === "email") return Mail;
  if (activityType === "chat") return MessageSquareText;
  return Sparkles;
}

function GenericTimelineItem({ event }: { event: TimelineEntry }) {
  const Icon = iconForActivity(event.activityType);
  return (
    <div className="rounded-lg border border-border/50 bg-secondary/20 p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          <p className="text-sm font-medium text-foreground">{event.title}</p>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{event.activityType}</span>
      </div>
      {event.body ? <p className="text-xs text-muted-foreground">{event.body}</p> : null}
      <p className="text-[11px] text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</p>
    </div>
  );
}

export function UnifiedActivityTimeline({ entityType, entityId }: { entityType: string; entityId: string }) {
  const { data: timelineData, isLoading } = useTimeline(entityType, entityId, 100);
  const { data: emailData } = useEntityEmails(entityType, entityId, 20);

  const emailMap = new Map<string, SharedEmail>((emailData?.data ?? []).map((message) => [message.id, message]));
  const timeline = timelineData?.data ?? [];

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display">Activity Timeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading timeline...</p>
        ) : timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          timeline.map((event) => {
            const email = event.sourceType === "email" && event.sourceId ? emailMap.get(event.sourceId) : null;
            if (email) {
              return <EmailTimelineItem key={`email-${event.id}`} email={email} />;
            }
            return <GenericTimelineItem key={`event-${event.id}`} event={event} />;
          })
        )}
      </CardContent>
    </Card>
  );
}
