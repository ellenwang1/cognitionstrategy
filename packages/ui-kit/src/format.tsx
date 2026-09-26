import React from "react";
import { Badge, StatusBadge } from "./primitives";

/** Field types mirror `FieldType` in the platform config contract. */
export type ValueType = "string" | "text" | "number" | "currency" | "boolean" | "enum" | "datetime" | "tags" | "json";

export function formatValue(value: unknown, type: ValueType = "string", opts: { currency?: string } = {}): React.ReactNode {
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">—</span>;
  switch (type) {
    case "boolean":
      return <Badge tone={value ? "success" : "neutral"}>{value ? "yes" : "no"}</Badge>;
    case "enum":
      return <StatusBadge value={value} />;
    case "currency": {
      const n = Number(value);
      return Number.isFinite(n)
        ? n.toLocaleString(undefined, { style: "currency", currency: opts.currency ?? "USD" })
        : String(value);
    }
    case "number": {
      const n = Number(value);
      return Number.isFinite(n) ? n.toLocaleString() : String(value);
    }
    case "datetime": {
      const d = new Date(String(value));
      return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
    }
    case "tags": {
      const items = Array.isArray(value) ? value : String(value).split(",");
      return (
        <span className="flex flex-wrap gap-1">
          {items.filter(Boolean).map((t) => (
            <Badge key={String(t)} tone="info">
              {String(t)}
            </Badge>
          ))}
        </span>
      );
    }
    case "json":
      return <code className="font-mono text-xs">{JSON.stringify(value)}</code>;
    default:
      return String(value);
  }
}
