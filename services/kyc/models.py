from __future__ import annotations

import uuid
from datetime import datetime, timezone

from platform_core.db import Base
from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class KycCase(Base):
    __tablename__ = "kyc_cases"
    __table_args__ = {"schema": "kyc"}

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    applicant_name: Mapped[str] = mapped_column(String(255))
    applicant_email: Mapped[str] = mapped_column(String(255))
    country: Mapped[str] = mapped_column(String(2))
    document_type: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(32), default="pending")
    reviewer_notes: Mapped[str] = mapped_column(Text, default="")
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
