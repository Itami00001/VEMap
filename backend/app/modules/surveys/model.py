import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class SurveyStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    closed = "closed"


class Survey(Base):
    __tablename__ = "surveys"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[SurveyStatus] = mapped_column(Enum(SurveyStatus), nullable=False, default=SurveyStatus.draft)
    scoring_version: Mapped[str] = mapped_column(String(16), nullable=False, default="1.0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    questions: Mapped[list["Question"]] = relationship(back_populates="survey", cascade="all, delete-orphan")


class QuestionType(str, enum.Enum):
    scale = "scale"
    single_choice = "single_choice"
    text = "text"


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    survey_id: Mapped[int] = mapped_column(ForeignKey("surveys.id"), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[QuestionType] = mapped_column(Enum(QuestionType), nullable=False)
    options: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)
    weight: Mapped[float] = mapped_column(nullable=False, default=1.0)
    required: Mapped[bool] = mapped_column(nullable=False, default=True)

    survey: Mapped["Survey"] = relationship(back_populates="questions")
