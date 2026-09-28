# Contributing

Reference for changing the platform or adding a tool. The [README](README.md) covers what
the platform is and how to run it.

## The contract: `tool.yaml`

`services/<tool>/tool.yaml` is validated by `platform_core.config.ToolConfig` (Pydantic),
which also checks that every field a view or action names exists in `entity.fields`. The
JSON Schema is exported to `packages/tool-sdk/schema/tool-config.schema.json` and compiled to
`packages/tool-sdk/src/generated/tool-config.ts`, so one model types both sides. After
editing `config.py`, run `make schema` and commit the regenerated files.

| Section | Backend (`create_tool_app`) | Frontend (`ToolRenderer`) |
|---------|-----------------------------|---------------------------|
| `entity` | column to field mapping, derived fields via a connector | value formatting per `FieldType` |
| `listView` | `GET /items` with filters, search, sort, pagination | `QueueView` or `DataTable` plus `FilterBar` |
| `detailView` | `GET /items/{id}`, `/audit`, `/approvals` | `DetailPane`, `AuditTrail`, `ApprovalWidget` |
| `actions` | `POST /items/{id}/actions/{key}`, permission gate, approval policy | permission-aware buttons, confirm modal |

`/items` is `api.resourcePath` from the yaml. Every app also has `/healthz`, `/config`,
`/me`, `GET /approvals` and `POST /approvals/{id}/decision`.

### Actions, permissions and approvals

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

Policy kinds are `never` (default), `always`, `threshold` (`field > threshold`) and
`field_true`. When a policy fires, the action writes an `approval_requests` row instead of
executing. Another user with the permission decides through `POST /approvals/{id}/decision`;
requesters cannot approve their own requests. Actions, requests and decisions all land in
`audit_log`.

Permissions are `<tool>:<verb>` strings granted to roles. `*` and `<tool>:*` are wildcards
(`platform_core.security.Principal`).

| Tool | Gated action | Permission | Approval policy |
|------|--------------|------------|-----------------|
| KYC | approve | `kyc:approve` | `field_true: sanctions_hit` |
| Refunds | approve | `refunds:approve` | `threshold: amount > 500` |
| Flags | edit | `flags:write` | `field_true: high_risk` |

## Database

`platform.users`, `roles`, `user_roles`, `role_permissions`, `audit_log` and
`approval_requests` are shared. `audit_log` and `approval_requests` carry `tool_key` and
`entity_id`, so every tool writes to the same tables through `platform_core`. Each tool owns
its own schema (`kyc`, `refunds`, `flags`) and one migration file under
`db/alembic/versions/`. Alembic reads `DATABASE_URL` through `platform_core.db.database_url()`.
`db/seed.py` is idempotent.

## Adding a tool

1. `services/<tool>/tool.yaml`: entity fields, views, actions, permissions, approval policies.
2. `services/<tool>/models.py`: one SQLAlchemy model in schema `<tool>`, using `new_id` and
   `utcnow` from `platform_core.models`. Add `db/alembic/versions/000N_<tool>.py`.
3. `services/<tool>/main.py`: `create_tool_app(config, ResourceBinding(model, enrich, connectors))`.
   A connector subclasses `platform_core.connectors.MockConnector` when the source is external.
4. `apps/<tool>`: copy `apps/flags`, change the package name, the port and the `tool.yaml` import.
5. Register the tool in `apps/shell/src/registry.ts` and `apps/shell/vite.config.ts`, add it
   to `scripts/run_services.sh` and `docker-compose.yml`, and import its models in
   `db/alembic/env.py` and `db/seed.py`.
6. Add the tool's roles and permissions to `db/seed.py`.

Develop the remote standalone first (`http://localhost:300N/?user=<email>`, served by
`mountStandalone`), then wire it into the shell.

## Deploying a tool

A tool is two images that share only Postgres and the auth issuer.

The API image is `Dockerfile.python` running `uvicorn services.<tool>.main:app`. It needs
`DATABASE_URL`, `PLATFORM_JWT_SECRET`, `PLATFORM_JWT_ISSUER`, `CORS_ORIGINS` and
`PLATFORM_ENV`, and runs its own Alembic revision, which only touches its schema.

The frontend image is `Dockerfile.web` with `APP=@tools/<tool>-web`. The artifact is a static
`dist/` with `assets/remoteEntry.js`; host it anywhere and point the shell at it with
`VITE_<TOOL>_REMOTE` at shell build time. The remote's API base is `VITE_API_URL` at build
time, or the `apiBaseUrl` the shell passes on mount (`VITE_<TOOL>_API_URL` in the shell).

React and `@platform/ui-kit` are Module Federation singletons with `requiredVersion` pinned
in `packages/tool-sdk/vite/remote.mjs`. A tool can redeploy without rebuilding the shell and
the shell without rebuilding tools.

## Checks and commits

```sh
make lint && make test                  # ruff, pytest (smoke test needs Postgres)
pnpm run typecheck && pnpm run build
```

Prefix commits `platform(<area>):` or `tool(<t>):`. [METRICS.md](METRICS.md) explains how
`scripts/metrics.sh` uses those prefixes and the package boundaries to measure what a new
tool costs.
