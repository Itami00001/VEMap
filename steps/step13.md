# step13 — ForecastPage (v1.1)

> ⛔ **СТАТУС: ЗАМОРОЖЕН (tz-v1.1, §13).**
> Зависит от step05 (формула Mood Index v2.0) и step12 (forecast service).
> Не реализовывать до разморозки step05/step12.
> Текст ниже — исторический (v1.0) + правки v1.1, вступает в силу после разморозки.

## Файлы
frontend/src/features/forecast/ForecastChart.tsx
frontend/src/features/forecast/ForecastInfo.tsx
frontend/src/pages/ForecastPage.tsx

## Что сделать (после разморозки, v1.1)
1. Select региона (все из /api/regions) + select города (из /api/cities).
2. Ось времени — периоды (year, month) из /api/periods, не годы.
3. Recharts: исторические точки — линия, прогноз — пунктир.
3. Блок инфо: последнее значение, прогноз, кол-во наблюдений, MAE, период.
4. Пометка: «Качество прогноза зависит от объёма данных».
5. Если status=insufficient_data — показать предупреждение, не рисовать линию.

## Проверка
- Москва: история + пунктирный прогноз, MAE видно.
- Регион с 2 точками → предупреждение.