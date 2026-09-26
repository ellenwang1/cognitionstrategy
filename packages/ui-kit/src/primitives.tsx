import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./lib/utils";
import { Alert as ShadcnAlert } from "./components/ui/alert";
import { Badge as ShadcnBadge, type BadgeProps as ShadcnBadgeProps } from "./components/ui/badge";
import { Button as ShadcnButton } from "./components/ui/button";
import { Card as ShadcnCard, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./components/ui/dialog";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Textarea } from "./components/ui/textarea";

export type ButtonVariant = "primary" | "danger" | "secondary";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  loading?: boolean;
}

export function Button({ variant = "secondary", size = "md", loading, children, className, ...rest }: ButtonProps) {
  const mapped = variant === "primary" ? "default" : variant === "danger" ? "destructive" : "outline";
  return <ShadcnButton variant={mapped} size={size === "sm" ? "sm" : "default"} className={className} {...rest} disabled={loading || rest.disabled}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{children}</ShadcnButton>;
}

export type BadgeTone = "neutral" | "success" | "danger" | "warning" | "info";

const badgeVariants: Record<BadgeTone, ShadcnBadgeProps["variant"]> = { neutral: "secondary", success: "success", danger: "destructive", warning: "warning", info: "info" };
export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) { return <ShadcnBadge variant={badgeVariants[tone]}>{children}</ShadcnBadge>; }

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

export function StatusBadge({ value }: { value: unknown }) { const key = String(value ?? "").toLowerCase(); return <Badge tone={STATUS_TONES[key] ?? "neutral"}>{key.replace(/_/g, " ") || "—"}</Badge>; }

export function Card({ title, actions, children }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  return <ShadcnCard>{title ? <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle>{title}</CardTitle>{actions}</CardHeader> : null}<CardContent className={title ? undefined : "pt-6"}>{children}</CardContent></ShadcnCard>;
}

export function Alert({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: React.ReactNode }) { return <ShadcnAlert variant={tone === "error" ? "destructive" : "default"}>{children}</ShadcnAlert>; }

export function Spinner({ label }: { label?: string }) { return <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{label ? <span className="text-sm text-muted-foreground">{label}</span> : null}</span>; }

export function EmptyState({ children }: { children: React.ReactNode }) { return <div className="py-8 text-center text-sm text-muted-foreground">{children}</div>; }

export function Modal({ title, onClose, footer, children }: { title: React.ReactNode; onClose: () => void; footer?: React.ReactNode; children: React.ReactNode }) { return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>{children}{footer ? <DialogFooter>{footer}</DialogFooter> : null}</DialogContent></Dialog>; }

export function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) { return <div className="grid gap-2"><Label>{label}</Label>{children}{hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}</div>; }

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) { return <Input {...props} />; }

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) { return <Textarea {...props} />; }

export function Select({ options, placeholder, className, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: string[]; placeholder?: string }) { return <select className={cn("flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring", className)} {...rest}>{placeholder !== undefined ? <option value="">{placeholder}</option> : null}{options.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}</select>; }

export function Checkbox({ label, className, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <label className="flex items-center gap-2 text-sm"><input type="checkbox" className={cn("h-4 w-4 rounded border-primary accent-primary", className)} {...rest} /><Label>{label}</Label></label>; }
