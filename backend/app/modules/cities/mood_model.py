from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class CityMoodRecord(Base):
    """Помесячные настроения городов. month NOT NULL (см. import-spec)."""

    __tablename__ = "city_mood_records"
    __table_args__ = (
        UniqueConstraint(
            "city_id",
            "year",
            "month",
            "scoring_version",
            name="uq_city_mood_city_year_month_version",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    city_id: Mapped[str] = mapped_column(ForeignKey("cities.city_id"), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    mood_index: Mapped[float] = mapped_column(Float, nullable=False)
    sentiment_raw: Mapped[float | None] = mapped_column(Float, nullable=True)
    n_lines: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scoring_version: Mapped[str] = mapped_column(String(16), nullable=False, default="2.0")
    source: Mapped[str] = mapped_column(String(64), nullable=False, default="csv-1905")
    is_public: Mapped[bool] = mapped_column(nullable=False, default=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
