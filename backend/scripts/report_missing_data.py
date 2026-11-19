"""Report missing public city observations for periods available on the map."""

import argparse
import csv
import sys
from pathlib import Path

from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.database import SessionLocal
from app.modules.cities.model import City
from app.modules.cities.mood_model import CityMoodRecord
from app.modules.cities.service import get_periods


def missing_rows():
    with SessionLocal() as db:
        cities = db.execute(select(City.city_id, City.name_ru).order_by(City.name_ru, City.city_id)).all()
        periods = get_periods(db)
        observations = {tuple(row) for row in db.execute(
            select(CityMoodRecord.city_id, CityMoodRecord.year, CityMoodRecord.month)
            .where(CityMoodRecord.is_public.is_(True))
        )}

    for city_id, name in cities:
        for period in periods:
            if (city_id, period.year, period.month) not in observations:
                yield name, period.year, period.month, "Нет данных"


def write_report(stream):
    writer = csv.writer(stream)
    writer.writerow(("Город", "Год", "Месяц", "Статус"))
    writer.writerows(missing_rows())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="Write a UTF-8 CSV to this path")
    args = parser.parse_args()
    if args.output is None:
        write_report(sys.stdout)
    else:
        with args.output.open("w", encoding="utf-8-sig", newline="") as stream:
            write_report(stream)


if __name__ == "__main__":
    main()
