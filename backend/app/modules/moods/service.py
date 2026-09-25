from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.modules.moods.calculator import calculate_mood
from app.modules.moods.model import MoodRecord
from app.modules.moods.schema import CompareRowOut, DataRowOut, HistoryPointOut, MapPointOut
from app.modules.regions.model import Region
from app.modules.responses.model import Response
from app.modules.surveys.model import Question, Survey


def get_available_years(db: Session, scoring_version: str) -> list[int]:
    rows = (
        db.query(MoodRecord.year)
        .filter(MoodRecord.scoring_version == scoring_version, MoodRecord.is_public.is_(True))
        .distinct()
        .order_by(MoodRecord.year)
        .all()
    )
    return [r[0] for r in rows]


def get_map_points(db: Session, year: int, scoring_version: str) -> list[MapPointOut]:
    rows = (
        db.query(MoodRecord)
        .filter(
            MoodRecord.year == year,
            MoodRecord.scoring_version == scoring_version,
            MoodRecord.is_public.is_(True),
        )
        .all()
    )
    return [
        MapPointOut(region_id=r.region_id, mood_index=r.mood_index, responses_count=r.responses_count)
        for r in rows
    ]


def get_history(db: Session, region_id: str, scoring_version: str) -> list[HistoryPointOut]:
    rows = (
        db.query(MoodRecord)
        .filter(
            MoodRecord.region_id == region_id,
            MoodRecord.scoring_version == scoring_version,
            MoodRecord.is_public.is_(True),
        )
        .order_by(MoodRecord.year)
        .all()
    )
    return [
        HistoryPointOut(year=r.year, mood_index=r.mood_index, responses_count=r.responses_count) for r in rows
    ]


def get_public_table(db: Session, year: int, scoring_version: str) -> list[DataRowOut]:
    regions = db.query(Region).order_by(Region.name_ru).all()
    moods = {
        r.region_id: r
        for r in db.query(MoodRecord).filter(
            MoodRecord.year == year,
            MoodRecord.scoring_version == scoring_version,
            MoodRecord.is_public.is_(True),
        )
    }
    years = get_available_years(db, scoring_version)
    prev_year = None
    for y in years:
        if y >= year:
            break
        prev_year = y
    prev_moods = {}
    if prev_year is not None:
        prev_moods = {
            r.region_id: r.mood_index
            for r in db.query(MoodRecord).filter(
                MoodRecord.year == prev_year,
                MoodRecord.scoring_version == scoring_version,
                MoodRecord.is_public.is_(True),
            )
        }
    result: list[DataRowOut] = []
    for reg in regions:
        rec = moods.get(reg.region_id)
        change = None
        if rec and reg.region_id in prev_moods:
            change = round(rec.mood_index - prev_moods[reg.region_id], 2)
        result.append(
            DataRowOut(
                region_id=reg.region_id,
                name_ru=reg.name_ru,
                mood_index=rec.mood_index if rec else None,
                responses_count=rec.responses_count if rec else None,
                change_from_prev=change,
            )
        )
    return result


def compare(db: Session, year_a: int, year_b: int, scoring_version: str) -> list[CompareRowOut]:
    regions = db.query(Region).order_by(Region.name_ru).all()

    def load(year: int) -> dict[str, float]:
        return {
            r.region_id: r.mood_index
            for r in db.query(MoodRecord).filter(
                MoodRecord.year == year,
                MoodRecord.scoring_version == scoring_version,
                MoodRecord.is_public.is_(True),
            )
        }

    a = load(year_a)
    b = load(year_b)
    out: list[CompareRowOut] = []
    for reg in regions:
        ma = a.get(reg.region_id)
        mb = b.get(reg.region_id)
        delta = None
        if ma is not None and mb is not None:
            delta = round(mb - ma, 2)
        out.append(
            CompareRowOut(region_id=reg.region_id, name_ru=reg.name_ru, mood_a=ma, mood_b=mb, delta=delta)
        )
    return out


def recalculate_for(db: Session, survey_id: int) -> list[MoodRecord]:
    survey = db.get(Survey, survey_id)
    if not survey:
        raise ValueError(f"Survey {survey_id} not found")

    questions = db.query(Question).filter(Question.survey_id == survey_id).all()
    responses = db.query(Response).filter(Response.survey_id == survey_id).all()

    by_region: dict[str, list[dict]] = {}
    for resp in responses:
        by_region.setdefault(resp.region_id, []).append({"answers": resp.answers})

    created: list[MoodRecord] = []
    for region_id, region_responses in by_region.items():
        mood = calculate_mood(region_responses, questions)
        if mood is None:
            continue
        existing = (
            db.query(MoodRecord)
            .filter(
                MoodRecord.region_id == region_id,
                MoodRecord.year == survey.year,
                MoodRecord.scoring_version == survey.scoring_version,
            )
            .first()
        )
        if existing:
            continue
        record = MoodRecord(
            region_id=region_id,
            year=survey.year,
            mood_index=round(mood, 2),
            responses_count=len(region_responses),
            scoring_version=survey.scoring_version,
            is_public=True,
            computed_at=datetime.now(timezone.utc),
        )
        db.add(record)
        created.append(record)
    db.commit()
    for r in created:
        db.refresh(r)
    return created


def publish_mood_records(db: Session, record_ids: list[int]) -> int:
    updated = 0
    for rid in record_ids:
        rec = db.get(MoodRecord, rid)
        if rec:
            rec.is_public = True
            updated += 1
    db.commit()
    return updated
