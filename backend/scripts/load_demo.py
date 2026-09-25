"""Idempotent load of DEMO survey + responses + mood recalculation."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.database import Base, SessionLocal, engine
from app.modules.moods.service import recalculate_for
from app.modules.regions.model import Region  # noqa: F401
from app.modules.responses.model import Response, ResponseSource
from app.modules.surveys.model import Question, QuestionType, Survey, SurveyStatus

ROOT = Path(__file__).resolve().parents[2]
SURVEY_FILE = ROOT / "data" / "seed" / "demo_survey.json"
RESP_FILE = ROOT / "data" / "seed" / "demo_responses.json"


def _map_source(raw: str) -> ResponseSource:
    if raw == "import":
        return ResponseSource.import_
    return ResponseSource(raw)


def load() -> None:
    Base.metadata.create_all(bind=engine)
    survey_payload = json.loads(SURVEY_FILE.read_text(encoding="utf-8"))
    responses_payload = json.loads(RESP_FILE.read_text(encoding="utf-8"))

    db = SessionLocal()
    try:
        survey_by_year: dict[int, Survey] = {}
        for spec in survey_payload["surveys"]:
            survey = (
                db.query(Survey)
                .filter(Survey.year == spec["year"], Survey.title == spec["title"])
                .first()
            )
            if not survey:
                survey = Survey(
                    year=spec["year"],
                    title=spec["title"],
                    description=spec.get("description"),
                    status=SurveyStatus(spec["status"]),
                    scoring_version=spec.get("scoring_version", "1.0"),
                )
                db.add(survey)
                db.flush()
                for idx, q in enumerate(spec["questions"], start=1):
                    db.add(
                        Question(
                            survey_id=survey.id,
                            text=q["text"],
                            type=QuestionType(q["type"]),
                            options=q.get("options"),
                            weight=q.get("weight", 1.0),
                            required=q.get("required", True),
                        )
                    )
                db.commit()
                db.refresh(survey)
            survey_by_year[survey.year] = survey

        for item in responses_payload:
            survey = survey_by_year[item["survey_year"]]
            questions = (
                db.query(Question).filter(Question.survey_id == survey.id).order_by(Question.id).all()
            )
            qids = {str(i + 1): str(q.id) for i, q in enumerate(questions)}
            mapped_answers = {qids[k]: v for k, v in item["answers"].items() if k in qids}
            exists = (
                db.query(Response)
                .filter(
                    Response.survey_id == survey.id,
                    Response.region_id == item["region_id"],
                    Response.user_id == item["user_id"],
                )
                .first()
            )
            if exists:
                continue
            db.add(
                Response(
                    survey_id=survey.id,
                    region_id=item["region_id"],
                    source=_map_source(item["source"]),
                    user_id=item["user_id"],
                    answers=mapped_answers,
                )
            )
        db.commit()

        for survey in survey_by_year.values():
            recalculate_for(db, survey.id)

        total = db.query(Response).count()
        print(f"DEMO loaded. responses={total}")
    finally:
        db.close()


if __name__ == "__main__":
    load()
