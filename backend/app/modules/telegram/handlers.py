"""Telegram bot handlers (aiogram). Run: python -m app.modules.telegram.bot"""
from __future__ import annotations

import asyncio
import os

from aiogram import Bot, Dispatcher, F
from aiogram.filters import Command
from aiogram.types import CallbackQuery, Message

from app.db.database import SessionLocal
from app.modules.regions.model import Region
from app.modules.surveys.model import Question
from app.modules.telegram import service as tg_service

dp = Dispatcher()
pending_answers: dict[str, dict] = {}


@dp.message(Command("start"))
async def cmd_start(message: Message) -> None:
    db = SessionLocal()
    try:
        user = tg_service.upsert_user(db, str(message.from_user.id), message.from_user.username)
        if user.region_id:
            await message.answer("Регион уже выбран. Используйте /survey для опроса.")
            return
        regions = db.query(Region).order_by(Region.federal_district, Region.name_ru).limit(40).all()
        from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

        buttons = [
            [InlineKeyboardButton(text=r.name_ru, callback_data=f"region:{r.region_id}")]
            for r in regions[:20]
        ]
        await message.answer("Выберите регион:", reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons))
    finally:
        db.close()


@dp.callback_query(F.data.startswith("region:"))
async def on_region(callback: CallbackQuery) -> None:
    region_id = callback.data.split(":", 1)[1]
    db = SessionLocal()
    try:
        user = tg_service.set_region(db, str(callback.from_user.id), region_id)
        if not user:
            await callback.answer("Не удалось сохранить регион", show_alert=True)
            return
        await callback.message.answer(f"Регион сохранён: {region_id}. Команда /survey — пройти опрос.")
    finally:
        db.close()
    await callback.answer()


@dp.message(Command("survey"))
async def cmd_survey(message: Message) -> None:
    db = SessionLocal()
    try:
        user = db.get(tg_service.TelegramUser, str(message.from_user.id))
        if not user or not user.region_id:
            await message.answer("Сначала /start и выбор региона.")
            return
        survey = tg_service.get_active_survey(db)
        if not survey:
            await message.answer("Нет активного опроса.")
            return
        questions = db.query(Question).filter(Question.survey_id == survey.id).order_by(Question.id).all()
        if not questions:
            await message.answer("В опросе нет вопросов.")
            return
        q = questions[0]
        pending_answers[str(message.from_user.id)] = {"survey_id": survey.id, "step": 0, "answers": {}}
        await message.answer(f"Вопрос 1/{len(questions)}: {q.text}\nОтветьте сообщением (scale 1-5 или текст).")
    finally:
        db.close()


@dp.message(F.text)
async def on_text_answer(message: Message) -> None:
    uid = str(message.from_user.id)
    if uid not in pending_answers:
        return
    db = SessionLocal()
    try:
        state = pending_answers[uid]
        survey_id = state["survey_id"]
        questions = db.query(Question).filter(Question.survey_id == survey_id).order_by(Question.id).all()
        step = state["step"]
        q = questions[step]
        raw = message.text.strip()
        if q.type.value == "scale":
            try:
                val = int(raw)
                if val < 1 or val > 5:
                    raise ValueError
            except ValueError:
                await message.answer("Введите число от 1 до 5.")
                return
            state["answers"][str(q.id)] = val
        else:
            state["answers"][str(q.id)] = raw
        step += 1
        if step >= len(questions):
            user = db.get(tg_service.TelegramUser, uid)
            tg_service.save_survey_response(db, user, state["answers"])
            del pending_answers[uid]
            await message.answer("Спасибо! Ответы сохранены.")
            return
        state["step"] = step
        pending_answers[uid] = state
        await message.answer(f"Вопрос {step + 1}/{len(questions)}: {questions[step].text}")
    finally:
        db.close()


async def main() -> None:
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        print("Set TELEGRAM_BOT_TOKEN to run bot")
        return
    bot = Bot(token=token)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
