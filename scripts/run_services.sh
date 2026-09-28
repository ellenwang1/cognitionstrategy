#!/usr/bin/env bash
set -euo pipefail

pids=()
cleanup() {
  trap - TERM INT EXIT
  kill "${pids[@]}" 2>/dev/null || true
}
trap cleanup TERM INT EXIT

"${PYTHON:-.venv/bin/python}" -m uvicorn services.auth.main:app --host 0.0.0.0 --port 8000 &
pids+=("$!")
"${PYTHON:-.venv/bin/python}" -m uvicorn services.kyc.main:app --host 0.0.0.0 --port 8001 &
pids+=("$!")
"${PYTHON:-.venv/bin/python}" -m uvicorn services.refunds.main:app --host 0.0.0.0 --port 8002 &
pids+=("$!")
"${PYTHON:-.venv/bin/python}" -m uvicorn services.flags.main:app --host 0.0.0.0 --port 8003 &
pids+=("$!")

wait -n "${pids[@]}"
