# Internal Tools Platform

A platform for building internal tools that need **permissions, audit and approval flows**
built in — not bolted on per tool.

You describe a tool in a `tool.yaml` (entity, list/detail views, actions, who may do what,
which actions need sign-off). The platform generates the API and the UI, enforces RBAC on
every request, writes an append-only audit log, and routes gated actions through an
approvals state machine. Tools plug into a shared shell as Module Federation remotes and
are deployed independently.

Three example tools ship in this repo — **KYC Review Queue**, **Refunds Dashboard**,
**Feature Flag Admin** — each a `tool.yaml`, a SQLAlchemy model, and a few lines of glue.

## What the platform gives you

| Capability | Where | What it does |
|------------|-------|--------------|
| **Permissions (RBAC)** | `platform_core.security` | Users → roles → permissions (`kyc:approve`, `refunds:*`, `*`). Every generated endpoint is gated with `require_permission`; the UI only renders actions the current user holds. |
| **Approval flows** | `platform_core.approvals` | Declarative per-action policies: `never`, `always`, `threshold` (e.g. `amount > 500`), `field_true` (e.g. `sanctions_hit`). Gated actions create an approval request; a second user with the permission decides. Requesters cannot approve their own requests. |
| **Audit trail** | `platform_core.audit` | Append-only `audit_log` with actor, action, before/after diff, `tool_key` + `entity_id`. Every action, approval request and decision is recorded and surfaced in the detail view. |
| **Auth** | `services/auth` | OIDC-style issuer (`/authorize`, `/token`, `/userinfo`) minting HS256 JWTs; `platform_core` validates them and resolves the principal + permissions. Mocked users for local dev. |
| **Config-driven CRUD + actions** | `platform_core.api.create_tool_app` | From a `ToolConfig`: list (filter/search/sort/paginate), detail, audit, approvals, and `POST /items/{id}/actions/{key}` endpoints, plus `/approvals` for deciders. |
| **Connectors** | `platform_core.connectors` | `Connector` interface for derived/external fields (`PostgresConnector`, `MockConnector`) so a tool can join in data from other systems. |
| **UI kit + renderer** | `@platform/ui-kit`, `@platform/tool-sdk` | `ToolRenderer` turns the same config into `QueueView`/`DataTable`, `FilterBar`, `DetailPane`, `ApprovalWidget`, `AuditTrail`, and permission-aware action buttons with confirm modals. |
| **Shell** | `apps/shell` | Module Federation host: login, permission-filtered navigation, tool registry, and an error-boundary fallback so one broken remote does not take down the others. |

## How it fits together

```
                       browser
                          │
   ┌──────────────────────┴────────────────────────┐
   │ apps/shell  (Module Federation host, :3000)   │  login, nav, tool registry,
   │   loads  kyc/Tool  refunds/Tool  flags/Tool   │  fallback UI when a remote fails
   └───────┬───────────────┬───────────────┬───────┘
           │ remoteEntry   │               │
   apps/kyc :3001   apps/refunds :3002   apps/flags :3003     ← each = tool.yaml + a few lines
           └──────── @platform/tool-sdk  ──────────┘           (shared singletons: react,
                          @platform/ui-kit                      react-dom, @platform/ui-kit)
                          │  REST + Bearer JWT
   services/kyc :8001   services/refunds :8002   services/flags :8003   services/auth :8000
           └──────── platform/core (platform_core) ─────────┘
              RBAC · audit · approvals · config loader · connectors · generated CRUD/action API
                          │
                    Postgres  (schemas: platform, kyc, refunds, flags)
```

### One contract, both sides

`services/<tool>/tool.yaml` is validated by `platform_core.config.ToolConfig` (Pydantic).
Its JSON Schema is exported to `packages/tool-sdk/schema/tool-config.schema.json` and
compiled to TypeScript in `packages/tool-sdk/src/generated/tool-config.ts`, so the backend
and frontend are typed from the same file.

| Section | Backend | Frontend |
|---------|---------|----------|
| `entity` | column ↔ field mapping, derived fields via connector | value formatting per `FieldType` |
| `listView` | `GET /items` filters / search / sort / pagination | `QueueView` or `DataTable` + `FilterBar` |
| `detailView` | `GET /items/{id}`, `/audit`, `/approvals` | `DetailPane`, `AuditTrail`, `ApprovalWidget` |
| `actions` | `POST /items/{id}/actions/{key}` with permission gate + approval policy | permission-aware buttons, confirm modal |

Example (Refunds — approvals over $500 need a manager):

```yaml
actions:
  - key: approve
    label: Approve refund
    kind: approve
    permission: refunds:approve
    confirm: true
    setsStatus: approved
    approval: { kind: threshold, field: amount, threshold: 500 }
```

### Data model

Shared tables live in the `platform` schema: `users`, `roles`, `user_roles`,
`role_permissions`, `audit_log`, `approval_requests`. `audit_log` and `approval_requests`
carry `tool_key` + `entity_id`, so every tool writes governance data to the same place.
Each tool owns its own Postgres schema (`kyc`, `refunds`, `flags`) and Alembic migration.

## Repository layout

| Path | Package | Role |
|------|---------|------|
| `platform/core` | `platform-core` (pip) | RBAC, audit, approvals, `ToolConfig` loader, connectors, `create_tool_app()` |
| `packages/ui-kit` | `@platform/ui-kit` | React components; Module Federation shared singleton |
| `packages/tool-sdk` | `@platform/tool-sdk` | Generated `ToolConfig` types, `ToolApiClient`, `ToolRenderer`, `createToolRemote()`, `mountStandalone()`, Vite host/remote presets |
| `apps/shell` | `@platform/shell` | Module Federation host and login |
| `services/auth` | — | OIDC-style token issuer (mock users for local dev) |
| `db/` | — | Alembic migrations (`0001_platform_shared`, then one per tool) and idempotent `seed.py` |
| `apps/<tool>`, `services/<tool>` | `@tools/<tool>-web` | **Tool code**: `tool.yaml` + model + optional connector + `create_tool_app(...)` |

## Running it

### Docker Compose

```sh
docker compose up --build
# shell → http://localhost:3000   (APIs on 8000–8003, remotes on 3001–3003)
```

`migrate` runs Alembic + seed once, then the four APIs and four frontends start.

### Local dev

```sh
# backend
make venv && make db-up && make migrate && make seed
make api                 # auth:8000 kyc:8001 refunds:8002 flags:8003
make test && make lint   # pytest (smoke test needs Postgres), ruff

# frontend
source ~/.nvm/nvm.sh; corepack enable; pnpm install
pnpm run schema && pnpm run gen:types   # regenerate the contract after editing platform_core/config.py
pnpm run typecheck && pnpm run build
pnpm run preview         # shell:3000 + remotes:3001-3003 (Module Federation needs built remotes)
```

Each remote also runs standalone (`http://localhost:3001/?user=kai.lead@fintech.dev`) via
`mountStandalone`, which is how a tool is developed without the shell.

For anything beyond local development, set `PLATFORM_ENV`, `PLATFORM_JWT_SECRET` and
`CORS_ORIGINS`.

### Demo users (password `demo`)

| User | Roles | Can |
|------|-------|-----|
| admin@fintech.dev | admin (`*`) | everything |
| ana.analyst@fintech.dev | kyc_analyst | read/review KYC, cannot approve |
| kai.lead@fintech.dev | kyc_lead, viewer | approve KYC |
| rae.refunds@fintech.dev | refunds_agent | review refunds |
| max.manager@fintech.dev | refunds_manager, viewer | approve refunds |
| fay.flags@fintech.dev | flags_admin | edit flags |
| vic.viewer@fintech.dev | viewer | read-only across tools |

Approval policies in the example tools:

| Tool | Action | Gate | Approval policy |
|------|--------|------|-----------------|
| KYC | approve / reject | `kyc:approve` | `field_true: sanctions_hit` |
| Refunds | approve | `refunds:approve` | `threshold: amount > 500` |
| Flags | edit | `flags:write` | `field_true: high_risk` |

## Adding a tool

1. `services/<tool>/tool.yaml` — entity fields, list/detail views, actions, permissions, approval policies.
2. `services/<tool>/app/models.py` — one SQLAlchemy model in schema `<tool>`; `db/alembic/versions/000N_<tool>.py`.
3. `services/<tool>/app/main.py` — `create_tool_app(config, ResourceBinding(model, connector))`.
4. `apps/<tool>` — copy `apps/flags`, change the name/port and the `tool.yaml` import.
5. Register in `apps/shell/src/registry.ts` + `vite.config.ts`; add the compose services.

Add roles/permissions for the new tool in `db/seed.py` (or your real IdP mapping) and the
audit log, approval flow and permission checks come for free.

## Deploying a tool

Each tool is two independent deploy targets that share only Postgres and the auth issuer:

- **API** — `Dockerfile.python`, `uvicorn services.<tool>.app.main:app`. Env: `DATABASE_URL`,
  `PLATFORM_JWT_SECRET`, `PLATFORM_JWT_ISSUER`, `CORS_ORIGINS`. Runs its own Alembic revision.
- **Frontend** — `Dockerfile.web` with `APP=@tools/<tool>-web`. Output is static `dist/` with
  `assets/remoteEntry.js`; host it anywhere and point the shell at it via
  `VITE_<TOOL>_REMOTE_URL`. The remote's API base is `VITE_API_URL` at build time or the
  `apiBaseUrl` the shell passes on mount.

React and `@platform/ui-kit` are Module Federation singletons pinned in
`packages/tool-sdk/vite/remote.mjs`, so a tool can be redeployed without rebuilding the
shell and vice versa. If a remote is down the shell renders a fallback card with a retry
button; the other tools are unaffected.

## Measuring platform leverage

[METRICS.md](METRICS.md) describes how per-tool marginal effort and reuse ratio are
computed from package boundaries and commit prefixes (`scripts/metrics.sh`).
