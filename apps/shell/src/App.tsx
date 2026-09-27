import React, { useEffect, useState } from "react";
import {
  Alert,
  ArrowRightIcon,
  Avatar,
  Badge,
  Button,
  FlagIcon,
  LayoutGridIcon,
  LogOutIcon,
  ReceiptIcon,
  SectionLabel,
  ShieldCheckIcon,
  Spinner,
  UserCheckIcon,
} from "@platform/ui-kit";
import { hasPermission } from "@platform/tool-sdk";
import { AuthProvider, useAuth } from "./auth";
import { RemoteErrorBoundary, RemoteHost } from "./RemoteHost";
import { TOOLS, type ToolRegistration } from "./registry";

const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  kyc: UserCheckIcon,
  refunds: ReceiptIcon,
  flags: FlagIcon,
};

function ToolIcon({ tool, className }: { tool: ToolRegistration; className?: string }) {
  const Icon = TOOL_ICONS[tool.key] ?? LayoutGridIcon;
  return <Icon className={className} />;
}

function useHashRoute(): string {
  const [route, setRoute] = useState(() => window.location.hash.replace(/^#\/?/, ""));
  useEffect(() => {
    const onChange = () => setRoute(window.location.hash.replace(/^#\/?/, ""));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

function Brand({ onLight = false }: { onLight?: boolean }) {
  return (
    <a className="flex items-center gap-2.5" href="#/">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-elevated">
        <ShieldCheckIcon className="h-4 w-4" />
      </span>
      <span className="leading-tight">
        <span className={onLight ? "block text-sm font-semibold text-foreground" : "block text-sm font-semibold text-white"}>Internal Tools</span>
        <span className={onLight ? "block text-[11px] text-muted-foreground" : "block text-[11px] text-sidebar-muted"}>Operations console</span>
      </span>
    </a>
  );
}

function Shell() {
  const { session, logout } = useAuth();
  const route = useHashRoute();
  if (!session) return <Login />;

  const visible = TOOLS.filter((t) => hasPermission(session.principal, t.permission));
  const active = visible.find((t) => t.key === route);

  const navLink = (selected: boolean) =>
    [
      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
      selected ? "bg-sidebar-accent text-white" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white",
    ].join(" ");

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="app-sidebar sticky top-0 h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-4">
        <div className="px-2">
          <Brand />
        </div>
        <nav className="mt-6 grid gap-0.5">
          <a className={navLink(!route)} href="#/">
            <LayoutGridIcon className="h-4 w-4 shrink-0 opacity-80" />
            Overview
          </a>
          <SectionLabel className="mb-1 mt-5 px-3 text-sidebar-muted">Tools</SectionLabel>
          {visible.map((t) => (
            <a key={t.key} className={navLink(active?.key === t.key)} href={`#/${t.key}`} aria-current={active?.key === t.key ? "page" : undefined}>
              <ToolIcon tool={t} className="h-4 w-4 shrink-0 opacity-80" />
              <span className="truncate">{t.name}</span>
            </a>
          ))}
        </nav>
        <div className="mt-auto rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3">
          <div className="flex items-center gap-2.5">
            <Avatar name={session.principal.name} size="md" />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium text-white">{session.principal.name}</div>
              <div className="truncate text-[11px] text-sidebar-muted">{session.principal.roles.join(", ")}</div>
            </div>
          </div>
          <Button size="sm" variant="ghost" className="mt-3 w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-white" onClick={logout}>
            <LogOutIcon />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="app-topbar sticky top-0 z-10 h-14 items-center gap-3 border-b bg-sidebar px-4 text-white">
          <Brand />
          <nav className="ml-auto flex items-center gap-1 overflow-x-auto">
            {visible.map((t) => (
              <a key={t.key} className={navLink(active?.key === t.key)} href={`#/${t.key}`}>
                {t.name}
              </a>
            ))}
          </nav>
          <Button size="icon-sm" variant="ghost" aria-label="Sign out" className="text-sidebar-foreground hover:text-white" onClick={logout}>
            <LogOutIcon />
          </Button>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-8 py-6">
          {active ? (
            <RemoteErrorBoundary key={active.key} tool={active}>
              <RemoteHost tool={active} session={session} onSessionExpired={logout} />
            </RemoteErrorBoundary>
          ) : route ? (
            <Alert tone="error">No tool named "{route}" is available to you.</Alert>
          ) : (
            <Home />
          )}
        </main>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function Home() {
  const { session } = useAuth();
  if (!session) return null;
  const visible = TOOLS.filter((t) => hasPermission(session.principal, t.permission));
  const firstName = session.principal.name.split(" ")[0];
  return (
    <div className="grid gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting()}, {firstName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You have access to {visible.length} {visible.length === 1 ? "tool" : "tools"}. Pick one to get started.
        </p>
      </header>

      <section className="grid gap-3">
        <SectionLabel>Your tools</SectionLabel>
        {visible.length === 0 ? <Alert tone="info">Your roles don't grant access to any tool.</Alert> : null}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((t) => (
            <a
              key={t.key}
              className="group relative flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              href={`#/${t.key}`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <ToolIcon tool={t} className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-semibold">{t.name}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t.description}</p>
              </div>
              <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary">
                Open
                <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="grid gap-3">
        <SectionLabel>Your permissions</SectionLabel>
        <div className="flex flex-wrap gap-1.5 rounded-xl border bg-card p-4 shadow-card">
          {session.principal.permissions.map((p) => (
            <Badge key={p} className="font-mono">
              {p}
            </Badge>
          ))}
        </div>
      </section>
    </div>
  );
}

function Login() {
  const { users, login, loading, error } = useAuth();
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="app-login-hero relative flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_20%_0%,hsl(var(--primary)/0.45),transparent_70%),radial-gradient(50%_40%_at_100%_100%,hsl(var(--info)/0.25),transparent_70%)]"
        />
        <div className="relative">
          <Brand />
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white">One console for every operations workflow.</h2>
          <p className="mt-4 text-sm leading-relaxed text-sidebar-foreground/90">
            KYC reviews, refunds and feature flags share a single design system, permission model and audit trail — so every team works the same way.
          </p>
          <ul className="mt-8 grid gap-3 text-sm">
            {TOOLS.map((t) => (
              <li key={t.key} className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white">
                  <ToolIcon tool={t} className="h-4 w-4" />
                </span>
                <span>
                  <span className="font-medium text-white">{t.name}</span>
                  <span className="block text-xs text-sidebar-muted">{t.description}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-sidebar-muted">Internal use only · Mocked OIDC for local development</p>
      </aside>

      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="app-login-brand-compact mb-6">
            <Brand onLight />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a seeded user to continue. All passwords are <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">demo</code>.
          </p>
          {error ? (
            <div className="mt-4">
              <Alert tone="error">{error}</Alert>
            </div>
          ) : null}
          <div className="mt-6 overflow-hidden rounded-xl border bg-card shadow-card">
            {users.length === 0 && !error ? (
              <div className="flex justify-center p-8">
                <Spinner label="Loading users…" />
              </div>
            ) : null}
            <ul className="divide-y">
              {users.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    className="group flex w-full items-center gap-3 p-4 text-left text-sm transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                    disabled={loading}
                    onClick={() => login(u.email)}
                  >
                    <Avatar name={u.name} size="lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{u.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                    </span>
                    <span className="flex flex-wrap justify-end gap-1">
                      {u.roles.map((r) => (
                        <Badge key={r} tone="info">
                          {r}
                        </Badge>
                      ))}
                    </span>
                    <ArrowRightIcon className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
