import React from "react";
import { ArrowRight, History } from "lucide-react";
import { Avatar, Card, EmptyState } from "./primitives";

export interface AuditEntry {
  id: number;
  created_at: string;
  actor_email: string;
  action: string;
  changes: Record<string, { before: unknown; after: unknown }>;
  context?: Record<string, unknown> | null;
}

function show(v: unknown): string {
  if (v === null || v === undefined) return "∅";
  return typeof v === "string" ? v : JSON.stringify(v);
}

export function AuditTrail({ entries, title = "Audit trail" }: { entries: AuditEntry[]; title?: string }) {
  return (
    <Card title={title} bodyClassName="p-0">
      {entries.length === 0 ? <EmptyState icon={<History className="h-5 w-5" />}>No activity yet</EmptyState> : null}
      <ol className="relative">
        {entries.map((e, i) => {
          const changes = Object.entries(e.changes ?? {});
          const last = i === entries.length - 1;
          return (
            <li key={e.id} className="relative flex gap-3 px-5 py-4 text-sm">
              {!last ? <span aria-hidden className="absolute left-[2.25rem] top-12 h-[calc(100%-2rem)] w-px bg-border" /> : null}
              <Avatar name={e.actor_email} size="md" className="relative z-[1] ring-4 ring-card" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="min-w-0">
                    <span className="font-medium">{e.actor_email}</span>{" "}
                    <span className="text-muted-foreground">{e.action.replace(/_/g, " ")}</span>
                  </span>
                  <time className="tabular whitespace-nowrap text-xs text-muted-foreground" dateTime={e.created_at}>
                    {new Date(e.created_at).toLocaleString()}
                  </time>
                </div>
                {changes.length > 0 ? (
                  <dl className="mt-2 grid gap-1.5">
                    {changes.map(([field, c]) => (
                      <div key={field} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs">
                        <dt className="font-medium text-foreground">{field}</dt>
                        <dd className="flex min-w-0 flex-wrap items-center gap-x-1.5">
                          <code className="break-all font-mono text-muted-foreground line-through decoration-muted-foreground/60">{show(c.before)}</code>
                          <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <code className="break-all font-mono text-foreground">{show(c.after)}</code>
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
