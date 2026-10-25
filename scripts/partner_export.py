#!/usr/bin/env python3
"""Загрузка оттенков с сайтов партнёров в формат stones.json."""

from __future__ import annotations

import json
import re
import sys
from html import unescape
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
STONES = ROOT / "stones.json"
INTERSTONE = "https://interstone.su"
STARON = "https://staron.ru"
HIMACS = "https://hi-macs.ru"
HIMACS_COLORS = f"{HIMACS}/colors"
HIMACS_BRAND = "himacs"
USER_AGENT = "AcrylicGoose/1.0"


def load_catalog():
    return json.loads(STONES.read_text(encoding="utf-8"))


def fetch_text(url, *, ajax=False):
    headers = {"User-Agent": USER_AGENT}
    if ajax:
        headers["X-Requested-With"] = "XMLHttpRequest"
    request = Request(url, headers=headers)
    with urlopen(request, timeout=40) as response:
        return response.read().decode("utf-8", "replace")


def split_interstone_title(title):
    title = re.sub(r"\s+", " ", title.strip())
    match = re.match(r"^((?:[A-Z]{1,2}\s*)?\d[\w./+-]*(?:\s*/\s*[\w./+-]+)?)\s+(.+)$", title, re.I)
    if match:
        return match.group(2).strip(), match.group(1).strip()
    match = re.match(r"^([A-Z]\s*\d{2,4})\s+(.+)$", title)
    if match:
        return match.group(2).strip(), match.group(1).strip()
    return title, title


def split_staron_title(title):
    title = re.sub(r"\s+", " ", title.strip())
    parts = title.split(" ")
    if len(parts) >= 2 and re.fullmatch(r"[A-Z]{2}\d{2,4}", parts[-1]):
        return " ".join(parts[:-1]), parts[-1]
    return title, title


def parse_interstone_cards(html):
    items = []
    for block in re.split(r'<div class="stone_card', html)[1:]:
        image = re.search(r'<img src="([^"]+)"[^>]*class="stone_cover', block)
        name = re.search(r'class="stone_name[^"]*"[^>]*title="([^"]*)"', block)
        if not image or not name:
            continue
        raw = unescape(name.group(1))
        shade_name, code = split_interstone_title(raw)
        items.append({
            "name": shade_name,
            "code": code,
            "url": unescape(image.group(1)),
            "isNew": "new-item" in block.split(">", 1)[0] or "Новинка" in block,
            "rawName": raw,
        })
    return items


def fetch_interstone(brand_id, collection_id=None):
    route = f"brands={brand_id};"
    if collection_id:
        route += f"collections={collection_id};"
    items = []
    page = 1
    while page <= 40:
        url = f"{INTERSTONE}/api/front/stones/{route}?lang=ru&page={page}"
        html = fetch_text(url, ajax=True)
        batch = parse_interstone_cards(html)
        if not batch:
            break
        items.extend(batch)
        page += 1
    return items


def staron_slug(collection_id):
    overrides = {
        "supreme": "supreme",
        "super-flex": "super-flex",
        "premiere": "premiere",
    }
    return overrides.get(collection_id, collection_id)


def parse_staron_cards(html):
    titles = re.findall(r'class="prodcard__title">([^<]+)</a>', html)
    images = re.findall(r'class="prodcard__img-pic"[^>]*>\s*<img src="([^"]+)"', html)
    items = []
    for title, image in zip(titles, images):
        raw = unescape(title.strip())
        shade_name, code = split_staron_title(raw)
        url = image if image.startswith("http") else urljoin(STARON, image)
        items.append({
            "name": shade_name,
            "code": code,
            "url": url,
            "isNew": False,
            "rawName": raw,
        })
    return items


def parse_himacs_section(body):
    shades = []

    for block in re.findall(
        r"colorsCategories_zoom\" href=\"([^\"]+)\"[\s\S]*?"
        r"colorsCategories_code\">([^<]+)</p><p class=\"colorsCategories_name\">([^<]+)",
        body,
    ):
        image, code, name = block
        url = image if image.startswith("http") else urljoin(HIMACS, image)
        shades.append({
            "name": unescape(name).strip(),
            "code": unescape(code).strip(),
            "url": url,
            "isNew": False,
        })

    return shades


def parse_himacs_html(html):
    collections = []
    pattern = re.compile(
        r'id="collection-([^"]+)" class="colorsCategories_listItem">'
        r'<div class="colorsCategories_listName">([^<]+)</div>'
        r'<div class="colorsCategories_listContent',
    )
    matches = list(pattern.finditer(html))
    for index, match in enumerate(matches):
        collection_id = match.group(1)
        title = unescape(match.group(2)).strip()
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(html)
        shades = parse_himacs_section(html[start:end])
        collections.append({
            "id": collection_id,
            "name": title,
            "shades": shades,
        })

    return collections


def fetch_himacs(collection_id=None):
    html = fetch_text(HIMACS_COLORS)
    collections = parse_himacs_html(html)
    items = []

    for collection in collections:
        if collection_id and collection["id"] != collection_id:
            continue
        for shade in collection["shades"]:
            item = dict(shade)
            item["collectionId"] = collection["id"]
            items.append(item)

    if collection_id and not items:
        raise ValueError(f"Коллекция {collection_id} не найдена на hi-macs.ru/colors")

    return items, collections


def export_himacs(data, collection_id=None):
    fetched, parsed_collections = fetch_himacs(collection_id)

    if collection_id:
        shades, stats = merge_shades(data, HIMACS_BRAND, collection_id, fetched)
        return {
            "brand": HIMACS_BRAND,
            "collection": collection_id,
            "shades": shades,
            "stats": stats,
        }

    all_shades = []
    seen = set()
    total_stats = {"kept": 0, "updated": 0, "new": 0}
    per_collection = {}

    for collection in parsed_collections:
        batch = [item for item in fetched if item.get("collectionId") == collection["id"]]
        shades, stats = merge_shades(data, HIMACS_BRAND, collection["id"], batch)
        per_collection[collection["id"]] = {"count": len(shades), "stats": stats}
        for key in total_stats:
            total_stats[key] += stats[key]
        for shade in shades:
            dedupe = (shade["brand"], shade["code"], shade["url"])
            if dedupe in seen:
                continue
            seen.add(dedupe)
            all_shades.append(shade)

    return {
        "brand": HIMACS_BRAND,
        "collections": [item["id"] for item in parsed_collections],
        "perCollection": per_collection,
        "shades": all_shades,
        "stats": total_stats,
    }


def fetch_staron_collection(collection_id):
    slug = staron_slug(collection_id)
    items = []
    page = 1
    while page <= 40:
        suffix = f"?PAGEN_1={page}" if page > 1 else ""
        url = f"{STARON}/catalog/{slug}/{suffix}"
        html = fetch_text(url)
        batch = parse_staron_cards(html)
        if not batch:
            break
        items.extend(batch)
        if page == 1 and f"PAGEN_1=2" not in html:
            break
        page += 1
    return items


def index_existing(data):
    by_url = {}
    by_key = {}
    for shade in data["shades"]:
        by_url[shade["url"]] = shade
        by_key[(shade["brand"], shade["code"])] = shade
    return by_url, by_key


def merge_shades(data, brand_id, collection_id, fetched):
    by_url, by_key = index_existing(data)
    merged = []
    stats = {"kept": 0, "updated": 0, "new": 0}

    for item in fetched:
        shade = {
            "brand": brand_id,
            "name": item["name"],
            "code": item["code"],
            "url": item["url"],
            "collections": [collection_id] if collection_id else [],
            "isNew": bool(item.get("isNew")),
        }

        previous = by_url.get(item["url"]) or by_key.get((brand_id, item["code"]))
        if previous:
            shade["name"] = previous["name"]
            shade["code"] = previous["code"]
            collections = list(previous.get("collections") or [])
            if collection_id and collection_id not in collections:
                collections.append(collection_id)
            shade["collections"] = collections or ([collection_id] if collection_id else [])
            shade["isNew"] = previous.get("isNew", False) or shade["isNew"]
            if previous.get("url") != item["url"]:
                stats["updated"] += 1
            else:
                stats["kept"] += 1
        else:
            stats["new"] += 1

        merged.append(shade)

    return merged, stats


def export_interstone_brand(data, brand_id, collection_id=None):
    if brand_id == "staron":
        raise ValueError("Staron загружается с staron.ru")

    if collection_id:
        fetched = fetch_interstone(brand_id, collection_id)
        shades, stats = merge_shades(data, brand_id, collection_id, fetched)
        return {"brand": brand_id, "collection": collection_id, "shades": shades, "stats": stats}

    collections = [item for item in data["collections"] if item["brand"] == brand_id]
    if not collections:
        raise ValueError(f"В stones.json нет коллекций для {brand_id}")

    all_shades = []
    seen = set()
    total_stats = {"kept": 0, "updated": 0, "new": 0}
    per_collection = {}

    for collection in collections:
        if collection.get("whole"):
            fetched = fetch_interstone(brand_id)
            shades, stats = merge_shades(data, brand_id, collection["id"], fetched)
        else:
            fetched = fetch_interstone(brand_id, collection["id"])
            shades, stats = merge_shades(data, brand_id, collection["id"], fetched)
        per_collection[collection["id"]] = {"count": len(shades), "stats": stats}
        for key in total_stats:
            total_stats[key] += stats[key]
        for shade in shades:
            key = (shade["brand"], shade["code"])
            if key in seen:
                continue
            seen.add(key)
            all_shades.append(shade)

    return {
        "brand": brand_id,
        "collections": [item["id"] for item in collections],
        "perCollection": per_collection,
        "shades": all_shades,
        "stats": total_stats,
    }


def export_staron_collection(data, collection_id):
    fetched = fetch_staron_collection(collection_id)
    shades, stats = merge_shades(data, "staron", collection_id, fetched)
    return {"brand": "staron", "collection": collection_id, "shades": shades, "stats": stats}


def main():
    if len(sys.argv) < 2:
        print(
            "Использование: partner_export.py serve | interstone BRAND [COLLECTION] | "
            "staron COLLECTION | himacs [COLLECTION]",
            file=sys.stderr,
        )
        raise SystemExit(2)

    command = sys.argv[1]
    data = load_catalog()

    if command == "serve":
        from export_stones_server import run

        run()
        return

    if command == "interstone":
        brand = sys.argv[2]
        collection = sys.argv[3] if len(sys.argv) > 3 else None
        result = export_interstone_brand(data, brand, collection)
    elif command == "staron":
        collection = sys.argv[2]
        result = export_staron_collection(data, collection)
    elif command == "himacs":
        collection = sys.argv[2] if len(sys.argv) > 2 else None
        result = export_himacs(data, collection)
    else:
        print(f"Неизвестная команда: {command}", file=sys.stderr)
        raise SystemExit(2)

    json.dump(result, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    try:
        main()
    except (HTTPError, URLError, TimeoutError, OSError, ValueError) as error:
        print(error, file=sys.stderr)
        raise SystemExit(1) from error
