import React, { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Avatar, Badge, Button, Card, EmptyState, StatusBadge, TextInput } from "./primitives";

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

  const pending = approvals.filter((a) => a.status === "pending").length;

  return (
    <Card
      title={
        <>
          {title}
          {pending > 0 ? <Badge tone="warning">{pending} pending</Badge> : null}
        </>
      }
      bodyClassName="p-0"
    >
      {approvals.length === 0 ? <EmptyState icon={<ShieldCheck className="h-5 w-5" />}>No approval requests</EmptyState> : null}
      <ul className="divide-y">
        {approvals.map((a) => (
          <li key={a.id} className="grid gap-3 px-5 py-4 text-sm">
            <div className="flex items-start gap-3">
              <Avatar name={a.requested_by_email} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium capitalize">{a.action_key.replace(/_/g, " ")}</span>
                  <StatusBadge value={a.status} />
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Requested by <span className="font-medium text-foreground">{a.requested_by_email}</span> · {new Date(a.created_at).toLocaleString()}
                </div>
                {a.reason ? <blockquote className="mt-2 border-l-2 border-border pl-3 text-xs italic text-muted-foreground">“{a.reason}”</blockquote> : null}
                {a.decided_by_email ? (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Decided by <span className="font-medium text-foreground">{a.decided_by_email}</span>
                    {a.decision_comment ? <> · “{a.decision_comment}”</> : null}
                  </div>
                ) : null}
              </div>
            </div>
            {a.status === "pending" && canDecide(a) ? (
              <div className="flex flex-wrap items-center gap-2 pl-11">
                <TextInput
                  className="h-8 min-w-0 flex-1"
                  placeholder="Add a comment (optional)"
                  value={comments[a.id] ?? ""}
                  onChange={(e) => setComments({ ...comments, [a.id]: e.target.value })}
                />
                <Button size="sm" variant="primary" loading={busy === a.id} onClick={() => decide(a, "approved")}>
                  Approve
                </Button>
                <Button size="sm" variant="danger" loading={busy === a.id} onClick={() => decide(a, "rejected")}>
                  Reject
                </Button>
              </div>
            ) : a.status === "pending" ? (
              <div className="pl-11 text-xs text-muted-foreground">
                Awaiting a second approver with <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{a.required_permission}</code>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
