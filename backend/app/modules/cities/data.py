# v1.1: стартовый список городов (ТЗ v1.1 §8). Не расширять самовольно —
# финальный список даёт владелец данных.
CITIES: list[dict[str, str]] = [
    {"city_id": "moskva", "name_ru": "Москва", "region_id": "RU-MOW", "region_name": "Москва"},
    {"city_id": "spb", "name_ru": "Санкт-Петербург", "region_id": "RU-SPE", "region_name": "Санкт-Петербург"},
    {"city_id": "simferopol", "name_ru": "Симферополь", "region_id": "RU-CR", "region_name": "Республика Крым"},
    {"city_id": "sevastopol", "name_ru": "Севастополь", "region_id": "RU-SEV", "region_name": "Севастополь"},
    {"city_id": "yalta", "name_ru": "Ялта", "region_id": "RU-CR", "region_name": "Республика Крым"},
    {"city_id": "kerch", "name_ru": "Керчь", "region_id": "RU-CR", "region_name": "Республика Крым"},
    {"city_id": "evpatoria", "name_ru": "Евпатория", "region_id": "RU-CR", "region_name": "Республика Крым"},
    {"city_id": "belogorsk", "name_ru": "Белогорск", "region_id": "RU-CR", "region_name": "Республика Крым"},
]
