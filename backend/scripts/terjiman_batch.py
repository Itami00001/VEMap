"""Recognize the Terjiman archive on a CPU and export one CSV row per page."""

import argparse
import csv
import hashlib
import json
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from pypdf import PdfReader

from app.modules.wiki.newspaper_ocr import TESSDATA, local_ocr, usable

COLUMNS = ("source_file", "page", "status", "method", "text", "error")
LANGUAGES = "ara"


def recognize_document(source: Path, root: Path, checkpoints: Path, max_pixels: int) -> list[dict]:
    name = source.relative_to(root).as_posix()
    info = source.stat()
    revision = f"{name}\n{info.st_size}\n{info.st_mtime_ns}\n{max_pixels}\n{LANGUAGES}"
    checkpoint = checkpoints / (hashlib.sha256(revision.encode("utf-8")).hexdigest() + ".json")
    if checkpoint.is_file():
        previous = json.loads(checkpoint.read_text(encoding="utf-8"))
        if all(row["status"] == "ok" for row in previous):
            return previous

    rows = []
    try:
        reader = PdfReader(source)
        total = len(reader.pages)
        if not total:
            raise ValueError("PDF has no pages")
        with tempfile.TemporaryDirectory(prefix="terjiman-") as temporary:
            for number, page in enumerate(reader.pages, 1):
                row = dict(source_file=name, page=number, status="ok", method="text-layer", text="", error="")
                try:
                    try:
                        text = (page.extract_text() or "").strip()
                    except Exception:
                        text = ""
                    if not usable(text):
                        row["method"] = f"tesseract-{LANGUAGES}"
                        text = local_ocr(source, number, Path(temporary), languages=LANGUAGES, max_pixels=max_pixels)
                    row["text"] = text
                    if not usable(text):
                        row.update(status="needs_review", error="Insufficient recognized text")
                except (OSError, subprocess.SubprocessError, ValueError) as exc:
                    row.update(status="failed", error=type(exc).__name__)
                rows.append(row)
    except Exception as exc:
        rows.append(dict(source_file=name, page="", status="failed", method="", text="", error=type(exc).__name__))

    staged = checkpoint.with_suffix(".tmp")
    staged.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
    staged.replace(checkpoint)
    return rows


def spreadsheet_text(text: str) -> str:
    return "'" + text if text.lstrip().startswith(("=", "+", "-", "@")) else text


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--workers", type=int, choices=(1, 2, 3), default=2)
    parser.add_argument("--max-pixels", type=int, default=1900)
    parser.add_argument("--limit", type=int, help="Limit the run to the first N issues")
    args = parser.parse_args()
    root = args.input.resolve()
    sources = sorted(path for path in root.rglob("*") if path.is_file() and path.suffix.casefold() == ".pdf")
    sources = sources[:args.limit]
    if not sources:
        parser.error("no PDFs found")
    for lang in LANGUAGES.split("+"):
        if not (TESSDATA / f"{lang}.traineddata").is_file():
            parser.error(f"{lang}.traineddata missing from {TESSDATA}")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    checkpoints = args.output.parent / "checkpoints"
    checkpoints.mkdir(exist_ok=True)
    print(f"Input issues: {len(sources)}", flush=True)
    staged = args.output.with_suffix(".tmp")
    counts = {"ok": 0, "needs_review": 0, "failed": 0}
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        tasks = [executor.submit(recognize_document, file, root, checkpoints, args.max_pixels) for file in sources]
        with staged.open("w", encoding="utf-8-sig", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=COLUMNS)
            writer.writeheader()
            for number, task in enumerate(tasks, 1):
                rows = task.result()
                for row in rows:
                    counts[row["status"]] += 1
                    writer.writerow({**row, "source_file": spreadsheet_text(row["source_file"]),
                                     "text": spreadsheet_text(row["text"])})
                print(f"{number}/{len(sources)}: {len(rows)} records, {counts}", flush=True)
    staged.replace(args.output)
    print(json.dumps({"issues": len(sources), **counts}), flush=True)
    if not counts["ok"]:
        raise SystemExit("No pages passed OCR validation")


if __name__ == "__main__":
    main()
