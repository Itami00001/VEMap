# VEMap

1. Скопируйте `.env.example` в `.env` и при необходимости измените переменные.
2. `docker-compose up -d postgres` — PostgreSQL на порту 5432.
3. Backend: `cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload` → http://localhost:8000/
4. Frontend: `cd frontend && npm install && npm run dev` → http://localhost:5173/
