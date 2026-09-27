import React from "react";
import { Search, X } from "lucide-react";
import { Button, Select, TextInput } from "./primitives";

export interface FilterDef {
  field: string;
  label: string;
  kind: "search" | "select" | "boolean";
  options?: string[];
}

export interface FilterBarProps {
  filters: FilterDef[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <span className="whitespace-nowrap">{label}</span>
      {children}
    </label>
  );
}

export function FilterBar({ filters, values, onChange, search, onSearchChange, searchPlaceholder = "Search…" }: FilterBarProps) {
  const set = (field: string, value: string) => onChange({ ...values, [field]: value });
  const activeCount = (search ? 1 : 0) + Object.values(values).filter(Boolean).length;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 shadow-card">
      {onSearchChange ? (
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <TextInput className="h-8 pl-8 shadow-none" value={search ?? ""} placeholder={searchPlaceholder} onChange={(e) => onSearchChange(e.target.value)} />
        </div>
      ) : null}
      {filters.length > 0 ? <span className="hidden h-5 w-px bg-border sm:block" /> : null}
      {filters.map((f) => (
        <Field key={f.field} label={f.label}>
          {f.kind === "select" ? (
            <Select className="w-36 [&>select]:h-8 [&>select]:shadow-none" value={values[f.field] ?? ""} options={f.options ?? []} placeholder="Any" onChange={(e) => set(f.field, e.target.value)} />
          ) : f.kind === "boolean" ? (
            <Select className="w-24 [&>select]:h-8 [&>select]:shadow-none" value={values[f.field] ?? ""} options={["true", "false"]} placeholder="Any" onChange={(e) => set(f.field, e.target.value)} />
          ) : (
            <TextInput className="h-8 w-32 shadow-none" value={values[f.field] ?? ""} onChange={(e) => set(f.field, e.target.value)} />
          )}
        </Field>
      ))}
      {activeCount > 0 ? (
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          onClick={() => {
            onChange({});
            onSearchChange?.("");
          }}
        >
          <X />
          Clear {activeCount > 1 ? `${activeCount} filters` : "filter"}
        </Button>
      ) : null}
    </div>
  );
}
