"""Create KYC cases.

Revision ID: 0002_kyc
Revises: 0001_platform_shared
"""

import sqlalchemy as sa
from alembic import op

revision = "0002_kyc"
down_revision = "0001_platform_shared"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS kyc"))
    op.create_table(
        "kyc_cases",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("applicant_name", sa.String(255), nullable=False),
        sa.Column("applicant_email", sa.String(255), nullable=False),
        sa.Column("country", sa.String(2), nullable=False),
        sa.Column("document_type", sa.String(32), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("reviewer_notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        schema="kyc",
    )


def downgrade() -> None:
    op.drop_table("kyc_cases", schema="kyc")
    op.execute(sa.text("DROP SCHEMA IF EXISTS kyc"))
