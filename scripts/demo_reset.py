"""Restore the demo starting state using only the seeded synthetic data.

Re-runs ``db/seed.py`` (which resets every seeded row's status/notes) and
clears the shared ``platform.audit_log`` / ``platform.approval_requests``
tables so the detail panes start empty. Refuses to run outside dev.

Usage: PYTHONPATH=. .venv/bin/python scripts/demo_reset.py   (or: make demo-reset)
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from platform_core.db import get_session_factory  # noqa: E402
from platform_core.models import ApprovalRequest, AuditLog  # noqa: E402
from sqlalchemy import delete  # noqa: E402

from db.seed import seed  # noqa: E402


def reset() -> None:
    if os.environ.get("PLATFORM_ENV", "dev") != "dev":
        raise SystemExit("demo_reset only runs when PLATFORM_ENV=dev")
    db = get_session_factory()()
    try:
        approvals = db.execute(delete(ApprovalRequest)).rowcount
        audit = db.execute(delete(AuditLog)).rowcount
        db.commit()
    finally:
        db.close()
    seed()
    print(f"demo reset: cleared {approvals} approval request(s), {audit} audit row(s); seed re-applied")


if __name__ == "__main__":
    reset()
