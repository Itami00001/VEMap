from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class MoodRecord(Base):
    __tablename__ = "mood_records"
    __table_args__ = (UniqueConstraint("region_id", "year", "scoring_version", name="uq_mood_region_year_version"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    region_id: Mapped[str] = mapped_column(ForeignKey("regions.region_id"), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    mood_index: Mapped[float] = mapped_column(Float, nullable=False)
    responses_count: Mapped[int] = mapped_column(Integer, nullable=False)
    scoring_version: Mapped[str] = mapped_column(String(16), nullable=False, default="1.0")
    is_public: Mapped[bool] = mapped_column(nullable=False, default=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
