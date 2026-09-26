import React from "react";
import { Pagination } from "./DataTable";
import { EmptyState } from "./primitives";

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
    <div className="pk-queue">
      {items.map((item) => (
        <div key={item.key} className={`pk-queue__item${selectedKey === item.key ? " is-selected" : ""}`} onClick={() => onSelect?.(item.key)}>
          <div>
            <div className="pk-queue__title">{item.title}</div>
            <div className="pk-queue__meta">
              {item.meta.map((m) => (
                <span key={m.label}>
                  {m.label}: <b>{m.value}</b>
                </span>
              ))}
            </div>
          </div>
          <div>{item.status}</div>
        </div>
      ))}
      {!loading && items.length === 0 ? <EmptyState>{emptyMessage}</EmptyState> : null}
      {loading ? <EmptyState>Loading…</EmptyState> : null}
      {pagination ? (
        <div className="pk-card">
          <Pagination {...pagination} />
        </div>
      ) : null}
    </div>
  );
}
