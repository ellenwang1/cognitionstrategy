import type { ToolConfig } from "./generated/tool-config";

export type Entity = Record<string, unknown> & { [key: string]: unknown };

export interface ListResult {
  items: Entity[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: string;
  direction?: "asc" | "desc";
  filters?: Record<string, string>;
}

export interface ActionResult {
  status: "applied" | "pending_approval";
  entity: Entity;
  approval?: Record<string, unknown>;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Thin typed client for the endpoints `platform_core.api` generates for every tool. */
export class ToolApiClient {
  constructor(private baseUrl: string, private resourcePath: string, private getToken: () => string | null) {}

  static forConfig(config: ToolConfig, baseUrl: string, getToken: () => string | null) {
    return new ToolApiClient(baseUrl, config.api.resourcePath ?? "/items", getToken);
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = await res.json();
        detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail ?? body);
      } catch {
        /* ignore */
      }
      throw new ApiError(res.status, detail);
    }
    return (await res.json()) as T;
  }

  config() {
    return this.request<ToolConfig>("/config");
  }

  list(q: ListQuery = {}) {
    const params = new URLSearchParams();
    if (q.page) params.set("page", String(q.page));
    if (q.pageSize) params.set("page_size", String(q.pageSize));
    if (q.search) params.set("search", q.search);
    if (q.sort) params.set("sort", q.sort);
    if (q.direction) params.set("direction", q.direction);
    for (const [k, v] of Object.entries(q.filters ?? {})) if (v) params.set(k, v);
    const qs = params.toString();
    return this.request<ListResult>(`${this.resourcePath}${qs ? `?${qs}` : ""}`);
  }

  get(id: string) {
    return this.request<Entity>(`${this.resourcePath}/${encodeURIComponent(id)}`);
  }

  audit(id: string) {
    return this.request<Array<Record<string, unknown>>>(`${this.resourcePath}/${encodeURIComponent(id)}/audit`);
  }

  approvalsFor(id: string) {
    return this.request<Array<Record<string, unknown>>>(`${this.resourcePath}/${encodeURIComponent(id)}/approvals`);
  }

  pendingApprovals() {
    return this.request<Array<Record<string, unknown>>>(`/approvals?status=pending`);
  }

  act(id: string, actionKey: string, payload: Record<string, unknown> = {}, reason = "") {
    return this.request<ActionResult>(`${this.resourcePath}/${encodeURIComponent(id)}/actions/${actionKey}`, {
      method: "POST",
      body: JSON.stringify({ payload, reason }),
    });
  }

  decide(approvalId: string, decision: "approved" | "rejected", comment = "") {
    return this.request<{ approval: Record<string, unknown>; entity: Entity | null }>(`/approvals/${approvalId}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision, comment }),
    });
  }
}
