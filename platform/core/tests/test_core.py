from pathlib import Path

import pytest
from platform_core.approvals import approval_required
from platform_core.config import ApprovalPolicy, load_tool_config
from platform_core.security import Principal, decode_token, issue_token


def test_principal_permission_wildcards() -> None:
    principal = Principal(
        id="1",
        email="user@example.com",
        name="User",
        permissions=["refunds:*"],
    )
    assert principal.has_permission("refunds:read")
    assert principal.has_permission("refunds:approve")
    assert not principal.has_permission("kyc:read")
    assert Principal(
        id="2", email="admin@example.com", name="Admin", permissions=["*"]
    ).has_permission("anything:write")


@pytest.mark.parametrize(
    ("policy", "entity", "expected"),
    [
        (ApprovalPolicy(kind="never"), {}, False),
        (ApprovalPolicy(kind="always"), {}, True),
        (ApprovalPolicy(kind="threshold", field="amount", threshold=500), {"amount": 500}, False),
        (ApprovalPolicy(kind="threshold", field="amount", threshold=500), {"amount": 499}, False),
        (ApprovalPolicy(kind="field_true", field="high_risk"), {"high_risk": True}, True),
        (ApprovalPolicy(kind="field_true", field="high_risk"), {"high_risk": False}, False),
    ],
)
def test_approval_policies(policy: ApprovalPolicy, entity: dict, expected: bool) -> None:
    assert approval_required(policy, entity) is expected


def test_issue_decode_roundtrip(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PLATFORM_JWT_SECRET", "test-secret")
    monkeypatch.setenv("PLATFORM_JWT_ISSUER", "http://test-issuer")
    principal = Principal(
        id="abc",
        email="user@example.com",
        name="User",
        roles=["viewer"],
        permissions=["kyc:read"],
    )
    assert decode_token(issue_token(principal)) == principal


def test_default_jwt_secret_rejected_outside_dev(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PLATFORM_ENV", "production")
    monkeypatch.delenv("PLATFORM_JWT_SECRET", raising=False)
    with pytest.raises(RuntimeError, match="PLATFORM_JWT_SECRET must be set outside dev"):
        issue_token(Principal(id="1", email="a@example.com", name="A"))


@pytest.mark.parametrize("service", ["kyc", "refunds", "flags"])
def test_tool_config_validates(service: str) -> None:
    path = Path(__file__).parents[3] / "services" / service / "tool.yaml"
    config = load_tool_config(path)
    assert config.key == service
    assert config.entity.fields
