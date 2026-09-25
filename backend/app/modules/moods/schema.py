from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MoodRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    region_id: str
    year: int
    mood_index: float
    responses_count: int
    scoring_version: str
    computed_at: datetime


class MapPointOut(BaseModel):
    region_id: str
    mood_index: float
    responses_count: int


class HistoryPointOut(BaseModel):
    year: int
    mood_index: float
    responses_count: int


class DataRowOut(BaseModel):
    region_id: str
    name_ru: str
    mood_index: float | None
    responses_count: int | None
    change_from_prev: float | None


class CompareRowOut(BaseModel):
    region_id: str
    name_ru: str
    mood_a: float | None
    mood_b: float | None
    delta: float | None
