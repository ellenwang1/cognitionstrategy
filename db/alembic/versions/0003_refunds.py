"""Create refund requests.

Revision ID: 0003_refunds
Revises: 0002_kyc
"""

import sqlalchemy as sa
from alembic import op

revision = "0003_refunds"
down_revision = "0002_kyc"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS refunds"))
    op.create_table(
        "refund_requests",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("order_id", sa.String(64), nullable=False),
        sa.Column("customer_email", sa.String(255), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("reason", sa.String(32), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="requested"),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
        schema="refunds",
    )


def downgrade() -> None:
    op.drop_table("refund_requests", schema="refunds")
    op.execute(sa.text("DROP SCHEMA IF EXISTS refunds"))
