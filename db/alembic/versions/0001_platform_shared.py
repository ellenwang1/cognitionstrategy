"""Create shared platform tables.

Revision ID: 0001_platform_shared
Revises:
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001_platform_shared"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS platform"))
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("password", sa.String(255), nullable=False, server_default="demo"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        schema="platform",
    )
    op.create_table(
        "roles",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("label", sa.String(128), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        schema="platform",
    )
    op.create_table(
        "user_roles",
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("role_key", sa.String(64), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["platform.users.id"]),
        sa.ForeignKeyConstraint(["role_key"], ["platform.roles.key"]),
        sa.PrimaryKeyConstraint("user_id", "role_key"),
        schema="platform",
    )
    op.create_table(
        "role_permissions",
        sa.Column("role_key", sa.String(64), nullable=False),
        sa.Column("permission", sa.String(128), nullable=False),
        sa.ForeignKeyConstraint(["role_key"], ["platform.roles.key"]),
        sa.PrimaryKeyConstraint("role_key", "permission"),
        schema="platform",
    )
    op.create_table(
        "audit_log",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tool", sa.String(64), nullable=False),
        sa.Column("actor_id", sa.String(36), nullable=False),
        sa.Column("actor_email", sa.String(255), nullable=False),
        sa.Column("action", sa.String(128), nullable=False),
        sa.Column("entity_type", sa.String(128), nullable=False),
        sa.Column("entity_id", sa.String(128), nullable=False),
        sa.Column("before", postgresql.JSONB(), nullable=True),
        sa.Column("after", postgresql.JSONB(), nullable=True),
        sa.Column("context", postgresql.JSONB(), nullable=True),
        sa.Index("ix_audit_log_entity", "tool", "entity_type", "entity_id"),
        schema="platform",
    )
    op.create_table(
        "approval_requests",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("tool", sa.String(64), nullable=False),
        sa.Column("entity_type", sa.String(128), nullable=False),
        sa.Column("entity_id", sa.String(128), nullable=False),
        sa.Column("action_key", sa.String(64), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("reason", sa.Text(), nullable=False, server_default=""),
        sa.Column("requested_by_id", sa.String(36), nullable=False),
        sa.Column("requested_by_email", sa.String(255), nullable=False),
        sa.Column("decided_by_id", sa.String(36), nullable=True),
        sa.Column("decided_by_email", sa.String(255), nullable=True),
        sa.Column("decision_comment", sa.Text(), nullable=True),
        sa.Column("required_permission", sa.String(128), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=True),
        sa.Index("ix_approval_entity", "tool", "entity_type", "entity_id"),
        schema="platform",
    )


def downgrade() -> None:
    op.drop_table("approval_requests", schema="platform")
    op.drop_table("audit_log", schema="platform")
    op.drop_table("role_permissions", schema="platform")
    op.drop_table("user_roles", schema="platform")
    op.drop_table("roles", schema="platform")
    op.drop_table("users", schema="platform")
    op.execute(sa.text("DROP SCHEMA IF EXISTS platform"))
