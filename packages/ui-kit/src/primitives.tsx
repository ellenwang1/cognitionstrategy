import React from "react";

export type ButtonVariant = "primary" | "danger" | "secondary";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  loading?: boolean;
}

export function Button({ variant = "secondary", size = "md", loading, children, className = "", ...rest }: ButtonProps) {
  const cls = ["pk-btn", variant !== "secondary" ? `pk-btn--${variant}` : "", size === "sm" ? "pk-btn--sm" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={cls} disabled={loading || rest.disabled} {...rest}>
      {loading ? <span className="pk-spinner" /> : null}
      {children}
    </button>
  );
}

export type BadgeTone = "neutral" | "success" | "danger" | "warning" | "info";

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return <span className={`pk-badge${tone !== "neutral" ? ` pk-badge--${tone}` : ""}`}>{children}</span>;
}

const STATUS_TONES: Record<string, BadgeTone> = {
  approved: "success",
  refunded: "success",
  enabled: "success",
  true: "success",
  rejected: "danger",
  cancelled: "danger",
  false: "neutral",
  pending: "warning",
  requested: "warning",
  pending_approval: "warning",
  in_review: "info",
};

export function StatusBadge({ value }: { value: unknown }) {
  const key = String(value ?? "").toLowerCase();
  return <Badge tone={STATUS_TONES[key] ?? "neutral"}>{key.replace(/_/g, " ") || "—"}</Badge>;
}

export function Card({ title, actions, children }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="pk-card">
      {title ? (
        <div className="pk-card__header">
          <span>{title}</span>
          {actions}
        </div>
      ) : null}
      <div className="pk-card__body">{children}</div>
    </div>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: React.ReactNode }) {
  return <div className={`pk-alert pk-alert--${tone}`}>{children}</div>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span className="pk-spinner" />
      {label ? <span className="pk-muted">{label}</span> : null}
    </span>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="pk-empty">{children}</div>;
}

export function Modal({ title, onClose, footer, children }: { title: React.ReactNode; onClose: () => void; footer?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="pk-modal-backdrop" onClick={onClose} role="presentation">
      <div className="pk-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="pk-modal__title">{title}</div>
        <div>{children}</div>
        {footer ? <div className="pk-modal__footer">{footer}</div> : null}
      </div>
    </div>
  );
}

export function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="pk-field">
      <label>{label}</label>
      {children}
      {hint ? <span className="pk-muted" style={{ fontSize: 11 }}>{hint}</span> : null}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="pk-input" {...props} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="pk-textarea" {...props} />;
}

export function Select({ options, placeholder, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: string[]; placeholder?: string }) {
  return (
    <select className="pk-select" {...rest}>
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
      {options.map((o) => (
        <option key={o} value={o}>
          {o.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
}

export function Checkbox({ label, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="pk-checkbox">
      <input type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  );
}
