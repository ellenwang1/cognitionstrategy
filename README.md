# Internal Tools Platform

A platform for building internal tools with permissions, audit and approval flows built in.

## Overview

Internal tools (review queues, admin dashboards, ops consoles) all need the same governance:
who can see what, who can do what, who has to sign off, and a record of what happened. This
platform provides those once. A tool is described in a `tool.yaml` (entity, list/detail
views, actions, required permissions, approval policies); the platform generates the REST API
and the UI, enforces RBAC on every request, writes an append-only audit log, and routes gated
actions through an approvals state machine. Tools load into a shared shell as Module
Federation remotes and deploy independently.

Three example tools ship in this repo: **KYC Review Queue**, **Refunds Dashboard** and
**Feature Flag Admin**. Each is a `tool.yaml`, a SQLAlchemy model and a few lines of glue.
See [CONTRIBUTING.md](CONTRIBUTING.md) for the `tool.yaml` contract and how to add a tool.

### Dependencies

- **Upstream**: Postgres 16 (shared `platform` schema plus one schema per tool); an OIDC-style
  token issuer (`services/auth` is the mock used for local dev).
- **Downstream**: each tool's frontend (`apps/<tool>`) and API (`services/<tool>`) depend on
  `@platform/tool-sdk`, `@platform/ui-kit` and `platform_core`.

## Local Development Setup

### Prerequisites

- Docker + Docker Compose (Postgres, or the full stack)
- Python 3.10+
- Node 24 with `corepack` (pnpm 9.12 is pinned in `package.json`)

### Environment Variables

All variables have local-dev defaults; nothing needs to be set to run on `localhost`.

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `DATABASE_URL` | SQLAlchemy URL for Postgres | default `postgresql+psycopg2://platform:platform@localhost:5432/platform` (matches `docker-compose.yml`) |
| `PLATFORM_JWT_SECRET` | HS256 secret shared by `services/auth` and every tool API | default dev-only value; must be set when `PLATFORM_ENV != dev` |
| `PLATFORM_JWT_ISSUER` | Expected `iss` claim / auth service URL | default `http://localhost:8000` |
| `PLATFORM_ENV` | `dev` (default) or anything else; non-dev refuses the default JWT secret | — |
| `CORS_ORIGINS` | Comma-separated allowed origins for the APIs | default `*` |
| `VITE_AUTH_URL`, `VITE_<TOOL>_API_URL`, `VITE_<TOOL>_REMOTE` | Shell build-time: auth URL, each tool's API base and `remoteEntry.js` URL | default `localhost` ports; see `apps/shell/src/registry.ts`, `apps/shell/vite.config.ts` |
| `VITE_API_URL` | Tool remote build-time: its own API base (the shell overrides this on mount) | default `localhost:800N` |

### Running Locally

Everything in Docker:

```bash
docker compose up --build
# shell → http://localhost:3000   (APIs on 8000–8003, remotes on 3001–3003)
```

Or backend and frontend separately:

```bash
# backend
make venv && make db-up && make migrate && make seed
make api                 # auth:8000 kyc:8001 refunds:8002 flags:8003

# frontend
corepack enable && pnpm install
pnpm run build && pnpm run preview   # shell:3000 + remotes:3001-3003
```

Sign in as any seeded user with password `demo`:

| User | Roles | Can |
|------|-------|-----|
| admin@fintech.dev | admin (`*`) | everything |
| ana.analyst@fintech.dev | kyc_analyst | read/review KYC, cannot approve |
| kai.lead@fintech.dev | kyc_lead, viewer | approve KYC |
| rae.refunds@fintech.dev | refunds_agent | review refunds |
| max.manager@fintech.dev | refunds_manager, viewer | approve refunds |
| fay.flags@fintech.dev | flags_admin | edit flags |
| vic.viewer@fintech.dev | viewer | read-only across tools |

A tool can also run without the shell: `http://localhost:3001/?user=kai.lead@fintech.dev`.

### Running Tests

```bash
make test        # pytest (smoke test needs Postgres from `make db-up`)
make lint        # ruff
pnpm run typecheck
```

## Architecture

The shell is a Module Federation host that loads each tool's remote. Each remote renders its
`tool.yaml` through `@platform/tool-sdk` and talks to its own FastAPI service, which
`platform_core.api.create_tool_app()` generates from the same `tool.yaml`. All services share
the `platform` schema for users, roles, permissions, audit and approvals; each tool owns its
own schema.

```
 ┌──────────────────────────────────────────────┐
 │  Shell  (login, nav, tool registry)          │
 └──────────┬──────────────┬──────────────┬─────┘
            │              │              │      Module Federation remotes
       KYC web       Refunds web      Flags web   (tool.yaml → ToolRenderer)
            │              │              │      REST + JWT
       KYC API       Refunds API      Flags API   (tool.yaml → create_tool_app)
            └──────────────┼──────────────┘
                     platform_core
        RBAC · audit · approvals · config · connectors
                           │
                       Postgres
        platform schema (users, roles, audit, approvals)
        + one schema per tool
```

### Key Files

| Path | Purpose |
|------|---------|
| `platform/core/platform_core/security.py` | JWT validation, `Principal`, `require_permission` (supports `*` and `<tool>:*` wildcards) |
| `platform/core/platform_core/approvals.py` | Approval policies (`never`/`always`/`threshold`/`field_true`), `request_approval`, `decide` |
| `platform/core/platform_core/audit.py` | Append-only audit log with before/after diff |
| `platform/core/platform_core/config.py` | `ToolConfig` — the Pydantic model behind `tool.yaml` |
| `platform/core/platform_core/api.py` | `create_tool_app()` — generates a tool's FastAPI app from its config |
| `platform/core/platform_core/connectors.py` | `Connector` interface for derived/external fields |
| `packages/tool-sdk/` | `ToolRenderer` (config → UI), API client, `createToolRemote`, `mountStandalone`, Vite presets |
| `packages/ui-kit/` | Shared React components (`DataTable`, `QueueView`, `DetailPane`, `ApprovalWidget`, `AuditTrail`, …) |
| `apps/shell/` | Module Federation host, login, `registry.ts` of tools |
| `services/auth/` | Mock OIDC issuer for local dev |
| `services/<tool>/tool.yaml` | A tool's declarative spec |
| `db/alembic/versions/` | `0001_platform_shared` plus one migration per tool; `db/seed.py` seeds demo users and rows |

## Deployment

Each tool is two independent images that share only Postgres and the auth issuer:

- **API** — `Dockerfile.python`, `uvicorn services.<tool>.app.main:app`; runs its own Alembic revision.
- **Frontend** — `Dockerfile.web` with `APP=@tools/<tool>-web`; static `dist/` with `assets/remoteEntry.js`.
  Point the shell at it with `VITE_<TOOL>_REMOTE`.

A tool can be redeployed without rebuilding the shell and vice versa; if a remote is down the
shell shows a fallback card and the other tools keep working. Details in
[CONTRIBUTING.md](CONTRIBUTING.md#deploying-a-tool).

### Environments

| Environment | URL | Notes |
|-------------|-----|-------|
| Local | http://localhost:3000 | `docker compose up --build`; mock auth, seeded demo data |

No shared environments are deployed yet.
