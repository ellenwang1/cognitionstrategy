from __future__ import annotations

from typing import Any

from platform_core.connectors import MockConnector

from .models import KycCase


class SanctionsConnector(MockConnector):
    def __init__(self) -> None:
        super().__init__("sanctions-vendor")

    def fetch(self, resource: str, **params: Any) -> list[dict[str, Any]]:
        if resource != "applicant":
            return super().fetch(resource, **params)
        seed = str(params.get("key", ""))
        score = self.stable_int(seed, 101)
        flags = ["name_match"] if score >= 65 else []
        if score >= 85:
            flags.append("country_risk")
        return [{"risk_score": score, "risk_flags": flags, "sanctions_hit": score >= 80}]


def enrich_kyc(_db: Any, obj: KycCase, data: dict[str, Any]) -> dict[str, Any]:
    key = f"{obj.applicant_name.lower()}:{obj.applicant_email.lower()}"
    result = SanctionsConnector().fetch_one("applicant", key=key) or {}
    data.update(result)
    return data
