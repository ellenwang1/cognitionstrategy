from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from platform_core.db import get_session_factory
from platform_core.models import Role, RolePermission, User, UserRole
from sqlalchemy import select

from services.flags.app.models import FeatureFlag
from services.kyc.app.models import KycCase
from services.refunds.app.models import RefundRequest

ROLES = {
    "admin": ["*"],
    "kyc_analyst": ["kyc:read", "kyc:review"],
    "kyc_lead": ["kyc:*"],
    "refunds_agent": ["refunds:read", "refunds:review"],
    "refunds_manager": ["refunds:*"],
    "flags_admin": ["flags:*"],
    "viewer": ["kyc:read", "refunds:read", "flags:read"],
}
USERS = [
    ("admin@fintech.dev", "Platform Admin", ["admin"]),
    ("ana.analyst@fintech.dev", "Ana Analyst", ["kyc_analyst"]),
    ("kai.lead@fintech.dev", "Kai Lead", ["kyc_lead", "viewer"]),
    ("rae.refunds@fintech.dev", "Rae Refunds", ["refunds_agent"]),
    ("max.manager@fintech.dev", "Max Manager", ["refunds_manager", "viewer"]),
    ("fay.flags@fintech.dev", "Fay Flags", ["flags_admin"]),
    ("vic.viewer@fintech.dev", "Vic Viewer", ["viewer"]),
]


def seed() -> None:
    db = get_session_factory()()
    try:
        for key, permissions in ROLES.items():
            role = db.get(Role, key)
            if role is None:
                role = Role(key=key, label=key.replace("_", " ").title(), description="")
                db.add(role)
            for permission in permissions:
                if db.get(RolePermission, {"role_key": key, "permission": permission}) is None:
                    db.add(RolePermission(role_key=key, permission=permission))

        user_by_email: dict[str, User] = {}
        for email, name, role_keys in USERS:
            user = db.scalar(select(User).where(User.email == email))
            if user is None:
                user = User(email=email, name=name, password="demo", active=True)
                db.add(user)
                db.flush()
            user_by_email[email] = user
            for role_key in role_keys:
                if db.get(UserRole, {"user_id": user.id, "role_key": role_key}) is None:
                    db.add(UserRole(user_id=user.id, role_key=role_key))

        base_time = datetime.now(timezone.utc) - timedelta(days=20)
        for i in range(1, 21):
            case_id = f"kyc-{i:03d}"
            case = db.get(KycCase, case_id)
            if case is None:
                case = KycCase(id=case_id)
                db.add(case)
            case.applicant_name = f"Applicant {i}"
            case.applicant_email = f"applicant{i}@example.com"
            case.country = ("US", "GB", "DE", "CA", "AU")[i % 5]
            case.document_type = ("passport", "drivers_license", "national_id")[i % 3]
            case.status = "pending" if i % 4 else "in_review"
            case.reviewer_notes = ""
            case.submitted_at = base_time + timedelta(days=i)

        reasons = ("duplicate", "fraud", "customer_request", "defective", "other")
        for i in range(1, 21):
            refund_id = f"refund-{i:03d}"
            refund = db.get(RefundRequest, refund_id)
            if refund is None:
                refund = RefundRequest(id=refund_id)
                db.add(refund)
            refund.order_id = f"ORD-{10000 + i}"
            refund.customer_email = f"customer{i}@example.com"
            refund.amount = Decimal(str(125 + i * 47))
            refund.currency = "USD"
            refund.reason = reasons[i % len(reasons)]
            refund.status = "requested"
            refund.notes = ""
            refund.requested_at = base_time + timedelta(days=i)

        owners = ("platform", "growth", "risk", "payments")
        for i in range(1, 13):
            flag_id = f"flag-{i:03d}"
            flag = db.get(FeatureFlag, flag_id)
            if flag is None:
                flag = FeatureFlag(id=flag_id)
                db.add(flag)
            flag.key = f"feature_{i}"
            flag.description = f"Feature flag {i}"
            flag.enabled = i % 3 == 0
            flag.rollout_target = ("internal", "beta", "10_percent", "50_percent", "everyone")[i % 5]
            flag.high_risk = i in (3, 7, 11)
            flag.owner = owners[i % len(owners)]
            flag.updated_at = base_time + timedelta(days=i)
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
