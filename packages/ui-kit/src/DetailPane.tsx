import React from "react";
import { X } from "lucide-react";
import { Button, SectionLabel } from "./primitives";

export interface DetailField {
  label: string;
  value: React.ReactNode;
  hint?: string;
}

export interface DetailSection {
  title: string;
  fields: DetailField[];
}

export interface DetailPaneProps {
  title: React.ReactNode;
  status?: React.ReactNode;
  subtitle?: React.ReactNode;
  sections: DetailSection[];
  actions?: React.ReactNode;
  onClose?: () => void;
  children?: React.ReactNode;
}

export function DetailPane({ title, status, subtitle, sections, actions, onClose, children }: DetailPaneProps) {
  return (
    <aside className="grid gap-4 lg:sticky lg:top-6">
      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        <header className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold tracking-tight">{title}</h2>
              {status}
            </div>
            {subtitle ? <div className="mt-1 font-mono text-xs text-muted-foreground">{subtitle}</div> : null}
          </div>
          {onClose ? (
            <Button size="icon-sm" variant="ghost" aria-label="Close details" onClick={onClose} className="-mr-2 -mt-1">
              <X />
            </Button>
          ) : null}
        </header>
        {actions ? <div className="flex flex-wrap gap-2 border-b bg-muted/30 px-5 py-3">{actions}</div> : null}
        {sections.map((s) => (
          <section key={s.title} className="border-b px-5 py-4 last:border-b-0">
            <SectionLabel className="mb-3">{s.title}</SectionLabel>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              {s.fields.map((f) => (
                <div key={f.label} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{f.label}</dt>
                  <dd className="tabular mt-0.5 break-words text-sm font-medium">{f.value}</dd>
                  {f.hint ? <dd className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{f.hint}</dd> : null}
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      {children}
    </aside>
  );
}
