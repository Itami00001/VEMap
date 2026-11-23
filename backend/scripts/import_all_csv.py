"""Import historical city moods from the three source CSVs."""

import csv
import sys
from collections import defaultdict
from hashlib import sha256
from pathlib import Path
from statistics import mean

from sqlalchemy import delete, tuple_
from sqlalchemy.dialects.postgresql import insert

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.database import Base, SessionLocal, engine
from app.modules.cities.model import City
from app.modules.cities.mood_model import CityMoodRecord
from app.modules.cities.source_model import CityMoodSource
from import_csv_moods import CANONICAL, SCORING_VERSION
from newspaper_corpus import document_key, load_corpus, merge_corpus, regional_lookup

EXAMPLES_DIR = Path(__file__).resolve().parents[2] / "data" / "examples"
ALIASES = {"петербургъ": "санкт-петербург", "саратовъ": "саратов"}
RUSSIAN_REGIONS = {
    "владивостокъ": "RU-PRI",
    "казань": "RU-TA",
    "николаевскъ": "RU-KHA",
    "новгородъ": "RU-NGR",
    "орелъ": "RU-ORL",
    "смоленскъ": "RU-SMO",
    "хабаровскъ": "RU-KHA",
}


def read_csv(filename):
    with (EXAMPLES_DIR / filename).open(encoding="utf-8-sig", newline="") as source:
        yield from csv.DictReader(source)


def place_key(row):
    name = row["city"].strip().casefold()
    return ALIASES.get(name, name)


def period_key(row):
    return place_key(row), int(row["year"]), int(row["month"])


def collect_data(superseded=()):
    places = {}
    articles = defaultdict(list)
    article_sources = defaultdict(set)
    summaries = {}
    replaced = set()

    def remember_place(row):
        name = place_key(row)
        if row["lat"] and row["lon"]:
            region_id = RUSSIAN_REGIONS.get(name)
            places[name] = {
                "city_id": "csv-" + sha256(name.encode()).hexdigest()[:32],
                "name_ru": row["city"].strip(),
                "region_id": region_id,
                "country": "RU" if region_id else "UA" if name in {"одесса", "полтава"} else "ZZ",
                "lat": float(row["lat"]),
                "lon": float(row["lon"]),
            }

    for row in read_csv("articles.csv"):
        remember_place(row)
        key = period_key(row)
        filename = (row.get("source_pdf") or row.get("source_file") or "").strip()
        if document_key(filename) in superseded:
            replaced.add(key)
            continue
        articles[key].append(float(row["score"]))
        page_text = (row.get("source_page") or row.get("page") or "").strip()
        if filename and page_text:
            page = int(page_text)
            if page > 0:
                article_sources[key].add((filename, page))

    # Use article scores where a city-month has no precomputed summary.
    for key, scores in articles.items():
        score = mean(scores)
        summaries[key] = score, (score + 1) / 2, len(scores), "articles"

    for row in read_csv("map_data.csv"):
        remember_place(row)
        if period_key(row) in replaced:
            continue
        score = float(row["score_mean"])
        summaries[period_key(row)] = score, (score + 1) / 2, int(row["n"]), "map_data"

    for row in read_csv("draft_for_webdev.csv"):
        summaries[period_key(row)] = (
            float(row["sentiment"]),
            float(row["sentiment_norm"]),
            int(row["n_lines"]),
            "draft_for_webdev",
        )

    cities = {
        city["city_id"]: city
        for city in CANONICAL.values()
        if city["region_id"] == "RU-CR"
    }
    moods = []
    sources = []
    for (name, year, month), (score, norm, count, source) in sorted(summaries.items()):
        city = CANONICAL.get(name) or places.get(name)
        if city is None:
            # The current cities schema requires coordinates.
            print(f"Skipping {name}, {year}-{month:02}: no coordinates", file=sys.stderr)
            continue
        city_id = city["city_id"]
        cities[city_id] = city
        for filename, page in sorted(article_sources.get((name, year, month), ())):
            sources.append({
                "city_id": city_id, "year": year, "month": month,
                "source_pdf": filename, "source_page": page,
            })
        moods.append(
            {
                "city_id": city_id,
                "year": year,
                "month": month,
                "mood_index": round(norm * 100, 2),
                "sentiment_raw": score,
                "n_lines": count,
                "scoring_version": SCORING_VERSION,
                "source": source,
                "is_public": True,
            }
        )
    return cities, moods, sources


def main():
    baseline = collect_data()
    archive_dir = EXAMPLES_DIR / "newspaper_archive"
    cities, moods, sources = baseline
    if (archive_dir / "site_data.csv").is_file():
        corpus = load_corpus(archive_dir)
        superseded = {document_key(row["source"]) for row in corpus}
        cities, moods, sources = merge_corpus(
            corpus, *collect_data(superseded), list(read_csv("articles.csv")), CANONICAL,
            regional_lookup(EXAMPLES_DIR.parent / "geo" / "russia-regions.geojson"),
        )
    if not moods:
        raise ValueError("No city moods found in the source CSVs")

    Base.metadata.create_all(bind=engine, tables=[
        City.__table__, CityMoodRecord.__table__, CityMoodSource.__table__,
    ])
    with SessionLocal.begin() as db:
        expected = {(mood["city_id"], mood["year"], mood["month"]) for mood in moods}
        old_keys = {(mood["city_id"], mood["year"], mood["month"]) for mood in baseline[1]}
        obsolete = old_keys - expected
        if obsolete:
            db.execute(delete(CityMoodRecord).where(
                tuple_(CityMoodRecord.city_id, CityMoodRecord.year, CityMoodRecord.month).in_(obsolete),
                CityMoodRecord.scoring_version == SCORING_VERSION,
                CityMoodRecord.source.in_(("articles", "map_data", "archive_fragments", "archive_merged")),
            ))
        db.execute(
            insert(City).values(list(cities.values())).on_conflict_do_nothing(
                index_elements=["city_id"]
            )
        )
        statement = insert(CityMoodRecord).values(moods)
        db.execute(
            statement.on_conflict_do_update(
                constraint="uq_city_mood_city_year_month_version",
                set_={
                    field: statement.excluded[field]
                    for field in ("mood_index", "sentiment_raw", "n_lines", "source", "is_public")
                },
            )
        )
        db.execute(delete(CityMoodSource).where(
            tuple_(CityMoodSource.city_id, CityMoodSource.year, CityMoodSource.month).in_(
                expected | old_keys
            )
        ))
        if sources:
            db.execute(insert(CityMoodSource), sources)
    print(f"Imported {len(moods)} city-period records for {len(cities)} cities")
    print(f"Linked {len(sources)} PDF pages to city-period records")


if __name__ == "__main__":
    main()
