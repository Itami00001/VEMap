# step02 — Регионы

## Цель
Загрузить справочник регионов и GeoJSON, создать модель, отдать через API.

## Файлы
data/geo/russia-regions.geojson      (скачать, не генерировать)
data/seed/regions.json               (85 регионов, поля: region_id, region_code, name_ru, name_en, name_crh, federal_district)
backend/app/modules/regions/model.py
backend/app/modules/regions/schema.py
backend/app/modules/regions/service.py
backend/app/modules/regions/router.py
backend/scripts/seed_regions.py

## Что сделать
1. GeoJSON: источник — репозиторий timurkanaz/Russia_geojson_OSM или аналог с границами субъектов РФ. Скачать и положить.
2. regions.json: 85 субъектов РФ. region_id = ISO 3166-2:RU (например RU-MOW). region_code = тот же ISO. name_crh для регионов Крыма заполнить реальным крымскотатарским названием, для остальных = name_ru.
3. model.py: SQLAlchemy Region (region_id PK, region_code, name_ru, name_en, name_crh, federal_district).
4. schema.py: Pydantic RegionOut.
5. service.py: get_all(), get_by_id().
6. router.py:
   - GET /api/regions → список
   - GET /api/regions/{region_id} → один
7. seed_regions.py: читает regions.json и заполняет таблицу (idempotent).
8. Подключить router в main.py.

## НЕ делать
- Не использовать внешние геокодеры.
- Не менять структуру GeoJSON, как скачали — так и лежит.
- Не выдумывать region_id. Только ISO 3166-2:RU.

## Проверка
- `curl localhost:8000/api/regions | jq length` → 85.
- `curl localhost:8000/api/regions/RU-MOW` → объект Москвы.
- БД: SELECT COUNT(*) FROM regions → 85.