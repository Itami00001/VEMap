from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class Region(Base):
    __tablename__ = "regions"

    region_id: Mapped[str] = mapped_column(String(16), primary_key=True)
    region_code: Mapped[str] = mapped_column(String(16), nullable=False)
    name_ru: Mapped[str] = mapped_column(String(255), nullable=False)
    name_en: Mapped[str] = mapped_column(String(255), nullable=False)
    name_crh: Mapped[str] = mapped_column(String(255), nullable=False)
    federal_district: Mapped[str] = mapped_column(String(128), nullable=False)
