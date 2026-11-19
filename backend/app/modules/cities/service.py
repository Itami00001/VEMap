from sqlalchemy.orm import Session

from app.modules.cities import model as _city_model  # noqa: F401 (metadata)
from app.modules.cities import mood_model as _mood_model  # noqa: F401 (metadata)
from app.modules.cities.model import City
from app.modules.cities.mood_model import CityMoodRecord
from app.modules.cities.schema import TimePeriodOut
from app.modules.moods import service as mood_service
from app.modules.moods.router import SCORING_VERSION
from app.modules.moods.schema import MapPointOut
from app.modules.regions.model import Region

CITY_SCORING_VERSION = "2.0"
CITY_SOURCE = "cities:2.0"
MONTHLY_CALENDAR = {1900: range(1, 13)}


def weighted_mood(values: list[tuple[float, int]]) -> tuple[float, int]:
    total = sum(count for _, count in values)
    if total > 0:
        return round(sum(value * count for value, count in values) / total, 2), total
    return round(sum(value for value, _ in values) / len(values), 2), total


def get_periods(db: Session) -> list[TimePeriodOut]:
    """Периоды наблюдений и месяцы из календаря исторического корпуса."""
    rows = (
        db.query(CityMoodRecord.year, CityMoodRecord.month)
        .filter(CityMoodRecord.is_public.is_(True))
        .distinct()
        .order_by(CityMoodRecord.year, CityMoodRecord.month)
        .all()
    )
    periods = {(year, month) for year, month in rows}
    periods.update((year, month) for year, months in MONTHLY_CALENDAR.items() for month in months)
    periods.update((year, None) for year in mood_service.get_available_years(db, SCORING_VERSION))
    return [
        TimePeriodOut(year=year, month=month)
        for year, month in sorted(periods, key=lambda period: (period[0], period[1] or 0))
    ]


def get_region_aggregates(db: Session, year: int, month: int) -> list[MapPointOut]:
    """Агрегат городов в регионы: взвешенное по n_lines среднее.

    Города без region_id (вне РФ) не включаются.
    """
    rows = (
        db.query(CityMoodRecord, City.region_id)
        .join(City, City.city_id == CityMoodRecord.city_id)
        .filter(
            CityMoodRecord.year == year,
            CityMoodRecord.month == month,
            CityMoodRecord.is_public.is_(True),
            City.region_id.is_not(None),
        )
        .all()
    )
    by_region: dict[str, list[CityMoodRecord]] = {}
    for rec, region_id in rows:
        by_region.setdefault(region_id, []).append(rec)
    out: list[MapPointOut] = []
    for region_id, recs in sorted(by_region.items()):
        weighted = [(r.mood_index, r.n_lines or 0) for r in recs]
        mood, count = weighted_mood(weighted)
        out.append(
            MapPointOut(
                region_id=region_id,
                mood_index=mood,
                responses_count=count,
                source=CITY_SOURCE,
            )
        )
    return out


def get_city_moods(db: Session, year: int, month: int | None) -> list[dict]:
    """Городские настроения за период. Только is_public=True."""
    query = (
        db.query(CityMoodRecord, City.name_ru, City.region_id, City.country)
        .join(City, City.city_id == CityMoodRecord.city_id)
        .filter(CityMoodRecord.year == year, CityMoodRecord.is_public.is_(True))
    )
    if month is not None:
        query = query.filter(CityMoodRecord.month == month)
    rows = query.all()
    return [
        {
            "city_id": rec.city_id,
            "month": rec.month,
            "name_ru": name_ru,
            "region_id": region_id,
            "country": country,
            "mood_index": rec.mood_index,
            "responses_count": rec.n_lines or 0,
        }
        for rec, name_ru, region_id, country in rows
    ]


def get_city_history(db: Session, city_id: str) -> list[dict]:
    """История города по всем периодам. Только is_public=True."""
    rows = (
        db.query(CityMoodRecord)
        .filter(CityMoodRecord.city_id == city_id, CityMoodRecord.is_public.is_(True))
        .order_by(CityMoodRecord.year, CityMoodRecord.month)
        .all()
    )
    return [
        {"year": r.year, "month": r.month, "mood_index": r.mood_index}
        for r in rows
    ]


def get_city_data_rows(db: Session, year: int, month: int | None) -> list[dict]:
    """Таблица ВСЕХ городов за период; без записей — null (прочерк).

    change_from_prev — к предыдущему месяцу (или году, если месяц 1/None).
    """
    current = {c["city_id"]: c for c in get_city_moods(db, year, month)}
    prev_month = month - 1 if month and month > 1 else None
    prev_year = year if prev_month is not None else year - 1
    prev = {p["city_id"]: p["mood_index"] for p in get_city_moods(db, prev_year, prev_month)}

    cities = db.query(City).order_by(City.name_ru).all()
    region_names = {r.region_id: r.name_ru for r in db.query(Region).all()}

    out = []
    for city in cities:
        cur = current.get(city.city_id)
        mood = cur["mood_index"] if cur else None
        prev_mood = prev.get(city.city_id)
        change = round(mood - prev_mood, 2) if mood is not None and prev_mood is not None else None
        if city.region_id is None:
            region_name = "Украина" if city.country == "UA" else (city.country or "")
        else:
            region_name = region_names.get(city.region_id, "")
        out.append(
            {
                "city_id": city.city_id,
                "name_ru": city.name_ru,
                "region_id": city.region_id,
                "region_name": region_name,
                "mood_index": mood,
                "responses_count": cur["responses_count"] if cur else None,
                "change_from_prev": change,
            }
        )
    return out
