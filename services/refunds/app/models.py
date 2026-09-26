from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from platform_core.db import Base
from sqlalchemy import DateTime, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RefundRequest(Base):
    __tablename__ = "refund_requests"
    __table_args__ = {"schema": "refunds"}

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id: Mapped[str] = mapped_column(String(64))
    customer_email: Mapped[str] = mapped_column(String(255))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    reason: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(32), default="requested")
    notes: Mapped[str] = mapped_column(Text, default="")
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
