import React, { useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Spinner } from "@platform/ui-kit";
import type { Session, ToolRemote } from "@platform/tool-sdk";
import type { ToolRegistration } from "./registry";

type State = { status: "loading" } | { status: "ready"; remote: ToolRemote } | { status: "error"; error: string };

/**
 * Loads a federated remote and mounts it; degrades to a fallback panel when the remote is unavailable.
 * The federation runtime caches a failed remoteEntry import, so retrying means reloading the page.
 */
export function RemoteHost({ tool, session, onSessionExpired }: { tool: ToolRegistration; session: Session; onSessionExpired: () => void }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    tool
      .load()
      .then((mod) => {
        if (cancelled) return;
        if (!mod?.default?.mount) throw new Error("remote does not expose a mount()");
        setState({ status: "ready", remote: mod.default });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ status: "error", error: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [tool]);

  useEffect(() => {
    const el = containerRef.current;
    if (state.status !== "ready" || !el) return;
    state.remote.mount(el, { session, apiBaseUrl: tool.apiBaseUrl, onSessionExpired });
    return () => state.remote.unmount(el);
  }, [state, session, tool, onSessionExpired]);

  if (state.status === "loading") return <Spinner label={`Loading ${tool.name}…`} />;
  if (state.status === "error") return <RemoteFallback tool={tool} error={state.error} onRetry={() => window.location.reload()} />;
  return <div ref={containerRef} />;
}

export function RemoteFallback({ tool, error, onRetry }: { tool: ToolRegistration; error: string; onRetry: () => void }) {
  return (
    <div>
      <Card title={`${tool.name} is unavailable`}>
        <div className="grid gap-3">
          <Alert tone="error">The tool's frontend could not be loaded. Other tools are unaffected.</Alert>
          <code className="break-all font-mono text-sm text-muted-foreground">{error}</code>
          <div>
            <Button variant="primary" onClick={onRetry}>
              Retry
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export class RemoteErrorBoundary extends React.Component<{ tool: ToolRegistration; children: React.ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  render() {
    if (this.state.error) return <RemoteFallback tool={this.props.tool} error={this.state.error} onRetry={() => this.setState({ error: null })} />;
    return this.props.children;
  }
}
