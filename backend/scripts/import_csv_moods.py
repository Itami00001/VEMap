"""Idempotent import of newspaper CSV moods (scoring_version 2.0).

Usage:
    python scripts/import_csv_moods.py [path/to.csv ...] [path/to/dir ...]
Default: data/examples/ directory (all *.csv, sorted; README files skipped).

File quirks handled: leading '# ...' comment lines are ignored;
files without a header row get the canonical column order.
Columns: city, year, month, sentiment, sentiment_norm, n_lines.

Empty sentiment_norm -> temporary norm (sentiment + 1) / 2
(see data/examples/test-data-README.md §4).
Existing city/year/month/version rows are skipped (unique index).

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
EXAMPLES_DIR = ROOT / "data" / "examples"
CSV_FILE = EXAMPLES_DIR / "draft_for_webdev.csv"
TEST_FILE = EXAMPLES_DIR / "test-data.csv"
DEFAULT_FILES = [CSV_FILE, TEST_FILE]

COLUMNS = ["city", "year", "month", "sentiment", "sentiment_norm", "n_lines"]


def resolve_paths(args: list[str]) -> list[Path]:
    """Argv paths (files or dirs) -> sorted *.csv files, README skipped."""
    if not args:
        return [p for p in DEFAULT_FILES if p.exists()]
    out: list[Path] = []
    for a in args:
        p = Path(a)
        if p.is_dir():
            for f in sorted(p.glob("*.csv")):
                if "readme" in f.name.lower():
                    print(f"Skip README-like file: {f.name}")
                    continue
                out.append(f)
        elif p.exists():
            out.append(p)
        else:
            print(f"Skip missing path: {p}")
    return out


def read_rows(path: Path) -> list[dict]:
    """Read CSV skipping '#' comments; header optional (canonical order fallback)."""
    with open(path, encoding="utf-8-sig") as f:
        lines = [ln for ln in f.read().splitlines() if ln.strip() and not ln.lstrip().startswith("#")]
    if not lines:
        return []
    if [c.strip() for c in lines[0].split(",")] == COLUMNS:
        return list(csv.DictReader(lines))
    return list(csv.DictReader(lines, fieldnames=COLUMNS))

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
    "симферополь": {"city_id": "simferopol", "name_ru": "Симферополь", "region_id": "RU-CR", "country": "RU", "lat": 44.95, "lon": 34.10},
    "ялта": {"city_id": "yalta", "name_ru": "Ялта", "region_id": "RU-CR", "country": "RU", "lat": 44.50, "lon": 34.17},
    "керчь": {"city_id": "kerch", "name_ru": "Керчь", "region_id": "RU-CR", "country": "RU", "lat": 45.36, "lon": 36.47},
    "евпатория": {"city_id": "evpatoria", "name_ru": "Евпатория", "region_id": "RU-CR", "country": "RU", "lat": 45.20, "lon": 33.37},
    "белогорск": {"city_id": "belogorsk", "name_ru": "Белогорск", "region_id": "RU-CR", "country": "RU", "lat": 45.05, "lon": 34.60},
}

SCORING_VERSION = "2.0"
SOURCE = "csv-1905"


def load(path: Path) -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        rows = read_rows(path)
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
                db.flush()  # SessionLocal(autoflush=False): иначе повторный db.get не увидит pending-строку
                cities_new += 1
            raw_norm = (row.get("sentiment_norm") or "").strip()
            if raw_norm:
                norm = float(raw_norm)
            else:
                # temporary norm, до подтверждения формулы
                norm = (float(row["sentiment"]) + 1) / 2
            mood = round(norm * 100, 2)
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
    for p in resolve_paths(sys.argv[1:]):
        print(f"Importing {p} ...")
        load(p)
