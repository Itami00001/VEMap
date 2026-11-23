import json
import re
from dataclasses import dataclass
from os import walk
from pathlib import Path
from stat import S_ISREG
from uuid import NAMESPACE_URL, uuid5

from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.modules.cities.model import City
from app.modules.cities.source_model import CityMoodSource, EXAMPLES_DIRECTORY, PDF_DIRECTORY

CORPUS_DIRECTORY = EXAMPLES_DIRECTORY / "newspaper_archive"
ARCHIVE_ROOTS = (PDF_DIRECTORY, EXAMPLES_DIRECTORY / "terjiman", CORPUS_DIRECTORY / "pdf")


class IssueOut(BaseModel):
    id: str
    source_pdf: str
    source_page: int
    title: str
    available: bool
    transcript: bool


class ArchiveCity(BaseModel):
    city_id: str
    name_ru: str
    sources: list[IssueOut]


class NewspaperCatalog(BaseModel):
    cities: list[ArchiveCity]
    archive: list[IssueOut]


@dataclass(frozen=True)
class Issue:
    id: str
    filename: str
    title: str
    path: Path | None
    has_transcript: bool = False

    def as_output(self, page: int = 1) -> IssueOut:
        return IssueOut(id=self.id, source_pdf=self.filename, source_page=page, title=self.title,
                        available=self.path is not None, transcript=self.has_transcript)


def transcript_path(pdf: Path) -> Path | None:
    candidate = pdf.with_suffix(".txt")
    if candidate.is_symlink():
        return None
    return candidate if candidate.is_file() and candidate.stat().st_size else None


def issue_id(filename: str) -> str:
    accession = re.search(r"RU_NLR_BIBL_A_[0-9]+", filename)
    identity = accession.group() if accession else filename
    return str(uuid5(NAMESPACE_URL, f"vemap:newspaper:{identity}"))


def issue_title(filename: str) -> str:
    match = re.search(r"(Терджиман.+)\.pdf$", filename, re.IGNORECASE)
    return match.group(1).replace("_", " ") if match else filename


def scan_archive(root: Path, titles: dict[str, str] | None = None):
    for folder, directories, filenames in walk(root.resolve()):
        directories.sort()
        names = set(filenames)
        for name in sorted(filenames):
            if not name.lower().endswith(".pdf"):
                continue
            path = Path(folder) / name
            try:
                if not S_ISREG(path.lstat().st_mode):
                    continue
            except FileNotFoundError:
                continue
            has_transcript = path.with_suffix(".txt").name in names and transcript_path(path) is not None
            title = titles.get(name) if titles is not None else None
            # A searchable re-export can have a different PDF page order than a scan
            # with the same library accession. Keep the editions independently addressable.
            identity = (str(uuid5(NAMESPACE_URL, f"vemap:newspaper:archive:{name}"))
                        if titles is not None else issue_id(name))
            yield Issue(identity, name, title or issue_title(name), path, has_transcript)


def issues(db: Session) -> tuple[dict[str, Issue], dict[str, Issue]]:
    by_id: dict[str, Issue] = {}
    by_filename: dict[str, Issue] = {}
    titles_path = CORPUS_DIRECTORY / "titles.json"
    titles = json.loads(titles_path.read_text(encoding="utf-8")) if titles_path.is_file() else None
    for root in ARCHIVE_ROOTS:
        for issue in scan_archive(root, titles if root == CORPUS_DIRECTORY / "pdf" else None):
            by_id.setdefault(issue.id, issue)
            by_filename.setdefault(issue.filename, by_id[issue.id])

    # A catalogue override retains the ID of a renamed or relocated issue.
    manifest = EXAMPLES_DIRECTORY / "newspaper-catalog.json"
    if manifest.is_file():
        for row in json.loads(manifest.read_text(encoding="utf-8-sig")):
            relative = Path(row["path"])
            path = (EXAMPLES_DIRECTORY / relative).resolve()
            if not path.is_file() or path.suffix.lower() != ".pdf" or not any(
                path.is_relative_to(root.resolve()) for root in ARCHIVE_ROOTS
            ):
                continue
            old = by_filename.get(path.name)
            if old is not None:
                by_id.pop(old.id, None)
            issue = Issue(row["id"], path.name, row.get("title") or issue_title(path.name), path,
                          transcript_path(path) is not None)
            by_id[issue.id] = by_filename[issue.filename] = issue
            for alias in row.get("aliases", []):
                by_filename[alias] = issue

    for (filename,) in db.query(CityMoodSource.source_pdf).distinct():
        if filename not in by_filename:
            issue = Issue(issue_id(filename), filename, issue_title(filename), None)
            by_id.setdefault(issue.id, issue)
            by_filename[filename] = by_id[issue.id]
    return by_id, by_filename


def find_issue(db: Session, identity: str) -> Issue | None:
    by_id, by_filename = issues(db)
    return by_id.get(identity) or by_filename.get(identity)


def list_catalog(db: Session) -> NewspaperCatalog:
    by_id, by_filename = issues(db)
    city_sources: dict[str, dict[str, IssueOut]] = {}
    for link in db.query(CityMoodSource).order_by(CityMoodSource.source_page):
        issue = by_filename[link.source_pdf]
        city_sources.setdefault(link.city_id, {}).setdefault(issue.id, issue.as_output(link.source_page))
    return NewspaperCatalog(
        cities=[
            ArchiveCity(city_id=city.city_id, name_ru=city.name_ru,
                        sources=sorted(city_sources.get(city.city_id, {}).values(), key=lambda item: item.title))
            for city in db.query(City).order_by(City.name_ru, City.city_id)
        ],
        archive=[issue.as_output() for issue in sorted(by_id.values(), key=lambda item: item.title)],
    )
