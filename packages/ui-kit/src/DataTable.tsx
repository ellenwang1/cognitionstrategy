import React from "react";
import { Button, EmptyState } from "./primitives";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./components/ui/table";

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
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c.key} className={c.sortable !== false ? "cursor-pointer select-none" : undefined} onClick={() => c.sortable !== false && toggleSort(c.key)}>
                {c.label}
                {c.sortable !== false ? (sort?.field === c.key ? (sort.direction === "asc" ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />) : <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-50" />) : null}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const key = rowKey(row);
            return (
              <TableRow key={key} className={selectedKey === key ? "bg-muted" : undefined} onClick={() => onRowClick?.(row)}>
                {columns.map((c) => (
                  <TableCell key={c.key}>{c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "")}</TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {!loading && rows.length === 0 ? <EmptyState>{emptyMessage}</EmptyState> : null}
      {loading ? <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div> : null}
      {pagination ? <Pagination {...pagination} /> : null}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPageChange }: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        {total === 0 ? "0" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}`} of {total}
      </span>
      <span className="flex items-center gap-2">
        <Button size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Prev
        </Button>
        <span>
          {page} / {pages}
        </span>
        <Button size="sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </span>
    </div>
  );
}
