"""Create feature flags.

Revision ID: 0004_flags
Revises: 0003_refunds
"""

import sqlalchemy as sa
from alembic import op

revision = "0004_flags"
down_revision = "0003_refunds"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS flags"))
    op.create_table(
        "feature_flags",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("key", sa.String(128), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("rollout_target", sa.String(32), nullable=False, server_default="internal"),
        sa.Column("high_risk", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("owner", sa.String(255), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        schema="flags",
    )


def downgrade() -> None:
    op.drop_table("feature_flags", schema="flags")
    op.execute(sa.text("DROP SCHEMA IF EXISTS flags"))
