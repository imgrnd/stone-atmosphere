#!/usr/bin/env python3
"""Скачивает кадры из stones.json и заново собирает статичные блоки страниц.

Новая коллекция добавляется в stones.json. Повторный запуск докачивает
только отсутствующие файлы и пересобирает те же блоки.
"""

import json
import re
import sys
from html import escape, unescape
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, unquote, urlsplit, urlunsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
STONES = ROOT / "stones.json"
PALETTE = ROOT / "palette.html"
MATERIALS = ROOT / "materials.html"
LEGACY = ROOT / "catalog-data.js"
LOG = Path(__file__).resolve().parent / "fetch-stones.log"
IMG_ROOT = ROOT / "imgs" / "stones"
PROMO = {"акция", "вывод из коллекции"}
NOTE = "Изображения передают характер фактуры. Оттенок и масштаб рисунка рекомендуем оценивать по физическому образцу."


def code_key(code):
    parts = re.split(r"(\d+)", code)
    return [(0, int(part)) if part.isdigit() else (1, part.casefold()) for part in parts]


def file_code(code):
    cleaned = re.sub(r"[^\w.+-]+", "-", code.strip(), flags=re.UNICODE)
    cleaned = re.sub(r"-{2,}", "-", cleaned).strip("-._")
    return cleaned or "shade"


def quote_url(url):
    parts = urlsplit(url)
    path = quote(unquote(parts.path), safe="/")
    return urlunsplit((parts.scheme, parts.netloc, path, parts.query, parts.fragment))


def sniff(data):
    if data[:3] == b"\xff\xd8\xff":
        return ".jpg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return ".png"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return ".gif"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    return None


def import_legacy():
    raw = LEGACY.read_text(encoding="utf-8")
    raw = raw[raw.index("{") : raw.rindex("}") + 1]
    catalog = json.loads(raw)
    html = PALETTE.read_text(encoding="utf-8")
    by_brand = {}

    for part in re.split(r'<section class="palette"', html)[1:]:
        brand_id = re.search(r'id="([^"]+)"', part).group(1)
        shades = []

        for item in re.finditer(r'<li class="swatch"([^>]*)>(.*?)</li>', part, re.S):
            attrs, body = item.group(1), item.group(2)
            image = re.search(r'<img src="([^"]+)"', body)

            if not image:
                continue

            def attr(name, source=attrs):
                found = re.search(rf'data-{name}="([^"]*)"', source)
                return unescape(found.group(1)) if found else ""

            shades.append({
                "brand": brand_id,
                "name": attr("name"),
                "code": attr("code"),
                "url": unescape(image.group(1)),
                "collections": attr("collection").split(),
                "isNew": attr("new") == "true",
            })

        by_brand[brand_id] = shades

    brands = []
    for brand in catalog["brands"]:
        brands.append({
            "id": brand["id"],
            "name": brand["name"],
            "type": brand["type"],
            "typeName": brand["typeName"],
        })

    collections = []
    for collection in catalog["collections"]:
        item = {
            "id": collection["id"],
            "brand": collection["brand"],
            "name": collection["name"],
            "lead": collection.get("lead") or "",
        }

        if collection.get("whole"):
            item["whole"] = True

        collections.append(item)

    shades = []
    seen = {}

    for brand in brands:
        if brand["id"] == "staron":
            continue

        for shade in by_brand.get(brand["id"], []):
            key = (shade["brand"], shade["code"])
            current = seen.get(key)

            if current:
                for collection_id in shade["collections"]:
                    if collection_id not in current["collections"]:
                        current["collections"].append(collection_id)
                continue

            shades.append(shade)
            seen[key] = shade

    for shade in catalog["shades"].get("staron", []):
        shades.append({
            "brand": "staron",
            "name": shade["name"],
            "code": shade["code"],
            "url": shade["image"],
            "collections": list(shade["collections"]),
            "isNew": bool(shade.get("isNew")),
        })

    whole = {item["brand"]: item["id"] for item in collections if item.get("whole")}

    for shade in shades:
        if not shade["collections"] and shade["brand"] in whole:
            shade["collections"] = [whole[shade["brand"]]]

    return {"brands": brands, "collections": collections, "shades": shades}


def load_stones():
    if not STONES.exists():
        data = import_legacy()
        STONES.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    return json.loads(STONES.read_text(encoding="utf-8"))


def collection_map(data):
    return {(item["brand"], item["id"]): item for item in data["collections"]}


def primary_id(shade, collections):
    regular = []

    for collection_id in shade["collections"]:
        collection = collections.get((shade["brand"], collection_id))

        if collection and collection["name"].strip().casefold() not in PROMO:
            regular.append(collection_id)

    return (regular or shade["collections"])[0]


def shade_dir(shade, collections):
    folder = IMG_ROOT / shade["brand"]

    if not shade["collections"]:
        return folder

    collection = collections.get((shade["brand"], primary_id(shade, collections)))

    if not collection:
        return None

    folder = IMG_ROOT / shade["brand"]

    if not collection.get("whole"):
        folder = folder / collection["id"]

    return folder


def saved_file(folder, code):
    if not folder.exists():
        return None

    for path in folder.glob(file_code(code) + ".*"):
        if not path.is_file() or path.stat().st_size == 0:
            continue

        with path.open("rb") as handle:
            if sniff(handle.read(16)):
                return path

    return None


def download(data):
    collections = collection_map(data)
    saved = {}
    failed = []

    for shade in data["shades"]:
        folder = shade_dir(shade, collections)

        if folder is None:
            failed.append(f"{shade['brand']} {shade['code']}: неизвестная коллекция")
            continue

        ready = saved_file(folder, shade["code"])

        if ready:
            saved[(shade["brand"], shade["code"])] = ready.relative_to(ROOT).as_posix()
            continue

        try:
            request = Request(quote_url(shade["url"]), headers={"User-Agent": "AcrylicGoose/1.0"})

            with urlopen(request, timeout=40) as response:
                payload = response.read()
        except (HTTPError, URLError, TimeoutError, OSError) as error:
            failed.append(f"{shade['url']}: {error}")
            continue

        extension = sniff(payload)

        if not extension:
            failed.append(f"{shade['url']}: ответ не изображение")
            continue

        folder.mkdir(parents=True, exist_ok=True)
        path = folder / f"{file_code(shade['code'])}{extension}"
        path.write_bytes(payload)
        saved[(shade["brand"], shade["code"])] = path.relative_to(ROOT).as_posix()
        print(saved[(shade["brand"], shade["code"])], flush=True)

    LOG.write_text("\n".join(failed) + ("\n" if failed else ""), encoding="utf-8")
    print(f"скачано и на месте: {len(saved)}, сбоев: {len(failed)}", flush=True)
    return saved


def brand_by_id(data):
    return {brand["id"]: brand for brand in data["brands"]}


def usable(data, saved):
    collections = collection_map(data)
    grouped = {}

    for shade in data["shades"]:
        path = saved.get((shade["brand"], shade["code"]))

        if not path:
            continue

        for collection_id in shade["collections"]:
            grouped.setdefault((shade["brand"], collection_id), []).append((shade, path))

    for key in grouped:
        grouped[key].sort(key=lambda item: code_key(item[0]["code"]))

    return collections, grouped


def swatch(shade, path, collection_name):
    badge = ""

    if shade.get("isNew"):
        badge = '\n              <span class="swatch__badge">Новинка</span>'

    label = ""

    if collection_name:
        label = f'\n                <span class="swatch__collection">{escape(collection_name)}</span>'

    return f"""          <li class="swatch">
            <article>
              <div class="swatch__frame">
                <img src="{escape(path, quote=True)}" alt="{escape(shade['name'], quote=True)}" loading="lazy" decoding="async">{badge}
              </div>
              <h2 class="swatch__name">{escape(shade['name'])}</h2>
              <p class="swatch__meta">
                <span class="swatch__code">{escape(shade['code'])}</span>{label}
              </p>
            </article>
          </li>"""


def render_materials(data, saved):
    collections, grouped = usable(data, saved)
    brands = brand_by_id(data)
    cards = []

    for collection in data["collections"]:
        shades = grouped.get((collection["brand"], collection["id"]))

        if not shades:
            continue

        brand = brands[collection["brand"]]
        anchor = collection["brand"] if collection.get("whole") else f"{collection['brand']}-{collection['id']}"
        href = f"palette.html#{anchor}"
        service = brand["typeName"] if collection["name"] == brand["name"] else brand["name"]
        text = f'\n          <p class="brand__text">{escape(collection["lead"])}</p>' if collection.get("lead") else ""
        cover = shades[0][1]
        cards.append(f"""        <li class="brand" data-brand="{escape(brand['id'], quote=True)}" data-brand-name="{escape(brand['name'], quote=True)}">
          <a class="brand__media" href="{href}">
            <img src="{escape(cover, quote=True)}" alt="{escape(collection['name'], quote=True)}" width="540" height="304" decoding="async">
          </a>
          <div class="brand__head">
            <h2 class="brand__name">{escape(collection['name'])}</h2>
            <p class="brand__type">{escape(service)}</p>
          </div>{text}
          <a class="brand__more" href="{href}">Смотреть коллекцию<i class="glyph ri-external-link-fill" aria-hidden="true"></i></a>
        </li>""")

    return "<ul class=\"brands__grid\">\n" + "\n".join(cards) + "\n      </ul>"


def render_palette(data, saved):
    collections, grouped = usable(data, saved)
    brands = brand_by_id(data)
    blocks = []

    for brand in data["brands"]:
        own = [item for item in data["collections"] if item["brand"] == brand["id"]]
        visible = [item for item in own if grouped.get((brand["id"], item["id"]))]

        if not visible:
            continue

        names = [item["name"] for item in visible if not item.get("whole")]
        lead = brand["typeName"] + "."

        if names:
            lead = f"{brand['typeName']}. Коллекции: {', '.join(names)}."

        first = grouped[(brand["id"], visible[0]["id"])][0]
        parts = [f"""    <section class="palette" id="{escape(brand['id'], quote=True)}">
      <nav class="crumbs" aria-label="Навигация">
        <a href="index.html">Главная</a>
        <span aria-hidden="true">/</span>
        <a href="materials.html">Материалы</a>
        <span aria-hidden="true">/</span>
        <span>{escape(brand['name'])}</span>
      </nav>
      <header class="palette__intro">
        <div class="palette__copy">
          <p class="palette__eyebrow">{escape(brand['typeName'])}</p>
          <h1 class="palette__title">{escape(brand['name'])}</h1>
          <p class="palette__lead">{escape(lead)}</p>
        </div>
        <figure class="palette__shot">
          <img src="{escape(first[1], quote=True)}" alt="{escape(first[0]['name'], quote=True)}" width="540" height="304" decoding="async">
        </figure>
      </header>"""]

        for collection in visible:
            shades = grouped[(brand["id"], collection["id"])]
            grid = "\n".join(swatch(shade, path, collection["name"]) for shade, path in shades)

            if collection.get("whole"):
                parts.append(f"""      <ul class="palette__grid">
{grid}
      </ul>""")
                continue

            parts.append(f"""      <section class="collection" id="{escape(brand['id'] + '-' + collection['id'], quote=True)}">
        <h2 class="collection__title">{escape(collection['name'])}</h2>
        <ul class="palette__grid">
{grid}
        </ul>
      </section>""")

        loose = [
            (shade, saved[(shade["brand"], shade["code"])])
            for shade in data["shades"]
            if shade["brand"] == brand["id"] and not shade["collections"] and (shade["brand"], shade["code"]) in saved
        ]
        loose.sort(key=lambda item: code_key(item[0]["code"]))

        if loose:
            grid = "\n".join(swatch(shade, path, "") for shade, path in loose)
            parts.append(f"""      <ul class="palette__grid">
{grid}
      </ul>""")

        parts.append(f"""      <p class="palette__note">{NOTE}</p>
    </section>""")
        blocks.append("\n".join(parts))

    return "\n\n".join(blocks)


def replace_marked(html, start, end, body, fallback):
    block = f"{start}\n{body}\n      {end}"
    pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)

    if pattern.search(html):
        return pattern.sub(block, html, count=1)

    updated, count = fallback(html, block)

    if count != 1:
        raise SystemExit(f"не найден блок {start}")

    return updated


def write_pages(data, saved):
    materials = MATERIALS.read_text(encoding="utf-8")
    materials = replace_marked(
        materials,
        "<!-- stones:materials -->",
        "<!-- /stones:materials -->",
        render_materials(data, saved),
        lambda html, block: re.subn(
            r'<div class="brands__bar">.*?</ul>',
            block,
            html,
            count=1,
            flags=re.S,
        ),
    )
    materials = re.sub(r'\n\s*<script src="catalog-data\.js[^"]*"></script>', "", materials)
    MATERIALS.write_text(materials, encoding="utf-8")

    palette = PALETTE.read_text(encoding="utf-8")
    palette = replace_marked(
        palette,
        "<!-- stones:palette -->",
        "<!-- /stones:palette -->",
        render_palette(data, saved),
        lambda html, block: re.subn(
            r'\s*<section class="palette".*?(?=\s*<section class="invite")',
            "\n" + block + "\n\n",
            html,
            count=1,
            flags=re.S,
        ),
    )
    palette = re.sub(r'\n\s*<script src="catalog-data\.js[^"]*"></script>', "", palette)
    PALETTE.write_text(palette, encoding="utf-8")


def main():
    data = load_stones()
    saved = download(data)
    write_pages(data, saved)

    if LEGACY.exists():
        LEGACY.unlink()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(1)
