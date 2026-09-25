from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.database import Base, engine
from app.modules.admin.logs import AuditLog  # noqa: F401
from app.modules.admin.router import router as admin_router
from app.modules.auth.router import router as auth_router
from app.modules.forecast.models import ForecastRun  # noqa: F401
from app.modules.forecast.router import router as forecast_router
from app.modules.moods.router import router as moods_router
from app.modules.regions.router import router as regions_router
from app.modules.telegram.model import TelegramUser  # noqa: F401

app = FastAPI(title="Map Mood API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)


app.include_router(regions_router)
app.include_router(moods_router)
app.include_router(forecast_router)
app.include_router(auth_router)
app.include_router(admin_router)


@app.get("/")
def root():
    return {"message": "Map Mood API"}
