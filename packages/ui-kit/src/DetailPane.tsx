import React from "react";
import { Card } from "./primitives";

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
  children?: React.ReactNode;
}

export function DetailPane({ title, status, subtitle, sections, actions, children }: DetailPaneProps) {
  return (
    <div className="grid gap-4">
      <div>
        <div className="flex items-center gap-2 text-lg font-semibold">
          {title}
          {status}
        </div>
        {subtitle ? <div className="font-mono text-sm text-muted-foreground">{subtitle}</div> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
      {sections.map((s) => (
        <Card key={s.title} title={s.title}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {s.fields.map((f) => (
              <div key={f.label}>
                <dt className="text-muted-foreground">{f.label}</dt>
                <dd>{f.value}</dd>
                {f.hint ? (
                  <dd className="text-xs text-muted-foreground">{f.hint}</dd>
                ) : null}
              </div>
            ))}
          </dl>
        </Card>
      ))}
      {children}
    </div>
  );
}
