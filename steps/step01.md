# step01 — Архитектура и каркас

## Цель
Создать пустой скелет монорепо: backend + frontend + docker + env.
Никакой бизнес-логики.

## Файлы
backend/
  app/main.py
  app/config.py
  app/db/database.py
  app/core/dependencies.py
  requirements.txt
  Dockerfile
frontend/                     (через `npm create vite@latest frontend -- --template react-ts`)
data/geo/                     (пустая)
data/seed/                    (пустая)
data/examples/                (пустая)
docs/                         (пустая)
docker-compose.yml
.env.example
README.md

## Что сделать
1. backend/app/main.py: FastAPI, title="Map Mood API", CORS на localhost:5173.
2. backend/app/config.py: класс Settings (pydantic-settings), читает DATABASE_URL, JWT_SECRET, ADMIN_EMAIL из .env.
3. backend/app/db/database.py: engine, SessionLocal, Base, get_db().
4. requirements.txt: fastapi, uvicorn[standard], pydantic, pydantic-settings, sqlalchemy, psycopg2-binary, python-multipart.
5. docker-compose.yml: сервисы postgres (15-alpine) + backend.
6. .env.example: DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD.
7. README.md: 5 строк — как поднять локально.

## НЕ делать
- Не создавать модели.
- Не писать роутеры.
- Не трогать frontend, кроме scaffolding через Vite.
- Не добавлять библиотеки сверх указанных.

## Проверка
- `docker-compose up` поднимает postgres.
- `uvicorn app.main:app --reload` → http://localhost:8000/ возвращает {"message":"Map Mood API"}.
- `npm run dev` во frontend → открывается дефолтная Vite-страница.