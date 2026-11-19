# VEMap

## Запуск через Docker (рекомендуется)

Не требует установки Node.js/Python/PostgreSQL на компьютер — всё собирается и работает внутри Docker.

1. Скопируйте `.env.example` в `.env` и при необходимости измените переменные (пароль админа и т.д.).
2. Запустите:

   ```bash
   docker compose up -d --build
   ```

   Первая сборка может занять несколько минут (установка Python/Node зависимостей). Повторные запуски используют кэш Docker и проходят быстрее.

3. Откройте:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8001

При первом запуске backend автоматически:
- создаёт таблицы в PostgreSQL;
- создаёт супер-админа из `ADMIN_EMAIL` / `ADMIN_PASSWORD`;
- загружает 85 регионов и demo-данные.

Остановка:

```bash
docker compose down
```

Полная очистка данных (включая БД):

```bash
docker compose down -v
```

## Локальный запуск (без Docker)

1. Скопируйте `.env.example` в `.env` и при необходимости измените переменные.
2. `docker-compose up -d postgres` — PostgreSQL на порту 5432.
3. Backend: `cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload` → http://localhost:8000/
4. Frontend: `cd frontend && npm install && npm run dev` → http://localhost:5173/