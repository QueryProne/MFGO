import { useEffect, useMemo, useRef, useState } from "react";
import { Command, Loader2, Search } from "lucide-react";
import { useLocation } from "wouter";

import { Input } from "@/components/ui/input";
import { api, SearchResponse, SearchResult } from "@/lib/api";

function resolveHref(result: SearchResult): string {
  if (result.href) return result.href;
  switch (result.entity) {
    case "customer":
      return `/customers/${result.id}`;
    case "vendor":
      return `/vendors/${result.id}`;
    case "item":
      return `/items/${result.id}`;
    case "workorder":
      return `/workorders/${result.id}`;
    case "lead":
      return `/leads/${result.id}`;
    case "opportunity":
      return `/opportunities/${result.id}`;
    case "salesorder":
      return "/salesorders";
    case "purchaseorder":
      return "/purchaseorders";
    case "invoice":
      return "/invoices";
    default:
      return "/admin?tab=custom-forms";
  }
}

function titleFor(result: SearchResult): string {
  return result.title || result.name || result.number || result.id;
}

function subtitleFor(result: SearchResult): string | undefined {
  if (result.subtitle) return result.subtitle;
  if (result.type && result.number) return result.number;
  if (result.status) return result.status;
  return undefined;
}

export function UniversalSearch() {
  const [, navigate] = useLocation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setActiveIndex(0);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await api.get<SearchResponse>(
          `/search?q=${encodeURIComponent(query.trim())}&limit=12`,
        );
        if (cancelled) return;
        setResults(response.results ?? []);
        setActiveIndex(0);
        setOpen(true);
      } catch {
        if (!cancelled) {
          setResults([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const showDropdown = useMemo(
    () => open && (query.trim().length >= 2 || loading),
    [open, query, loading],
  );

  const navigateTo = (result: SearchResult) => {
    navigate(resolveHref(result));
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="max-w-md w-full relative hidden md:block">
      <Search className="w-4 h-4 absolute left-3 top-[18px] -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        placeholder="Search anything (records, forms, fields...)"
        className="w-full pl-9 pr-20 h-9 bg-secondary/50 border-border/50 focus-visible:ring-primary/30 rounded-lg text-sm"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (!showDropdown) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => (results.length ? (current + 1) % results.length : 0));
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => (results.length ? (current - 1 + results.length) % results.length : 0));
            return;
          }
          if (event.key === "Enter") {
            if (results.length === 0) return;
            event.preventDefault();
            navigateTo(results[activeIndex] ?? results[0]);
            return;
          }
          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />

      <div className="absolute right-3 top-[18px] -translate-y-1/2 flex items-center gap-1">
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
        ) : (
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border/50 bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <Command className="w-3 h-3" /> K
          </kbd>
        )}
      </div>

      {showDropdown ? (
        <div className="absolute top-11 w-full rounded-lg border border-border/60 bg-card/95 backdrop-blur-xl shadow-xl z-[70] overflow-hidden">
          {loading ? (
            <div className="px-3 py-3 text-xs text-muted-foreground">Searching...</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground">No matches found.</div>
          ) : (
            <ul className="max-h-[380px] overflow-auto">
              {results.map((result, index) => {
                const isActive = index === activeIndex;
                const title = titleFor(result);
                const subtitle = subtitleFor(result);
                return (
                  <li key={`${result.entity}-${result.id}-${index}`}>
                    <button
                      type="button"
                      className={`w-full text-left px-3 py-2.5 border-b border-border/40 last:border-b-0 transition-colors ${
                        isActive ? "bg-primary/10" : "hover:bg-secondary/40"
                      }`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => navigateTo(result)}
                    >
                      <div className="flex items-start gap-3">
                        <span className="inline-flex min-w-[90px] justify-center rounded-md border border-border/60 bg-background/80 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                          {result.type || result.metadata?.type || result.entity}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{title}</p>
                          {subtitle ? <p className="text-xs text-muted-foreground truncate">{subtitle}</p> : null}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
