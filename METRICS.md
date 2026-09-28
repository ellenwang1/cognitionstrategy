# Metrics: what does tool N cost?

`scripts/metrics.sh` splits tracked source lines into a platform bucket and one bucket per
tool, by path. `scripts/metrics.sh --commits` attributes each commit's added and deleted
lines the same way and prints them next to the commit's `platform(...)` or `tool(...)`
prefix.

## Buckets

| Bucket | Paths |
|--------|-------|
| platform | `packages/*`, `apps/shell`, `services/auth`, `db/alembic/{env.py,alembic.ini,script.py.mako}`, `db/alembic/versions/0001_platform_shared.py`, root tooling and `scripts/` |
| tool `<t>` | `apps/<t>/`, `services/<t>/`, `db/alembic/versions/*_<t>.py` |
| excluded | `pnpm-lock.yaml`, `packages/tool-sdk/src/generated/*`, `packages/tool-sdk/schema/*.json`, `dist/`, `node_modules/`, `*.md` |

`db/seed.py` seeds every tool's demo rows and is in neither bucket.

## Definitions

Reuse ratio for tool t is `platform_LOC / (platform_LOC + tool_t_LOC)`. It rewards a large
platform, so read it with marginal effort.

Marginal effort for tool N is `tool_N_LOC` plus the platform lines added because of tool N:
`platform(...)` commits landing while tool N was built whose message names it.

Novelty for tool N is the count of platform additions it forced: a new `ui-kit` component,
a new `platform_core` capability (policy kind, action kind, field type, endpoint) or a new
connector type.

## Baseline

`scripts/metrics.sh` on this branch:

```
bucket          loc  files
platform       4526     71
kyc             248     15
refunds         242     15
flags           192     14

reuse ratio = platform / (platform + tool)
kyc        tool=248  reuse=0.948
refunds    tool=242  reuse=0.949
flags      tool=192  reuse=0.959
```

Per tool, the hand-written part is the yaml (47 to 70 lines), one model (about 25 lines),
one migration (about 35 lines) and an optional connector (about 25 lines). The rest is the
`apps/<t>` scaffold, identical across tools apart from name, port and yaml path.

| Tool | Order | Novelty | What it forced |
|------|------:|--------:|----------------|
| KYC review queue | 1 | 5 | `QueueView`, `ApprovalWidget` and `AuditTrail`, `field_true` policy, `MockConnector` with derived fields, `approve` and `reject` action kinds |
| Refunds dashboard | 2 | 2 | `threshold` policy, `currency` field type |
| Feature flag admin | 3 | 0 | nothing new |

The platform was designed with all three tools known, so these novelty counts are "what the
tool needed beyond a plain CRUD table", not a chronological measurement. From tool 4 on,
`--commits` gives the chronological one.

## Recording a new tool

1. Build it in `tool(<name>):` commits. Platform changes it needs go in separate
   `platform(<area>): ... for <name>` commits.
2. Run `scripts/metrics.sh --commits` and add a row above with tool LOC, forced platform
   LOC and the novelty items by name.
3. A tool that does not fit the entity, list, detail and action shape will show up as
   novelty of 2 or more and a platform commit of several hundred lines. That is the signal
   this file exists to catch.
