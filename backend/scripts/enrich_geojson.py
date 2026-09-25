"""One-time enrichment: inject region_id into russia-regions.geojson properties."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GEO = ROOT / "data" / "geo" / "russia-regions.geojson"
PUBLIC_GEO = ROOT / "frontend" / "public" / "data" / "geo" / "russia-regions.geojson"
REGIONS_FILE = ROOT / "data" / "seed" / "regions.json"

# name_latin in geojson differs from name_en in the reference
NAME_OVERRIDES = {
    "Kabardino-Balkar Republic": "RU-KB",
    "Khanty\u2013Mansi Autonomous Okrug \u2013 Yugra": "RU-KHM",
    "Sakha (Yakutia) Republic": "RU-SA",
}


def main() -> None:
    geo = json.loads(GEO.read_text(encoding="utf-8"))
    regions = json.loads(REGIONS_FILE.read_text(encoding="utf-8"))
    by_name_en = {r["name_en"]: r["region_id"] for r in regions}

    matched_regions: set[str] = set()
    unmatched_features: list[str] = []
    for feature in geo["features"]:
        props = feature["properties"]
        latin = props.get("name_latin")
        region_id = NAME_OVERRIDES.get(latin) or by_name_en.get(latin)
        if region_id:
            props["region_id"] = region_id
            matched_regions.add(region_id)
        else:
            unmatched_features.append(str(latin))

    GEO.write_text(json.dumps(geo, ensure_ascii=False), encoding="utf-8")
    PUBLIC_GEO.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_GEO.write_text(json.dumps(geo, ensure_ascii=False), encoding="utf-8")

    no_geometry = sorted({r["region_id"] for r in regions} - matched_regions)
    print(f"features: {len(geo['features'])}, matched: {len(matched_regions)}")
    print(f"unmatched features: {unmatched_features}")
    print(f"regions without geometry: {no_geometry}")


if __name__ == "__main__":
    main()
