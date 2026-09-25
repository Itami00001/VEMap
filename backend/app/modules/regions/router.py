from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.modules.regions import service
from app.modules.regions.schema import RegionOut

router = APIRouter(prefix="/api/regions", tags=["regions"])


@router.get("", response_model=list[RegionOut])
def list_regions(db: Session = Depends(get_db)):
    return service.get_all(db)


@router.get("/{region_id}", response_model=RegionOut)
def get_region(region_id: str, db: Session = Depends(get_db)):
    region = service.get_by_id(db, region_id)
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")
    return RegionOut.model_validate(region)
