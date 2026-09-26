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
    <div className="pk-detail">
      <div>
        <div className="pk-detail__title">
          {title}
          {status}
        </div>
        {subtitle ? <div className="pk-muted pk-mono">{subtitle}</div> : null}
      </div>
      {actions ? <div className="pk-detail__actions">{actions}</div> : null}
      {sections.map((s) => (
        <Card key={s.title} title={s.title}>
          <div className="pk-detail__grid">
            {s.fields.map((f) => (
              <div key={f.label}>
                <div className="pk-detail__label">{f.label}</div>
                <div className="pk-detail__value">{f.value}</div>
                {f.hint ? <div className="pk-muted" style={{ fontSize: 11 }}>{f.hint}</div> : null}
              </div>
            ))}
          </div>
        </Card>
      ))}
      {children}
    </div>
  );
}
