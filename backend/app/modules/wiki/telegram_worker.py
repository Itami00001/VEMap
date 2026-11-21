import asyncio
import logging
from datetime import timezone
from uuid import UUID

from aiogram import Bot
from aiogram.exceptions import TelegramAPIError, TelegramRetryAfter
from aiogram.types import (
    BotCommand, BotCommandScopeChat, BufferedInputFile, FSInputFile,
    InlineKeyboardButton, InlineKeyboardMarkup, Update,
)
from sqlalchemy import select

from app.config import settings
from app.db.database import SessionLocal
from app.modules.wiki.models import WikiArticle, WikiControl
from app.modules.wiki.service import (
    BLOCK_MESSAGES, BOT_READY, MOSCOW, apply_decision, collect_deleted, storage_path,
)

logger = logging.getLogger(__name__)
CHAT_TYPES = {"group", "supergroup"}
LIST_PAGE_SIZE = 2
COMMANDS = {
    "help": "Справка по командам",
    "automative": "Открыть меню модерации с кнопками",
    "list": "Опубликованные статьи (/list 2 — вторая страница)",
    "view": "Карточка, текст и PDF статьи (/view ID)",
    "delete": "Удалить статью (/delete ID)",
    "retry": "Повторить обработку CSV (/retry ID)",
}


def keyboard(*choices: tuple[str, str]) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text=caption, callback_data=data) for caption, data in choices
    ]])


async def show_menu(bot: Bot, group_id: int) -> None:
    await bot.send_message(
        group_id, "Модерация VEMap Wiki",
        reply_markup=keyboard(("Опубликованные статьи", "wiki:list:1"), ("Справка", "wiki:help:")),
    )


async def show_help(bot: Bot, group_id: int) -> None:
    commands = "\n".join(f"/{name} — {description}" for name, description in COMMANDS.items())
    await bot.send_message(group_id, f"Команды VEMap Wiki\n\n{commands}")


async def is_private_group(bot: Bot, group_id: int) -> bool:
    group = await bot.get_chat(group_id)
    return (group.id == group_id and group.type in CHAT_TYPES and not group.username
            and not getattr(group, "active_usernames", None))


async def send_article_pdf(bot: Bot, group_id: int, article: WikiArticle, index: int):
    file = article.files[index]
    label = "Заявка" if article.status == "pending" else "Статья"
    return await bot.send_document(
        group_id, FSInputFile(storage_path(article.id) / f"{index}.pdf", filename=file["name"]),
        caption=f"{label} {article.id} · газета {index + 1} из {len(article.files)}",
    )


async def send_article_text(bot: Bot, group_id: int, article: WikiArticle):
    originals = "\n".join(file["name"] for file in article.files)
    published = f"Опубликована UTC: {article.published_at.isoformat()}Z\n" if article.published_at else ""
    content = (
        f"ID: {article.id}\nВремя UTC: {article.created_at.isoformat()}Z\n"
        f"{published}Браузер/устройство (User-Agent): {article.user_agent}\nPDF:\n{originals}\n\n"
        f"Название:\n{article.title}\n\nТекст статьи:\n{article.body}"
    )
    label = "заявки" if article.status == "pending" else "статьи"
    return await bot.send_document(
        group_id, BufferedInputFile(content.encode("utf-8"), filename=f"{article.id}.txt"),
        caption=f"Полный текст {label} {article.id}",
    )


def published_page(page: int) -> list[WikiArticle]:
    with SessionLocal() as db:
        return list(db.scalars(
            select(WikiArticle).where(WikiArticle.status == "approved")
            .order_by(WikiArticle.published_at.desc(), WikiArticle.id)
            .offset((page - 1) * LIST_PAGE_SIZE).limit(LIST_PAGE_SIZE + 1)
        ))


async def list_published(bot: Bot, group_id: int, value: str, *, buttons: bool = False) -> None:
    if value and (not value.isascii() or not value.isdecimal() or len(value) > 6 or int(value) == 0):
        await bot.send_message(group_id, "Укажите номер страницы, например /list 2.")
        return
    page = int(value) if value else 1
    articles = await asyncio.to_thread(published_page, page)
    if not articles:
        text = "Опубликованных статей пока нет." if page == 1 else "На этой странице нет статей. Начните с /list."
        await bot.send_message(group_id, text, reply_markup=keyboard(("Меню", "wiki:menu:")) if buttons else None)
        return

    lines = [f"Опубликованные статьи · страница {page}"]
    rows = []
    for number, article in enumerate(articles[:LIST_PAGE_SIZE], 1):
        timestamp = article.published_at or article.created_at
        local = timestamp.replace(tzinfo=timezone.utc).astimezone(MOSCOW)
        device = " ".join(article.user_agent.split())[:120] or "не указано"
        names = ", ".join(" ".join(file["name"].split()) for file in article.files)
        title = " ".join(article.title.split())[:80]
        prefix = f"{number}. " if buttons else ""
        lines.append(f"{prefix}{title}\nID: {article.id}\n{local:%d.%m.%Y %H:%M} МСК\nУстройство: {device}\nPDF: {names}")
        if buttons:
            rows.extend(keyboard(
                (f"{number}. Открыть", f"wiki:view:{article.id}"),
                (f"{number}. Удалить", f"wiki:ask-delete:{article.id}"),
                (f"{number}. Повторить CSV", f"wiki:retry:{article.id}"),
            ).inline_keyboard)
    navigation = []
    if page > 1:
        navigation.append(f"/list {page - 1} ←")
    if len(articles) > LIST_PAGE_SIZE:
        navigation.append(f"/list {page + 1} →")
    if buttons:
        controls = []
        if page > 1:
            controls.append(("← Назад", f"wiki:list:{page - 1}"))
        controls.append(("Меню", "wiki:menu:"))
        if len(articles) > LIST_PAGE_SIZE:
            controls.append(("Далее →", f"wiki:list:{page + 1}"))
        rows.extend(keyboard(*controls).inline_keyboard)
    elif navigation:
        lines.append("   ".join(navigation))
    await bot.send_message(
        group_id, "\n\n".join(lines),
        reply_markup=InlineKeyboardMarkup(inline_keyboard=rows) if rows else None,
    )


def published_article(article_id: str) -> WikiArticle | None:
    with SessionLocal() as db:
        return db.scalar(select(WikiArticle).where(WikiArticle.id == article_id, WikiArticle.status == "approved"))


async def view_published(bot: Bot, group_id: int, value: str) -> None:
    try:
        article_id = str(UUID(value))
    except ValueError:
        await bot.send_message(group_id, "Используйте /view ID. ID статьи можно скопировать из /list.")
        return
    article = await asyncio.to_thread(published_article, article_id)
    if article is None:
        await bot.send_message(group_id, "Опубликованная статья не найдена.")
        return
    await send_article_text(bot, group_id, article)
    for index in range(len(article.files)):
        await send_article_pdf(bot, group_id, article, index)


async def deliver_one(bot: Bot, group_id: int) -> None:
    with SessionLocal() as db:
        article = db.scalar(select(WikiArticle).where(
            WikiArticle.status == "pending", WikiArticle.moderation_sent.is_(False),
        ).order_by(WikiArticle.created_at, WikiArticle.id).limit(1))
    if article is None:
        return
    if not await is_private_group(bot, group_id):
        raise RuntimeError("Wiki Telegram group is no longer private")
    ids = list(article.delivery)
    for index in range(len(ids), len(article.files)):
        sent = await send_article_pdf(bot, group_id, article, index)
        ids.append(sent.message_id)
        remember_delivery(article.id, ids)

    if len(ids) == len(article.files):
        sent = await send_article_text(bot, group_id, article)
        ids.append(sent.message_id)
        remember_delivery(article.id, ids)

    sent = await bot.send_message(
        group_id, f"Новая статья VEMap\n{article.title}\nID {article.id}",
        reply_markup=keyboard(("Принять", f"wiki:approve:{article.id}"), ("Отклонить", f"wiki:reject:{article.id}")),
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
    )
    with SessionLocal.begin() as db:
        state = db.get(WikiControl, 1, with_for_update=True)
        if state.generation == generation:
            state.notified = generation


async def handle_menu_action(bot: Bot, group_id: int, callback_id: str, action: str, value: str) -> None:
    await bot.answer_callback_query(callback_id)
    if action == "menu":
        await show_menu(bot, group_id)
    elif action == "help":
        await show_help(bot, group_id)
    elif action == "list":
        await list_published(bot, group_id, value, buttons=True)
    elif action == "view":
        await view_published(bot, group_id, value)
    elif action == "retry":
        result = await asyncio.to_thread(apply_decision, "retry", value)
        await bot.send_message(group_id, result)
    elif action == "ask-delete":
        article = await asyncio.to_thread(published_article, value)
        if article is None:
            await bot.send_message(group_id, "Опубликованная статья не найдена.")
        else:
            await bot.send_message(
                group_id, f"Удалить статью «{article.title}»?\nID: {article.id}",
                reply_markup=keyboard(("Удалить", f"wiki:delete:{article.id}"), ("Отмена", "wiki:cancel:")),
            )


async def handle_update(bot: Bot, group_id: int, username: str, incoming: Update) -> None:
    callback = incoming.callback_query
    if callback is not None:
        message = callback.message
        if (message is None or message.chat.id != group_id or message.chat.type not in CHAT_TYPES
                or callback.from_user.is_bot):
            return
        prefix, _, rest = (callback.data or "").partition(":")
        action, _, value = rest.partition(":")
        if prefix != "wiki" or not await is_private_group(bot, group_id):
            return
        if action in {"menu", "help", "list", "view", "retry", "ask-delete"}:
            await handle_menu_action(bot, group_id, callback.id, action, value)
            return
        if action not in {"continue", "approve", "reject", "delete", "cancel"}:
            return
        result = ("Удаление отменено." if action == "cancel"
                  else await asyncio.to_thread(apply_decision, action, value))
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
    parts = message.text.split(maxsplit=1)
    if not parts or not parts[0].startswith("/"):
        return
    command, _, target = parts[0][1:].partition("@")
    if target and target.casefold() != username.casefold():
        return
    name = command.casefold()
    if name in {"wiki", "hel"}:
        name = "help"
    if name not in COMMANDS or not await is_private_group(bot, group_id):
        return
    arg = parts[1].strip() if len(parts) > 1 else ""
    if name == "help":
        await show_help(bot, group_id)
    elif name == "automative":
        await show_menu(bot, group_id)
    elif name == "list":
        await list_published(bot, group_id, arg)
    elif name == "view":
        await view_published(bot, group_id, arg)
    else:
        result = await asyncio.to_thread(apply_decision, name, arg)
        await bot.send_message(group_id, result)


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
                        if not await is_private_group(bot, group_id):
                            logger.error("Wiki Telegram target must be the configured group or supergroup")
                            return
                        if (await bot.get_webhook_info()).url:
                            logger.error("Wiki Telegram bot already has a webhook")
                            return
                        username = (await bot.get_me()).username or ""
                        try:
                            await bot.set_my_commands(
                                [BotCommand(command=name, description=description)
                                 for name, description in COMMANDS.items()],
                                scope=BotCommandScopeChat(chat_id=group_id),
                            )
                        except TelegramAPIError as exc:
                            logger.warning("Could not register Wiki Telegram commands: %s", type(exc).__name__)
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
