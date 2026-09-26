"""Shared platform tables: identity, RBAC, audit, approvals."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import PLATFORM_SCHEMA, Base


def _uuid() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": PLATFORM_SCHEMA}

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    name: Mapped[str] = mapped_column(String(255))
    password: Mapped[str] = mapped_column(String(255), default="demo")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    roles: Mapped[list["UserRole"]] = relationship(back_populates="user", lazy="selectin")


class Role(Base):
    __tablename__ = "roles"
    __table_args__ = {"schema": PLATFORM_SCHEMA}

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    label: Mapped[str] = mapped_column(String(128))
    description: Mapped[str] = mapped_column(Text, default="")

    permissions: Mapped[list["RolePermission"]] = relationship(
        back_populates="role", lazy="selectin"
    )


class UserRole(Base):
    __tablename__ = "user_roles"
    __table_args__ = {"schema": PLATFORM_SCHEMA}

    user_id: Mapped[str] = mapped_column(
        ForeignKey(f"{PLATFORM_SCHEMA}.users.id"), primary_key=True
    )
    role_key: Mapped[str] = mapped_column(
        ForeignKey(f"{PLATFORM_SCHEMA}.roles.key"), primary_key=True
    )

    user: Mapped[User] = relationship(back_populates="roles", lazy="selectin")
    role: Mapped[Role] = relationship(lazy="selectin")


class RolePermission(Base):
    __tablename__ = "role_permissions"
    __table_args__ = {"schema": PLATFORM_SCHEMA}

    role_key: Mapped[str] = mapped_column(
        ForeignKey(f"{PLATFORM_SCHEMA}.roles.key"), primary_key=True
    )
    permission: Mapped[str] = mapped_column(String(128), primary_key=True)

    role: Mapped[Role] = relationship(back_populates="permissions", lazy="selectin")


class AuditLog(Base):
    """Append-only audit trail. Never updated or deleted by application code."""

    __tablename__ = "audit_log"
    __table_args__ = (
        Index("ix_audit_log_entity", "tool", "entity_type", "entity_id"),
        {"schema": PLATFORM_SCHEMA},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    tool: Mapped[str] = mapped_column(String(64))
    actor_id: Mapped[str] = mapped_column(String(36))
    actor_email: Mapped[str] = mapped_column(String(255))
    action: Mapped[str] = mapped_column(String(128))
    entity_type: Mapped[str] = mapped_column(String(128))
    entity_id: Mapped[str] = mapped_column(String(128))
    before: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    after: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    context: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


class ApprovalRequest(Base):
    """Approval state machine: pending -> approved | rejected | cancelled."""

    __tablename__ = "approval_requests"
    __table_args__ = (
        Index("ix_approval_entity", "tool", "entity_type", "entity_id"),
        {"schema": PLATFORM_SCHEMA},
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    tool: Mapped[str] = mapped_column(String(64))
    entity_type: Mapped[str] = mapped_column(String(128))
    entity_id: Mapped[str] = mapped_column(String(128))
    action_key: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(16), default="pending")
    reason: Mapped[str] = mapped_column(Text, default="")
    requested_by_id: Mapped[str] = mapped_column(String(36))
    requested_by_email: Mapped[str] = mapped_column(String(255))
    decided_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    decided_by_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    decision_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    required_permission: Mapped[str] = mapped_column(String(128))
    payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
