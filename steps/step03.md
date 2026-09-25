# step03 — Data model

## Цель
Создать SQLAlchemy-модели для surveys, questions, responses, mood_records.
Без расчётов, без API.

## Файлы
backend/app/modules/surveys/model.py
backend/app/modules/surveys/schema.py
backend/app/modules/responses/model.py
backend/app/modules/responses/schema.py
backend/app/modules/moods/model.py
backend/app/modules/moods/schema.py
backend/app/db/migrations/   (alembic init, если решишь использовать alembic)

## Что сделать
1. Survey: id, year, title, description, status (draft/active/closed), scoring_version, created_at, updated_at.
2. Question: id, survey_id FK, text, type (scale/single_choice/text), options (JSON), weight, required.
3. Response: id, survey_id FK, region_id FK, source (telegram/site/import), user_id, answers (JSON), created_at.
4. MoodRecord: id, region_id FK, year, mood_index (float 0–100), responses_count, scoring_version, computed_at.
5. Уникальный индекс: (region_id, year, scoring_version) для MoodRecord.
6. Pydantic-схемы для чтения/записи.

## НЕ делать
- Не писать CRUD-роуты.
- Не писать расчёт Mood Index.
- Не добавлять поля «на будущее».

## Проверка
- `python -c "from app.db.database import Base; ..."` — Base.metadata.create_all() проходит без ошибок.
- Показать SQL: 4 таблицы.