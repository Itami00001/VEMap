# Статус шагов (ТЗ v1.1 — актуально)

Актуальное ТЗ: `docs/tz-v1.1.md` (при противоречии важнее `docs/tz.md` v1.0).

| Step | Статус | Комментарий |
|---|---|---|
| step01 Архитектура | ✅ готов, не трогать | универсален |
| step02 Регионы | ✅ готов, не трогать | `region` остаётся «обёрткой» карты |
| step03 Data model | ✅ готов, не трогать | surveys/questions/responses — вторичный источник |
| step04 DEMO DATA | ✅ готов, не трогать | помечено DEMO |
| step05 Mood Index | ⛔ заморожен | ждём метрики + словарь от владельца данных; после — переписать `docs/mood-index.md` |
| step06 Mood API | ✅ backend v1.1-compat | `?month=`, `/api/periods`, `/api/cities`, city endpoints (месячные — `[]` до структуры БД) |
| step07 Frontend каркас | ✅ готов | моки `VITE_USE_MOCKS`, типы `City`/`TimePeriod`, все роуты |
| step08 Карта | ✅ принят (2026-09-26: фиксворкер+Крым) | `TimeSlider`, агрегат городов, серый = нет данных; воркер из public/, Крым добавлен |
| step09 RegionPopup | ✅ принят | регион + города + спарклайн, период в шапке |
| step10 DataPage | ✅ принят | таблица по городам, фильтр периода, поиск, сортировка |
| step11 Compare | ✅ принят | два периода, режимы Абсолют/Изменение, Δ-таблица |
| step12 Forecast service | ⛔ заморожен | зависит от step05 |
| step13 ForecastPage | ⛔ заморожен | страница-заглушка «в разработке», без псевдо-прогноза |
| step14 Auth | ✅ принят | login → JWT; 401 без токена; bcrypt `$2b$`; фикс `.local`-домена |
| step15 Admin | ✅ принят | backend + frontend (login, surveys, import preview/confirm, publish) |
| step16 Telegram | ✅ backend готов | вторичный источник, выбор города (верификация в Docker: импорт ok) |
| step17 Landing | ✅ принят | hero, pipeline, блок «Сканы газет → AI-анализ», команда |
| step18 Acceptance | ✅ пройден | см. отчёт ниже |

## Блокеры (внешние)

1. Саня (данные): финальный список городов; структура записи
   `{city, year, month, mood_coefficient, source_metrics}`; список метрик;
   словарь тональности или подтверждение miniLLM.
2. Миша (аналитика): формат `{city, year, month, summary_text, key_topics[]}`.

## Приёмка Docker (step18, 2026-09-26)

`docker compose up --build -d` — postgres + backend + frontend (nginx) подняты.
Фронт собран с `VITE_USE_MOCKS=true`, `VITE_API_URL=http://localhost:8001`.

- `GET /` → `{"message":"VEMap API"}` ✅
- `GET /api/regions` → 85 ✅
- `GET /api/cities` → 8 (ТЗ v1.1 §8) ✅
- `GET /api/periods` → `[]` (пустая БД, честно) ✅
- `GET /api/map/2024?month=5` → `[]` (месячных записей нет) ✅
- `POST /api/auth/login` → JWT ✅; `/api/admin/*` без токена → 401 ✅
- Пароли: bcrypt `$2b$` ✅; `random()`/фейков без DEMO — нет ✅
- `GET http://localhost:5173/` → 200 ✅
- `tsc -b` в docker-сборке фронта — чисто ✅

## Фиксы карты 2026-09-26 (жалобы: нет Крыма/Москвы/Питера, worker MIME)

1. Крыма и Севастополя не было в `russia-regions.geojson` (83 вместо 85) —
   добавлены полигоны из OSM (relations 3795586/3788485, ODbL), теперь 85/85.
   Москва и Питер в GeoJSON были, но не рисовались: карта была мертва из-за
   падения воркера (см. п.2).
2. `maplibre-gl-worker.mjs` отдавался как text/html (Vite не эмитит файл,
   на который maplibre ссылается относительно бандла) → `setWorkerUrl` на
   копию в `public/` (+ shared), в nginx — `application/javascript` для `.mjs`.
   Проверка: оба файла → 200 application/javascript.
3. Проект переименован в VEMap (бренд, title, API message, доки).
   Инфра-идентификаторы (`mapmood` в БД/URL, `admin@mapmood.local`) оставлены —
   переименование БД требует миграции volume.
4. Аудит тестовых данных: моки консистентны (3 периода, 8 городов × 3,
   все коды в geo); сиды: 5 опросов (2016–2024), 300 ответов (6×50), коды ISO
   корректны (RU-SPE). Исправлены доки (`demo-data.md`, `step04.md`),
   где было «2 опроса» / «60+ ответов» / «RU-SPB».
