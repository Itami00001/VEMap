from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.modules.cities import service as city_service
from app.modules.cities.model import City
from app.modules.cities.source_model import CityMoodSource, newspaper_path
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
    availability = {}
    for source in query.order_by(CityMoodSource.source_pdf, CityMoodSource.source_page):
        if source.source_pdf not in availability:
            availability[source.source_pdf] = newspaper_path(source.source_pdf) is not None
        sources_by_period[(source.city_id, source.month)].append({
            "source_pdf": source.source_pdf,
            "source_page": source.source_page,
            "available": availability[source.source_pdf],
        })
    for row in rows:
        row["sources"] = sources_by_period[(row["city_id"], row["month"])]
    return rows


@router.get("/newspapers/{filename}")
def open_newspaper(filename: str, db: Session = Depends(get_db)):
    source = db.query(CityMoodSource.source_pdf).filter(CityMoodSource.source_pdf == filename).first()
    path = newspaper_path(filename) if source else None
    if path is None:
        raise HTTPException(status_code=404, detail="Newspaper PDF not found")
    return FileResponse(path, media_type="application/pdf", filename=path.name, content_disposition_type="inline")


@router.get("/newspapers")
def list_newspapers(db: Session = Depends(get_db)):
    rows = (
        db.query(City.city_id, City.name_ru, CityMoodSource.source_pdf, CityMoodSource.source_page)
        .join(CityMoodSource, CityMoodSource.city_id == City.city_id)
        .order_by(City.name_ru, CityMoodSource.source_pdf, CityMoodSource.source_page)
        .all()
    )
    availability = {}
    catalog = {}
    for city_id, name, filename, page in rows:
        if filename not in availability:
            availability[filename] = newspaper_path(filename) is not None
        if not availability[filename]:
            continue
        city = catalog.setdefault(city_id, {"city_id": city_id, "name_ru": name, "sources": {}})
        city["sources"].setdefault(filename, {"source_pdf": filename, "source_page": page})
    return [{**city, "sources": list(city["sources"].values())} for city in catalog.values()]


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
