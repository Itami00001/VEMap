"""Idempotent import of newspaper CSV moods (scoring_version 2.0).

Usage:
    python scripts/import_csv_moods.py [path/to.csv]
Default: data/examples/draft_for_webdev.csv (columns:
city, year, month, sentiment, sentiment_norm, n_lines).

Unknown city name -> error, nothing is imported silently.
"""
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.database import Base, SessionLocal, engine
from app.modules.cities.model import City
from app.modules.cities.mood_model import CityMoodRecord
from app.modules.regions.model import Region  # noqa: F401 (FK target metadata)

ROOT = Path(__file__).resolve().parents[2]
CSV_FILE = ROOT / "data" / "examples" / "draft_for_webdev.csv"

# Сырое имя (lower) -> каноника. См. docs/import-spec.md §4.
CANONICAL: dict[str, dict] = {
    "москва": {"city_id": "moskva", "name_ru": "Москва", "region_id": "RU-MOW", "country": "RU", "lat": 55.75, "lon": 37.62},
    "санкт-петербург": {"city_id": "spb", "name_ru": "Санкт-Петербург", "region_id": "RU-SPE", "country": "RU", "lat": 59.94, "lon": 30.31},
    "курск": {"city_id": "kursk", "name_ru": "Курск", "region_id": "RU-KRS", "country": "RU", "lat": 51.73, "lon": 36.19},
    "воронеж": {"city_id": "voronezh", "name_ru": "Воронеж", "region_id": "RU-VOR", "country": "RU", "lat": 51.67, "lon": 39.21},
    "саратов": {"city_id": "saratov", "name_ru": "Саратов", "region_id": "RU-SAR", "country": "RU", "lat": 51.53, "lon": 46.03},
    "ярославле": {"city_id": "yaroslavl", "name_ru": "Ярославль", "region_id": "RU-YAR", "country": "RU", "lat": 57.63, "lon": 39.87},
    "ярославль": {"city_id": "yaroslavl", "name_ru": "Ярославль", "region_id": "RU-YAR", "country": "RU", "lat": 57.63, "lon": 39.87},
    "кіев": {"city_id": "kyiv", "name_ru": "Киев", "region_id": None, "country": "UA", "lat": 50.45, "lon": 30.52},
    "киев": {"city_id": "kyiv", "name_ru": "Киев", "region_id": None, "country": "UA", "lat": 50.45, "lon": 30.52},
    "харьков": {"city_id": "kharkiv", "name_ru": "Харьков", "region_id": None, "country": "UA", "lat": 49.99, "lon": 36.23},
    "николаев": {"city_id": "mykolaiv", "name_ru": "Николаев", "region_id": None, "country": "UA", "lat": 46.97, "lon": 32.00},
}

SCORING_VERSION = "2.0"
SOURCE = "csv-1905"


def load(path: Path) -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        with open(path, encoding="utf-8-sig") as f:
            rows = list(csv.DictReader(f))
        cities = cities_new = records_new = 0
        for row in rows:
            raw = (row.get("city") or "").strip()
            canon = CANONICAL.get(raw.lower())
            if not canon:
                raise ValueError(f"Unknown city {raw!r}: mapping missing, import aborted")
            city = db.get(City, canon["city_id"])
            if not city:
                city = City(**canon)
                db.add(city)
                cities_new += 1
            mood = round(float(row["sentiment_norm"]) * 100, 2)
            year, month = int(row["year"]), int(row["month"])
            existing = (
                db.query(CityMoodRecord)
                .filter(
                    CityMoodRecord.city_id == canon["city_id"],
                    CityMoodRecord.year == year,
                    CityMoodRecord.month == month,
                    CityMoodRecord.scoring_version == SCORING_VERSION,
                )
                .first()
            )
            if existing:
                continue
            db.add(
                CityMoodRecord(
                    city_id=canon["city_id"],
                    year=year,
                    month=month,
                    mood_index=mood,
                    sentiment_raw=float(row["sentiment"]),
                    n_lines=int(row["n_lines"]),
                    scoring_version=SCORING_VERSION,
                    source=SOURCE,
                    is_public=True,
                )
            )
            records_new += 1
        db.commit()
        cities = db.query(City).count()
        records = db.query(CityMoodRecord).count()
        print(f"Cities in DB: {cities} (new: {cities_new}), records: {records} (new: {records_new})")
    finally:
        db.close()


if __name__ == "__main__":
    load(Path(sys.argv[1]) if len(sys.argv) > 1 else CSV_FILE)
