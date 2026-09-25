from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from sklearn.linear_model import LinearRegression
from sqlalchemy.orm import Session

from app.modules.forecast.models import ForecastRun
from app.modules.moods.model import MoodRecord


@dataclass
class ForecastResult:
    status: str
    region_id: str | None
    aggregate: str | None
    history: list[dict]
    forecast: list[dict]
    mae: float | None
    observations: int
    horizon: int
    note: str


def _load_series(db: Session, region_id: str | None, scoring_version: str = "1.0") -> list[tuple[int, float]]:
    q = db.query(MoodRecord).filter(
        MoodRecord.scoring_version == scoring_version,
        MoodRecord.is_public.is_(True),
    )
    if region_id:
        q = q.filter(MoodRecord.region_id == region_id)
    rows = q.order_by(MoodRecord.year).all()
    if region_id:
        return [(r.year, r.mood_index) for r in rows]

    by_year: dict[int, list[float]] = {}
    for r in rows:
        by_year.setdefault(r.year, []).append(r.mood_index)
    return sorted((year, float(np.mean(vals))) for year, vals in by_year.items())


def _run_model(series: list[tuple[int, float]], horizon: int) -> ForecastResult:
    note = "Качество прогноза зависит от объёма и качества исторических данных."
    history = [{"year": y, "mood_index": v} for y, v in series]
    if len(series) < 4:
        return ForecastResult(
            status="insufficient_data",
            region_id=None,
            aggregate=None,
            history=history,
            forecast=[],
            mae=None,
            observations=len(series),
            horizon=horizon,
            note=note,
        )

    years = np.array([y for y, _ in series]).reshape(-1, 1)
    values = np.array([v for _, v in series])
    mae = None
    if len(series) >= 2:
        train_x, train_y = years[:-1], values[:-1]
        test_x, test_y = years[-1:], values[-1:]
        model = LinearRegression()
        model.fit(train_x, train_y)
        pred = model.predict(test_x)[0]
        mae = float(abs(pred - test_y[0]))

    model = LinearRegression()
    model.fit(years, values)
    last_year = int(series[-1][0])
    forecast = []
    for step in range(1, horizon + 1):
        y = last_year + step
        pred = float(model.predict(np.array([[y]]))[0])
        forecast.append({"year": y, "mood_index": round(pred, 2)})

    return ForecastResult(
        status="ok",
        region_id=None,
        aggregate=None,
        history=history,
        forecast=forecast,
        mae=round(mae, 2) if mae is not None else None,
        observations=len(series),
        horizon=horizon,
        note=note,
    )


def forecast_region(db: Session, region_id: str, horizon: int = 3) -> ForecastResult:
    series = _load_series(db, region_id)
    result = _run_model(series, horizon)
    result.region_id = region_id
    if result.status == "ok":
        db.add(
            ForecastRun(
                region_id=region_id,
                model="linear_regression",
                horizon=horizon,
                mae=result.mae,
            )
        )
        db.commit()
    return result


def forecast_russia(db: Session, horizon: int = 3) -> ForecastResult:
    series = _load_series(db, None)
    result = _run_model(series, horizon)
    result.aggregate = "mean_by_region"
    if result.status == "ok":
        db.add(
            ForecastRun(
                region_id=None,
                model="linear_regression",
                horizon=horizon,
                mae=result.mae,
            )
        )
        db.commit()
    return result
