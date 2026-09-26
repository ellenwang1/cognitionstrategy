"""Append-only audit logging helper."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import AuditLog
from .security import Principal


def record_audit(
    db: Session,
    *,
    tool: str,
    actor: Principal,
    action: str,
    entity_type: str,
    entity_id: str,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    context: dict[str, Any] | None = None,
) -> AuditLog:
    entry = AuditLog(
        tool=tool,
        actor_id=actor.id,
        actor_email=actor.email,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        before=before,
        after=after,
        context=context,
    )
    db.add(entry)
    db.flush()
    return entry


def entity_audit_trail(
    db: Session, *, tool: str, entity_type: str, entity_id: str, limit: int = 100
) -> list[AuditLog]:
    stmt = (
        select(AuditLog)
        .where(
            AuditLog.tool == tool,
            AuditLog.entity_type == entity_type,
            AuditLog.entity_id == str(entity_id),
        )
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt))


def diff(before: dict[str, Any] | None, after: dict[str, Any] | None) -> dict[str, Any]:
    """Field-level before/after diff, used by the audit-trail viewer."""
    before = before or {}
    after = after or {}
    changed = {}
    for key in set(before) | set(after):
        if before.get(key) != after.get(key):
            changed[key] = {"before": before.get(key), "after": after.get(key)}
    return changed
