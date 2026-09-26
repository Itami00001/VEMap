from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.modules.cities.data import CITIES
from app.modules.cities.schema import (
    CityCompareRowOut,
    CityDataRowOut,
    CityMoodOut,
    CityOut,
    TimePeriodOut,
)
from app.modules.moods import service as mood_service
from app.modules.moods.router import SCORING_VERSION

router = APIRouter(prefix="/api", tags=["cities"])


@router.get("/periods", response_model=list[TimePeriodOut])
def list_periods(db: Session = Depends(get_db)):
    # v1.1: только реально существующие периоды. Помесячных записей в БД пока
    # нет (структура ждёт владельца данных), поэтому month всегда null.
    years = mood_service.get_available_years(db, SCORING_VERSION)
    return [TimePeriodOut(year=y, month=None) for y in years]


@router.get("/cities", response_model=list[CityOut])
def list_cities():
    return [CityOut(**c) for c in CITIES]


@router.get("/cities/moods", response_model=list[CityMoodOut])
def city_moods(year: int, month: int | None = None):
    # Городских записей в БД пока нет — структура ждёт владельца данных.
    # Возвращаем пустой массив, а не 404 (см. step06 v1.1).
    _ = (year, month)
    return []


@router.get("/cities/{city_id}/history")
def city_history(city_id: str):
    # Истории городов в БД пока нет — см. выше.
    _ = city_id
    return []


@router.get("/data/cities", response_model=list[CityDataRowOut])
def data_cities(year: int, month: int | None = None):
    _ = (year, month)
    return []


@router.get("/compare/cities", response_model=list[CityCompareRowOut])
def compare_cities(year_a: int, year_b: int, month_a: int | None = None, month_b: int | None = None):
    _ = (year_a, year_b, month_a, month_b)
    return []
