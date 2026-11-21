import hashlib
import hmac
import ipaddress
import os
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Event
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import HTTPException, Request, UploadFile
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import SessionLocal
from app.modules.wiki.models import WikiArticle, WikiAttempt, WikiControl

BOT_READY = Event()
MAX_FILES = 3
MAX_FILE_BYTES = 24 * 1024 * 1024
MAX_UPLOAD_BYTES = 36 * 1024 * 1024
MOSCOW = ZoneInfo("Europe/Moscow")

BLOCK_MESSAGES = {
    "minute": "Более 10 заявок за минуту",
    "day": "Более 20 заявок за день",
}


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def day_start(now: datetime) -> datetime:
    return (
        now.replace(tzinfo=timezone.utc).astimezone(MOSCOW)
        .replace(hour=0, minute=0, second=0, microsecond=0)
        .astimezone(timezone.utc).replace(tzinfo=None)
    )


def initialize() -> None:
    with SessionLocal.begin() as db:
        if db.get(WikiControl, 1) is None:
            db.add(WikiControl(id=1))
        db.execute(update(WikiArticle).where(WikiArticle.processing == "running").values(processing="queued"))
        db.execute(delete(WikiAttempt).where(WikiAttempt.created_at < utcnow() - timedelta(days=2)))


def control(db: Session) -> WikiControl:
    return db.scalars(select(WikiControl).where(WikiControl.id == 1)
                      .with_for_update().execution_options(populate_existing=True)).one()


def client_key(request: Request) -> str:
    address = request.client.host if request.client else "unknown"
    if settings.WIKI_TRUST_PROXY:
        forwarded = request.headers.get("X-Wiki-Client-Address", "").split(",")[0].strip()
        try:
            address = str(ipaddress.ip_address(forwarded))
        except ValueError:
            pass
    try:
        ip = ipaddress.ip_address(address)
        if isinstance(ip, ipaddress.IPv6Address):
            address = str(ip.ipv4_mapped or ipaddress.ip_network(f"{ip}/64", strict=False))
    except ValueError:
        pass
    return hmac.new(settings.JWT_SECRET.encode(), address.encode(), hashlib.sha256).hexdigest()


def storage_path(article_id: str) -> Path:
    return Path(settings.WIKI_STORAGE_DIR) / str(UUID(article_id))


def stage_files(uploads: list[UploadFile], staging: Path) -> list[dict]:
    if not 1 <= len(uploads) <= MAX_FILES:
        raise HTTPException(422, f"Прикрепите от 1 до {MAX_FILES} газет в PDF.")
    files = []
    total = 0
    for index, upload in enumerate(uploads):
        filename = upload.filename or ""
        if (not filename.lower().endswith(".pdf") or len(filename) > 200
                or any(c in filename for c in ("/", "\\", "\r", "\n", "\0"))):
            raise HTTPException(422, "Имя файла должно оканчиваться на .pdf.")
        size = 0
        with (staging / f"{index}.pdf").open("xb") as output:
            while chunk := upload.file.read(256 * 1024):
                if size == 0 and not chunk.startswith(b"%PDF-"):
                    raise HTTPException(422, "Прикреплённый файл не является PDF.")
                size += len(chunk)
                total += len(chunk)
                if size > MAX_FILE_BYTES or total > MAX_UPLOAD_BYTES:
                    raise HTTPException(413, "Лимит PDF — 24 МБ на файл и 36 МБ суммарно.")
                output.write(chunk)
        if not size:
            raise HTTPException(422, "Прикреплён пустой PDF.")
        files.append({"name": filename, "size": size})
    return files


def save_article(db: Session, article: WikiArticle, staging: Path) -> None:
    state = control(db)
    existing = db.get(WikiArticle, article.id)
    if existing is not None:
        if existing.client_key != article.client_key:
            raise HTTPException(409, "Повторите отправку с новым ID.")
        db.rollback()
        return
    if state.blocked:
        raise HTTPException(503, "Приём заявок приостановлен до решения модератора.")
    now = utcnow()
    today = day_start(now)
    attempts = select(func.count()).select_from(WikiAttempt)
    daily_for_client = db.scalar(attempts.where(
        WikiAttempt.created_at >= today, WikiAttempt.client_key == article.client_key,
    ))
    if daily_for_client >= 3:
        raise HTTPException(429, "С этого подключения уже отправлены 3 заявки за сегодня.")

    active_since = state.resumed_at or datetime.min
    count_minute = db.scalar(attempts.where(
        WikiAttempt.created_at >= max(active_since, now - timedelta(minutes=1)),
    ))
    count_day = db.scalar(attempts.where(WikiAttempt.created_at >= max(active_since, today)))
    if count_minute >= 10 or count_day >= 20:
        state.blocked = "minute" if count_minute >= 10 else "day"
        state.generation += 1
        db.commit()
        raise HTTPException(503, "Приём заявок приостановлен до решения модератора.")

    destination = storage_path(article.id)
    if destination.exists():
        raise HTTPException(503, "Не удалось сохранить заявку. Повторите отправку позже.")
    os.replace(staging, destination)
    try:
        db.add(article)
        db.add(WikiAttempt(client_key=article.client_key, created_at=now))
        db.commit()
    except Exception:
        shutil.rmtree(destination, ignore_errors=True)
        raise


def apply_decision(action: str, value: str) -> str:
    with SessionLocal.begin() as db:
        if action == "continue":
            state = control(db)
            if not state.blocked or value != str(state.generation):
                return "Эта блокировка уже снята."
            state.blocked = None
            state.resumed_at = utcnow()
            return "Приём заявок возобновлён."

        try:
            article_id = str(UUID(value))
        except ValueError:
            return "Неверный ID статьи."
        article = db.get(WikiArticle, article_id, with_for_update=True)
        if article is None:
            return "Заявка уже удалена."
        if action == "approve" and article.status == "pending":
            article.status = "approved"
            article.published_at = utcnow()
            article.processing = "queued"
            return f"Статья {article_id} опубликована."
        if action == "retry" and article.status == "approved" and article.processing in {"waiting", "failed"}:
            article.processing = "queued"
            return "Статья поставлена в очередь на обработку."
        if action == "delete" or (action == "reject" and article.status == "pending"):
            article.status = "deleted"
            article.title = ""
            article.body = ""
            article.user_agent = ""
            article.files = []
            article.points = []
            article.processing = "waiting"
            return f"Статья {article_id} удалена."
        return "Решение по этой заявке уже принято."


def collect_deleted() -> None:
    with SessionLocal.begin() as db:
        ids = db.scalars(select(WikiArticle.id).where(WikiArticle.status == "deleted").limit(30)).all()
        for article_id in ids:
            path = storage_path(article_id)
            if path.exists():
                shutil.rmtree(path)
            db.execute(delete(WikiArticle).where(WikiArticle.id == article_id, WikiArticle.status == "deleted"))
