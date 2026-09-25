from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.modules.forecast import service
from app.modules.regions.model import Region

router = APIRouter(prefix="/api/forecast", tags=["forecast"])


@router.get("/russia")
def forecast_russia(horizon: int = Query(3, ge=1, le=10), db: Session = Depends(get_db)):
    result = service.forecast_russia(db, horizon)
    return asdict(result)


@router.get("/{region_id}")
def forecast_region(region_id: str, horizon: int = Query(3, ge=1, le=10), db: Session = Depends(get_db)):
    if not db.get(Region, region_id):
        raise HTTPException(status_code=404, detail="Region not found")
    result = service.forecast_region(db, region_id, horizon)
    return asdict(result)
