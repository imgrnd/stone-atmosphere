# AcrylicGoose

A plain HTML and JavaScript folder. No build step.

### GitHub Pages

Публичный сайт: после push в `github` → `main` обновляется автоматически (Settings → Pages: ветка `main`, папка `/`).

Первый раз (нужен `gh auth login`):

```bash
./scripts/publish-github-pages.sh
```

Дальше после правок:

```bash
git push github main
```

Админка (`admin.html`, `catalog-admin.html`, `stones-export.html`) только локально через `scripts/export_stones_server.py`.

From the repo root:

```bash
python3 -m http.server 43123
```

Open http://127.0.0.1:43123

### Локальная админка (порт 43124)

```bash
python3 scripts/export_stones_server.py
```

Если админка пустая: на 43124 не должен быть `python3 -m http.server` — только этот скрипт. Перезапустите его после обновления кода.

- http://127.0.0.1:43124/admin.html — хаб
- http://127.0.0.1:43124/catalog-admin.html — мини-каталог на главной (бренды, порядок, ручной набор слайдов)
- http://127.0.0.1:43124/stones-export.html — экспорт партнёров в `stones.json`

Конфиг мини-каталога: `catalog-mini.config.json`. После правок в админке нажмите «Применить на главной» или:

```bash
node scripts/build-catalog-mini.mjs
```

В git коммитьте `catalog-mini.config.json`, `catalog-mini.js` и `catalog-mini/*.json` (кроме служебного `_candidates.json`, его можно пересоздать).

### Экспорт коллекций с сайтов партнёров

Служебная форма (Interstone, Staron, HI-MACS → фрагмент `stones.json`) — через тот же сервер выше.

HI-MACS из CLI ([hi-macs.ru/colors](https://hi-macs.ru/colors)): `python3 scripts/partner_export.py himacs` или `himacs solid`.

После правок палитры и `stones.json`:

```bash
python3 scripts/fetch-stones.py
node scripts/build-catalog-mini.mjs
```
