from pathlib import Path

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base

EXAMPLES_DIRECTORY = Path(__file__).resolve().parents[4] / "data" / "examples"
PDF_DIRECTORY = EXAMPLES_DIRECTORY / "all_searchable_pdfs"


class CityMoodSource(Base):
    __tablename__ = "city_mood_sources"

    city_id: Mapped[str] = mapped_column(ForeignKey("cities.city_id"), primary_key=True)
    year: Mapped[int] = mapped_column(primary_key=True)
    month: Mapped[int] = mapped_column(primary_key=True)
    source_pdf: Mapped[str] = mapped_column(primary_key=True)
    source_page: Mapped[int] = mapped_column(primary_key=True)


def newspaper_path(filename: str) -> Path | None:
    if not filename.lower().endswith(".pdf") or "/" in filename or "\\" in filename:
        return None
    path = (PDF_DIRECTORY / filename).resolve()
    return path if path.parent == PDF_DIRECTORY.resolve() and path.is_file() else None
