import React from "react";
import { Button, FormField, Select, TextInput } from "./primitives";

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

export function FilterBar({ filters, values, onChange, search, onSearchChange, searchPlaceholder = "Search…" }: FilterBarProps) {
  const set = (field: string, value: string) => onChange({ ...values, [field]: value });
  const hasAny = Boolean(search) || Object.values(values).some(Boolean);
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
      {onSearchChange ? (
        <FormField label="Search">
          <TextInput value={search ?? ""} placeholder={searchPlaceholder} onChange={(e) => onSearchChange(e.target.value)} />
        </FormField>
      ) : null}
      {filters.map((f) => (
        <FormField key={f.field} label={f.label}>
          {f.kind === "select" ? (
            <Select value={values[f.field] ?? ""} options={f.options ?? []} placeholder="Any" onChange={(e) => set(f.field, e.target.value)} />
          ) : f.kind === "boolean" ? (
            <Select value={values[f.field] ?? ""} options={["true", "false"]} placeholder="Any" onChange={(e) => set(f.field, e.target.value)} />
          ) : (
            <TextInput value={values[f.field] ?? ""} onChange={(e) => set(f.field, e.target.value)} />
          )}
        </FormField>
      ))}
      {hasAny ? (
        <Button
          onClick={() => {
            onChange({});
            onSearchChange?.("");
          }}
        >
          Clear
        </Button>
      ) : null}
    </div>
  );
}
