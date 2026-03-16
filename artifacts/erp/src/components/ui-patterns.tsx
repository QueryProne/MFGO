import { ReactNode } from "react";
import { Badge } from "./ui/badge";
import { ChevronLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "./ui/button";

export function PageHeader({ 
  title, 
  description, 
  action, 
  backUrl 
}: { 
  title: string; 
  description?: string; 
  action?: ReactNode;
  backUrl?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div className="flex flex-col gap-1">
        {backUrl && (
          <Link href={backUrl} className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 w-fit transition-colors mb-1">
            <ChevronLeft className="w-3 h-3" /> Back
          </Link>
        )}
        <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">{title}</h1>
        {description && <p className="text-sm text-muted-foreground font-medium">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

const statusColorMap: Record<string, string> = {
  active: "bg-green-500/10 text-green-500 border-green-500/20",
  inactive: "bg-muted text-muted-foreground border-border",
  draft: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  confirmed: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  in_production: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  shipped: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  completed: "bg-green-500/10 text-green-500 border-green-500/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const classes = statusColorMap[normalized] || "bg-secondary text-secondary-foreground border-border";
  
  return (
    <Badge variant="outline" className={`capitalize font-semibold shadow-sm px-2.5 py-0.5 rounded-md ${classes}`}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

export function EmptyState({ title, description, icon: Icon, action }: { title: string, description: string, icon: any, action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-card/50 rounded-2xl border border-dashed border-border/60">
      <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4 shadow-sm border border-border/50">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-display font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-sm mb-6">{description}</p>
      {action}
    </div>
  );
}

export function LoadingTable() {
  return (
    <div className="w-full space-y-3">
      <div className="h-10 bg-secondary/50 rounded-lg animate-pulse w-full"></div>
      <div className="h-16 bg-secondary/30 rounded-lg animate-pulse w-full"></div>
      <div className="h-16 bg-secondary/30 rounded-lg animate-pulse w-full"></div>
      <div className="h-16 bg-secondary/30 rounded-lg animate-pulse w-full"></div>
      <div className="h-16 bg-secondary/30 rounded-lg animate-pulse w-full"></div>
    </div>
  );
}
