from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.modules.moods import service as mood_service
from app.modules.moods.schema import CompareRowOut, DataRowOut, HistoryPointOut, MapPointOut
from app.modules.regions.model import Region

router = APIRouter(prefix="/api", tags=["moods"])

SCORING_VERSION = "1.0"


@router.get("/years")
def list_years(db: Session = Depends(get_db)):
    years = mood_service.get_available_years(db, SCORING_VERSION)
    return years


@router.get("/map/{year}", response_model=list[MapPointOut])
def map_for_year(year: int, month: int | None = Query(default=None), db: Session = Depends(get_db)):
    # v1.1: month принят для совместимости. Помесячных записей в БД пока нет
    # (структура ждёт владельца данных) — запрос с month возвращает [].
    if month is not None:
        return []
    points = mood_service.get_map_points(db, year, SCORING_VERSION)
    if not points:
        return []
    return points


@router.get("/regions/{region_id}/history", response_model=list[HistoryPointOut])
def region_history(region_id: str, db: Session = Depends(get_db)):
    region = db.get(Region, region_id)
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")
    return mood_service.get_history(db, region_id, SCORING_VERSION)


@router.get("/data", response_model=list[DataRowOut])
def public_data(
    year: int = Query(...),
    month: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    # v1.1: см. комментарий выше — запрос с month возвращает [].
    if month is not None:
        return []
    return mood_service.get_public_table(db, year, SCORING_VERSION)


@router.get("/compare", response_model=list[CompareRowOut])
def compare_years(
    year_a: int = Query(...),
    year_b: int = Query(...),
    month_a: int | None = Query(default=None),
    month_b: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    # v1.1: см. комментарий выше — запрос с month_* возвращает [].
    if month_a is not None or month_b is not None:
        return []
    return mood_service.compare(db, year_a, year_b, SCORING_VERSION)
