from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.modules.cities import service as city_service
from app.modules.cities.comparison import Comparison, compare_periods
from app.modules.cities.model import City
from app.modules.cities.newspapers import ArchiveCity, NewspaperCatalog, find_issue, issues, list_catalog
from app.modules.cities.source_model import CityMoodSource
from app.modules.cities.schema import (
    CityCompareRowOut,
    CityDataRowOut,
    CityMoodOut,
    CityOut,
    TimePeriodOut,
)
from app.modules.moods import service as mood_service
from app.modules.moods.router import SCORING_VERSION
from app.modules.regions.model import Region

router = APIRouter(prefix="/api", tags=["cities"])


@router.get("/periods", response_model=list[TimePeriodOut])
def list_periods(db: Session = Depends(get_db)):
    # Только реально существующие периоды: городские помесячные + годовые опросные.
    return city_service.get_periods(db)


@router.get("/cities", response_model=list[CityOut])
def list_cities(db: Session = Depends(get_db)):
    # Справочник из БД (импорт CSV), а не статический список.
    rows = (
        db.query(City, Region.name_ru)
        .outerjoin(Region, Region.region_id == City.region_id)
        .order_by(City.name_ru)
        .all()
    )
    out = []
    for city, region_name in rows:
        if city.region_id is None:
            rn = "Украина" if city.country == "UA" else (city.country or "")
        else:
            rn = region_name or ""
        out.append(CityOut(
            city_id=city.city_id,
            name_ru=city.name_ru,
            region_id=city.region_id,
            region_name=rn,
            country=city.country,
            lat=city.lat,
            lon=city.lon,
        ))
    return out


@router.get("/cities/moods", response_model=list[CityMoodOut])
def city_moods(year: int, month: int | None = None, db: Session = Depends(get_db)):
    # City observations are monthly. A yearly survey is a distinct period.
    if month is None:
        return []
    rows = city_service.get_city_moods(db, year, month)
    query = db.query(CityMoodSource).filter(CityMoodSource.year == year, CityMoodSource.month == month)
    sources_by_period = defaultdict(list)
    _, by_filename = issues(db)
    for source in query.order_by(CityMoodSource.source_pdf, CityMoodSource.source_page):
        issue = by_filename[source.source_pdf]
        sources_by_period[(source.city_id, source.month)].append(issue.as_output(source.source_page))
    for row in rows:
        row["sources"] = sources_by_period[(row["city_id"], row["month"])]
    return rows


@router.get("/newspapers/{filename}")
def open_newspaper(filename: str, db: Session = Depends(get_db)):
    issue = find_issue(db, filename)
    path = issue.path if issue else None
    if path is None:
        raise HTTPException(status_code=404, detail="Newspaper PDF not found")
    return FileResponse(path, media_type="application/pdf", filename=path.name, content_disposition_type="inline")


@router.get("/newspapers", response_model=list[ArchiveCity])
def list_newspapers(db: Session = Depends(get_db)):
    return list_catalog(db).cities


@router.get("/newspaper-catalog", response_model=NewspaperCatalog)
def newspaper_catalog(db: Session = Depends(get_db)):
    return list_catalog(db)


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
    comparison = compare_periods(db, TimePeriodOut(year=year_a, month=month_a), TimePeriodOut(year=year_b, month=month_b))
    return [
        CityCompareRowOut(city_id=row.id, name_ru=row.name, region_id=row.region_id,
                          mood_a=row.a.value if row.a else None, mood_b=row.b.value if row.b else None, delta=row.delta)
        for row in comparison.cities
    ]


@router.get("/compare/periods", response_model=Comparison)
def compare_workspace(
    year_a: int | None = None, year_b: int | None = None,
    month_a: int | None = Query(None, ge=1, le=12), month_b: int | None = Query(None, ge=1, le=12),
    db: Session = Depends(get_db),
):
    if year_a is None and year_b is None and month_a is None and month_b is None:
        return compare_periods(db)
    if year_a is None or year_b is None:
        raise HTTPException(400, "Укажите оба периода.")
    return compare_periods(db, TimePeriodOut(year=year_a, month=month_a), TimePeriodOut(year=year_b, month=month_b))
