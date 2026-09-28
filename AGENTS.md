# Agent notes

Read this before changing code. The [README](README.md) covers running the stack and
[CONTRIBUTING.md](CONTRIBUTING.md) covers the `tool.yaml` contract.

## What this is

A config-driven platform for internal tools. Each tool is a `services/<tool>/tool.yaml`.
The Python side (`packages/platform-core`) turns it into a FastAPI app; the TypeScript side
(`packages/tool-sdk`) turns it into a React UI loaded by the `apps/shell` Module Federation
host. Permissions, audit and approvals live in the platform, not in tools.

## Where things are

- `packages/platform-core/platform_core/`: `config.py` (the `ToolConfig` model, the source
  of truth for `tool.yaml`), `api.py` (`create_tool_app`, `ResourceService`), `security.py`
  (JWT, `Principal`, permissions), `approvals.py`, `audit.py`, `connectors.py`, `models.py`
  (shared tables), `db.py`.
- `packages/tool-sdk/src/`: `ToolRenderer.tsx` (config to UI), `api.ts` (client),
  `mount.tsx` (`createToolRemote`), `standalone.ts`, `generated/tool-config.ts`.
- `packages/ui-kit/src/`: components used by the renderer and the shell. `components/ui/`
  holds shadcn-style bases; `primitives.tsx` wraps them in the API the rest of the repo uses.
- `services/<tool>/`: `tool.yaml`, `models.py`, `main.py`, optional `connector.py`.
  `services/auth` is a mock OIDC issuer.
- `apps/<tool>/`: identical thin remotes; only the name, port and yaml import differ.
- `db/alembic/versions/`: `0001` is the shared `platform` schema, then one per tool.
- `tests/`: `test_core.py` (unit) and `test_smoke.py` (migrates, seeds and drives the APIs
  against Postgres; skipped when Postgres is down, so start it before trusting a green run).

## Commands

```sh
make venv && make db-up && make migrate && make seed
make lint && make test                  # ruff over packages/platform-core services db tests; pytest
pnpm install && pnpm run typecheck && pnpm run build
make schema                             # regenerate JSON schema + TS types after editing config.py
```

## Rules

- `packages/tool-sdk/schema/*.json` and `packages/tool-sdk/src/generated/*` are generated.
  Edit `config.py` and run `make schema`; never hand-edit them.
- Behaviour that every tool needs goes in `platform_core` or `tool-sdk`, not in a tool.
  A tool should stay yaml plus model plus migration.
- Adding a field to `tool.yaml` means updating `ToolConfig` and, if the UI reads it,
  `ToolRenderer`. `ToolConfig` rejects references to unknown fields at import time.
- Module Federation needs built remotes. Use `pnpm run build && pnpm run preview`, not
  `pnpm run dev`, when testing through the shell.
- Services import as `services.<tool>.main:app` from the repo root (`PYTHONPATH=.`); there
  is no per-service package to install.
- Commit prefixes are `platform(<area>):` and `tool(<t>):`; `scripts/metrics.sh --commits`
  relies on them.
