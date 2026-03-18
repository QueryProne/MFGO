import { Mail, Send, Inbox } from "lucide-react";

import type { SharedEmail } from "@/lib/api";

export function EmailTimelineItem({ email }: { email: SharedEmail }) {
  const icon = email.direction === "inbound" ? Inbox : Send;
  const Icon = icon;
  return (
    <div className="rounded-lg border border-border/50 bg-secondary/20 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-primary" />
          <p className="text-sm font-medium text-foreground">{email.subject || "(No subject)"}</p>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{email.status}</span>
      </div>
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" />
        {email.direction} · {email.fromAddress}
      </p>
      <p className="text-xs text-muted-foreground">
        {(email.bodyText || email.bodyHtml || "").toString().replace(/<[^>]*>/g, "").slice(0, 220) || "No body preview"}
      </p>
    </div>
  );
}
