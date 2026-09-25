import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, JSON, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class ResponseSource(str, enum.Enum):
    telegram = "telegram"
    site = "site"
    import_ = "import"


class Response(Base):
    __tablename__ = "responses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    survey_id: Mapped[int] = mapped_column(ForeignKey("surveys.id"), nullable=False)
    region_id: Mapped[str] = mapped_column(ForeignKey("regions.region_id"), nullable=False)
    source: Mapped[ResponseSource] = mapped_column(Enum(ResponseSource), nullable=False)
    user_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    answers: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
