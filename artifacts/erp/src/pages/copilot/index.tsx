import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui-patterns";
import { AICopilotChat } from "@/components/ai/ai-copilot-chat";

const examples = [
  "List open tasks for customer Acme",
  "Show vendor XYZ recent interactions",
  "Summarize production orders due this week",
  "What's the status of customer leads?",
];

export default function CopilotPage() {
  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="AI Copilot"
        description="Read-only assistant for ERP operations and CRM insight."
      />

      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display">Suggested Questions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          {examples.map((example) => (
            <div key={example} className="rounded-md border border-border/50 bg-secondary/20 px-3 py-2 text-muted-foreground">
              {example}
            </div>
          ))}
        </CardContent>
      </Card>

      <AICopilotChat />
    </div>
  );
}
