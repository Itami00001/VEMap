"""Isolated smoke test for Wiki submission, moderation, CSV and the local queue."""

import asyncio
import io
import os
import tempfile
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4


def test(directory: Path) -> None:
    os.environ.update(
        DATABASE_URL=f"sqlite:///{(directory / 'smoke.db').as_posix()}",
        JWT_SECRET="isolated-smoke-secret-for-ve-map",
        ADMIN_PASSWORD="isolated-smoke-only",
        WIKI_TELEGRAM_TOKEN="",
        WIKI_STORAGE_DIR=str(directory / "files"),
        WIKI_TRUST_PROXY="true",
    )
    from fastapi import HTTPException
    from fastapi.testclient import TestClient
    from pypdf import PdfWriter
    from sqlalchemy import delete

    from app.db.database import SessionLocal
    from app.main import app
    from app.modules.cities.local_queue import LocalQueue
    from app.modules.wiki import service
    from app.modules.wiki.models import WikiAttempt
    from app.modules.wiki.newspaper_map import city_index, find_points
    from app.modules.wiki.processor import read_points
    from app.modules.wiki.telegram_worker import deliver_one, handle_update, notify_block

    sample = io.BytesIO()
    writer = PdfWriter()
    writer.add_blank_page(width=240, height=320)
    writer.write(sample)
    pdf = sample.getvalue()
    group_id = -1001234567890
    payload = "Первая строка\nБез изменений <и> &"
    title = "Статья о поиске"

    class Bot:
        def __init__(self):
            self.sent = []

        async def send_document(self, chat_id, file, **kwargs):
            assert chat_id == group_id and kwargs["protect_content"]
            self.sent.append(Path(file.path).read_bytes() if hasattr(file, "path") else file.data)
            return SimpleNamespace(message_id=len(self.sent))

        async def send_message(self, chat_id, text, **kwargs):
            assert chat_id == group_id
            self.sent.append(text)
            return SimpleNamespace(message_id=len(self.sent))

        async def answer_callback_query(self, *args, **kwargs):
            pass

        async def edit_message_reply_markup(self, **kwargs):
            assert kwargs["chat_id"] == group_id

    def callback(chat_id, action, value):
        return SimpleNamespace(callback_query=SimpleNamespace(
            message=SimpleNamespace(chat=SimpleNamespace(id=chat_id, type="supergroup"), message_id=123),
            from_user=SimpleNamespace(is_bot=False),
            data=f"wiki:{action}:{value}", id="callback",
        ))

    def store_csv(ident, content):
        csv_path = directory / "points.csv"
        csv_path.write_text(content, encoding="utf-8")
        from app.modules.wiki.models import WikiArticle
        with SessionLocal.begin() as db:
            article = db.get(WikiArticle, ident)
            article.points = read_points(csv_path, 1)
            article.processing = "ready"

    with TestClient(app) as client:
        def submit(address, ident=None, content=pdf):
            return client.post("/api/wiki/articles", data={"title": title, "body": payload},
                               files=[("files", ("historical.pdf", content, "application/pdf"))],
                               headers={"X-Wiki-Client-Address": address, "X-Submission-ID": str(ident or uuid4()),
                                        "User-Agent": "VEMap-Client-Smoke"})

        assert submit("192.0.2.1").status_code == 503
        service.BOT_READY.set()
        assert submit("192.0.2.1", content=b"not a PDF").status_code == 422
        response = submit("192.0.2.1")
        assert response.status_code == 202, response.text
        ident = response.json()["id"]
        assert submit("192.0.2.1", ident).json()["id"] == ident
        assert submit("192.0.2.2", ident).status_code == 409
        endpoint = f"/api/wiki/articles/{ident}"
        assert client.get(endpoint).status_code == 404
        assert client.get(endpoint + "/files/0").status_code == 404
        assert client.get("/api/wiki/articles").json()["articles"] == []

        bot = Bot()
        asyncio.run(deliver_one(bot, group_id))
        asyncio.run(deliver_one(bot, group_id))
        assert len(bot.sent) == 3, bot.sent
        assert bot.sent[0] == pdf and payload.encode() in bot.sent[1]
        assert title.encode() in bot.sent[1] and b"VEMap-Client-Smoke" in bot.sent[1]
        asyncio.run(handle_update(bot, group_id, "wiki", callback(group_id + 1, "approve", ident)))
        assert client.get(endpoint).status_code == 404
        asyncio.run(handle_update(bot, group_id, "wiki", callback(group_id, "approve", ident)))
        article = client.get(endpoint).json()
        assert article["body"] == payload and "user_agent" not in article
        assert client.get(endpoint + "/files/0").content == pdf
        store_csv(ident, "name,lat,lon,file_index,page\nВаршава,52.23,21.01,0,1\n")
        assert client.get(endpoint).json()["points"][0]["page"] == 1
        assert "Варшава" in client.get(endpoint + "/points.csv").text
        service.apply_decision("delete", ident)
        assert client.get(endpoint).status_code == 404
        assert client.get(endpoint + "/files/0").status_code == 404
        service.collect_deleted()
        assert not service.storage_path(ident).exists()

        assert submit("192.0.2.1").status_code == 202
        assert submit("192.0.2.1").status_code == 202
        assert submit("192.0.2.1").status_code == 429
        with SessionLocal.begin() as db:
            db.execute(delete(WikiAttempt))
        for index in range(1, 11):
            assert submit(f"192.0.2.{index}").status_code == 202
        assert submit("192.0.2.11").status_code == 503
        assert client.get("/api/wiki/articles").json()["paused"] is True
        asyncio.run(notify_block(bot, group_id))
        assert "Более 10" in bot.sent[-1]
        asyncio.run(handle_update(bot, group_id, "wiki", callback(group_id, "continue", "1")))
        assert submit("192.0.2.11").status_code == 202

    cities = city_index([
        {"id": "a", "name": "Варшава", "lat": 52.23, "lon": 21.01},
        {"id": "b", "name": "Берлинъ", "lat": 52.52, "lon": 13.40},
        {"id": "c", "name": "Москва", "lat": 55.75, "lon": 37.62},
    ])
    points = list(find_points(["Выставка въ Варшав.", "Изъ Берлина въ Варшаву."], cities, 2))
    assert [(p["name"], p["page"], p["file_index"], p["mood_index"]) for p in points] == [
        ("Варшава", 1, 2, None), ("Берлинъ", 2, 2, None),
    ], points

    async def check_queue():
        queue = LocalQueue()
        class Request:
            async def is_disconnected(self):
                return False

        order = []
        async def take(i):
            async with queue.enter(Request()):
                order.append(i)

        async with queue.enter(Request()):
            work = [asyncio.create_task(take(i)) for i in range(5)]
            await asyncio.sleep(0)
            try:
                async with queue.enter(Request()):
                    raise AssertionError("Unbounded queue")
            except HTTPException as exc:
                assert exc.status_code == 429
            assert not order
        await asyncio.gather(*work)
        assert order == list(range(5)), order

    asyncio.run(check_queue())
    print("Wiki smoke passed: private drafts, exact Telegram copies, callback scope, moderation, limits, CSV and FIFO.")


if __name__ == "__main__":
    with tempfile.TemporaryDirectory(prefix="vemap-wiki-smoke-") as temporary:
        try:
            test(Path(temporary))
        finally:
            from app.db.database import engine

            engine.dispose()
