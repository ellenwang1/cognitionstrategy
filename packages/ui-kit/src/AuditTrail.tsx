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
      <div className="pk-audit">
        {entries.map((e) => {
          const changes = Object.entries(e.changes ?? {});
          return (
            <div key={e.id} className="pk-audit__item">
              <span className="pk-audit__dot" />
              <div>
                <div className="pk-audit__head">
                  <span>
                    <b>{e.actor_email}</b> · {e.action}
                  </span>
                  <span className="pk-muted">{new Date(e.created_at).toLocaleString()}</span>
                </div>
                {changes.length > 0 ? (
                  <div className="pk-audit__changes">
                    {changes.map(([field, c]) => (
                      <div key={field} className="pk-audit__change">
                        {field}: <del>{show(c.before)}</del>
                        <ins>{show(c.after)}</ins>
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
