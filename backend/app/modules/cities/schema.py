from pydantic import BaseModel
from app.modules.cities.newspapers import IssueOut


class TimePeriodOut(BaseModel):
    year: int
    month: int | None = None


class CityOut(BaseModel):
    city_id: str
    name_ru: str
    region_id: str | None
    region_name: str
    country: str
    lat: float
    lon: float


class CityMoodOut(BaseModel):
    city_id: str
    mood_index: float
    responses_count: int
    sources: list[IssueOut]


class CityDataRowOut(BaseModel):
    city_id: str
    name_ru: str
    region_id: str | None
    region_name: str
    mood_index: float | None
    responses_count: int | None
    change_from_prev: float | None


class CityCompareRowOut(BaseModel):
    city_id: str
    name_ru: str
    region_id: str | None
    mood_a: float | None
    mood_b: float | None
    delta: float | None
