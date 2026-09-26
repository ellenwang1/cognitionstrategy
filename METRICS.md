# METRICS — measuring per-tool marginal effort

The question this prototype exists to answer: if the platform is built, what does tool
number N cost? Everything below is computed from **package boundaries** and **commit
prefixes**, so it can be re-run by anyone with `git`:

```sh
scripts/metrics.sh            # bucket LOC/files + reuse ratio for the working tree
scripts/metrics.sh --commits  # per-commit attribution (platform vs tool lines)
```

## Buckets

| Bucket | Paths | Rule |
|--------|-------|------|
| **platform** | `packages/*`, `platform/*`, `apps/shell`, `services/auth`, `db/alembic/{env.py,alembic.ini,script.py.mako}`, `db/alembic/versions/0001_platform_shared.py`, `db/seed.py`, root tooling (`package.json`, `turbo.json`, `Makefile`, `docker-compose.yml`, `Dockerfile.*`, `scripts/`) | anything a tool *consumes* but does not own |
| **tool `<t>`** | `apps/<t>/`, `services/<t>/`, `db/alembic/versions/*_<t>.py` | everything needed to ship exactly that tool that no other tool uses |
| excluded | `pnpm-lock.yaml`, `packages/tool-sdk/src/generated/*`, `packages/tool-sdk/schema/*.json`, `dist/`, `node_modules/`, `*.md` | generated or non-source |

Commits are prefixed `platform(<area>):` or `tool(<t>):` so `git log --oneline` gives the
same partition over time; `--commits` cross-checks the prefix against the paths touched.

Known impurity: `db/seed.py` seeds all three tools' demo rows and is counted as platform
(it is demo data, not tool logic). The three tool migration files were committed in the
`platform(core)` commit (the `--commits` view still attributes their lines to `tool` by path).

## Definitions

- **LOC / files per bucket** — tracked source lines (`.py .ts .tsx .mjs .css .yaml .json .html .toml .ini .sh`) per bucket.
- **Reuse ratio (tool t)** = `platform_LOC / (platform_LOC + tool_t_LOC)` — the share of the
  lines that run when tool *t* ships that came from the platform. Note this rewards a fat
  platform; read it together with marginal effort.
- **Marginal effort (tool N)** = `tool_N_LOC` + platform LOC added *because of* tool N
  (platform commits landing between tool N−1 and tool N whose message names the tool, or
  novelty items below). Platform lines that would have been written anyway are excluded.
- **Novelty score (tool N)** = count of net-new platform primitives tool N forced:
  a new `ui-kit` component, a new `platform_core` capability (policy kind, action kind,
  field type, API endpoint), or a new connector type. Each counts 1.

## Baseline (this repo, at PR time)

`scripts/metrics.sh`:

```
bucket          loc  files
platform       3710     63
kyc             252     15
refunds         246     15
flags           196     14

kyc        tool=252  reuse=0.936
refunds    tool=246  reuse=0.938
flags      tool=196  reuse=0.950
```

Per-tool breakdown of what those ~200–250 lines are:

| File | KYC | Refunds | Flags | What it is |
|------|----:|--------:|------:|------------|
| `services/<t>/tool.yaml` | 70 | 64 | 47 | **the tool** — entity, views, actions, policies |
| `services/<t>/app/models.py` | 26 | 28 | 26 | one SQLAlchemy model in the tool schema |
| `services/<t>/app/connector.py` | 29 | 26 | — | mocked external source (sanctions / payments) |
| `services/<t>/app/main.py` | 13 | 13 | 9 | `create_tool_app(config, binding)` |
| `db/alembic/versions/000N_<t>.py` | 34 | 35 | 34 | one table |
| `apps/<t>/src/remote.tsx` | 8 | 8 | 8 | `createToolRemote(config)` |
| `apps/<t>/*` boilerplate (package.json, vite.config, tsconfig, index.html, main.tsx, env.d.ts) | 58 | 58 | 58 | identical across tools — could be a generator |
| `services/<t>/{Dockerfile,pyproject.toml,__init__}` | 20 | 20 | 20 | identical across tools |

So the **hand-written, tool-specific** portion is ~110–170 lines per tool (yaml + model +
migration + connector); the remaining ~80 are copy-paste scaffolding that a
`pnpm new-tool <name>` generator would remove.

### Marginal effort 1 → 2 → 3

| Tool | Order | Tool LOC | Platform LOC forced | Novelty | Notes |
|------|------:|---------:|--------------------:|--------:|-------|
| KYC Review Queue | 1 | 252 | (all 3,710 — first tool pays for the platform) | 5 | `QueueView`, `ApprovalWidget`/`AuditTrail`, `field_true` approval policy, `Connector`/`MockConnector` + derived fields, `approve`/`reject` action kinds |
| Refunds Dashboard | 2 | 246 | ≈ 30 | 2 | `threshold` approval policy, `currency` field type; first user of `DataTable` list mode |
| Feature Flag Admin | 3 | 196 | 0 | 0 | only `edit` action + `field_true` policy, both already existed |

Honesty note: the platform was designed with all three tools known, so the KYC novelty
count is "what KYC needed that a plain CRUD table does not", not a chronological measurement.
The per-commit attribution becomes a true chronological measurement from tool 4 onward:
any `platform(...)` commit landing while building tool N is that tool's forced platform cost.

**Prediction for tools 4–10**: a tool that fits the entity/list/detail/action shape costs
~150–250 LOC and novelty 0–1. A tool that does not fit (multi-entity workflows, charts,
bulk operations) will show up as novelty ≥ 2 and a platform commit of several hundred lines —
that signal is the point of tracking this.

## How to record a new tool

1. Build it in commits prefixed `tool(<name>):`. Any platform change it needs goes in a
   separate `platform(<area>): … for <name>` commit.
2. Run `scripts/metrics.sh --commits`; add a row to the marginal-effort table with
   tool LOC, forced platform LOC (sum of the `platform(...) for <name>` commits), and the
   novelty items by name.
3. If the boilerplate row grows, that is the cue to build the generator.
