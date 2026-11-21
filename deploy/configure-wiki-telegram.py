#!/usr/bin/env python3
"""Validate a VEMap Wiki bot and stage its credentials without echoing the token."""
import argparse
import fcntl
import getpass
import json
import os
import re
import secrets
import sys
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path("/srv/vemap")


def telegram(token, method, **data):
    body = urllib.parse.urlencode(data).encode()
    request = urllib.request.Request(f"https://api.telegram.org/bot{token}/{method}", data=body)
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            payload = json.load(response)
            return payload.get("result") if payload.get("ok") else None
    except (OSError, ValueError):
        return None


def set_env(path, entries):
    with (ROOT / ".env.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        old = path.read_text().splitlines() if path.exists() else []
        content = [line for line in old if line.split("=", 1)[0].strip() not in entries]
        content.extend(f"{name}={value}" for name, value in entries.items())
        fd, temp = tempfile.mkstemp(dir=path.parent, prefix=".env-vemap-")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as file:
                file.write("\n".join(content) + "\n")
            os.replace(temp, path)
        finally:
            if os.path.exists(temp):
                os.unlink(temp)


def read_input(prompt):
    print(prompt, end="", flush=True)
    return sys.stdin.buffer.readline().decode("utf-8", errors="ignore").strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--confirmed-group", type=int)
    args = parser.parse_args()
    token = getpass.getpass("Вставьте токен бота Telegram и нажмите Enter (токен скрыт): ").strip()
    if not re.fullmatch(r"\d+:[A-Za-z0-9_-]{20,}", token):
        raise SystemExit("Формат токена не принят. Файл настроек не изменён.")
    me = telegram(token, "getMe")
    if not me or not me.get("is_bot"):
        raise SystemExit("Telegram не подтвердил токен бота. Файл настроек не изменён.")
    webhook = telegram(token, "getWebhookInfo")
    if webhook is None or webhook.get("url"):
        raise SystemExit("Бот уже обслуживается через webhook или Telegram недоступен. Файл настроек не изменён.")
    answer = str(args.confirmed_group) if args.confirmed_group else read_input(
        "ID группы или ссылка на сообщение из неё (Enter для проверки по команде): ",
    )
    match = re.fullmatch(r"https://t\.me/c/(\d+)/(?:\d+/)?\d+/?(?:\?.*)?", answer)
    if match:
        answer = "-100" + match[1]
    if answer and not re.fullmatch(r"-?\d{1,18}", answer):
        raise SystemExit("Формат ID группы не принят. Файл настроек не изменён.")
    candidates = [int(answer)] if answer else []
    if candidates and candidates[0] > 0:
        candidates.append(int("-100" + answer))
    for candidate in candidates:
        group = telegram(token, "getChat", chat_id=candidate)
        if group and group.get("type") in {"group", "supergroup"} and not group.get("username"):
            member = telegram(token, "getChatMember", chat_id=group["id"], user_id=me["id"])
            if member and member.get("status") in {"member", "administrator", "creator"}:
                break
    else:
        if args.confirmed_group:
            raise SystemExit("Telegram не подтвердил ранее выбранную группу. Файл настроек не изменён.")
        proof = f"/wiki_setup@{me['username']} {secrets.token_hex(4)}"
        print("Указанный ID не подтвердился. Отправьте эту команду в нужную группу:")
        print(proof)
        read_input("После отправки нажмите Enter здесь. ")
        updates = telegram(token, "getUpdates", limit=100, timeout=4, allowed_updates='["message"]') or []
        matches = [
            update["message"]["chat"]["id"] for update in updates
            if update.get("message", {}).get("text") == proof
            and update["message"]["chat"].get("type") in {"group", "supergroup"}
        ]
        group = telegram(token, "getChat", chat_id=matches[-1]) if matches else None
        if not group or group.get("type") not in {"group", "supergroup"} or group.get("username"):
            raise SystemExit("Закрытая группа не подтверждена. Проверьте, что бот добавлен, и повторите.")
    title = " ".join(str(group.get("title", "")).split())
    print(f"Бот @{me['username']}, группа {title!r}, ID {group['id']}.")
    if args.confirmed_group and group["id"] != args.confirmed_group:
        raise SystemExit("Подтверждённый ID группы изменился. Файл настроек не изменён.")
    if not args.confirmed_group and read_input("Сохранить настройки только для этой группы? [y/N]: ").lower() not in {"y", "yes", "д", "да"}:
        raise SystemExit("Файл настроек не изменён.")
    set_env(ROOT / ".env", {"WIKI_TELEGRAM_TOKEN": token, "WIKI_TELEGRAM_CHAT_ID": str(group["id"])})
    print("Настройки сохранены. Токен в выводе и в истории команд отсутствует.")


if __name__ == "__main__":
    main()
