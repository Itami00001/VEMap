from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.modules.cities import service as city_service
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
    # Только реально существующие периоды: городские помесячные + годовые опросные.
    return city_service.get_periods(db)


@router.get("/cities", response_model=list[CityOut])
def list_cities():
    return [CityOut(**c) for c in CITIES]


@router.get("/cities/moods", response_model=list[CityMoodOut])
def city_moods(year: int, month: int | None = None, db: Session = Depends(get_db)):
    return city_service.get_city_moods(db, year, month)


@router.get("/cities/{city_id}/history")
def city_history(city_id: str, db: Session = Depends(get_db)):
    return city_service.get_city_history(db, city_id)


@router.get("/data/cities", response_model=list[CityDataRowOut])
def data_cities(year: int, month: int | None = None, db: Session = Depends(get_db)):
    rows = city_service.get_city_data_rows(db, year, month)
    for r in rows:
        if not r["region_name"] and r["region_id"]:
            # region_name not in get_city_moods, skip for now
            pass
    return rows


@router.get("/compare/cities", response_model=list[CityCompareRowOut])
def compare_cities(
    year_a: int, year_b: int, month_a: int | None = None, month_b: int | None = None, db: Session = Depends(get_db)
):
    return city_service.get_city_compare_rows(db, year_a, year_b, month_a, month_b)
