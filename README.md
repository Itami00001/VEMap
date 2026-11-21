# VEMap

Интерактивная карта исторических данных и каталог архивных газет. Публичный адрес проекта — [vemap.ru](https://vemap.ru).

## Локальный запуск

Нужны Docker и Docker Compose v2. Скопируйте `.env.example` в `.env` в корне проекта. Задайте случайный `JWT_SECRET` и свой `ADMIN_PASSWORD` перед первым запуском.

```sh
docker compose up -d --build
```

Откройте [карту](http://localhost:5173) или [документацию API](http://localhost:8001/docs). При старте backend создаёт таблицы и первого администратора, загружает регионы из `data/seed/regions.json` и импортирует `articles.csv`, `map_data.csv` и `draft_for_webdev.csv` из `data/examples/`.

Для разработки frontend поднимите `docker compose up -d --build postgres backend`. В `frontend/` скопируйте собственный `.env.example` в `.env`, выполните `npm ci` и `npm run dev` с Node.js 24. Пример frontend указывает на API на порту `8001`. `docker compose down` останавливает контейнеры с сохранением тома PostgreSQL.

### Переменные окружения

- `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` задают ключ подписи токена и учётную запись первого администратора. Изменение `ADMIN_PASSWORD` после создания аккаунта не сбрасывает пароль в базе.
- `GROQ_API_KEY`, `YANDEX_API_KEY`, `YANDEX_FOLDER_ID` и `GOOGLE_API_KEY` подключают провайдеров чата. Соответствующие `GROQ_MODEL`, `YANDEX_MODEL` и `GOOGLE_MODEL` меняют модель. Без ключей карта и каталог работают, а соответствующий провайдер чата недоступен.
- `DATABASE_URL` нужен при запуске backend напрямую. Docker Compose задаёт свой адрес по имени сервиса `postgres`. Для существующего сервера изменение пароля PostgreSQL требует обновления роли в самой БД и строки подключения.
- `VITE_API_URL` и `VITE_USE_MOCKS` читаются при сборке frontend. Production-сборка использует относительные `/api/...`, которые nginx проксирует в backend. `VITE_*` видны браузеру.

### Архивные данные

Docker монтирует `data/` с хоста. PDF и одноимённые необязательные `.txt` можно разместить в `data/examples/all_searchable_pdfs/` и `data/examples/terjiman/`. Эти каталоги синхронизируются отдельно от Git и контейнерных образов. Проверить наличие выпусков можно через `/api/newspaper-catalog`.

## CI/CD и домашний сервер

GitHub Actions проверяет frontend и запускает тестовый стек с отдельной базой. После проверок образы из `codex/home-server-ci` публикуются в GHCR с тегом `sha-<commit>` и двумя дайджестами в итогах запуска.

Для production выберите проверенный коммит из `codex/home-server-ci` и отправьте новый тег вида `production-v1.0.0`. CI ещё раз проверит этот коммит, опубликует оба образа и добавит их дайджесты в манифест GitHub Release.

```sh
git tag -a production-v1.0.0 COMMIT_SHA -m 'Deploy VEMap 1.0.0'
git push origin refs/tags/production-v1.0.0
```

На Fedora или Ubuntu серверу нужны Docker Compose **2.24.4+**, Bash, Python 3, `curl`, `flock` и исходящие подключения к GitHub и GHCR. Текущая установка использует Compose-проект `vemap-live` в `~/projects/vemap-live`, существующий том PostgreSQL и локальный origin `http://127.0.0.1:15173`. Для публичного HTTPS настройте маршрут Cloudflare Tunnel с `vemap.ru` на этот origin. На новом сервере клонируйте репозиторий, перенесите `.env` и `data/`, восстановите БД из проверенного дампа и настройте маршрут туннеля. Для первоначального запуска стека из исходников используйте `docker compose -p vemap-live -f docker-compose.yml -f deploy/compose.production.yml up -d --build`.

Если пакеты GHCR приватные, на сервере войдите в реестр под аккаунтом с доступом к обоим пакетам. GitHub требует токен classic с `read:packages`. Введите токен в приватном терминале. [Документация GHCR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)

```sh
docker login ghcr.io --username YOUR_GITHUB_LOGIN
```

Первый деплой выполняется вручную из каталога стека. После появления релиза запустите `bash deploy/rollout.sh --follow`. Для запуска по выбранным образам передайте два полных значения вида `ghcr.io/...@sha256:...` из итогов успешного CI.

```sh
bash deploy/rollout.sh "$BACKEND_IMAGE" "$FRONTEND_IMAGE"
```

Скрипт загружает оба образа до перезапуска сервисов, сохраняет проверяемый дамп PostgreSQL в `~/projects/vemap-db-backups` и проверяет главную страницу и `/api/periods`. При неудаче он возвращает предыдущие образы. Вручную их можно вернуть командой `bash deploy/rollout.sh --rollback`. Откат контейнеров сохраняет текущий том, а дамп даёт отдельную точку восстановления БД.

После первого успешного деплоя установите пользовательский таймер systemd под пользователем, который управляет Docker. Таймер проверяет последний GitHub Release каждые пять минут и применяет опубликованный манифест production.

```sh
install -Dm644 deploy/vemap-rollout.service ~/.config/systemd/user/vemap-rollout.service
install -Dm644 deploy/vemap-rollout.timer ~/.config/systemd/user/vemap-rollout.timer
systemctl --user daemon-reload
systemctl --user enable --now vemap-rollout.timer
```

Если деплой должен работать после выхода пользователя из SSH, включите `loginctl enable-linger` для пользователя развёртывания. При переносе на VPS обновите `ExecStart`, если меняется каталог стека. Проверяйте журнал через `journalctl --user -u vemap-rollout.service`.

## VEMap Wiki и локальный чат

Wiki хранит исходные PDF в томе `wiki_files`, а заявки, подтверждённые публикации и точки — в PostgreSQL. При переносе или восстановлении нужен и дамп БД, и копия тома. Модерация работает только для настроенной закрытой группы. На VPS запустите `python3 /srv/vemap/deploy/configure-wiki-telegram.py` в интерактивном SSH-сеансе. Утилита проверит бота и группу, затем сохранит настройки без печати токена. Для группы используется отдельный бот с polling. Кнопки принимают или отклоняют заявки. Команды группы — `/automative` (меню с кнопками), `/help` (справка), `/list [страница]` (опубликованные статьи), `/view <ID>` (текст и оригинальные PDF опубликованной статьи), `/delete <ID>` и `/retry <ID>`.

Форма принимает до трёх PDF объёмом до 24 МиБ каждый и 36 МиБ суммарно. Ограничение на отправителя применяется по HMAC IP (IPv6 /64) и московскому календарному дню. В Telegram передаётся User-Agent браузера, исходные PDF и полный текст. До одобрения публикация не доступна по публичному API. Для production за Caddy используйте `WIKI_TRUST_PROXY=true`. Точное расположение доверенной границы — Caddy перед внутренним Nginx. Не включайте это значение при прямом публичном доступе к backend.

После одобрения worker извлекает текст PDF и ищет однозначные названия из справочника городов VEMap. Страницы без пригодного текста распознаёт Tesseract с [Iskra OCR orus](https://github.com/AButon-8/iskra_ocr). При обнаружении арабской графики Tesseract использует модель ara. Для встроенного обработчика лимит составляет 32 страницы на статью. CSV сохраняет название, координаты, номер PDF и страницу исходного файла. Значение Mood Index в строках этого обработчика пустое. Упоминания вне справочника и неоднозначные совпадения пропускаются.

- `WIKI_OCR_COMMAND` — JSON-массив программы и аргументов для внешнего OCR с позиционными параметрами `input.pdf output.pdf`. Выход — текстовый PDF с тем же количеством страниц.
- `WIKI_PROCESSOR` — альтернативная команда всей цепочки, JSON-массив argv. Worker добавляет `--output points.csv` и отдельный `--input` для каждого PDF. CSV в UTF-8, обязательные поля `lat,lon`, дополнительные `name,mood_index,file_index,page`. `file_index` с нуля, `page` с единицы.

Для локального чата на VPS с сетью `vemap-live_default` выполните `bash deploy/install-local-llm.sh`. Укажите `LOCAL_LLM_URL=http://local-llm:8080` и `CHAT_ALLOW_CLOUD=false` в настройках стека и пересоздайте backend через штатный релиз. Запросы идут по внутренней сети Docker. Один запрос выполняется, до пяти ждут в очереди до 75 секунд. Ссылки на страницы формируются из страниц, отобранных для контекста ответа.

Пакетный OCR Терджимана запускается из контейнера backend командой `python -m scripts.terjiman_batch --input /input --output /output/terjiman.csv`. На каждую страницу записывается отдельная строка с исходным файлом, методом, статусом и текстом. Результаты выпусков сохраняются в `checkpoints` рядом с финальным CSV. В этом экспорте сохраняется исходная графика OCR. Для транслитерации и перевода нужен отдельный этап.
