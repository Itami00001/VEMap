# step08 — MapLibre + GeoJSON + раскраска (v1.1)

> Актуализировано по tz-v1.1: ползунок — по периодам (year, month), значения — агрегат по городам региона.

## Файлы
frontend/src/features/map/MapView.tsx
frontend/src/features/map/TimeSlider.tsx
frontend/src/features/map/legend.ts
frontend/src/features/map/useMapData.ts

## Что сделать
1. MapView: maplibregl.Map, center [105, 61], zoom 3, style — публичный raster-стиль (например demotiles).
2. Загрузить /data/geo/russia-regions.geojson из public/ (скопировать туда при build).
3. Слой fill: цвет = f(mood_index) → градиент красный→жёлтый→зелёный.
4. Периоды — только из GET /api/periods. **TimeSlider (year + month, шаг 1 месяц, но только существующие периоды)**.
5. При смене периода: fetch /api/map/{year}?month=, обновить данные региона.
6. Легенда: 0–100, 5 цветовых ступеней.
7. Регионы без данных (нет городов с данными) — серые, не белые.

## НЕ делать
- Не пихать данные в style JSON руками.
- Не использовать внешние тайлы регионов — только локальный GeoJSON.
- Не добавлять deck.gl.
- Не рисовать маркеры городов без отдельного задания.

## Проверка
- /map: карта России, регионы с городами раскрашены, TimeSlider переключает периоды.
- Регион без данных — серый.