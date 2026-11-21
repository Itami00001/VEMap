import argparse
import csv
import json
import os
import re
import shutil
import subprocess
import tempfile
import unicodedata
from collections import defaultdict
from pathlib import Path

from pypdf import PdfReader

FIELDS = ("name", "lat", "lon", "mood_index", "file_index", "page")
MAX_PAGES = 32
TESSDATA = Path("/usr/local/share/vemap/ocr")
ORTHOGRAPHY = str.maketrans("ѣѢіІѳѲѵѴёЁ‑–—", "еЕиИфФиИеЕ---")
ALIASES = {
    "москва": ("Москве", "Москву", "Москвы", "Москвой"),
    "санкт-петербург": ("Петербург", "Петербурге", "Петербурга", "Санкт-Петербурге", "Санкт-Петербурга"),
    "варшава": ("Варшаве", "Варшаву", "Варшавы", "Варшавой"),
    "киев": ("Киеве", "Киева", "Киеву", "Киевом"),
    "одесса": ("Одессе", "Одессу", "Одессы", "Одессой"),
    "париж": ("Париже", "Парижа", "Парижу", "Парижем"),
    "лондон": ("Лондоне", "Лондона", "Лондону", "Лондоном"),
    "берлин": ("Берлине", "Берлина", "Берлину", "Берлином"),
    "харьков": ("Харькове", "Харькова", "Харькову"),
    "курск": ("Курске", "Курска", "Курску"),
    "воронеж": ("Воронеже", "Воронежа", "Воронежу"),
    "севастополь": ("Севастополе", "Севастополя", "Севастополю"),
    "симферополь": ("Симферополе", "Симферополя", "Симферополю"),
}


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFC", text).translate(ORTHOGRAPHY)
    text = re.sub(r"(?<=\w)-[ \t]*\n[ \t]*(?=\w)", "", text)
    text = re.sub(r"(?<=[бвгджзклмнпрстфхцчшщБВГДЖЗКЛМНПРСТФХЦЧШЩ])[Ъъ]\b", "", text)
    return re.sub(r"\s+", " ", text).strip()


def city_index(cities: list[dict]) -> tuple[re.Pattern, dict]:
    by_name = defaultdict(dict)
    for city in cities:
        name = normalize(city["name"]).casefold()
        if not name:
            continue
        for alias in (name, *ALIASES.get(name, ())):
            by_name[normalize(alias).casefold()][city["id"]] = city
    unique = {name: next(iter(rows.values())) for name, rows in by_name.items() if len(rows) == 1}
    alternatives = "|".join(re.escape(name) for name in sorted(unique, key=len, reverse=True))
    pattern = re.compile(r"(?<![\w-])(?:" + alternatives + r")(?![\w-])" if alternatives else r"(?!)", re.IGNORECASE)
    return pattern, unique


def find_points(pages: list[str], cities: tuple[re.Pattern, dict], file_index: int):
    pattern, by_name = cities
    seen = set()
    for page, text in enumerate(pages, 1):
        for match in pattern.finditer(normalize(text)):
            if not match.group()[0].isupper():
                continue
            city = by_name.get(match.group().casefold())
            if city is None or city["id"] in seen:
                continue
            seen.add(city["id"])
            yield {
                "name": city["name"], "lat": city["lat"], "lon": city["lon"],
                "mood_index": None, "file_index": file_index, "page": page,
            }


def usable(text: str) -> bool:
    letters = sum(letter.isalpha() for letter in text)
    return letters >= 16 and letters >= len(text) * 0.35


def local_ocr(path: Path, page: int, scratch: Path) -> str:
    if not shutil.which("pdftoppm") or not shutil.which("tesseract") or not (TESSDATA / "orus.traineddata").is_file():
        raise RuntimeError("Tesseract orus and pdftoppm are required for scans")
    image = scratch / "page"
    subprocess.run(
        ["pdftoppm", "-f", str(page), "-l", str(page), "-scale-to", "3600", "-gray", "-singlefile",
         "-png", str(path), str(image)],
        check=True, timeout=20, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    result = subprocess.run(
        ["tesseract", str(image.with_suffix(".png")), "stdout", "--tessdata-dir", str(TESSDATA),
         "-l", "orus", "--psm", "3"],
        check=True, timeout=35, capture_output=True, text=True, encoding="utf-8",
        env={**os.environ, "OMP_THREAD_LIMIT": "1"},
    )
    return result.stdout


def extract_pages(path: Path, remaining: int, scratch: Path, ocr_command: list[str]) -> list[str]:
    reader = PdfReader(path)
    if reader.is_encrypted:
        raise ValueError("Encrypted PDF")
    count = len(reader.pages)
    if count < 1 or count > remaining:
        raise ValueError(f"An article accepts at most {MAX_PAGES} PDF pages in total")
    pages = [page.extract_text() or "" for page in reader.pages]
    if all(map(usable, pages)):
        return pages
    if ocr_command:
        searchable = scratch / "searchable.pdf"
        subprocess.run([*ocr_command, str(path), str(searchable)], check=True, timeout=1000,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        corrected = PdfReader(searchable)
        if len(corrected.pages) != count:
            raise ValueError("OCR changed article pagination")
        return [page.extract_text() or "" for page in corrected.pages]
    return [text if usable(text) else local_ocr(path, index, scratch) for index, text in enumerate(pages, 1)]


def main() -> None:
    if os.name == "posix":
        import resource

        memory = 768 * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_AS, (memory, memory))
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", action="append", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--catalogue", type=Path, required=True)
    parser.add_argument("--ocr-command", default="[]", type=json.loads)
    args = parser.parse_args()
    cities = city_index(json.loads(args.catalogue.read_text(encoding="utf-8")))
    remaining = MAX_PAGES
    points = []
    for index, path in enumerate(args.input):
        with tempfile.TemporaryDirectory(dir=args.output.parent) as temporary:
            pages = extract_pages(path.resolve(), remaining, Path(temporary), args.ocr_command)
        remaining -= len(pages)
        points.extend(find_points(pages, cities, index))
    with args.output.open("x", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(points)


if __name__ == "__main__":
    main()
