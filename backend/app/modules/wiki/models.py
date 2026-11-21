from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class WikiArticle(Base):
    __tablename__ = "wiki_articles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    client_key: Mapped[str] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    title: Mapped[str] = mapped_column(String(180))
    body: Mapped[str] = mapped_column(Text)
    user_agent: Mapped[str] = mapped_column(String(512))
    files: Mapped[list[dict]] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime)
    delivery: Mapped[list[int]] = mapped_column(JSON, default=list)
    moderation_sent: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    processing: Mapped[str] = mapped_column(String(16), default="waiting")
    points: Mapped[list[dict]] = mapped_column(JSON, default=list)


class WikiAttempt(Base):
    __tablename__ = "wiki_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    client_key: Mapped[str] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, index=True)


class WikiControl(Base):
    __tablename__ = "wiki_control"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    blocked: Mapped[str | None] = mapped_column(String(32))
    generation: Mapped[int] = mapped_column(Integer, default=0)
    notified: Mapped[int] = mapped_column(Integer, default=0)
    resumed_at: Mapped[datetime | None] = mapped_column(DateTime)
    update_offset: Mapped[int] = mapped_column(Integer, default=0)
