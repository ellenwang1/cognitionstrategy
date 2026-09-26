import React from "react";
import { Card, EmptyState } from "./primitives";

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
    <Card title={title}>
      {entries.length === 0 ? <EmptyState>No activity yet</EmptyState> : null}
      <div className="grid gap-2">
        {entries.map((e) => {
          const changes = Object.entries(e.changes ?? {});
          return (
            <div key={e.id} className="rounded-lg border p-3 text-sm">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span>
                    <b>{e.actor_email}</b> · {e.action}
                  </span>
                  <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                </div>
                {changes.length > 0 ? (
                  <div className="mt-2 grid gap-2">
                    {changes.map(([field, c]) => (
                      <div key={field} className="grid gap-1">
                        <span className="font-medium">{field}</span>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <pre className="rounded bg-muted p-2 text-xs">{show(c.before)}</pre>
                          <pre className="rounded bg-muted p-2 text-xs">{show(c.after)}</pre>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
