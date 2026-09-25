"""Pure Mood Index calculation (scoring_version 1.0)."""
from __future__ import annotations

from typing import Any

from app.modules.surveys.model import Question, QuestionType


def _normalize_answer(question: Question, raw: Any) -> float | None:
    if raw is None:
        return None
    if question.type == QuestionType.scale:
        try:
            value = float(raw)
        except (TypeError, ValueError):
            return None
        if value < 1 or value > 5:
            return None
        return (value - 1.0) / 4.0 * 100.0
    if question.type == QuestionType.single_choice:
        if not question.options or "choices" not in question.options:
            return None
        key = str(raw)
        for choice in question.options["choices"]:
            if str(choice.get("key")) == key:
                score = choice.get("score")
                if score is None:
                    return None
                return float(score)
        return None
    return None


def calculate_mood_for_single_response(answers: dict, questions: list[Question]) -> float | None:
    weighted_sum = 0.0
    weight_total = 0.0
    qmap = {str(q.id): q for q in questions}
    for qid, raw in answers.items():
        question = qmap.get(str(qid))
        if not question:
            continue
        norm = _normalize_answer(question, raw)
        if norm is None:
            continue
        w = float(question.weight or 1.0)
        weighted_sum += norm * w
        weight_total += w
    if weight_total == 0:
        return None
    return weighted_sum / weight_total


def calculate_mood(responses: list[dict], questions: list[Question]) -> float | None:
    """responses: list of {answers: dict}"""
    values: list[float] = []
    for item in responses:
        val = calculate_mood_for_single_response(item.get("answers", {}), questions)
        if val is not None:
            values.append(val)
    if len(values) < 5:
        return None
    return sum(values) / len(values)
