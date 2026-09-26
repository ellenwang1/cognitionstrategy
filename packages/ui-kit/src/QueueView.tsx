import React from "react";
import { ChevronRight } from "lucide-react";
import { Pagination } from "./DataTable";
import { EmptyState, Spinner } from "./primitives";
import { cn } from "./lib/utils";

export interface QueueItem {
  key: string;
  title: React.ReactNode;
  status?: React.ReactNode;
  meta: { label: string; value: React.ReactNode }[];
}

export interface QueueViewProps {
  items: QueueItem[];
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
  loading?: boolean;
  emptyMessage?: string;
  pagination?: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void };
}

/** Work-queue presentation: one card per item, highest priority first. */
export function QueueView({ items, selectedKey, onSelect, loading, emptyMessage = "Queue is empty", pagination }: QueueViewProps) {
  return (
    <div className="grid gap-2">
      {items.map((item) => {
        const selected = selectedKey === item.key;
        return (
          <button
            type="button"
            key={item.key}
            aria-pressed={selected}
            className={cn(
              "group grid w-full gap-3 rounded-xl border bg-card p-4 text-left shadow-card transition-all",
              "hover:border-primary/40 hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              selected && "border-primary bg-accent/40 ring-1 ring-primary",
            )}
            onClick={() => onSelect?.(item.key)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 truncate text-sm font-semibold">{item.title}</div>
              <div className="flex shrink-0 items-center gap-2">
                {item.status}
                <ChevronRight className={cn("h-4 w-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary", selected && "text-primary")} />
              </div>
            </div>
            {item.meta.length > 0 ? (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
                {item.meta.map((m) => (
                  <div key={m.label} className="min-w-0">
                    <dt className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{m.label}</dt>
                    <dd className="tabular mt-0.5 truncate text-sm text-foreground">{m.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </button>
        );
      })}
      {!loading && items.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/60">
          <EmptyState>{emptyMessage}</EmptyState>
        </div>
      ) : null}
      {loading && items.length === 0 ? (
        <div className="flex justify-center rounded-xl border border-dashed bg-card/60 py-10">
          <Spinner label="Loading…" />
        </div>
      ) : null}
      {pagination ? (
        <div className="rounded-xl border bg-card px-4 py-2.5 shadow-card">
          <Pagination {...pagination} />
        </div>
      ) : null}
    </div>
  );
}
