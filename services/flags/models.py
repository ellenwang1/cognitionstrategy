from __future__ import annotations

from datetime import datetime

from platform_core.db import Base
from platform_core.models import new_id, utcnow
from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column


class FeatureFlag(Base):
    __tablename__ = "feature_flags"
    __table_args__ = {"schema": "flags"}

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    key: Mapped[str] = mapped_column(String(128), unique=True)
    description: Mapped[str] = mapped_column(Text, default="")
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    rollout_target: Mapped[str] = mapped_column(String(32), default="internal")
    high_risk: Mapped[bool] = mapped_column(Boolean, default=False)
    owner: Mapped[str] = mapped_column(String(255))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
