from pydantic import BaseModel, ConfigDict


class RegionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    region_id: str
    region_code: str
    name_ru: str
    name_en: str
    name_crh: str
    federal_district: str
