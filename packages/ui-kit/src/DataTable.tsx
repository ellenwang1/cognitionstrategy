import React from "react";
import { Button, EmptyState, Spinner } from "./primitives";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "./lib/utils";
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
    <div className="overflow-hidden rounded-xl border bg-card shadow-card">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => {
              const sortable = c.sortable !== false && Boolean(onSortChange);
              const active = sort?.field === c.key;
              return (
                <TableHead
                  key={c.key}
                  aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}
                  className={cn(sortable && "cursor-pointer select-none hover:text-foreground", active && "text-foreground")}
                  onClick={() => sortable && toggleSort(c.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    {sortable ? (
                      active ? (
                        sort.direction === "asc" ? (
                          <ArrowUp className="h-3 w-3 text-primary" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-primary" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )
                    ) : null}
                  </span>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const key = rowKey(row);
            const selected = selectedKey === key;
            return (
              <TableRow
                key={key}
                data-state={selected ? "selected" : undefined}
                className={cn(onRowClick && "cursor-pointer", selected && "shadow-[inset_3px_0_0_hsl(var(--primary))]")}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((c) => (
                  <TableCell key={c.key} className="tabular whitespace-nowrap">
                    {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "")}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {!loading && rows.length === 0 ? <EmptyState>{emptyMessage}</EmptyState> : null}
      {loading && rows.length === 0 ? (
        <div className="flex justify-center py-10">
          <Spinner label="Loading…" />
        </div>
      ) : null}
      {pagination ? (
        <div className="border-t bg-muted/30 px-4 py-2.5">
          <Pagination {...pagination} />
        </div>
      ) : null}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPageChange }: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span className="tabular">
        {total === 0 ? "0 results" : (
          <>
            <span className="font-medium text-foreground">{from}–{to}</span> of <span className="font-medium text-foreground">{total}</span>
          </>
        )}
      </span>
      <span className="flex items-center gap-1">
        <Button size="icon-sm" variant="ghost" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft />
        </Button>
        <span className="tabular min-w-[4.5rem] text-center text-xs">
          Page <span className="font-medium text-foreground">{page}</span> / {pages}
        </span>
        <Button size="icon-sm" variant="ghost" aria-label="Next page" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight />
        </Button>
      </span>
    </div>
  );
}
