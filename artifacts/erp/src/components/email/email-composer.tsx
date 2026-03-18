import { useMemo, useState } from "react";
import { Send, Save, Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateEmailMutation } from "@/hooks/use-shared-workflows";

function parseRecipientInput(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((email) => ({ email }));
}

export function EmailComposer({
  entityType,
  entityId,
  defaultTo,
}: {
  entityType: string;
  entityId: string;
  defaultTo?: string;
}) {
  const [to, setTo] = useState(defaultTo ?? "");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [sendLaterAt, setSendLaterAt] = useState("");

  const createEmail = useCreateEmailMutation();
  const hasTo = useMemo(() => parseRecipientInput(to).length > 0, [to]);

  const submit = (mode: "draft" | "send" | "queue") => {
    createEmail.mutate(
      {
        entityType,
        entityId,
        to: parseRecipientInput(to),
        cc: parseRecipientInput(cc),
        bcc: parseRecipientInput(bcc),
        subject,
        bodyText: body,
        bodyHtml: `<p>${body.replace(/\n/g, "<br/>")}</p>`,
        templateId: templateId || undefined,
        saveAsDraft: mode === "draft",
        sendImmediately: mode === "send",
        sendAfter: mode === "queue" ? sendLaterAt || undefined : undefined,
      },
      {
        onSuccess: () => {
          if (mode !== "draft") {
            setSubject("");
            setBody("");
          }
        },
      },
    );
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display">Email</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input value={to} onChange={(event) => setTo(event.target.value)} placeholder="To (comma-separated emails)" className="bg-background" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Input value={cc} onChange={(event) => setCc(event.target.value)} placeholder="CC" className="bg-background" />
          <Input value={bcc} onChange={(event) => setBcc(event.target.value)} placeholder="BCC" className="bg-background" />
        </div>
        <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" className="bg-background" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Input
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            placeholder="Template ID (optional)"
            className="bg-background"
          />
          <Input
            type="datetime-local"
            value={sendLaterAt}
            onChange={(event) => setSendLaterAt(event.target.value)}
            className="bg-background"
          />
        </div>
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="bg-background min-h-[130px]"
          placeholder="Compose email body..."
        />
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={() => submit("draft")} disabled={createEmail.isPending || !hasTo} className="gap-2">
            <Save className="w-4 h-4" />
            Save Draft
          </Button>
          <Button
            variant="outline"
            onClick={() => submit("queue")}
            disabled={createEmail.isPending || !hasTo || !sendLaterAt}
            className="gap-2"
          >
            <Clock3 className="w-4 h-4" />
            Queue Send
          </Button>
          <Button onClick={() => submit("send")} disabled={createEmail.isPending || !hasTo} className="gap-2">
            <Send className="w-4 h-4" />
            Send Now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
