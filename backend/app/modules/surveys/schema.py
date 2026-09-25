from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class SurveyStatus(str, Enum):
    draft = "draft"
    active = "active"
    closed = "closed"


class QuestionType(str, Enum):
    scale = "scale"
    single_choice = "single_choice"
    text = "text"


class QuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    survey_id: int
    text: str
    type: QuestionType
    options: dict | list | None
    weight: float
    required: bool


class SurveyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    year: int
    title: str
    description: str | None
    status: SurveyStatus
    scoring_version: str
    created_at: datetime
    updated_at: datetime
    questions: list[QuestionOut] = Field(default_factory=list)


class SurveyCreate(BaseModel):
    year: int
    title: str
    description: str | None = None
    status: SurveyStatus = SurveyStatus.draft
    scoring_version: str = "1.0"


class SurveyUpdate(BaseModel):
    year: int | None = None
    title: str | None = None
    description: str | None = None
    status: SurveyStatus | None = None
    scoring_version: str | None = None
