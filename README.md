# AcrylicGoose

A plain HTML and JavaScript folder. No build step.

### GitHub Pages

Публичный сайт: https://imgrnd.github.io/stone-atmosphere/ — после `git push github main` обновляется автоматически (ветка `main`, папка `/`).

Первый раз (нужен `gh auth login`):

```bash
./scripts/publish-github-pages.sh
```

Дальше после правок:

```bash
git push github main
```

Админка (`admin.html`, `catalog-admin.html`, `stones-export.html`) **не работает на GitHub Pages** (нет API). Локально или на VPS — через `scripts/export_stones_server.py`.

From the repo root:

```bash
python3 -m http.server 43123
```

Open http://127.0.0.1:43123

### Локальная админка (порт 43124)

```bash
python3 scripts/export_stones_server.py
```

Без переменных `ADMIN_*` сервер открыт без пароля (только для разработки на своём компьютере).

Если админка пустая: на 43124 не должен быть `python3 -m http.server` — только этот скрипт. Перезапустите его после обновления кода.

- http://127.0.0.1:43124/admin.html — хаб
- http://127.0.0.1:43124/catalog-admin.html — мини-каталог на главной (бренды, порядок, ручной набор слайдов)
- http://127.0.0.1:43124/stones-export.html — экспорт партнёров в `stones.json`

### Админка на VPS (прод)

Публичный сайт остаётся на GitHub Pages (или FTP на `www`). Редактирование каталога — отдельный поддомен, например `https://admin.ваш-домен.ru/`, с **HTTPS** и **HTTP Basic Auth**.

1. Клонировать репозиторий на сервер (нужны Python 3 и Node.js).
2. Скопировать [deploy/admin.env.example](deploy/admin.env.example) в `/etc/acrylicgoose/admin.env`, задать `ADMIN_USER` и длинный `ADMIN_PASSWORD` (≥20 символов), `chmod 600`.
3. Подключить [deploy/acrylicgoose-admin.service](deploy/acrylicgoose-admin.service): поправить `WorkingDirectory`, `systemctl enable --now acrylicgoose-admin`.
4. Настроить TLS reverse proxy на `127.0.0.1:43124` — [deploy/Caddyfile.example](deploy/Caddyfile.example) или [deploy/nginx-admin.conf.example](deploy/nginx-admin.conf.example). Basic Auth запрашивает сам Python-сервер; без HTTPS пароль передаётся открытым текстом.
5. Закрыть порт 43124 снаружи firewall (слушает только `127.0.0.1`, если `ADMIN_BIND` не меняли).

Страницы `…/admin.html` на `github.io` — только статическая копия интерфейса, API там нет. Рабочий вход: URL вашего admin-хоста после шага 4.

После правок на VPS закоммитьте изменённые `catalog-mini.config.json`, `catalog-mini/*.json` и при необходимости `stones.json`, затем `git push github main` или выгрузка на хостинг по FTP.

Конфиг мини-каталога: `catalog-mini.config.json`. После правок в админке нажмите «Применить на главной» или:

```bash
node scripts/build-catalog-mini.mjs
```

В git коммитьте `catalog-mini.config.json`, `catalog-mini.js` и `catalog-mini/*.json` (кроме служебного `_candidates.json`, его можно пересоздать).

### Заявки с формы на главной (PHP)

Приём заявок и просмотр в браузере на обычном PHP-хостинге (например `stone-vibe.ru`), без Python.

**Один раз на сервере** (рядом с `public_html`, не в git):

```bash
mkdir -p ~/domains/stone-vibe.ru/private/briefs
chmod 750 ~/domains/stone-vibe.ru/private ~/domains/stone-vibe.ru/private/briefs
cp deploy/brief-config.example.php ~/domains/stone-vibe.ru/private/brief-config.php
# задайте admin_password_hash: php -r "echo password_hash('ВАШ_ПАРОЛЬ', PASSWORD_DEFAULT), PHP_EOL;"
chmod 600 ~/domains/stone-vibe.ru/private/brief-config.php
```

В `public_html` должны быть каталоги из репо: `api/`, `admin/`, `lib/` (вместе с остальной статикой). Папку `private/` **не** копировать в `public_html`. При `rsync` не затирайте `~/domains/…/private/`.

- Форма на главной → `POST /api/brief-submit.php`
- Список заявок: **https://ваш-домен.ru/admin/briefs.php** (HTTP Basic Auth, логин из `brief-config.php`)

### Экспорт коллекций с сайтов партнёров

Служебная форма (Interstone, Staron, HI-MACS → фрагмент `stones.json`) — через тот же сервер выше.

HI-MACS из CLI ([hi-macs.ru/colors](https://hi-macs.ru/colors)): `python3 scripts/partner_export.py himacs` или `himacs solid`.

После правок палитры и `stones.json`:

```bash
python3 scripts/fetch-stones.py
node scripts/build-catalog-mini.mjs
```
