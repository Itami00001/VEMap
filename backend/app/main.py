import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.database import Base, engine
from app.modules.admin.logs import AuditLog  # noqa: F401
from app.modules.admin.router import router as admin_router
from app.modules.auth.router import router as auth_router
from app.modules.cities.chat import router as newspaper_chat_router
from app.modules.cities.router import router as cities_router
from app.modules.cities.local_queue import LocalQueue
from app.modules.cities.model import City  # noqa: F401
from app.modules.cities.mood_model import CityMoodRecord  # noqa: F401
from app.modules.forecast.models import ForecastRun  # noqa: F401
from app.modules.forecast.router import router as forecast_router
from app.modules.moods.router import router as moods_router
from app.modules.regions.router import router as regions_router
from app.modules.telegram.model import TelegramUser  # noqa: F401

from app.modules.wiki.processor import processing_loop
from app.modules.wiki.router import router as wiki_router
from app.modules.wiki.service import initialize as initialize_wiki
from app.modules.wiki.telegram_worker import telegram_loop

app = FastAPI(title="VEMap API")


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
    initialize_wiki()


@app.on_event("startup")
async def start_wiki_workers() -> None:
    app.state.local_chat_queue = LocalQueue()
    app.state.wiki_tasks = [asyncio.create_task(telegram_loop()), asyncio.create_task(processing_loop())]


@app.on_event("shutdown")
async def stop_wiki_workers() -> None:
    for task in app.state.wiki_tasks:
        task.cancel()
    await asyncio.gather(*app.state.wiki_tasks, return_exceptions=True)


app.include_router(wiki_router)
app.include_router(regions_router)
app.include_router(cities_router)
app.include_router(newspaper_chat_router)
app.include_router(moods_router)
app.include_router(forecast_router)
app.include_router(auth_router)
app.include_router(admin_router)


@app.get("/")
def root():
    return {"message": "VEMap API"}
