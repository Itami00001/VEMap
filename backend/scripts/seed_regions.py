"""Idempotent seed of regions from data/seed/regions.json."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.database import Base, SessionLocal, engine
from app.modules.regions.model import Region

ROOT = Path(__file__).resolve().parents[2]
REGIONS_FILE = ROOT / "data" / "seed" / "regions.json"


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    data = json.loads(REGIONS_FILE.read_text(encoding="utf-8"))
    db = SessionLocal()
    try:
        for item in data:
            existing = db.get(Region, item["region_id"])
            if existing:
                for key, val in item.items():
                    setattr(existing, key, val)
            else:
                db.add(Region(**item))
        db.commit()
        count = db.query(Region).count()
        print(f"Regions in DB: {count}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
