"""Validate and project the searchable archive export into VEMap's city periods."""

import csv
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import date
from hashlib import sha256
from pathlib import Path, PurePosixPath
from statistics import mean

MONTH_NAMES = (
    "янв", "фев", "мар", "апр", "ма", "июн", "июл", "авг", "сен", "окт", "ноя", "дек",
)
ORTHOGRAPHY = str.maketrans("ѣіѳѵё–—‑", "еифие---")
CITY_ALIASES = {
    "петербург": "санкт-петербург",
    "петроград": "санкт-петербург",
    "константинополь": "стамбул",
}


def read_rows(path):
    with path.open(encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))


def document_key(filename):
    return unicodedata.normalize("NFC", PurePosixPath(filename).stem).casefold().removesuffix("_searchable")


def place_name(name):
    key = unicodedata.normalize("NFC", name).casefold().translate(ORTHOGRAPHY)
    key = re.sub(r"ъ\b", "", key).strip()
    return CITY_ALIASES.get(key, key)


def optional_month(value):
    if not value:
        return 0
    number = float(value)
    if not number.is_integer() or not 1 <= number <= 12:
        raise ValueError(f"Invalid month: {value!r}")
    return int(number)


def corrected_period(row, legacy_dates):
    source = row["source"]
    filename = PurePosixPath(source).stem.casefold()
    supplied_year = int(row["year"])
    explicit = re.search(r"(?<!\d)((?:18|19|20)\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?([0-3]\d)(?!\d)", filename)
    named_year = re.search(r"(?<!\d)((?:18|19|20)\d{2})(?!\d)", filename)
    folder_year = re.search(r"/((?:18|19|20)\d{2})\s*год(?:\s|/)", source)
    if explicit:
        try:
            exact = date(*map(int, explicit.groups()))
            return exact.year, exact.month
        except ValueError:
            pass
    year = int((named_year or folder_year)[1]) if named_year or folder_year else supplied_year
    if not 1800 <= year <= 2099:
        raise ValueError(f"No reliable publication year for {source!r}")
    spaced = re.sub(r"[_-]", " ", filename)
    day = r"(?:0?[1-9]|[12]\d|3[01])"
    month = 0
    for number, prefix in enumerate(MONTH_NAMES, 1):
        word = r"(?:мая|май|маѧ)" if number == 5 else prefix + r"[а-яё]*"
        if re.search(rf"(?<!\d){day}[.\s]+{word}\b|\b{word}[.\s]+{day}(?!\d)", spaced):
            month = number
            break
    if not month and year == supplied_year:
        month = optional_month(row["month"])
    legacy = legacy_dates.get(document_key(source), set())
    if not month and len(legacy) == 1:
        old_year, old_month = next(iter(legacy))
        if old_year == year:
            month = old_month
    return year, month


def load_corpus(root):
    rows = read_rows(root / "site_data.csv")
    articles = read_rows(root / "articles.csv")
    summary = read_rows(root / "map_data.csv")
    if not rows or len({row["article_id"] for row in rows}) != len(rows):
        raise ValueError("Archive has empty or duplicate articles")
    from_site = Counter()
    pdf_folder = root / "pdf"
    pdfs = {path.name for path in pdf_folder.iterdir() if path.is_file() and path.suffix.lower() == ".pdf"}
    for row in rows:
        path = PurePosixPath(row["pdf_path"])
        score = float(row["sentiment_score"])
        page = int(row["page"])
        if path.parts != ("pdf", path.name) or path.name not in pdfs or page < 1:
            raise ValueError(f"Missing archive source {path}, page {page}")
        if row["sentiment_status"] != "ok" or not -1 <= score <= 1:
            raise ValueError(f"Invalid score for {row['article_id']}")
        from_site[(row["city"], int(row["year"]), path.name, page, score)] += 1
    if from_site != Counter(
        (row["city"], int(row["year"]), row["source_file"], int(row["page"]), float(row["score"]))
        for row in articles
    ):
        raise ValueError("The site and article exports contain different observations")
    grouped = defaultdict(list)
    for row in articles:
        grouped[row["city"], int(row["year"]), optional_month(row["month"])].append(float(row["score"]))
    from_map = {(row["city"], int(row["year"]), optional_month(row["month"])): row for row in summary}
    if len(from_map) != len(summary) or from_map.keys() != grouped.keys() or any(
        int(from_map[key]["n"]) != len(scores) or abs(mean(scores) - float(from_map[key]["score_mean"])) > 0.000501
        for key, scores in grouped.items()
    ):
        raise ValueError("Map summaries do not match the article export")
    return rows


def regional_lookup(path):
    import json

    features = json.loads(Path(path).read_text(encoding="utf-8-sig"))["features"]
    polygons = []
    for feature in features:
        geometry = feature["geometry"]
        parts = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
        for rings in parts:
            xs, ys = zip(*[(point[0], point[1]) for point in rings[0]])
            polygons.append((min(xs), min(ys), max(xs), max(ys), rings, feature["properties"]["region_id"]))

    def inside(x, y, ring):
        result = False
        first = ring[-1]
        for second in ring:
            x1, y1 = first[:2]
            x2, y2 = second[:2]
            if (y1 > y) != (y2 > y) and x < x1 + (x2 - x1) * (y - y1) / (y2 - y1):
                result = not result
            first = second
        return result

    def lookup(x, y):
        for x1, y1, x2, y2, rings, region in polygons:
            if x1 <= x <= x2 and y1 <= y <= y2 and inside(x, y, rings[0]) and not any(
                inside(x, y, hole) for hole in rings[1:]
            ):
                return region
        return None

    return lookup


def merge_corpus(rows, cities, moods, sources, legacy, canonical, region_at):
    available = {place_name(city["name_ru"]): city for city in cities.values()}
    available.update({place_name(name): city for name, city in canonical.items()})
    geo = defaultdict(Counter)
    for row in rows:
        if row["lat"] and row["lon"]:
            lat, lon = float(row["lat"]), float(row["lon"])
            if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                raise ValueError(f"Invalid coordinates for {row['city']!r}")
            geo[place_name(row["city"])][(lat, lon)] += 1

    legacy_dates = defaultdict(set)
    for row in legacy:
        old_pdf = row.get("source_pdf") or row.get("source_file")
        if old_pdf:
            legacy_dates[document_key(old_pdf)].add((int(row["year"]), int(row["month"])))
    by_period = {(mood["city_id"], mood["year"], mood["month"]): mood for mood in moods}
    sources_by_period = defaultdict(set)
    for source in sources:
        key = source["city_id"], source["year"], source["month"]
        sources_by_period[key].add((source["source_pdf"], source["source_page"]))
    grouped = defaultdict(list)
    corrections = 0
    missing_geo = 0
    for row in rows:
        year, month = corrected_period(row, legacy_dates)
        corrections += year != int(row["year"])
        name = place_name(row["city"])
        city = available.get(name)
        if city is None:
            if not geo[name]:
                missing_geo += 1
                continue
            (lat, lon), _ = geo[name].most_common(1)[0]
            region = region_at(lon, lat)
            city = {"city_id": "csv-" + sha256(name.encode()).hexdigest()[:32], "name_ru": row["city"],
                    "region_id": region, "country": "RU" if region else "ZZ", "lat": lat, "lon": lon}
            available[name] = city
        city_id = city["city_id"]
        cities.setdefault(city_id, city)
        data = float(row["sentiment_score"]), PurePosixPath(row["pdf_path"]).name, int(row["page"])
        grouped[city_id, year, 0].append(data)
        if month:
            grouped[city_id, year, month].append(data)
    for key, observations in grouped.items():
        old = by_period.get(key)
        if old and old["source"] == "draft_for_webdev":
            continue
        city_id, year, month = key
        score = mean(row[0] for row in observations)
        count = len(observations)
        source = "archive_fragments"
        if old and old["n_lines"]:
            old_count = old["n_lines"]
            score = (score * count + old["sentiment_raw"] * old_count) / (count + old_count)
            count += old_count
            source = "archive_merged"
        by_period[key] = {"city_id": city_id, "year": year, "month": month, "source": source, "is_public": True,
                          "mood_index": round((score + 1) * 50, 2), "sentiment_raw": score, "n_lines": count,
                          "scoring_version": "2.0"}
        sources_by_period[key].update((filename, page) for _, filename, page in observations)
    print(f"Archive: {len(rows)} articles, {len(grouped)} city periods, {missing_geo} articles without a known location, "
          f"{corrections} year corrections")
    return cities, list(by_period.values()), [
        {"city_id": city_id, "year": year, "month": month, "source_pdf": filename, "source_page": page}
        for (city_id, year, month), values in sources_by_period.items() for filename, page in sorted(values)
    ]
