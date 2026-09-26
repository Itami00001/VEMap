from pydantic import BaseModel


class TimePeriodOut(BaseModel):
    year: int
    month: int | None = None


class CityOut(BaseModel):
    city_id: str
    name_ru: str
    region_id: str
    region_name: str


class CityMoodOut(BaseModel):
    city_id: str
    mood_index: float
    responses_count: int


class CityDataRowOut(BaseModel):
    city_id: str
    name_ru: str
    region_id: str
    region_name: str
    mood_index: float | None
    responses_count: int | None
    change_from_prev: float | None


class CityCompareRowOut(BaseModel):
    city_id: str
    name_ru: str
    region_id: str
    mood_a: float | None
    mood_b: float | None
    delta: float | None
