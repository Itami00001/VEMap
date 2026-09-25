# step04 — DEMO DATA

## Цель
Ручной набор демо-данных для проверки пайплайна. Явно помечен DEMO.

## Файлы
data/seed/demo_survey.json
data/seed/demo_responses.json
backend/scripts/load_demo.py
docs/demo-data.md

## Что сделать
1. demo_survey.json: один опрос (year=2024), 3 вопроса (scale, single_choice, text).
2. demo_responses.json: ≥ 60 ответов от 6 регионов × 10 ответов. Регионы: RU-MOW, RU-SPB, RU-TA, RU-CR, RU-KDA, RU-NVS.
3. load_demo.py: идемпотентная загрузка.
4. docs/demo-data.md: пометить «DEMO DATA, не реальные наблюдения».

## НЕ делать
- Не выдавать за реальные данные.
- Не генерировать случайно — писать значения вручную в JSON.
- Не вызывать NLP.

## Проверка
- После load_demo: SELECT COUNT(*) FROM responses → 60+.
- В docs/demo-data.md явно стоит DEMO DATA.