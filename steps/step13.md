# step13 — ForecastPage

## Файлы
frontend/src/features/forecast/ForecastChart.tsx
frontend/src/features/forecast/ForecastInfo.tsx
frontend/src/pages/ForecastPage.tsx

## Что сделать
1. Select региона (все из /api/regions).
2. Recharts: исторические точки — линия, прогноз — пунктир.
3. Блок инфо: последнее значение, прогноз, кол-во наблюдений, MAE, период.
4. Пометка: «Качество прогноза зависит от объёма данных».
5. Если status=insufficient_data — показать предупреждение, не рисовать линию.

## Проверка
- Москва: история + пунктирный прогноз, MAE видно.
- Регион с 2 точками → предупреждение.