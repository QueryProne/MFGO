import { FormEvent, useMemo, useState } from "react";
import { Bot, Loader2, Send } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

async function streamCopilotAnswer(payload: {
  query: string;
  entityType?: string;
  entityId?: string;
  onChunk: (chunk: string) => void;
}): Promise<void> {
  const response = await fetch(`${API}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: payload.query,
      entityType: payload.entityType,
      entityId: payload.entityId,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    const fallback = await response.text().catch(() => "");
    throw new Error(fallback || "Chat request failed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let splitIndex = buffer.indexOf("\n\n");
    while (splitIndex >= 0) {
      const chunk = buffer.slice(0, splitIndex);
      buffer = buffer.slice(splitIndex + 2);

      const lines = chunk
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const event = lines.find((line) => line.startsWith("event:"))?.replace("event:", "").trim();
      const dataLine = lines.find((line) => line.startsWith("data:"))?.replace("data:", "").trim();

      if (event === "chunk" && dataLine) {
        const parsed = JSON.parse(dataLine) as { text?: string };
        if (parsed.text) payload.onChunk(parsed.text);
      }
      splitIndex = buffer.indexOf("\n\n");
    }
  }
}

export function AICopilotChat({
  entityType,
  entityId,
  className,
}: {
  entityType?: string;
  entityId?: string;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Ask me read-only ERP questions such as open tasks, vendor interactions, production due this week, or lead status.",
    },
  ]);

  const placeholder = useMemo(() => {
    if (entityType && entityId) {
      return `Ask about this ${entityType}...`;
    }
    return "Ask MFGO Copilot...";
  }, [entityType, entityId]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim() || isSending) return;

    const userMessage = query.trim();
    setQuery("");
    setIsSending(true);

    setMessages((prev) => [...prev, { role: "user", content: userMessage }, { role: "assistant", content: "" }]);

    try {
      await streamCopilotAnswer({
        query: userMessage,
        entityType,
        entityId,
        onChunk: (chunk) => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "assistant") {
              last.content += chunk;
            }
            return next;
          });
        },
      });
      if (entityType && entityId) {
        queryClient.invalidateQueries({ queryKey: ["timeline", entityType, entityId] });
      }
    } catch (error) {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant" && last.content.length === 0) {
          last.content = `I need more details. (${String(error)})`;
        }
        return next;
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card className={`border-border/50 shadow-sm ${className ?? ""}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          AI Copilot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-border/50 bg-secondary/20 p-3 h-[300px] overflow-y-auto space-y-2">
          {messages.map((message, idx) => (
            <div
              key={`message-${idx}`}
              className={`rounded-md px-3 py-2 text-sm whitespace-pre-wrap ${
                message.role === "user" ? "bg-primary/15 text-foreground ml-8" : "bg-background text-muted-foreground mr-8"
              }`}
            >
              {message.content || (message.role === "assistant" && isSending ? "..." : "")}
            </div>
          ))}
        </div>

        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            className="bg-background"
          />
          <Button type="submit" disabled={isSending || !query.trim()} className="gap-2">
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Ask
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
