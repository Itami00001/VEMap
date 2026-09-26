# step04 — DEMO DATA

## Цель
Ручной набор демо-данных для проверки пайплайна. Явно помечен DEMO.

## Файлы
data/seed/demo_survey.json
data/seed/demo_responses.json
backend/scripts/load_demo.py
docs/demo-data.md

## Что сделать
1. demo_survey.json: пять опросов (2016, 2018, 2020, 2022, 2024), в каждом 3 вопроса (scale, single_choice, text).
2. demo_responses.json: 300 ответов — 6 регионов × 50 ответов. Регионы: RU-MOW, RU-SPE, RU-TA, RU-CR, RU-KDA, RU-NVS.
3. load_demo.py: идемпотентная загрузка.
4. docs/demo-data.md: пометить «DEMO DATA, не реальные наблюдения».

## НЕ делать
- Не выдавать за реальные данные.
- Не генерировать случайно — писать значения вручную в JSON.
- Не вызывать NLP.

## Проверка
- После load_demo: SELECT COUNT(*) FROM responses → 300.
- В docs/demo-data.md явно стоит DEMO DATA.