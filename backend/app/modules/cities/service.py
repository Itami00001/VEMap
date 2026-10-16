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


def get_periods(db: Session) -> list[TimePeriodOut]:
    """Все существующие периоды: помесячные городские + годовые опросные."""
    rows = (
        db.query(CityMoodRecord.year, CityMoodRecord.month)
        .filter(CityMoodRecord.is_public.is_(True))
        .distinct()
        .order_by(CityMoodRecord.year, CityMoodRecord.month)
        .all()
    )
    out = [TimePeriodOut(year=y, month=m) for y, m in rows]
    for y in mood_service.get_available_years(db, SCORING_VERSION):
        out.append(TimePeriodOut(year=y, month=None))
    out.sort(key=lambda p: (p.year, p.month if p.month is not None else 0))
    return out


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
        total_w = sum(w for _, w in weighted)
        if total_w > 0:
            mood = sum(m * w for m, w in weighted) / total_w
        else:
            mood = sum(m for m, _ in weighted) / len(weighted)
        out.append(
            MapPointOut(
                region_id=region_id,
                mood_index=round(mood, 2),
                responses_count=sum(w for _, w in weighted),
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


def get_city_compare_rows(
    db: Session, year_a: int, year_b: int, month_a: int | None, month_b: int | None
) -> list[dict]:
    """Сравнение двух периодов по городам."""
    a = get_city_moods(db, year_a, month_a)
    b = get_city_moods(db, year_b, month_b)
    a_map = {c["city_id"]: c for c in a}
    b_map = {c["city_id"]: c for c in b}
    all_ids = set(a_map) | set(b_map)
    out = []
    for cid in all_ids:
        ca = a_map.get(cid)
        cb = b_map.get(cid)
        mood_a = ca["mood_index"] if ca else None
        mood_b = cb["mood_index"] if cb else None
        delta = round(mood_b - mood_a, 2) if mood_a is not None and mood_b is not None else None
        ref = ca or cb
        out.append(
            {
                "city_id": cid,
                "name_ru": ref["name_ru"] if ref else "",
                "region_id": ref["region_id"] if ref else None,
                "mood_a": mood_a,
                "mood_b": mood_b,
                "delta": delta,
            }
        )
    return out
