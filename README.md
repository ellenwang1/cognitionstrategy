# Internal tools platform

Internal tools (review queues, admin dashboards) all need the same governance: who can see
what, who can act, who signs off, and a record of what happened. This repo builds that once.
A tool is a `tool.yaml` (entity, list and detail views, actions, permissions, approval
policies). From it, `platform_core.api.create_tool_app()` generates the FastAPI service and
`@platform/tool-sdk` renders the UI. Every request is permission-checked, every action is
written to an append-only audit log, and gated actions go through an approvals flow.

Three example tools ship here: KYC review queue, refunds dashboard and feature flag admin.
Each is a `tool.yaml`, one SQLAlchemy model, one migration and a few lines of glue.

## Run it

Everything in Docker:

```sh
docker compose up --build     # shell on http://localhost:3000
```

Or backend and frontend separately:

```sh
make venv && make db-up && make migrate && make seed
make api                      # auth + the three tool APIs

corepack enable && pnpm install
pnpm run build && pnpm run preview   # shell + the three tool remotes
```

Module Federation loads built remotes, so use `build && preview` rather than `pnpm run dev`
when going through the shell. A remote also runs on its own by opening its URL (see
`docker-compose.yml` for ports) with `?user=<email>`.

Sign in as any seeded user with password `demo`. `admin@fintech.dev` can do everything;
`ana.analyst@fintech.dev` can review KYC cases but not approve them; `kai.lead@fintech.dev`
can. The full list of users and roles is in `db/seed.py`.

All environment variables have local defaults. `DATABASE_URL`, `PLATFORM_JWT_SECRET`,
`PLATFORM_JWT_ISSUER`, `CORS_ORIGINS` and `PLATFORM_ENV` configure the APIs;
`VITE_*` variables configure the frontends at build time. Outside `PLATFORM_ENV=dev` the
default JWT secret is refused.

## Checks

```sh
make lint && make test        # ruff, pytest (the smoke test needs `make db-up`)
pnpm run typecheck && pnpm run build
```

## Layout

| Path | What it is |
|------|------------|
| `packages/platform-core` | Python: `ToolConfig`, `create_tool_app()`, JWT and permissions, audit log, approvals, connectors |
| `packages/tool-sdk` | TypeScript: generated `ToolConfig` types, API client, `ToolRenderer`, `createToolRemote()`, Vite presets |
| `packages/ui-kit` | Shared React components and the Tailwind preset |
| `apps/shell` | Module Federation host: login, nav, tool registry |
| `apps/<tool>` | One thin remote per tool |
| `services/auth` | Mock OIDC issuer for local development |
| `services/<tool>` | `tool.yaml`, model, optional connector, `main.py` |
| `db/` | Alembic migrations (one for the shared `platform` schema, one per tool) and `seed.py` |
| `tests/` | pytest: unit tests for `platform_core` and a smoke test against Postgres |

The shell loads each tool's remote; each remote renders its `tool.yaml` and calls its own
FastAPI service. All services share the `platform` schema (users, roles, audit, approvals)
and each tool owns a schema of its own.

Each tool deploys as two images that share only Postgres and the auth issuer:
`Dockerfile.python` running `uvicorn services.<tool>.main:app`, and `Dockerfile.web` with
`APP=@tools/<tool>-web` serving a static `dist/`. If a remote is down the shell shows a
fallback card and the other tools keep working.

[CONTRIBUTING.md](CONTRIBUTING.md) has the `tool.yaml` contract and the steps for adding a
tool. [AGENTS.md](AGENTS.md) is the short orientation for coding agents. No shared
environment is deployed yet.
