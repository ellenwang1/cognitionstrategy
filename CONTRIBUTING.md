# Contributing

Technical reference for working on the platform or building a tool on it. For what the
platform is and how to run it, start with the [README](README.md).

## The contract: `tool.yaml`

Each tool is primarily a declarative spec (`services/<tool>/tool.yaml`) validated by
`platform_core.config.ToolConfig` (Pydantic). Its JSON Schema is exported to
`packages/tool-sdk/schema/tool-config.schema.json` and compiled to TypeScript
(`packages/tool-sdk/src/generated/tool-config.ts`), so one contract types both sides.

| Section | Backend (`platform_core.api.create_tool_app`) | Frontend (`tool-sdk` `ToolRenderer`) |
|---------|-----------------------------------------------|--------------------------------------|
| `entity` | column ↔ field mapping, derived fields via connector | value formatting per `FieldType` |
| `listView` | `GET /items` filters / search / sort / pagination | `QueueView` or `DataTable` + `FilterBar` |
| `detailView` | `GET /items/{id}`, `/audit`, `/approvals` | `DetailPane`, `AuditTrail`, `ApprovalWidget` |
| `actions` | `POST /items/{id}/actions/{key}` with permission gate + approval policy | permission-aware buttons, confirm modal |

After editing `platform_core/config.py`, regenerate the schema and types:

```sh
pnpm run schema && pnpm run gen:types
```

### Actions, permissions and approval policies

Every action names the permission it requires and, optionally, an approval policy:

```yaml
actions:
  - key: approve
    label: Approve refund
    kind: approve                 # approve | reject | edit | custom
    permission: refunds:approve
    confirm: true
    setsStatus: approved
    approval: { kind: threshold, field: amount, threshold: 500 }
```

Policy kinds: `never` (default), `always`, `threshold` (`field > threshold`), `field_true`.
When a policy fires, the action creates an `approval_requests` row instead of executing;
another user holding the permission decides via `POST /approvals/{id}/decision`. Requesters
cannot approve their own requests. Every action, request and decision is written to
`audit_log`.

Permissions are `<tool>:<verb>` strings granted to roles. `*` and `<tool>:*` are wildcards
(`platform_core.security.Principal`).

The example tools:

| Tool | Action | Gate | Approval policy |
|------|--------|------|-----------------|
| KYC | approve / reject | `kyc:approve` | `field_true: sanctions_hit` |
| Refunds | approve | `refunds:approve` | `threshold: amount > 500` |
| Flags | edit | `flags:write` | `field_true: high_risk` |

## Layers

| Path | Package | Role |
|------|---------|------|
| `platform/core` | `platform-core` (pip) | RBAC (`require_permission`), append-only audit (`record_audit`, before/after diff), approvals state machine (`request_approval`/`decide`), `ToolConfig` loader, `Connector` / `PostgresConnector` / `MockConnector`, and `create_tool_app()` which generates the per-tool FastAPI surface from a config + SQLAlchemy model. |
| `packages/ui-kit` | `@platform/ui-kit` | React components: `DataTable`, `QueueView`, `FilterBar`, `DetailPane`, `ApprovalWidget`, `AuditTrail`, form primitives, `Modal`, badges. Module Federation shared singleton. |
| `packages/tool-sdk` | `@platform/tool-sdk` | Generated `ToolConfig` types, `ToolApiClient`, `ToolRenderer` (config → UI), `createToolRemote()` (MF `mount`/`unmount` surface), `mountStandalone()`, and `vite/remote.mjs` host/remote Vite presets with the pinned React 18.3.1 + `@platform/ui-kit` singletons. |
| `apps/shell` | `@platform/shell` | MF host. OIDC login against `services/auth`, JWT session in `localStorage`, permission-filtered nav, `RemoteHost` with error boundary + retry fallback. |
| `services/auth` | — | Mock OIDC: `/.well-known/openid-configuration`, `/authorize` (password-protected, one-time 5-minute codes), `/token` (password + authorization-code grants), `/userinfo`, `/users`. Issues HS256 JWTs that `platform_core.security` validates. |
| `db/` | — | Alembic: `0001_platform_shared` (users, roles, permissions, audit_log, approval_requests in schema `platform`), then one migration per tool schema. `seed.py` is idempotent. |
| `apps/<tool>`, `services/<tool>` | `@tools/<tool>-web` | Tool code: `tool.yaml` + SQLAlchemy model + optional connector + `create_tool_app(...)`. |

### Shared platform tables vs schema-per-tool

`platform.users/roles/user_roles/role_permissions/audit_log/approval_requests` are shared;
`audit_log` and `approval_requests` carry `tool_key` + `entity_id` so every tool writes to
the same tables through `platform_core`. Each tool owns its own Postgres schema (`kyc`,
`refunds`, `flags`) and migration file.

### Generated API surface

`create_tool_app()` mounts, per tool: `GET /items`, `GET /items/{id}`,
`GET /items/{id}/audit`, `GET /items/{id}/approvals`, `POST /items/{id}/actions/{key}`,
`GET /approvals`, `POST /approvals/{id}/decision`, plus `/healthz`, `/config` and `/me`.
(`/items` is the `api.resourcePath` from `tool.yaml`, e.g. `/refunds`.)

## Adding a tool

1. `services/<tool>/tool.yaml` — entity fields, list/detail views, actions, permissions, approval policies.
2. `services/<tool>/app/models.py` — one SQLAlchemy model in schema `<tool>`;
   `db/alembic/versions/000N_<tool>.py`.
3. `services/<tool>/app/main.py` — `create_tool_app(config, ResourceBinding(model, connector))`.
4. `apps/<tool>` — copy `apps/flags`, change the name/port and the `tool.yaml` import.
5. Register in `apps/shell/src/registry.ts` + `apps/shell/vite.config.ts`; add the compose services.
6. Add the tool's roles/permissions to `db/seed.py`.

Develop the remote standalone (`http://localhost:300N/?user=<email>`, via `mountStandalone`)
before wiring it into the shell. Module Federation needs built remotes, so use
`pnpm run build && pnpm run preview` rather than `pnpm run dev` when testing through the shell.

## Deploying a tool

Every tool is two independent deploy targets that share nothing at runtime except Postgres
and the auth issuer:

- **API** — `Dockerfile.python` image, `uvicorn services.<tool>.app.main:app`. Env:
  `DATABASE_URL`, `PLATFORM_JWT_SECRET`, `PLATFORM_JWT_ISSUER`, `CORS_ORIGINS`, `PLATFORM_ENV`.
  Run its own Alembic revision (`db/alembic/versions/000N_<tool>.py`) — it only touches its
  schema.
- **Frontend** — `Dockerfile.web` image, `APP=@tools/<tool>-web`. The deployable artifact is
  static `dist/` with `assets/remoteEntry.js`; host it anywhere and point the shell at it via
  `VITE_<TOOL>_REMOTE` (shell build-time env, see `apps/shell/vite.config.ts`). The remote's
  API base is `VITE_API_URL` at build time or the `apiBaseUrl` the shell passes on mount
  (`VITE_<TOOL>_API_URL` in the shell).
- Platform packages are versioned workspace packages; a remote pins them at build time, so a
  tool can be redeployed without rebuilding the shell and vice versa. React and
  `@platform/ui-kit` are MF singletons with `requiredVersion` pinned in
  `packages/tool-sdk/vite/remote.mjs`.
- If a remote is down the shell renders a fallback card with a retry button; the other tools
  are unaffected.

## Checks

```sh
make test && make lint          # pytest (smoke test needs Postgres), ruff
pnpm run typecheck && pnpm run build
```

## Commit conventions and metrics

Commits are prefixed `platform(<area>):` or `tool(<t>):`. [METRICS.md](METRICS.md) uses
these prefixes and package boundaries to compute per-tool marginal effort and reuse ratio
(`scripts/metrics.sh`); after adding a tool, run it and record the numbers there.
