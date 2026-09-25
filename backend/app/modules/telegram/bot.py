"""Telegram bot entry point. Run: python -m app.modules.telegram.bot"""
import asyncio

from app.modules.telegram.handlers import main


if __name__ == "__main__":
    asyncio.run(main())
