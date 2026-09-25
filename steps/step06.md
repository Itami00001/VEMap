# step06 — Mood API (v1.1)

> Актуализировано по tz-v1.1 (время = year+month, данные по городам, регионы — «обёртка»).
> **Внимание:** реализация на backend отложена до структуры БД от владельца данных;
> фронтенд работает через моки этой спецификации (см. step07 v1.1).

## Файлы
backend/app/modules/moods/router.py
backend/app/modules/cities/* (после утверждения структуры БД)

## Эндпоинты (v1.1)
GET /api/periods                             → [{year, month}] существующие периоды (только реальные, без пропусков)
GET /api/cities                              → [{city_id, name_ru, region_id, region_name}] справочник городов
GET /api/map/{year}?month=                   → [{region_id, mood_index, responses_count}] — агрегат по городам региона
GET /api/data?year=&month=                   → таблица по городам: Город | Регион | Mood | Ответов/статей | Δ к пред. периоду
GET /api/compare?year_a=&month_a=&year_b=&month_b= → разница по городам
GET /api/regions/{region_id}/history         → история региона (точки по существующим периодам)
GET /api/cities/{city_id}/history            → история города

## Совместимость с v1.0
- GET /api/years и вызовы без `?month=` остаются рабочими (годовые данные, month IS NULL).

## Что сделать
1. Публичный ответ НЕ содержит сырых текстов/ответов, user_id, source.
2. Если данных за период нет — пустой массив с пояснением (не 404).
3. Никакой интерполяции пропущенных месяцев.

## НЕ делать
- Не отдавать /api/admin/* сюда.
- Не возвращать raw articles/responses.

## Проверка
- /api/periods → только существующие (year, month).
- /api/map/2024?month=5 → регионы с городами данных, остальные — пусто.
- /api/cities → города из tz-v1.1 §8.