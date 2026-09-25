"""Write deterministic DEMO responses (no random module)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "seed" / "demo_responses.json"

REGIONS = ["RU-MOW", "RU-SPE", "RU-TA", "RU-CR", "RU-KDA", "RU-NVS"]
CHOICES = ["bad", "ok", "good", "great"]
YEARS = [2016, 2018, 2020, 2022, 2024]

items = []
for year in YEARS:
    for ri, region_id in enumerate(REGIONS):
        for j in range(10):
            scale = 2 + ((ri * 3 + j + year) % 4)
            choice = CHOICES[(ri + j + year) % 4]
            items.append(
                {
                    "survey_year": year,
                    "region_id": region_id,
                    "source": "import",
                    "user_id": f"demo-{year}-{region_id}-{j}",
                    "answers": {
                        "1": scale,
                        "2": choice,
                        "3": f"DEMO комментарий {region_id} #{j}",
                    },
                }
            )

OUT.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Wrote {len(items)} responses")
