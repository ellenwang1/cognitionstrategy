import type { ToolConfig } from "./generated/tool-config";
import type { Session, ToolRemote } from "./session";

/**
 * Dev-only helper: run a tool remote outside the shell by obtaining a session
 * from the mocked auth service (password grant) and mounting the tool.
 * Query params: `?user=email` selects a seeded user (default admin).
 */
export async function mountStandalone(el: HTMLElement, remote: ToolRemote, config: ToolConfig, authUrl = "http://localhost:8000") {
  const params = new URLSearchParams(window.location.search);
  const username = params.get("user") ?? "admin@fintech.dev";
  el.innerHTML = `<p class="p-4 text-sm text-muted-foreground">Signing in as ${username}…</p>`;
  try {
    const res = await fetch(`${authUrl}/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ grant_type: "password", username, password: "demo" }),
    });
    if (!res.ok) throw new Error(`auth failed: ${res.status}`);
    const token = (await res.json()) as { access_token: string };
    const me = await fetch(`${authUrl}/userinfo`, { headers: { authorization: `Bearer ${token.access_token}` } });
    const principal = (await me.json()) as Session["principal"];
    el.innerHTML = "";
    const wrapper = document.createElement("div");
    wrapper.className = "p-4";
    el.appendChild(wrapper);
    remote.mount(wrapper, { session: { token: token.access_token, principal } });
  } catch (e) {
    el.innerHTML = `<pre class="whitespace-pre-wrap p-4 text-sm text-destructive">Standalone mode needs the auth service at ${authUrl} and the ${config.api.baseUrl} API at ${config.api.baseUrl}.\n${String(e)}</pre>`;
  }
}
