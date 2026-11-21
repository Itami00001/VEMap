import asyncio
import logging

from aiogram import Bot
from aiogram.exceptions import TelegramRetryAfter
from aiogram.types import BufferedInputFile, FSInputFile, InlineKeyboardButton, InlineKeyboardMarkup, Update
from sqlalchemy import select

from app.config import settings
from app.db.database import SessionLocal
from app.modules.wiki.models import WikiArticle, WikiControl
from app.modules.wiki.service import BLOCK_MESSAGES, BOT_READY, apply_decision, collect_deleted, storage_path

logger = logging.getLogger(__name__)
CHAT_TYPES = {"group", "supergroup"}


def keyboard(*choices: tuple[str, str]) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text=caption, callback_data=data) for caption, data in choices
    ]])


async def deliver_one(bot: Bot, group_id: int) -> None:
    with SessionLocal() as db:
        article = db.scalar(select(WikiArticle).where(
            WikiArticle.status == "pending", WikiArticle.moderation_sent.is_(False),
        ).order_by(WikiArticle.created_at, WikiArticle.id).limit(1))
    if article is None:
        return
    group = await bot.get_chat(group_id)
    if group.id != group_id or group.type not in CHAT_TYPES or group.username or getattr(group, "active_usernames", None):
        raise RuntimeError("Wiki Telegram group is no longer private")
    ids = list(article.delivery)
    for index, file in enumerate(article.files):
        if index < len(ids):
            continue
        sent = await bot.send_document(
            group_id, FSInputFile(storage_path(article.id) / f"{index}.pdf", filename=file["name"]),
            caption=f"Заявка {article.id} · газета {index + 1} из {len(article.files)}",
            protect_content=True,
        )
        ids.append(sent.message_id)
        remember_delivery(article.id, ids)

    if len(ids) == len(article.files):
        originals = "\n".join(file["name"] for file in article.files)
        content = (
            f"ID: {article.id}\nВремя UTC: {article.created_at.isoformat()}Z\n"
            f"Браузер/устройство (User-Agent): {article.user_agent}\nPDF:\n{originals}\n\n"
            f"Название:\n{article.title}\n\nТекст статьи:\n{article.body}"
        )
        sent = await bot.send_document(
            group_id, BufferedInputFile(content.encode("utf-8"), filename=f"{article.id}.txt"),
            caption=f"Полный текст заявки {article.id}", protect_content=True,
        )
        ids.append(sent.message_id)
        remember_delivery(article.id, ids)

    sent = await bot.send_message(
        group_id, f"Новая статья VEMap\n{article.title}\nID {article.id}",
        reply_markup=keyboard(("Принять", f"wiki:approve:{article.id}"), ("Отклонить", f"wiki:reject:{article.id}")),
        protect_content=True,
    )
    remember_delivery(article.id, [*ids, sent.message_id], completed=True)


def remember_delivery(article_id: str, ids: list[int], completed: bool = False) -> None:
    with SessionLocal.begin() as db:
        article = db.get(WikiArticle, article_id, with_for_update=True)
        if article is not None:
            article.delivery = ids
            article.moderation_sent = completed


async def notify_block(bot: Bot, group_id: int) -> None:
    with SessionLocal() as db:
        state = db.get(WikiControl, 1)
        if not state.blocked or state.generation == state.notified:
            return
        reason = BLOCK_MESSAGES[state.blocked]
        generation = state.generation
    await bot.send_message(
        group_id,
        f"Сработала блокировка «{reason}». Wiki отклоняет новые заявки. Нажмите Continue, чтобы продолжить.",
        reply_markup=keyboard(("Continue", f"wiki:continue:{generation}")),
        protect_content=True,
    )
    with SessionLocal.begin() as db:
        state = db.get(WikiControl, 1, with_for_update=True)
        if state.generation == generation:
            state.notified = generation


async def handle_update(bot: Bot, group_id: int, username: str, incoming: Update) -> None:
    callback = incoming.callback_query
    if callback is not None:
        message = callback.message
        if (message is None or message.chat.id != group_id or message.chat.type not in CHAT_TYPES
                or callback.from_user.is_bot):
            return
        prefix, _, rest = (callback.data or "").partition(":")
        action, _, value = rest.partition(":")
        if prefix != "wiki" or action not in {"continue", "approve", "reject"}:
            return
        result = await asyncio.to_thread(apply_decision, action, value)
        await bot.answer_callback_query(callback.id, text=result, show_alert=True)
        try:
            await bot.edit_message_reply_markup(chat_id=group_id, message_id=message.message_id, reply_markup=None)
        except Exception as exc:
            logger.info("Could not clear Wiki moderation buttons: %s", type(exc).__name__)
        return

    message = incoming.message
    if message is None or message.chat.id != group_id or message.chat.type not in CHAT_TYPES or not message.text:
        return
    if message.sender_chat:
        if message.sender_chat.id != group_id:
            return
    elif not message.from_user or message.from_user.is_bot:
        return
    command, _, arg = message.text.partition(" ")
    name, _, target = command.partition("@")
    if target and target.casefold() != username.casefold():
        return
    if name == "/wiki":
        await bot.send_message(group_id, "Команды VEMap Wiki\n/delete ID — удалить статью\n/retry ID — заново получить CSV")
    elif name in {"/delete", "/retry"}:
        result = await asyncio.to_thread(apply_decision, name[1:], arg.strip())
        await bot.send_message(group_id, result, protect_content=True)


async def telegram_loop() -> None:
    token = settings.WIKI_TELEGRAM_TOKEN.get_secret_value().strip()
    if not token:
        return
    group_id = settings.WIKI_TELEGRAM_CHAT_ID
    try:
        async with Bot(token=token).context() as bot:
            verified = False
            username = ""
            while True:
                try:
                    if not verified:
                        group = await bot.get_chat(group_id)
                        if group.id != group_id or group.type not in CHAT_TYPES or group.username:
                            logger.error("Wiki Telegram target must be the configured group or supergroup")
                            return
                        if (await bot.get_webhook_info()).url:
                            logger.error("Wiki Telegram bot already has a webhook")
                            return
                        username = (await bot.get_me()).username or ""
                        verified = True
                    with SessionLocal() as db:
                        offset = db.get(WikiControl, 1).update_offset
                    updates = await bot.get_updates(offset=offset, timeout=3, allowed_updates=["message", "callback_query"])
                    BOT_READY.set()
                    for incoming in updates:
                        try:
                            await handle_update(bot, group_id, username, incoming)
                        except Exception as exc:
                            logger.warning("Wiki moderation update failed: %s", type(exc).__name__)
                        with SessionLocal.begin() as db:
                            db.get(WikiControl, 1).update_offset = incoming.update_id + 1
                    await notify_block(bot, group_id)
                    await deliver_one(bot, group_id)
                    await asyncio.to_thread(collect_deleted)
                except TelegramRetryAfter as exc:
                    BOT_READY.clear()
                    await asyncio.sleep(min(float(exc.retry_after), 300))
                except Exception as exc:
                    BOT_READY.clear()
                    verified = False
                    logger.warning("Wiki Telegram unavailable: %s", type(exc).__name__)
                    await asyncio.sleep(10)
    except Exception as exc:
        logger.error("Wiki Telegram could not start: %s", type(exc).__name__)
    finally:
        BOT_READY.clear()
