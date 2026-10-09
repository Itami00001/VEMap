from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class City(Base):
    """Справочник городов (вариант C). region_id NULL — вне РФ (напр. UA)."""

    __tablename__ = "cities"

    city_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name_ru: Mapped[str] = mapped_column(String(255), nullable=False)
    region_id: Mapped[str | None] = mapped_column(
        ForeignKey("regions.region_id"), nullable=True
    )
    country: Mapped[str] = mapped_column(String(2), nullable=False, default="RU")
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)
