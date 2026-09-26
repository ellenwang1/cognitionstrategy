"""Approvals engine: request -> pending -> approved | rejected."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .audit import record_audit
from .config import ActionSpec, ApprovalPolicy
from .models import ApprovalRequest, utcnow
from .security import Principal

PENDING = "pending"
APPROVED = "approved"
REJECTED = "rejected"
CANCELLED = "cancelled"

TERMINAL_STATES = {APPROVED, REJECTED, CANCELLED}


def approval_required(policy: ApprovalPolicy, entity: dict[str, Any]) -> bool:
    """Evaluate a declarative approval policy against an entity snapshot."""
    if policy.kind == "never":
        return False
    if policy.kind == "always":
        return True
    if policy.kind == "threshold":
        if policy.field is None or policy.threshold is None:
            return False
        value = entity.get(policy.field)
        try:
            return float(value) >= policy.threshold  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return False
    if policy.kind == "field_true":
        return bool(entity.get(policy.field or ""))
    return False


def request_approval(
    db: Session,
    *,
    tool: str,
    action: ActionSpec,
    entity_type: str,
    entity_id: str,
    requester: Principal,
    reason: str = "",
    payload: dict[str, Any] | None = None,
) -> ApprovalRequest:
    existing = db.scalar(
        select(ApprovalRequest).where(
            ApprovalRequest.tool == tool,
            ApprovalRequest.entity_type == entity_type,
            ApprovalRequest.entity_id == str(entity_id),
            ApprovalRequest.action_key == action.key,
            ApprovalRequest.status == PENDING,
        )
    )
    if existing is not None:
        return existing

    request = ApprovalRequest(
        tool=tool,
        entity_type=entity_type,
        entity_id=str(entity_id),
        action_key=action.key,
        status=PENDING,
        reason=reason,
        requested_by_id=requester.id,
        requested_by_email=requester.email,
        required_permission=action.permission,
        payload=payload,
    )
    db.add(request)
    db.flush()
    record_audit(
        db,
        tool=tool,
        actor=requester,
        action=f"approval.requested:{action.key}",
        entity_type=entity_type,
        entity_id=str(entity_id),
        after={"approval_id": request.id, "status": PENDING},
        context={"reason": reason},
    )
    return request


def decide(
    db: Session,
    *,
    approval_id: str,
    approver: Principal,
    decision: str,
    comment: str = "",
) -> ApprovalRequest:
    if decision not in (APPROVED, REJECTED, CANCELLED):
        raise HTTPException(status_code=400, detail=f"invalid decision: {decision}")

    request = db.get(ApprovalRequest, approval_id)
    if request is None:
        raise HTTPException(status_code=404, detail="approval request not found")
    if request.status in TERMINAL_STATES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"approval already {request.status}",
        )
    if decision != CANCELLED and not approver.has_permission(request.required_permission):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"missing permission: {request.required_permission}",
        )
    if decision != CANCELLED and approver.id == request.requested_by_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="requester cannot approve their own request",
        )

    before = {"status": request.status}
    request.status = decision
    request.decided_at = utcnow()
    request.decided_by_id = approver.id
    request.decided_by_email = approver.email
    request.decision_comment = comment
    db.flush()

    record_audit(
        db,
        tool=request.tool,
        actor=approver,
        action=f"approval.{decision}:{request.action_key}",
        entity_type=request.entity_type,
        entity_id=request.entity_id,
        before=before,
        after={"status": decision},
        context={"approval_id": request.id, "comment": comment},
    )
    return request


def pending_for_entity(
    db: Session, *, tool: str, entity_type: str, entity_id: str
) -> list[ApprovalRequest]:
    stmt = select(ApprovalRequest).where(
        ApprovalRequest.tool == tool,
        ApprovalRequest.entity_type == entity_type,
        ApprovalRequest.entity_id == str(entity_id),
    ).order_by(ApprovalRequest.created_at.desc())
    return list(db.scalars(stmt))


def list_approvals(
    db: Session, *, tool: str, status_filter: str | None = PENDING
) -> list[ApprovalRequest]:
    stmt = select(ApprovalRequest).where(ApprovalRequest.tool == tool)
    if status_filter:
        stmt = stmt.where(ApprovalRequest.status == status_filter)
    return list(db.scalars(stmt.order_by(ApprovalRequest.created_at.desc())))
