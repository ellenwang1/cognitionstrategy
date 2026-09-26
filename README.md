# Internal Tools Platform — monorepo prototype

A prototype of a config-driven internal-tools platform for a small fintech, built to
answer one question: **what is the marginal effort of the Nth internal tool?**
Three tools (KYC Review Queue, Refunds Dashboard, Feature Flag Admin) are shipped as
thin verticals on top of shared platform packages; see [METRICS.md](METRICS.md) for how
effort/reuse is measured.

## Architecture

```
                       browser
                          │
   ┌──────────────────────┴────────────────────────┐
   │ apps/shell  (Module Federation host, :3000)   │  mocked OIDC login, nav, tool registry,
   │   loads  kyc/Tool  refunds/Tool  flags/Tool   │  fallback UI when a remote fails
   └───────┬───────────────┬───────────────┬───────┘
           │ remoteEntry   │               │
   apps/kyc :3001   apps/refunds :3002   apps/flags :3003     ← each = tool.yaml + 8 lines
           └──────── @platform/tool-sdk  ──────────┘           (shared singletons: react,
                          @platform/ui-kit                      react-dom, @platform/ui-kit)
                          │  REST + Bearer JWT
   services/kyc :8001   services/refunds :8002   services/flags :8003   services/auth :8000
           └──────── platform/core (platform_core) ─────────┘
              RBAC · audit · approvals · config loader · connectors · generated CRUD/action API
                          │
                    Postgres  (schemas: platform, kyc, refunds, flags)
```

### The contract: `tool.yaml`

Each tool is primarily a declarative spec (`services/<tool>/tool.yaml`) validated by
`platform_core.config.ToolConfig` (Pydantic). Its JSON Schema is exported to
`packages/tool-sdk/schema/tool-config.schema.json` and compiled to TypeScript
(`packages/tool-sdk/src/generated/tool-config.ts`), so **one contract types both sides**:

| Section       | Backend (`platform_core.api.create_tool_app`)                  | Frontend (`tool-sdk` `ToolRenderer`)         |
|---------------|----------------------------------------------------------------|----------------------------------------------|
| `entity`      | column ↔ field mapping, derived fields via connector           | value formatting per `FieldType`             |
| `listView`    | `GET /items` filters / search / sort / pagination              | `QueueView` or `DataTable` + `FilterBar`     |
| `detailView`  | `GET /items/{id}`, `/audit`, `/approvals`                      | `DetailPane`, `AuditTrail`, `ApprovalWidget` |
| `actions`     | `POST /items/{id}/actions/{key}` with permission gate + approval policy | permission-aware buttons, confirm modal |

### Layers

| Path | Package | Role |
|------|---------|------|
| `platform/core` | `platform-core` (pip) | RBAC (`require_permission`, wildcard perms), append-only audit (`record_audit`, before/after diff), approvals state machine (`request_approval`/`decide`), `ToolConfig` loader, `Connector` / `PostgresConnector` / `MockConnector`, and `create_tool_app()` which generates the whole per-tool FastAPI surface from a config + SQLAlchemy model. |
| `packages/ui-kit` | `@platform/ui-kit` | React components: `DataTable`, `QueueView`, `FilterBar`, `DetailPane`, `ApprovalWidget`, `AuditTrail`, form primitives, `Modal`, badges. MF shared singleton. |
| `packages/tool-sdk` | `@platform/tool-sdk` | Generated `ToolConfig` types, `ToolApiClient`, `ToolRenderer` (config → UI), `createToolRemote()` (MF `mount`/`unmount` surface), `mountStandalone()`, and `vite/remote.mjs` host/remote Vite presets with the pinned React 18.3.1 + `@platform/ui-kit` singletons. |
| `apps/shell` | `@platform/shell` | MF host. Mock OIDC login (seeded users, password `demo`), JWT session in `localStorage`, permission-filtered nav, `RemoteHost` with error boundary + retry fallback. |
| `services/auth` | — | Mock OIDC: `/.well-known/openid-configuration`, `/authorize`, `/token` (password + code grants), `/userinfo`, `/users`. Issues HS256 JWTs that `platform_core.security` validates. |
| `db/` | — | Alembic: `0001_platform_shared` (users, roles, permissions, audit_log, approval_requests in schema `platform`), then one migration per tool schema. `seed.py` is idempotent. |
| `apps/<tool>`, `services/<tool>` | `@tools/<tool>-web` | **Tool code.** `tool.yaml` + SQLAlchemy model + optional connector + `create_tool_app(...)`. |

### Shared platform tables vs schema-per-tool

`platform.users/roles/user_roles/role_permissions/audit_log/approval_requests` are shared;
`audit_log` and `approval_requests` carry `tool_key` + `entity_id` so every tool writes to
the same tables through `platform_core`. Each tool owns its own Postgres schema (`kyc`,
`refunds`, `flags`) and migration file.

### Approval policies

| Tool | Action | Gate | Approval policy |
|------|--------|------|-----------------|
| KYC | approve / reject | `kyc:approve` | `field_true: sanctions_hit` (sanctions hits need a second approver) |
| Refunds | approve | `refunds:approve` | `threshold: amount > 500` |
| Flags | edit | `flags:write` | `field_true: high_risk` |

Requesters cannot approve their own requests; every request/decision/action is audited.

## Running it

### Docker Compose (everything)

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
make test && make lint   # pytest (needs Postgres for the smoke test), ruff

# frontend
source ~/.nvm/nvm.sh; corepack enable; pnpm install
pnpm run schema && pnpm run gen:types   # regenerate the contract after editing platform_core/config.py
pnpm run typecheck && pnpm run build
pnpm run preview         # shell:3000 + remotes:3001-3003 (Module Federation needs built remotes)
```

Sign in as any seeded user (password `demo`):

| User | Roles | Can |
|------|-------|-----|
| admin@fintech.dev | admin (`*`) | everything |
| ana.analyst@fintech.dev | kyc_analyst | read/review KYC, cannot approve |
| kai.lead@fintech.dev | kyc_lead, viewer | approve KYC |
| rae.refunds@fintech.dev | refunds_agent | review refunds |
| max.manager@fintech.dev | refunds_manager, viewer | approve refunds |
| fay.flags@fintech.dev | flags_admin | edit flags |
| vic.viewer@fintech.dev | viewer | read-only across tools |

Each remote also runs standalone (`http://localhost:3001/?user=kai.lead@fintech.dev`)
via `mountStandalone`, which is how a tool is developed without the shell.

## Per-tool deploy notes

Every tool is two independent deploy targets that share nothing at runtime except
Postgres and the auth issuer:

- **API** — `Dockerfile.python` image, `uvicorn services.<tool>.app.main:app`. Env:
  `DATABASE_URL`, `PLATFORM_JWT_SECRET`, `PLATFORM_JWT_ISSUER`, `CORS_ORIGINS`. Run its
  own Alembic revision (`db/alembic/versions/000N_<tool>.py`) — it only touches its schema.
- **Frontend** — `Dockerfile.web` image, `APP=@tools/<tool>-web`. The deployable
  artifact is static `dist/` with `assets/remoteEntry.js`; host it anywhere and point the
  shell at it via `VITE_<TOOL>_REMOTE_URL` (shell build-time env). The remote's API base is
  `VITE_API_URL` at build time or the `apiBaseUrl` the shell passes on mount.
- Platform packages are versioned workspace packages; a remote pins them at build time, so
  a tool can be redeployed without rebuilding the shell and vice versa. React and
  `@platform/ui-kit` are MF singletons with `requiredVersion` pinned in
  `packages/tool-sdk/vite/remote.mjs`.
- If a remote is down the shell renders a fallback card with a retry button; the other
  tools are unaffected.

## Adding tool #4

1. `services/<tool>/tool.yaml` — entity fields, list/detail view, actions + policies.
2. `services/<tool>/app/models.py` — one SQLAlchemy model in schema `<tool>`;
   `db/alembic/versions/0005_<tool>.py`.
3. `services/<tool>/app/main.py` — `create_tool_app(config, ResourceBinding(model, connector))`.
4. `apps/<tool>` — copy `apps/flags`, change the name/port and the `tool.yaml` import.
5. Register in `apps/shell/src/registry.ts` + `vite.config.ts`, add compose services.

Then run `scripts/metrics.sh` and record the marginal effort in METRICS.md.
