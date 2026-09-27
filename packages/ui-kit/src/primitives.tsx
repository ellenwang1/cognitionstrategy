import React from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Info, Inbox, Loader2 } from "lucide-react";
import { cn } from "./lib/utils";
import { Alert as ShadcnAlert } from "./components/ui/alert";
import {
  Badge as ShadcnBadge,
  type BadgeProps as ShadcnBadgeProps,
} from "./components/ui/badge";
import { Button as ShadcnButton } from "./components/ui/button";
import { Card as ShadcnCard, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./components/ui/dialog";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Textarea } from "./components/ui/textarea";

export type ButtonVariant = "primary" | "danger" | "secondary" | "ghost";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "icon" | "icon-sm";
  loading?: boolean;
}

const buttonVariantMap = {
  primary: "default",
  danger: "destructive",
  secondary: "outline",
  ghost: "ghost",
} as const;

const buttonSizeMap = {
  sm: "sm",
  md: "default",
  icon: "icon",
  "icon-sm": "icon-sm",
} as const;

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  children,
  className,
  ...rest
}: ButtonProps) {
  return (
    <ShadcnButton
      variant={buttonVariantMap[variant]}
      size={buttonSizeMap[size]}
      className={className}
      {...rest}
      disabled={loading || rest.disabled}
    >
      {loading ? <Loader2 className="animate-spin" /> : null}
      {children}
    </ShadcnButton>
  );
}

export type BadgeTone = "neutral" | "success" | "danger" | "warning" | "info";

const badgeVariants: Record<BadgeTone, ShadcnBadgeProps["variant"]> = {
  neutral: "secondary",
  success: "success",
  danger: "destructive",
  warning: "warning",
  info: "info",
};
export function Badge({
  tone = "neutral",
  dot,
  className,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <ShadcnBadge variant={badgeVariants[tone]} dot={dot} className={className}>
      {children}
    </ShadcnBadge>
  );
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
  return (
    <Badge tone={STATUS_TONES[key] ?? "neutral"} dot className="capitalize">
      {key.replace(/_/g, " ") || "—"}
    </Badge>
  );
}

export function Card({
  title,
  description,
  actions,
  className,
  bodyClassName,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <ShadcnCard className={className}>
      {title ? (
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">{title}</CardTitle>
            {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </CardHeader>
      ) : null}
      <CardContent className={bodyClassName}>{children}</CardContent>
    </ShadcnCard>
  );
}

/** Small uppercase heading used above groups of fields or list sections. */
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h4 className={cn("text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground", className)}>{children}</h4>;
}

const ALERT_ICONS = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
} as const;

export function Alert({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success";
  children: React.ReactNode;
}) {
  const Icon = ALERT_ICONS[tone];
  return (
    <ShadcnAlert variant={tone === "error" ? "destructive" : tone === "success" ? "success" : "default"}>
      <Icon />
      <div className="min-w-0 flex-1 leading-relaxed">{children}</div>
    </ShadcnAlert>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      {label ? <span className="text-sm text-muted-foreground">{label}</span> : null}
    </span>
  );
}

export function EmptyState({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <Inbox className="h-5 w-5" />}
      </span>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

export function Modal({
  title,
  description,
  onClose,
  footer,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </DialogHeader>
        {children}
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}

export function FormField({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

export function TextInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <Input className={className} {...props} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <Textarea {...props} />;
}

export function Select({
  options,
  placeholder,
  className,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: string[];
  placeholder?: string;
}) {
  return (
    <span className={cn("relative inline-flex w-full", className)}>
      <select
        className="h-9 w-full appearance-none rounded-md border border-input bg-card py-1 pl-3 pr-8 text-sm capitalize shadow-sm transition-colors hover:border-slate-400/70 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
        {...rest}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </span>
  );
}

export function Checkbox({
  label,
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        className={cn("h-4 w-4 rounded border-input text-primary accent-primary focus:ring-2 focus:ring-primary/20", className)}
        {...rest}
      />
      <span>{label}</span>
    </label>
  );
}

/** Circular initials avatar; colour is derived from the name so the same person is always the same hue. */
export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const initials = name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  const hues = ["bg-indigo-500", "bg-sky-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-violet-500", "bg-teal-500"];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const sizes = { sm: "h-6 w-6 text-[10px]", md: "h-8 w-8 text-xs", lg: "h-10 w-10 text-sm" };
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white", hues[hash % hues.length], sizes[size], className)}
    >
      {initials || "?"}
    </span>
  );
}
