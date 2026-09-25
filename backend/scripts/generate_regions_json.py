"""One-time generator for data/seed/regions.json — 85 subjects of RF, ISO 3166-2:RU."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "seed" / "regions.json"

CRIMEAN = {
    "RU-CR": "Qırım",
    "RU-SEV": "Aqyar",
}

# (region_id, name_ru, name_en, federal_district)
RAW = [
    ("RU-AD", "Республика Адыгея", "Republic of Adygea", "Южный"),
    ("RU-AL", "Республика Алтай", "Altai Republic", "Сибирский"),
    ("RU-ALT", "Алтайский край", "Altai Krai", "Сибирский"),
    ("RU-AMU", "Амурская область", "Amur Oblast", "Дальневосточный"),
    ("RU-ARK", "Архангельская область", "Arkhangelsk Oblast", "Северо-Западный"),
    ("RU-AST", "Астраханская область", "Astrakhan Oblast", "Южный"),
    ("RU-BA", "Республика Башкортостан", "Republic of Bashkortostan", "Приволжский"),
    ("RU-BEL", "Белгородская область", "Belgorod Oblast", "Центральный"),
    ("RU-BRY", "Брянская область", "Bryansk Oblast", "Центральный"),
    ("RU-BU", "Республика Бурятия", "Republic of Buryatia", "Дальневосточный"),
    ("RU-CE", "Чеченская Республика", "Chechen Republic", "Северо-Кавказский"),
    ("RU-CHE", "Челябинская область", "Chelyabinsk Oblast", "Уральский"),
    ("RU-CHU", "Чукотский автономный округ", "Chukotka Autonomous Okrug", "Дальневосточный"),
    ("RU-CU", "Чувашия", "Chuvash Republic", "Приволжский"),
    ("RU-DA", "Республика Дагестан", "Republic of Dagestan", "Северо-Кавказский"),
    ("RU-IN", "Республика Ингушетия", "Republic of Ingushetia", "Северо-Кавказский"),
    ("RU-IRK", "Иркутская область", "Irkutsk Oblast", "Сибирский"),
    ("RU-IVA", "Ивановская область", "Ivanovo Oblast", "Центральный"),
    ("RU-KAM", "Камчатский край", "Kamchatka Krai", "Дальневосточный"),
    ("RU-KB", "Кабардино-Балкарская Республика", "Kabardino-Balkarian Republic", "Северо-Кавказский"),
    ("RU-KC", "Карачаево-Черкесская республика", "Karachay-Cherkess Republic", "Северо-Кавказский"),
    ("RU-KDA", "Краснодарский край", "Krasnodar Krai", "Южный"),
    ("RU-KEM", "Кемеровская область", "Kemerovo Oblast", "Сибирский"),
    ("RU-KGD", "Калининградская область", "Kaliningrad Oblast", "Северо-Западный"),
    ("RU-KGN", "Курганская область", "Kurgan Oblast", "Уральский"),
    ("RU-KHA", "Хабаровский край", "Khabarovsk Krai", "Дальневосточный"),
    ("RU-KHM", "Ханты-Мансийский автономный округ - Югра", "Khanty-Mansi Autonomous Okrug", "Уральский"),
    ("RU-KIR", "Кировская область", "Kirov Oblast", "Приволжский"),
    ("RU-KK", "Республика Хакасия", "Republic of Khakassia", "Сибирский"),
    ("RU-KL", "Республика Калмыкия", "Republic of Kalmykia", "Южный"),
    ("RU-KLU", "Калужская область", "Kaluga Oblast", "Центральный"),
    ("RU-KO", "Республика Коми", "Komi Republic", "Северо-Западный"),
    ("RU-KOS", "Костромская область", "Kostroma Oblast", "Центральный"),
    ("RU-KR", "Республика Карелия", "Republic of Karelia", "Северо-Западный"),
    ("RU-KRS", "Курская область", "Kursk Oblast", "Центральный"),
    ("RU-KYA", "Красноярский край", "Krasnoyarsk Krai", "Сибирский"),
    ("RU-LEN", "Ленинградская область", "Leningrad Oblast", "Северо-Западный"),
    ("RU-LIP", "Липецкая область", "Lipetsk Oblast", "Центральный"),
    ("RU-MAG", "Магаданская область", "Magadan Oblast", "Дальневосточный"),
    ("RU-ME", "Республика Марий Эл", "Mari El Republic", "Приволжский"),
    ("RU-MO", "Республика Мордовия", "Republic of Mordovia", "Приволжский"),
    ("RU-MOS", "Московская область", "Moscow Oblast", "Центральный"),
    ("RU-MOW", "Москва", "Moscow", "Центральный"),
    ("RU-MUR", "Мурманская область", "Murmansk Oblast", "Северо-Западный"),
    ("RU-NEN", "Ненецкий автономный округ", "Nenets Autonomous Okrug", "Северо-Западный"),
    ("RU-NGR", "Новгородская область", "Novgorod Oblast", "Северо-Западный"),
    ("RU-NIZ", "Нижегородская область", "Nizhny Novgorod Oblast", "Приволжский"),
    ("RU-NVS", "Новосибирская область", "Novosibirsk Oblast", "Сибирский"),
    ("RU-OMS", "Омская область", "Omsk Oblast", "Сибирский"),
    ("RU-ORE", "Оренбургская область", "Orenburg Oblast", "Приволжский"),
    ("RU-ORL", "Орловская область", "Oryol Oblast", "Центральный"),
    ("RU-PER", "Пермский край", "Perm Krai", "Приволжский"),
    ("RU-PNZ", "Пензенская область", "Penza Oblast", "Приволжский"),
    ("RU-PRI", "Приморский край", "Primorsky Krai", "Дальневосточный"),
    ("RU-PSK", "Псковская область", "Pskov Oblast", "Северо-Западный"),
    ("RU-ROS", "Ростовская область", "Rostov Oblast", "Южный"),
    ("RU-RYA", "Рязанская область", "Ryazan Oblast", "Центральный"),
    ("RU-SA", "Республика Саха (Якутия)", "Republic of Sakha", "Дальневосточный"),
    ("RU-SAK", "Сахалинская область", "Sakhalin Oblast", "Дальневосточный"),
    ("RU-SAM", "Самарская область", "Samara Oblast", "Приволжский"),
    ("RU-SAR", "Саратовская область", "Saratov Oblast", "Приволжский"),
    ("RU-SE", "Республика Северная Осетия-Алания", "Republic of North Ossetia-Alania", "Северо-Кавказский"),
    ("RU-SMO", "Смоленская область", "Smolensk Oblast", "Центральный"),
    ("RU-SPE", "Санкт-Петербург", "Saint Petersburg", "Северо-Западный"),
    ("RU-STA", "Ставропольский край", "Stavropol Krai", "Северо-Кавказский"),
    ("RU-SVE", "Свердловская область", "Sverdlovsk Oblast", "Уральский"),
    ("RU-TA", "Республика Татарстан", "Republic of Tatarstan", "Приволжский"),
    ("RU-TAM", "Тамбовская область", "Tambov Oblast", "Центральный"),
    ("RU-TOM", "Томская область", "Tomsk Oblast", "Сибирский"),
    ("RU-TUL", "Тульская область", "Tula Oblast", "Центральный"),
    ("RU-TVE", "Тверская область", "Tver Oblast", "Центральный"),
    ("RU-TY", "Республика Тыва", "Tuva Republic", "Сибирский"),
    ("RU-TYU", "Тюменская область", "Tyumen Oblast", "Уральский"),
    ("RU-UD", "Удмуртская Республика", "Udmurt Republic", "Приволжский"),
    ("RU-ULY", "Ульяновская область", "Ulyanovsk Oblast", "Приволжский"),
    ("RU-VGG", "Волгоградская область", "Volgograd Oblast", "Южный"),
    ("RU-VLA", "Владимирская область", "Vladimir Oblast", "Центральный"),
    ("RU-VLG", "Вологодская область", "Vologda Oblast", "Северо-Западный"),
    ("RU-VOR", "Воронежская область", "Voronezh Oblast", "Центральный"),
    ("RU-YAN", "Ямало-Ненецкий автономный округ", "Yamalo-Nenets Autonomous Okrug", "Уральский"),
    ("RU-YAR", "Ярославская область", "Yaroslavl Oblast", "Центральный"),
    ("RU-YEV", "Еврейская автономная область", "Jewish Autonomous Oblast", "Дальневосточный"),
    ("RU-ZAB", "Забайкальский край", "Zabaykalsky Krai", "Дальневосточный"),
    ("RU-CR", "Республика Крым", "Republic of Crimea", "Южный"),
    ("RU-SEV", "Севастополь", "Sevastopol", "Южный"),
]

out = []
for rid, name_ru, name_en, fd in RAW:
    name_crh = CRIMEAN.get(rid, name_ru)
    out.append(
        {
            "region_id": rid,
            "region_code": rid,
            "name_ru": name_ru,
            "name_en": name_en,
            "name_crh": name_crh,
            "federal_district": fd,
        }
    )

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Wrote {len(out)} regions to {OUT}")

if __name__ == "__main__":
    pass
