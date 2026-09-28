from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from platform_core.db import get_engine
from sqlalchemy import text

from services.auth.main import app as auth_app
from services.kyc.main import app as kyc_app
from services.refunds.main import app as refunds_app

ROOT = Path(__file__).parents[1]


@pytest.fixture(scope="module", autouse=True)
def database() -> None:
    try:
        with get_engine().connect() as connection:
            connection.execute(text("select 1"))
    except Exception as exc:
        pytest.skip(f"Postgres unavailable: {exc}")
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], cwd=ROOT / "db", check=True)
    subprocess.run(
        [sys.executable, "seed.py"],
        cwd=ROOT / "db",
        check=True,
        env={**os.environ, "PYTHONPATH": str(ROOT)},
    )


def token(email: str) -> str:
    response = TestClient(auth_app).post(
        "/token",
        json={"grant_type": "password", "username": email, "password": "demo"},
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def test_service_approval_flow() -> None:
    admin = token("admin@fintech.dev")
    headers = {"Authorization": f"Bearer {admin}"}
    kyc = TestClient(kyc_app)
    refunds = TestClient(refunds_app)

    cases = kyc.get("/cases", headers=headers).json()
    assert cases["total"] >= 20
    case_id = cases["items"][0]["id"]
    started = kyc.post(f"/cases/{case_id}/actions/start_review", headers=headers, json={})
    assert started.status_code == 200
    assert started.json()["status"] == "applied"

    high_refund = next(
        item for item in refunds.get("/refunds", headers=headers).json()["items"]
        if item["amount"] > 500
    )
    refund_id = high_refund["id"]
    rae = token("rae.refunds@fintech.dev")
    denied = refunds.post(
        f"/refunds/{refund_id}/actions/approve",
        headers={"Authorization": f"Bearer {rae}"},
        json={},
    )
    assert denied.status_code == 403

    max_manager = token("max.manager@fintech.dev")
    pending = refunds.post(
        f"/refunds/{refund_id}/actions/approve",
        headers={"Authorization": f"Bearer {max_manager}"},
        json={"reason": "Manager review"},
    )
    assert pending.status_code == 200
    approval_id = pending.json()["approval"]["id"]
    assert pending.json()["status"] == "pending_approval"

    decided = refunds.post(
        f"/approvals/{approval_id}/decision",
        headers=headers,
        json={"decision": "approved", "comment": "Approved by admin"},
    )
    assert decided.status_code == 200
    assert decided.json()["approval"]["status"] == "approved"
    assert decided.json()["entity"]["status"] == "approved"
    assert refunds.get(f"/refunds/{refund_id}/audit", headers=headers).json()

    enriched_cases = kyc.get("/cases", headers=headers).json()["items"]
    sanctions_case = next(item for item in enriched_cases if item["sanctions_hit"])
    approval = kyc.post(
        f"/cases/{sanctions_case['id']}/actions/approve",
        headers=headers,
        json={},
    )
    assert approval.status_code == 200
    assert approval.json()["status"] == "pending_approval"


def test_kyc_derived_filter_and_sort() -> None:
    admin = token("admin@fintech.dev")
    headers = {"Authorization": f"Bearer {admin}"}
    kyc = TestClient(kyc_app)
    filtered = kyc.get("/cases?sanctions_hit=true", headers=headers)
    assert filtered.status_code == 200
    assert filtered.json()["items"]
    assert all(item["sanctions_hit"] for item in filtered.json()["items"])

    sorted_cases = kyc.get("/cases?sort=risk_score&direction=desc", headers=headers).json()["items"]
    scores = [item["risk_score"] for item in sorted_cases]
    assert scores == sorted(scores, reverse=True)
