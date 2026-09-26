import React from "react";
import { Button, EmptyState } from "./primitives";

export interface Column<Row> {
  key: string;
  label: string;
  render?: (row: Row) => React.ReactNode;
  sortable?: boolean;
}

export interface SortState {
  field: string;
  direction: "asc" | "desc";
}

export interface DataTableProps<Row> {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  selectedKey?: string | null;
  onRowClick?: (row: Row) => void;
  sort?: SortState | null;
  onSortChange?: (sort: SortState) => void;
  loading?: boolean;
  emptyMessage?: string;
  pagination?: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void };
}

export function DataTable<Row>({ columns, rows, rowKey, selectedKey, onRowClick, sort, onSortChange, loading, emptyMessage = "No records", pagination }: DataTableProps<Row>) {
  const toggleSort = (key: string) => {
    if (!onSortChange) return;
    const direction = sort?.field === key && sort.direction === "asc" ? "desc" : "asc";
    onSortChange({ field: key, direction });
  };
  return (
    <div className="pk-table-wrap">
      <table className="pk-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} onClick={() => c.sortable !== false && toggleSort(c.key)}>
                {c.label}
                {sort?.field === c.key ? (sort.direction === "asc" ? " ▲" : " ▼") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            return (
              <tr key={key} className={selectedKey === key ? "is-selected" : ""} onClick={() => onRowClick?.(row)}>
                {columns.map((c) => (
                  <td key={c.key}>{c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "")}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!loading && rows.length === 0 ? <EmptyState>{emptyMessage}</EmptyState> : null}
      {loading ? <div className="pk-table__empty">Loading…</div> : null}
      {pagination ? <Pagination {...pagination} /> : null}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPageChange }: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pk-pagination">
      <span>
        {total === 0 ? "0" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}`} of {total}
      </span>
      <span style={{ display: "flex", gap: 6 }}>
        <Button size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Prev
        </Button>
        <span style={{ alignSelf: "center" }}>
          {page} / {pages}
        </span>
        <Button size="sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </span>
    </div>
  );
}
