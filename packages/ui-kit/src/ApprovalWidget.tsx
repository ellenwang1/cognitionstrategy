import React, { useState } from "react";
import { Button, Card, EmptyState, StatusBadge, TextInput } from "./primitives";

export interface ApprovalItem {
  id: string;
  action_key: string;
  status: string;
  reason?: string | null;
  requested_by_email: string;
  created_at: string;
  decided_by_email?: string | null;
  decision_comment?: string | null;
  required_permission: string;
}

export interface ApprovalWidgetProps {
  approvals: ApprovalItem[];
  canDecide: (approval: ApprovalItem) => boolean;
  onDecide: (approval: ApprovalItem, decision: "approved" | "rejected", comment: string) => Promise<void> | void;
  title?: string;
}

export function ApprovalWidget({ approvals, canDecide, onDecide, title = "Approvals" }: ApprovalWidgetProps) {
  const [comments, setComments] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const decide = async (a: ApprovalItem, decision: "approved" | "rejected") => {
    setBusy(a.id);
    try {
      await onDecide(a, decision, comments[a.id] ?? "");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card title={title}>
      {approvals.length === 0 ? <EmptyState>No approval requests</EmptyState> : null}
      <div className="grid gap-2">
        {approvals.map((a) => (
          <div key={a.id} className="rounded-lg border p-3 text-sm">
            <div>
              <div>
                <b>{a.action_key.replace(/_/g, " ")}</b> <StatusBadge value={a.status} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                requested by {a.requested_by_email} · {new Date(a.created_at).toLocaleString()}
                {a.reason ? ` · "${a.reason}"` : ""}
                {a.decided_by_email ? ` · decided by ${a.decided_by_email}` : ""}
                {a.decision_comment ? ` · "${a.decision_comment}"` : ""}
              </div>
            </div>
            {a.status === "pending" && canDecide(a) ? (
              <div className="flex items-center gap-2">
                <TextInput placeholder="Comment" value={comments[a.id] ?? ""} onChange={(e) => setComments({ ...comments, [a.id]: e.target.value })} />
                <Button size="sm" variant="primary" loading={busy === a.id} onClick={() => decide(a, "approved")}>
                  Approve
                </Button>
                <Button size="sm" variant="danger" loading={busy === a.id} onClick={() => decide(a, "rejected")}>
                  Reject
                </Button>
              </div>
            ) : a.status === "pending" ? (
              <span className="text-xs text-muted-foreground">
                needs <code className="font-mono">{a.required_permission}</code>
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
