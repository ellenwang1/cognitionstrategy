# Demo handoff — Refunds threshold approval (45–50 s)

One workflow, one control, one honest boundary. Everything below was executed on
2026-09-27 against this branch; anything not executed is marked **not verified**.

## A. Demo setup

Prerequisites: Docker (Postgres), Python 3.12, Node 24 + pnpm 9.12 (`source ~/.nvm/nvm.sh`).

```sh
cd cognitionstrategy
make venv && make db-up && make migrate && make seed      # first time only
pnpm install && pnpm run build
make api                                                  # terminal 1: auth:8000 kyc:8001 refunds:8002 flags:8003
pnpm run preview                                          # terminal 2: shell :3000, remotes :3001-3003
```

- **URL:** http://localhost:3000 → login → `#/refunds`. There is no hosted preview URL.
- **Users** (password `demo`, all synthetic): `max.manager@fintech.dev` (refunds manager, can request approval), `admin@fintech.dev` (second approver), `rae.refunds@fintech.dev` (agent, no approve permission).
- **Starting record:** `ORD-10008` (`refund-008`), **$501.00 USD**, reason Defective, status **Requested**. It is $1 over the configured `threshold: 500`, so approving it routes to a second approver.
- **Reset:** `make demo-reset` — deletes all rows in `platform.approval_requests` and `platform.audit_log` and re-runs the idempotent seed (every seeded refund returns to `requested`). Refuses to run unless `PLATFORM_ENV=dev` (the default). All data is seeded synthetic data; no external system is touched.
- **Recording tip:** have two browser profiles/incognito windows open — one logged in as Max, one as admin — so the approver switch is a tab change, not a login. Show the full table row before clicking it; once the detail pane opens the table narrows and the Status/Requested columns scroll.

## B. Recording plan (≈48 s)

| t | Click | Visible outcome |
|---|-------|-----------------|
| 0–5 s | Max's window, Refunds Dashboard already open | Table: `ORD-10008 · customer8@example.com · $501.00 · USD · Defective · Requested`. 20 refund requests. |
| 5–10 s | Click the `ORD-10008` row | Detail pane: Order / Refund / Payments processor sections (processor status `settled` comes from the payments connector), **Approvals: "No approval requests"**, **Audit trail: "No activity yet"**. |
| 10–17 s | Click **Approve refund**, leave Reason blank, click **Approve refund** | Red alert inside the modal: `a reason is required for 'Approve refund'` (HTTP 422 from the refunds API). Status unchanged. |
| 17–25 s | Type reason `Customer confirmed defective item`, click **Approve refund** | Modal closes. Notice: `"Approve refund" requires approval — request submitted.` Status stays **Requested**; Approvals shows a pending request by max.manager with the reason and "Awaiting a second approver with `refunds:approve`" (Max sees no decide buttons on his own request). Audit trail: `approval.requested:approve`. |
| 25–30 s | Switch to admin's window, click `ORD-10008` | Same pending request, now with **Approve / Reject** buttons. |
| 30–40 s | Type comment `Reviewed - OK`, click **Approve** | Notice `Request approved.` Status badge → **Approved** in pane and table. Audit trail gains `approval.approved:approve` (pending → approved) and `action:approve` (requested → approved) attributed to admin. |
| 40–48 s | Press F5 | Approved state, comment and all three audit entries reload from Postgres. Optional last 3 s: flash `services/refunds/tool.yaml` lines 46–54 — the whole rule is `requireReason: true` + `approval: {kind: threshold, field: amount, threshold: 500}`. |

Cut here. Do not tour KYC or Flags.

## C. Narration script (≈112 words)

> This is the refunds queue a support manager uses; each request carries the processor's payment status. A refund above the $500 threshold can't be approved by one person: when Max approves, the server rejects a blank reason, then records a request a second approver must decide. Admin approves; the status changes and the audit trail shows who did what, before and after. It survives a reload because it's in Postgres.
> Devin built the platform, all three tools and tests from a prompt; I set scope and merged after reviewing its fixes. Identity is a mocked login and the payments feed is synthetic. The pilot should test real SSO, a real processor, and production ownership.

## D. Evidence summary

| Claim | Evidence / code location | Status | Limitation |
|-------|--------------------------|--------|------------|
| Approving ORD-10008 routes to a second approver, then applies on decision | `platform/core/platform_core/api.py` `ResourceService.perform` / `decide`; `approvals.py` `approval_required` (`threshold` strict `>`); `services/refunds/tool.yaml` `approval: threshold 500` | **Verified** — browser (recording) + `services/tests/test_smoke.py::test_service_approval_flow` + curl | Entity status stays `requested` until decided; no notification to the approver exists. |
| Blank reason is rejected server-side | `api.py` `perform`: `if action.require_reason and not body.reason.strip(): 422`; test asserts 422 and no new approval | **Verified** — pytest + browser | Only whitespace check; no minimum length or reason taxonomy. |
| Agent (Rae) cannot approve | `security.assert_permission` → 403; UI hides the button via `hasPermission` | **Verified** — pytest (403) + browser (button absent) | Permissions come from a mock OIDC service's JWT; roles are seeded, not managed. |
| Requester cannot approve own request | `approvals.decide` → 403 `requester cannot approve their own request`; widget `canDecide` | **Verified** — 403 verified in PR #1 testing; button absence verified today | Today's run verified UI absence only; the 403 path was not re-executed today. |
| State persists across reload | Postgres tables `refunds.refund_requests`, `platform.approval_requests`, `platform.audit_log` (Alembic) | **Verified** — F5 after each step; DB rows inspected by the test run | Single local Postgres container; no backups/HA. |
| Every action/decision is audited with before/after diff | `audit.py` `record_audit`; `AuditTrail` component | **Verified** — three entries visible and in DB | Append-only by convention (no DB grant/trigger enforces it); **not a tamper-resistant compliance log**. |
| Genuine code reuse across the 3 tools | Frontend: `apps/{kyc,refunds,flags}/src/remote.tsx` are each 8 lines calling `createToolRemote(config)` → one `ToolRenderer` (`packages/tool-sdk`) using `DataTable/QueueView/FilterBar/DetailPane/ApprovalWidget/AuditTrail` from `@platform/ui-kit`. Backend: `services/{kyc,refunds,flags}/app/main.py` each call `create_tool_app(config, ResourceBinding(...))`; approvals/audit/RBAC live once in `platform_core`. | **Verified** (by inspection + all three tools running through the same code path) | The three tools were designed together, so this shows the shape fits three known cases, not an arbitrary 4th–10th tool. `scripts/metrics.sh` reports 196–252 tool-specific LOC per tool. |
| Devin built the implementation | Repo started as README-only (`8dafc18`); all code commits are Devin sessions (PRs #1–#3 by `devin-ai-integration[bot]`). This branch: `requireReason` rule, modal error display, `make demo-reset`, this file. | **Verified** — git history + PR pages | Wall-clock build time is **unknown** from records (PR #1 commits are timestamped 06:19–06:32 UTC on 2026-09-26 and were tested by 06:45; the session's wall time is not recorded in the repo). |
| Human intervention | PR #1 review flagged 16 findings (e.g. payload bypassing approval policy, forged admin tokens via default secret) — fixed by Devin's review loop and merged by ellenwang1; PR #2 fixed the remote-Retry bug surfaced in testing. Today: you chose the 60-minute budget and the refunds workflow. | **Verified** (PR comments) | Number of prompts/decisions per session is not in the repo. |
| Tests | `make test` → **14 passed** (the smoke test now also asserts the 422 reason-required path); `make lint` (ruff) clean; `pnpm typecheck` + `pnpm build` clean | **Verified** today | Frontend has no automated tests; UI was verified manually/by recording. |

## E. Production and ownership boundary

| Area | Implemented | Simulated | Not verified / not present |
|------|-------------|-----------|----------------------------|
| Identity | HS256 JWT validated on every API call; role → permission mapping in DB | `services/auth` is a **mock** OIDC issuer with seeded users, password `demo` | Real SSO/OIDC provider, MFA, session revocation, user provisioning |
| Authorisation | Server-side permission gates and approval policies (403/422 regardless of UI) | — | Fine-grained/row-level access; policy management UI |
| Integrations | `Connector` interface; derived fields merged into API responses | Payments processor and sanctions vendor are deterministic `MockConnector`s | Any real processor/KYC vendor, retries, rate limits, credentials handling |
| Audit | Shared `platform.audit_log` with actor, before/after, context | — | Immutability guarantees, retention, export to SIEM |
| Data | Postgres with Alembic migrations, schema per tool | 20 refunds / 20 KYC cases / 12 flags seeded | Backups, PII handling, data residency |
| Deployment | Dockerfiles + `docker-compose.yml`; each frontend an independent MF remote | — | Hosting, TLS, CI/CD, secrets management (`PLATFORM_JWT_SECRET` must be set outside dev), monitoring/alerting, on-call |
| Maintenance | Config contract typed on both sides (Pydantic → JSON Schema → TS) | — | Who owns platform upgrades (React/Vite/FastAPI), dependency patching, and the 10 future tools |

## F. Final build assessment

**What this supports about a custom build.** Three tools run on one code path with server-enforced RBAC, approval routing and audit — reuse is demonstrable in code, not just in screenshots. A new rule (reason required) was a 1-line config change plus ~10 lines of platform code, regenerated types and one test. Devin produced the implementation and self-fixed 16 review findings; the human role was scoping, review and merge.

**What it does not establish.** Production readiness (identity, integrations, ops are mocked or absent), the cost of tools 4–10 (all three known tools were designed together), total cost of ownership against the $250K licence, or how the 60-engineer team would staff platform maintenance. Build time is not recorded, so no effort claim should be made.

**Evidence that challenges "retain for now".** The marginal-tool cost signal is real and measurable (`METRICS.md`, `scripts/metrics.sh`): a tool that fits the list/detail/action shape is ~200 lines of declarative config and model. If the ten planned tools fit that shape, the customisation and cost argument for a custom platform is stronger than a screen tour suggests — but that is exactly what a pilot should measure, not assume.

**Single most useful next validation.** Build tool #4 (one the client actually needs) on this platform with real SSO and one real read-only integration, tracking forced platform changes via `scripts/metrics.sh --commits`. That measures the marginal cost and the production gap in one step.
