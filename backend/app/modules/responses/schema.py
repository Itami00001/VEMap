from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict


class ResponseSource(str, Enum):
    telegram = "telegram"
    site = "site"
    import_ = "import"


class ResponseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    survey_id: int
    region_id: str
    source: ResponseSource
    user_id: str | None
    answers: dict
    created_at: datetime


class ResponseCreate(BaseModel):
    survey_id: int
    region_id: str
    source: ResponseSource
    user_id: str | None = None
    answers: dict
