import React, { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Spinner } from "@platform/ui-kit";
import { hasPermission } from "@platform/tool-sdk";
import { AuthProvider, useAuth } from "./auth";
import { RemoteErrorBoundary, RemoteHost } from "./RemoteHost";
import { TOOLS } from "./registry";

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

function Shell() {
  const { session, logout } = useAuth();
  const route = useHashRoute();
  if (!session) return <Login />;

  const visible = TOOLS.filter((t) => hasPermission(session.principal, t.permission));
  const active = visible.find((t) => t.key === route);

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-10 flex h-14 items-center gap-6 border-b bg-background/95 px-6 backdrop-blur">
        <a className="text-sm font-semibold" href="#/">
          Internal Tools
        </a>
        <div className="flex items-center gap-1">
          {visible.map((t) => (
            <a
              key={t.key}
              className={`rounded-md px-3 py-1.5 text-sm ${
                active?.key === t.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              href={`#/${t.key}`}
            >
              {t.name}
            </a>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span>
            <b>{session.principal.name}</b> · {session.principal.roles.join(", ")}
          </span>
          <Button size="sm" onClick={logout}>
            Sign out
          </Button>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl p-6">
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
  );
}

function Home() {
  const { session } = useAuth();
  const visible = TOOLS.filter((t) => session && hasPermission(session.principal, t.permission));
  return (
    <div className="grid gap-4">
      <h2 className="text-2xl font-semibold">Your tools</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((t) => (
          <a
            key={t.key}
            className="rounded-xl border bg-card p-6 transition-shadow hover:shadow-md"
            href={`#/${t.key}`}
          >
            <h3 className="font-semibold">{t.name}</h3>
            <div className="mt-2 text-sm text-muted-foreground">{t.description}</div>
          </a>
        ))}
        {visible.length === 0 ? <Alert tone="info">Your roles don't grant access to any tool.</Alert> : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Permissions: {session?.principal.permissions.map((p) => <Badge key={p}>{p}</Badge>)}
      </p>
    </div>
  );
}

function Login() {
  const { users, login, loading, error } = useAuth();
  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center p-6">
      <div className="grid w-full gap-4">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Mocked OIDC: pick a seeded user. All passwords are "demo".
        </p>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Card title="Users">
          {users.length === 0 && !error ? <Spinner label="Loading users…" /> : null}
          <div className="grid gap-2">
            {users.map((u) => (
              <button
                key={u.id}
                className="flex items-center justify-between rounded-md border bg-background p-3 text-left text-sm transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                disabled={loading}
                onClick={() => login(u.email)}
              >
                <span>
                  <b>{u.name}</b>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </span>
                <span className="flex flex-wrap gap-1">
                  {u.roles.map((r) => (
                    <Badge key={r} tone="info">
                      {r}
                    </Badge>
                  ))}
                </span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
