import csv
import io
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, Response
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.config import settings
from app.core.dependencies import get_db
from app.modules.wiki.models import WikiArticle, WikiControl
from app.modules.wiki.service import BOT_READY, client_key, save_article, stage_files, storage_path, utcnow

router = APIRouter(prefix="/api/wiki", tags=["wiki"])


def public_article(article: WikiArticle, *, full: bool = False) -> dict:
    result = {
        "id": article.id, "title": article.title, "date": article.published_at.isoformat() + "Z",
        "summary": article.body[:220], "file_count": len(article.files),
        "processing": article.processing, "point_count": len(article.points),
    }
    if full:
        result.update(body=article.body, files=article.files, points=article.points)
    return result


def published(db: Session, article_id: UUID) -> WikiArticle:
    article = db.get(WikiArticle, str(article_id))
    if article is None or article.status != "approved":
        raise HTTPException(404, "Статья не найдена.")
    return article


@router.get("/articles")
def list_articles(db: Session = Depends(get_db), before: Annotated[str | None, Query(max_length=90)] = None):
    page_size = 24
    query = select(WikiArticle).where(WikiArticle.status == "approved")
    if before:
        try:
            date, article_id = before.split("|", 1)
            timestamp = datetime.fromisoformat(date)
            if timestamp.tzinfo is not None:
                raise ValueError
            article_id = str(UUID(article_id))
        except ValueError as exc:
            raise HTTPException(422, "Неверная позиция в каталоге.") from exc
        query = query.where(or_(
            WikiArticle.published_at < timestamp,
            and_(WikiArticle.published_at == timestamp, WikiArticle.id > article_id),
        ))
    matches = db.scalars(query.order_by(WikiArticle.published_at.desc(), WikiArticle.id)
                         .limit(page_size + 1)).all()
    articles = matches[:page_size]
    next_page = f"{articles[-1].published_at.isoformat()}|{articles[-1].id}" if len(matches) > page_size else None
    state = db.get(WikiControl, 1)
    return {
        "accepting": BOT_READY.is_set() and state is not None and not state.blocked,
        "paused": bool(state and state.blocked),
        "articles": [public_article(article) for article in articles],
        "next": next_page,
    }


@router.post("/articles", status_code=202)
def submit_article(
    request: Request,
    title: Annotated[str, Form(min_length=1, max_length=180)],
    body: Annotated[str, Form(min_length=1, max_length=10000)],
    files: Annotated[list[UploadFile], File()],
    db: Session = Depends(get_db),
    request_id: Annotated[UUID | None, Header(alias="X-Submission-ID")] = None,
):
    if not BOT_READY.is_set():
        raise HTTPException(503, "Приём заявок временно недоступен.")
    if not title.strip() or not body.strip() or "\0" in title or "\0" in body:
        raise HTTPException(422, "Заполните название и текст статьи.")
    key = client_key(request)
    article_id = str(request_id or uuid4())
    existing = db.get(WikiArticle, article_id)
    if existing is not None:
        if existing.client_key != key:
            raise HTTPException(409, "Повторите отправку с новым ID.")
        return {"id": article_id}
    state = db.get(WikiControl, 1)
    if state and state.blocked:
        raise HTTPException(503, "Приём заявок приостановлен до решения модератора.")
    root = Path(settings.WIKI_STORAGE_DIR)
    root.mkdir(parents=True, mode=0o700, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".upload-", dir=root) as temporary:
        stored = stage_files(files, Path(temporary))
        article = WikiArticle(
            id=article_id, client_key=key, created_at=utcnow(), title=title, body=body,
            user_agent=request.headers.get("User-Agent", "")[:512], files=stored,
        )
        save_article(db, article, Path(temporary))
    return {"id": article_id}


@router.get("/articles/{article_id}")
def article_details(article_id: UUID, db: Session = Depends(get_db)):
    return public_article(published(db, article_id), full=True)


@router.get("/articles/{article_id}/files/{file_index}")
def article_pdf(article_id: UUID, file_index: int, db: Session = Depends(get_db)):
    article = published(db, article_id)
    if not 0 <= file_index < len(article.files):
        raise HTTPException(404, "PDF не найден.")
    path = storage_path(article.id) / f"{file_index}.pdf"
    if not path.is_file():
        raise HTTPException(404, "PDF не найден.")
    return FileResponse(path, media_type="application/pdf", filename=article.files[file_index]["name"],
                        content_disposition_type="inline", headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "no-store"})


@router.get("/articles/{article_id}/points.csv")
def article_csv(article_id: UUID, db: Session = Depends(get_db)):
    article = published(db, article_id)
    if article.processing != "ready":
        raise HTTPException(404, "CSV ещё не готов.")
    fields = ["name", "lat", "lon", "mood_index", "file_index", "page"]
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fields)
    writer.writeheader()
    for point in article.points:
        name = point["name"]
        if name.lstrip().startswith(("=", "+", "-", "@")):
            name = "'" + name
        writer.writerow({**point, "name": name})
    return Response("\ufeff" + output.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="{article.id}.csv"'})
