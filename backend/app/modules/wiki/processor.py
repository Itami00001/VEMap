import asyncio
import csv
import json
import logging
import os
import sys
import math
import subprocess
import tempfile
from pathlib import Path

from sqlalchemy import select

from app.config import settings
from app.db.database import SessionLocal
from app.modules.cities.model import City
from app.modules.wiki.models import WikiArticle
from app.modules.wiki.service import storage_path

logger = logging.getLogger(__name__)
MAX_CSV_BYTES = 4 * 1024 * 1024
MAX_POINTS = 5000


def read_points(csv_path: Path, file_count: int) -> list[dict]:
    if csv_path.stat().st_size > MAX_CSV_BYTES:
        raise ValueError("CSV exceeds maximum size")
    points = []
    with csv_path.open(encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        if not reader.fieldnames or not {"lat", "lon"}.issubset(reader.fieldnames):
            raise ValueError("CSV must contain lat and lon")
        for row in reader:
            lat, lon = float(row.get("lat") or ""), float(row.get("lon") or "")
            if not math.isfinite(lat) or not math.isfinite(lon) or not (-85 <= lat <= 85 and -180 <= lon <= 180):
                raise ValueError("Coordinate outside map bounds")
            mood = float(row["mood_index"]) if row.get("mood_index") else None
            if mood is not None and not (0 <= mood <= 100):
                raise ValueError("Invalid mood index")
            index = int(row["file_index"]) if row.get("file_index") else None
            page = int(row["page"]) if row.get("page") else None
            if index is not None and not 0 <= index < file_count:
                raise ValueError("Invalid PDF index")
            if page is not None and (index is None or not 1 <= page <= 10000):
                raise ValueError("Page requires a PDF index")
            points.append({
                "name": (row.get("name") or "").strip()[:180],
                "lat": lat, "lon": lon, "mood_index": mood, "file_index": index, "page": page,
            })
            if len(points) > MAX_POINTS:
                raise ValueError("CSV contains too many points")
    return points


def build_command(command: list[str], directory: Path) -> list[str]:
    if command:
        return command
    catalogue = directory / "catalogue.json"
    with SessionLocal() as db:
        cities = db.execute(select(City.city_id, City.name_ru, City.lat, City.lon)).all()
    catalogue.write_text(json.dumps([
        {"id": city_id, "name": name, "lat": lat, "lon": lon}
        for city_id, name, lat, lon in cities
        if math.isfinite(lat) and math.isfinite(lon) and -85 <= lat <= 85 and -180 <= lon <= 180
    ], ensure_ascii=False), encoding="utf-8")
    return [sys.executable, "-m", "app.modules.wiki.newspaper_map", "--catalogue", str(catalogue),
            "--ocr-command", json.dumps(settings.WIKI_OCR_COMMAND)]


def process_one(command: list[str]) -> bool:
    with SessionLocal.begin() as db:
        article = db.scalar(
            select(WikiArticle).where(WikiArticle.status == "approved", WikiArticle.processing.in_(("queued", "waiting")))
            .order_by(WikiArticle.published_at, WikiArticle.id).limit(1).with_for_update(skip_locked=True)
        )
        if article is None:
            return False
        article_id, file_count = article.id, len(article.files)
        article.processing = "running"

    try:
        folder = storage_path(article_id)
        files = [str(folder / f"{index}.pdf") for index in range(file_count)]
        with tempfile.TemporaryDirectory(prefix="vemap-wiki-") as temporary:
            directory = Path(temporary)
            result_path = directory / "points.csv"
            process = build_command(command, directory)
            environment = {key: os.environ[key] for key in ("PATH", "LANG", "LC_ALL", "SystemRoot", "SYSTEMROOT",
                           "TEMP", "TMP", "TESSDATA_PREFIX", "HOME") if key in os.environ}
            subprocess.run(
                [*process, "--output", str(result_path), *[arg for file in files for arg in ("--input", file)]],
                stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                timeout=settings.WIKI_PROCESSOR_TIMEOUT, check=True, env=environment,
            )
            points = read_points(result_path, file_count)
        finish(article_id, "ready", points)
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        logger.warning("Wiki processing failed for %s: %s", article_id, type(exc).__name__)
        finish(article_id, "failed", [])
    return True


def finish(article_id: str, status: str, points: list[dict]) -> None:
    with SessionLocal.begin() as db:
        article = db.get(WikiArticle, article_id, with_for_update=True)
        if article and article.status == "approved" and article.processing == "running":
            article.processing = status
            article.points = points


async def processing_loop() -> None:
    while True:
        try:
            if await asyncio.to_thread(process_one, settings.WIKI_PROCESSOR):
                continue
        except Exception as exc:
            logger.warning("Wiki processor unavailable: %s", type(exc).__name__)
        await asyncio.sleep(5)
