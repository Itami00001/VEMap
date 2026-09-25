# step07 — Frontend базовый каркас (v1.1)

> Актуализировано по tz-v1.1: фронт работает **на моках** (backend ждёт структуру БД).

## Файлы
frontend/src/app/router.tsx
frontend/src/pages/Landing.tsx
frontend/src/pages/MapPage.tsx
frontend/src/pages/DataPage.tsx
frontend/src/pages/ForecastPage.tsx
frontend/src/pages/AboutPage.tsx
frontend/src/services/api.ts
frontend/src/types/index.ts
frontend/src/styles/globals.css

## Что сделать (v1.1)
1. Установить: react-router-dom, maplibre-gl, recharts.
2. router.tsx: маршруты /, /map, /data, /compare, /forecast (заглушка-заморозка), /about.
3. api.ts: fetch-обёртка с baseURL из VITE_API_URL **+ режим моков** `VITE_USE_MOCKS=true|false`.
   При `true` все запросы обслуживаются локальными DEMO-данными (frontend/src/mocks/*),
   помеченными как DEMO DATA.
4. types/index.ts: Region, **City**, **TimePeriod {year, month}**, CityDataRow, CompareRow.
   Mood Index — только `number` («число + цвет»), формулы на фронте нет.
5. globals.css: базовые сбросы, шрифт, тёмная тема.

## НЕ делать
- Не реализовывать карту на этом шаге.
- Не добавлять Tailwind без явного «ок» (сначала CSS).
- Не вычислять и не «знать» формулу Mood Index на фронте.

## Проверка
- Переход между /, /map, /data, /compare, /forecast, /about работает.
- При VITE_USE_MOCKS=true фронт показывает DEMO-данные без запущенного backend.