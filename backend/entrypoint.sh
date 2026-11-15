#!/bin/sh
set -e

# Дождёмся готовности БД (на случай, если healthcheck не сработал)
python - <<'PY'
import time
from sqlalchemy import create_engine, text
from app.config import settings

engine = create_engine(settings.DATABASE_URL)
for _ in range(60):
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        break
    except Exception:
        time.sleep(1)
else:
    raise SystemExit("Database is not available")
PY

# Инициализация данных (идемпотентно)
python scripts/create_superadmin.py
python scripts/seed_regions.py
python scripts/import_all_csv.py

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
