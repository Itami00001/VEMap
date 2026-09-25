# step16 — Telegram (v1.1)

> Актуализировано по tz-v1.1: Telegram-бот — вторичный источник. Выбор города + региона; опросы без изменений структуры.

## Файлы
backend/app/modules/telegram/bot.py
backend/app/modules/telegram/handlers.py
backend/app/modules/telegram/service.py
backend/app/modules/telegram/model.py

## Что сделать
1. Модель TelegramUser: telegram_user_id (PK), username, language, region_id, created_at, updated_at.
2. /start:
   - upsert user по telegram_user_id;
   - если региона/города нет — FSM: спросить город (стартовый список tz-v1.1 §8), region_id выводится из города;
   - после выбора — сохранить city_id + region_id.
3. Команда /survey: активный опрос года → пройти вопросы.
4. Ответы → Response(source="telegram", user_id=telegram_user_id, region_id).
5. Рассылку вынести в отдельный сервис broadcast.py (не в MVP).

## НЕ делать
- Не использовать username как PK.
- Не хранить chat_id в открытом виде более необходимого.

## Проверка
- /start → бот спрашивает регион.
- Выбор региона → сохранён в БД.
- /survey → вопросы → ответы в responses.