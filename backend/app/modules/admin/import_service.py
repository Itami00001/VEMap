import json
from typing import Any

from sqlalchemy.orm import Session

from app.modules.moods.model import MoodRecord
from app.modules.responses.model import Response, ResponseSource
from app.modules.surveys.model import Question, QuestionType, Survey


def validate_import_payload(data: Any) -> list[str]:
    errors: list[str] = []
    if not isinstance(data, dict):
        return ["Корень JSON должен быть объектом"]
    if "responses" not in data or not isinstance(data["responses"], list):
        errors.append("Ожидается поле responses: []")
    return errors


def preview_import(db: Session, data: dict) -> dict:
    errors = validate_import_payload(data)
    if errors:
        return {"valid": False, "errors": errors, "preview_count": 0}
    return {"valid": True, "errors": [], "preview_count": len(data["responses"])}


def confirm_import(db: Session, data: dict, survey_id: int) -> dict:
    errors = validate_import_payload(data)
    if errors:
        return {"ok": False, "errors": errors, "imported": 0}
    survey = db.get(Survey, survey_id)
    if not survey:
        return {"ok": False, "errors": ["Survey not found"], "imported": 0}
    imported = 0
    for item in data["responses"]:
        db.add(
            Response(
                survey_id=survey_id,
                region_id=item["region_id"],
                source=ResponseSource.import_,
                user_id=item.get("user_id"),
                answers=item["answers"],
            )
        )
        imported += 1
    db.commit()
    return {"ok": True, "errors": [], "imported": imported}
