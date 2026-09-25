# step12 — Forecast service

> ⛔ **СТАТУС: ЗАМОРОЖЕН (tz-v1.1, §13).**
> Прогноз зависит от формулы Mood Index — она не утверждена. Не реализовывать и не менять,
> пока не разморожен step05 (метрики + словарь тональности от владельца данных).
> Текст ниже — исторический (v1.0).

## Файлы
backend/app/modules/forecast/models.py
backend/app/modules/forecast/service.py
backend/app/modules/forecast/router.py
docs/forecast.md

## Что сделать
1. docs/forecast.md: описать вход, модель, backtesting, метрики, поведение при недостатке данных.
2. service.py:
   - вход: [year, mood_index];
   - если точек < 4 → вернуть {status: "insufficient_data"};
   - baseline: линейная регрессия (sklearn.LinearRegression);
   - backtesting: hold-out последней точки, MAE;
   - прогноз на N лет вперёд (N по запросу, по умолчанию 3);
   - сохранять ForecastRun в БД (region_id, model, horizon, mae, created_at).
3. router.py:
   - GET /api/forecast/{region_id}?horizon=3
   - GET /api/forecast/russia
4. НЕ random(), НЕ заглушки.

## Проверка
- /api/forecast/RU-MOW?horizon=3 → массив предсказаний + mae.
- При < 4 точках → status=insufficient_data.