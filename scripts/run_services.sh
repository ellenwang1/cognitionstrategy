#!/usr/bin/env bash
set -euo pipefail

pids=()
cleanup() {
  trap - TERM INT EXIT
  kill "${pids[@]}" 2>/dev/null || true
}
trap cleanup TERM INT EXIT

"${PYTHON:-.venv/bin/python}" -m uvicorn services.auth.app.main:app --host 0.0.0.0 --port 8000 &
pids+=("$!")
"${PYTHON:-.venv/bin/python}" -m uvicorn services.kyc.app.main:app --host 0.0.0.0 --port 8001 &
pids+=("$!")
"${PYTHON:-.venv/bin/python}" -m uvicorn services.refunds.app.main:app --host 0.0.0.0 --port 8002 &
pids+=("$!")
"${PYTHON:-.venv/bin/python}" -m uvicorn services.flags.app.main:app --host 0.0.0.0 --port 8003 &
pids+=("$!")

wait -n "${pids[@]}"
