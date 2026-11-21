"""Shared CPU OCR for VEMap newspaper uploads and archival scans."""

import os
import re
import subprocess
from pathlib import Path

TESSDATA = Path("/usr/local/share/vemap/ocr")


def usable(text: str) -> bool:
    words = re.findall(r"[^\W\d_]{2,}", text)
    letters = sum(map(len, words))
    return len(words) >= 4 and letters >= 24 and letters >= len(text) * 0.30


def image_languages(image: Path) -> str:
    if not (TESSDATA / "ara.traineddata").is_file():
        return "orus"
    try:
        result = subprocess.run(
            ["tesseract", str(image), "stdout", "--psm", "0", "-l", "osd"],
            capture_output=True, text=True, encoding="utf-8", timeout=12,
            env={**os.environ, "OMP_THREAD_LIMIT": "1"},
        )
    except subprocess.TimeoutExpired:
        return "orus"
    return "ara" if "Script: Arabic" in result.stdout else "orus"


def local_ocr(path: Path, page: int, scratch: Path, *, languages: str | None = None, max_pixels: int = 3600) -> str:
    if languages is None and (TESSDATA / "ara.traineddata").is_file():
        detect_base = scratch / "script"
        subprocess.run(
            ["pdftoppm", "-f", str(page), "-l", str(page), "-scale-to", "1200", "-gray", "-singlefile",
             "-png", str(path), str(detect_base)],
            check=True, timeout=20, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        languages = image_languages(detect_base.with_suffix(".png"))
    languages = languages or "orus"
    if languages == "ara":
        max_pixels = min(max_pixels, 2000)

    image_base = scratch / "page"
    image = image_base.with_suffix(".png")
    subprocess.run(
        ["pdftoppm", "-f", str(page), "-l", str(page), "-scale-to", str(max_pixels), "-gray", "-singlefile",
         "-png", str(path), str(image_base)],
        check=True, timeout=25, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    result = subprocess.run(
        ["tesseract", str(image), "stdout", "--tessdata-dir", str(TESSDATA), "-l", languages, "--oem", "1", "--psm", "3"],
        check=True, timeout=65, capture_output=True, text=True, encoding="utf-8",
        env={**os.environ, "OMP_THREAD_LIMIT": "1"},
    )
    return result.stdout.strip()
