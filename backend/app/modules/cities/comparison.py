from collections import defaultdict
from itertools import pairwise
from typing import Literal

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.modules.cities.model import City
from app.modules.cities.mood_model import CityMoodRecord
from app.modules.cities.newspapers import Issue, IssueOut, issues
from app.modules.cities.schema import TimePeriodOut
from app.modules.cities.service import CITY_SCORING_VERSION, get_periods, weighted_mood
from app.modules.cities.source_model import CityMoodSource
from app.modules.moods.router import SCORING_VERSION
from app.modules.moods.service import get_map_points
from app.modules.regions.model import Region


class Observation(BaseModel):
    value: float
    count: int | None
    method: str
    unit: str
    sources: list[IssueOut] = Field(default_factory=list)


class ComparisonRow(BaseModel):
    id: str
    name: str
    a: Observation | None
    b: Observation | None
    delta: float | None = None
    status: Literal["comparable", "different_methods", "only_a", "only_b"]
    lat: float | None = None
    lon: float | None = None
    region_id: str | None = None


class Comparison(BaseModel):
    periods: list[TimePeriodOut]
    period_a: TimePeriodOut | None
    period_b: TimePeriodOut | None
    cities: list[ComparisonRow]
    regions: list[ComparisonRow]


METHODS = {
    "map_data": ("Газетные фрагменты · 1900", "фрагменты"),
    "articles": ("Газетные фрагменты · 1900", "фрагменты"),
    "draft_for_webdev": ("Газетные сводки · 1905", "строки"),
}


def city_method(row: CityMoodRecord) -> tuple[str, str]:
    return METHODS.get(row.source, (row.source, "наблюдения"))


def public_city_records(db: Session):
    return db.query(CityMoodRecord).filter(
        CityMoodRecord.is_public.is_(True), CityMoodRecord.scoring_version == CITY_SCORING_VERSION,
    )


def default_periods(db: Session, periods: list[TimePeriodOut]):
    coverage = defaultdict(set)
    for row in public_city_records(db):
        coverage[(row.year, row.month)].add((row.city_id, city_method(row)))
    for a, b in pairwise(periods):
        if coverage[a.year, a.month] & coverage[b.year, b.month]:
            return a, b
    annual = [period for period in periods if period.month is None]
    pool = annual if len(annual) >= 2 else periods
    return (pool[0], pool[1] if len(pool) >= 2 else pool[0]) if pool else (None, None)


def snapshot(db: Session, period: TimePeriodOut | None, cities: dict[str, City], newspapers: dict[str, Issue]):
    city_values: dict[str, Observation] = {}
    region_values: dict[str, Observation] = {}
    if period is None:
        return city_values, region_values
    if period.month is None:
        for point in get_map_points(db, period.year, SCORING_VERSION):
            region_values[point.region_id] = Observation(
                value=point.mood_index, count=point.responses_count, method="Годовые опросы", unit="ответы",
            )
        return city_values, region_values

    groups = defaultdict(list)
    links = defaultdict(list)
    for source in db.query(CityMoodSource).filter_by(year=period.year, month=period.month).order_by(
        CityMoodSource.source_pdf, CityMoodSource.source_page,
    ):
        links[source.city_id].append(newspapers[source.source_pdf].as_output(source.source_page))
    for row in public_city_records(db).filter_by(year=period.year, month=period.month):
        method, unit = city_method(row)
        observation = Observation(value=row.mood_index, count=row.n_lines, method=method, unit=unit,
                                  sources=links[row.city_id])
        city_values[row.city_id] = observation
        if (region_id := cities[row.city_id].region_id) is not None:
            groups[region_id].append(observation)
    for region_id, observations in groups.items():
        value, count = weighted_mood([(item.value, item.count or 0) for item in observations])
        method, unit = (observations[0].method, observations[0].unit)
        mixed = any((item.method, item.unit) != (method, unit) for item in observations)
        region_values[region_id] = Observation(
            value=value, count=None if mixed else count, method="Смешанные методики" if mixed else method,
            unit="" if mixed else unit,
        )
    return city_values, region_values


def comparison_row(id: str, name: str, a: Observation | None, b: Observation | None, **coordinates) -> ComparisonRow:
    if a is None:
        status = "only_b"
    elif b is None:
        status = "only_a"
    elif a.method != b.method or a.unit != b.unit or not a.unit:
        status = "different_methods"
    else:
        status = "comparable"
    return ComparisonRow(id=id, name=name, a=a, b=b, status=status,
                         delta=round(b.value - a.value, 2) if a and b and status == "comparable" else None,
                         **coordinates)


def compare_periods(db: Session, a: TimePeriodOut | None = None, b: TimePeriodOut | None = None) -> Comparison:
    periods = get_periods(db)
    if a is None or b is None:
        a, b = default_periods(db, periods)
    cities = {item.city_id: item for item in db.query(City).order_by(City.name_ru, City.city_id)}
    newspapers = issues(db)[1] if any(period and period.month is not None for period in (a, b)) else {}
    city_a, region_a = snapshot(db, a, cities, newspapers)
    city_b, region_b = snapshot(db, b, cities, newspapers)
    return Comparison(
        periods=periods, period_a=a, period_b=b,
        cities=[
            comparison_row(id, city.name_ru, city_a.get(id), city_b.get(id),
                           lat=city.lat, lon=city.lon, region_id=city.region_id)
            for id, city in cities.items() if id in city_a or id in city_b
        ],
        regions=[
            comparison_row(id, name, region_a.get(id), region_b.get(id))
            for id, name in db.query(Region.region_id, Region.name_ru).order_by(Region.name_ru)
            if id in region_a or id in region_b
        ],
    )
