# step05 — Mood Index v1.0

> ⛔ **СТАТУС: ЗАМОРОЖЕН (tz-v1.1, §13).**
> Формула v1.0 ниже считается из ответов опроса. По v1.1 Mood Index считается из **тональности текстов** (газеты), новая формула v2.0 **не утверждена**.
> Ничего не реализовывать и не менять, пока владелец данных не утвердит:
> список метрик, словарь тональности (или miniLLM), структуру записи БД.
> После утверждения — docs/mood-index.md переписывается полностью (см. tz-v1.1 §13).
> Текст ниже — исторический (v1.0).

## Цель
Согласовать и реализовать формулу Mood Index.

## Файлы
docs/mood-index.md
backend/app/modules/moods/calculator.py
backend/app/modules/moods/service.py

## Что сделать
1. docs/mood-index.md:
   - входные данные;
   - нормализация: scale 1..5 → 0..100; single_choice → веса; text → НЕ участвует в v1.0;
   - веса по вопросам (берём из Question.weight);
   - формула: mood_index = Σ(norm_i * weight_i) / Σ(weight_i);
   - диапазон 0..100;
   - минимальный размер выборки: 5 ответов на регион/год; иначе — не считаем;
   - scoring_version = "1.0".
2. calculator.py: чистая функция `calculate_mood(responses, questions) -> float | None`.
3. service.py: `recalculate_for(survey_id)` — перебирает ответы, пишет MoodRecord.
4. Никаких NLP, никаких случайных чисел.

## НЕ делать
- Не менять формулу без согласования.
- Не считать Mood для региона с < 5 ответов.
- Не перезаписывать существующие версии scoring_version.

## Проверка
- Для demo-данных: python -m app.modules.moods.service recalc → в mood_records есть 6 записей.
- Mood Index в диапазоне 0–100.