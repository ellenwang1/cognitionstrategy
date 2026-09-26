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
    <div className="shell">
      <nav className="shell__nav">
        <a className="shell__brand shell__link" href="#/">
          Internal Tools
        </a>
        <div className="shell__links">
          {visible.map((t) => (
            <a key={t.key} className={`shell__link${active?.key === t.key ? " is-active" : ""}`} href={`#/${t.key}`}>
              {t.name}
            </a>
          ))}
        </div>
        <div className="shell__user">
          <span>
            <b>{session.principal.name}</b> · {session.principal.roles.join(", ")}
          </span>
          <Button size="sm" onClick={logout}>
            Sign out
          </Button>
        </div>
      </nav>
      <main className="shell__main pk-root">
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
    <div>
      <h2 style={{ marginTop: 0 }}>Your tools</h2>
      <div className="shell__home">
        {visible.map((t) => (
          <a key={t.key} className="shell__tile" href={`#/${t.key}`}>
            <h3>{t.name}</h3>
            <div className="pk-muted">{t.description}</div>
          </a>
        ))}
        {visible.length === 0 ? <Alert tone="info">Your roles don't grant access to any tool.</Alert> : null}
      </div>
      <p className="pk-muted" style={{ marginTop: 24, fontSize: 12 }}>
        Permissions: {session?.principal.permissions.map((p) => <Badge key={p}>{p}</Badge>)}
      </p>
    </div>
  );
}

function Login() {
  const { users, login, loading, error } = useAuth();
  return (
    <div className="shell__login pk-root">
      <h1>Sign in</h1>
      <p className="pk-muted">Mocked OIDC: pick a seeded user. All passwords are "demo".</p>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Card title="Users">
        {users.length === 0 && !error ? <Spinner label="Loading users…" /> : null}
        <div className="shell__userlist">
          {users.map((u) => (
            <button key={u.id} className="shell__useritem" disabled={loading} onClick={() => login(u.email)}>
              <span>
                <b>{u.name}</b>
                <div className="pk-muted" style={{ fontSize: 12 }}>
                  {u.email}
                </div>
              </span>
              <span className="pk-tags">
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
  );
}
