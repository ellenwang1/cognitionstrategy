from __future__ import annotations

from datetime import datetime

from platform_core.db import Base
from platform_core.models import new_id, utcnow
from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column


class KycCase(Base):
    __tablename__ = "kyc_cases"
    __table_args__ = {"schema": "kyc"}

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    applicant_name: Mapped[str] = mapped_column(String(255))
    applicant_email: Mapped[str] = mapped_column(String(255))
    country: Mapped[str] = mapped_column(String(2))
    document_type: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(32), default="pending")
    reviewer_notes: Mapped[str] = mapped_column(Text, default="")
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
