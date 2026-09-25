import json

from sqlalchemy.orm import Session

from app.modules.moods.model import MoodRecord
from app.modules.responses.model import Response
from app.modules.surveys.model import Survey


def export_full_dataset(db: Session) -> dict:
    return {
        "surveys": [
            {
                "id": s.id,
                "year": s.year,
                "title": s.title,
                "status": s.status.value,
            }
            for s in db.query(Survey).all()
        ],
        "responses": [
            {
                "id": r.id,
                "survey_id": r.survey_id,
                "region_id": r.region_id,
                "source": r.source.value,
                "answers": r.answers,
            }
            for r in db.query(Response).all()
        ],
        "mood_records": [
            {
                "id": m.id,
                "region_id": m.region_id,
                "year": m.year,
                "mood_index": m.mood_index,
                "is_public": m.is_public,
            }
            for m in db.query(MoodRecord).all()
        ],
    }


def export_json(db: Session) -> str:
    return json.dumps(export_full_dataset(db), ensure_ascii=False, indent=2)
