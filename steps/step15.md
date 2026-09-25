# step15 — Admin (v1.1)

> Актуализировано по tz-v1.1: импорт расширяется под города/периоды и газеты; газеты — после утверждения структуры БД.

## Файлы
backend/app/modules/surveys/router.py (admin-часть)
backend/app/modules/admin/import_service.py
backend/app/modules/admin/export_service.py
backend/app/modules/admin/logs.py
frontend/src/pages/admin/*

## Что сделать
1. Admin API:
   - POST/PUT/DELETE /api/admin/surveys (DELETE только SUPER_ADMIN)
   - GET /api/admin/data
   - PUT /api/admin/data/{id}
   - POST /api/admin/import → JSON, валидация → preview → import
   - GET /api/admin/export (SUPER_ADMIN)
   - GET /api/admin/logs (SUPER_ADMIN)
2. Импорт: этапы validate → preview → confirm → import. При ошибке — понятное сообщение.
   Формат записи v1.1 (после утверждения владельцем данных):
   `{city, year, month, mood_coefficient (0–1/0–10), source_metrics}` —
   нормализация к 0–100 на входе. Импорт newspapers/articles — только после структуры БД.
3. Audit log: кто, что, когда.
4. Frontend /admin/login, /admin/dashboard, /admin/surveys, /admin/import, /admin/data.
5. Защитить роуты через JWT в заголовке.

## НЕ делать
- Не давать ADMIN удалять (только SUPER_ADMIN).
- Не возвращать password_hash.
- Не публиковать сразу после импорта — только через явное действие.

## Проверка
- Логин админа → видит опросы.
- Загрузка JSON → preview → import → данные в БД.
- ADMIN не может удалить опрос (403).