# world-land.geojson

- Слой суши и крупных островов Natural Earth, масштаб 1:110m.
- Исходник: [ne_110m_land.geojson, Natural Earth v5.1.2](https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_110m_land.geojson).
- [Лицензия Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) — public domain.
- Геометрия сохранена без изменений. Удалены неиспользуемые свойства фигур и метаданные коллекции.

Файл `country-overview.geojson` подготовлен из [Natural Earth, Admin 0 — Countries, 1:50m](https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_50m_admin_0_countries.geojson). Полигоны с двухбуквенным кодом ISO обрезаны по слою суши. Поле `size_at_zoom_zero` равно квадратному корню из площади исходного полигона в Web Mercator, пересчитанному в пиксели для карты шириной 512 пикселей. На карте эти полигоны используются как маска внутренних линий.
