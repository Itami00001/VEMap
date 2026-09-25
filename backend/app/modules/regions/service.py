from sqlalchemy.orm import Session

from app.modules.regions.model import Region
from app.modules.regions.schema import RegionOut


def get_all(db: Session) -> list[RegionOut]:
    rows = db.query(Region).order_by(Region.name_ru).all()
    return [RegionOut.model_validate(r) for r in rows]


def get_by_id(db: Session, region_id: str) -> Region | None:
    return db.query(Region).filter(Region.region_id == region_id).first()
