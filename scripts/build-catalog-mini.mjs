import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const palettePath = join(root, "palette.html");
const outDir = join(root, "catalog-mini");
const catalogJsPath = join(root, "catalog-mini.js");

const TARGET = 12;
const MIN_ITEMS = 8;
const MAX_ITEMS = 16;
const EXCLUDED_BRAND_IDS = new Set(["techgres", "kerama-marazzi"]);
const EXCLUDED_TYPES = ["Керамические широкоформатные плиты"];

const html = readFileSync(palettePath, "utf8");

function decodeText(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function pickItems(collections) {
  const total = collections.reduce((sum, collection) => sum + collection.items.length, 0);
  const count = Math.min(MAX_ITEMS, Math.max(MIN_ITEMS, Math.min(TARGET, total)));
  const picked = [];
  const indices = collections.map(() => 0);

  while (picked.length < count) {
    let added = false;

    for (let i = 0; i < collections.length; i += 1) {
      const collection = collections[i];
      const index = indices[i];

      if (index >= collection.items.length) {
        continue;
      }

      const item = collection.items[index];
      picked.push({
        name: item.name,
        code: item.code,
        image: item.image,
        href: `palette.html#${collection.id}`,
        new: item.new,
      });
      indices[i] += 1;
      added = true;

      if (picked.length >= count) {
        break;
      }
    }

    if (!added) {
      break;
    }
  }

  return picked;
}

function parseSwatch(block) {
  const imageMatch = block.match(/<img[^>]+src="([^"]+)"[^>]+alt="([^"]*)"/);
  const nameMatch = block.match(/<h2 class="swatch__name">([\s\S]*?)<\/h2>/);
  const codeMatch = block.match(/<span class="swatch__code">([\s\S]*?)<\/span>/);

  if (!imageMatch || !nameMatch || !codeMatch) {
    return null;
  }

  return {
    name: decodeText(nameMatch[1]),
    code: decodeText(codeMatch[1]),
    image: imageMatch[1],
    new: /class="swatch__badge"/.test(block),
  };
}

const brandChunks = html.split(/<section class="palette" id="/).slice(1);
const brands = [];

mkdirSync(outDir, { recursive: true });

for (const chunk of brandChunks) {
  const idMatch = chunk.match(/^([^"]+)"/);
  if (!idMatch) {
    continue;
  }

  const brandId = idMatch[1];
  const bodyStart = idMatch[0].length;
  const nextPalette = chunk.search(/\n\s*<section class="palette" id="/);
  const body = nextPalette === -1
    ? chunk.slice(bodyStart)
    : chunk.slice(bodyStart, nextPalette);

  const eyebrowMatch = body.match(/<p class="palette__eyebrow">([\s\S]*?)<\/p>/);
  const titleMatch = body.match(/<h1 class="palette__title">([\s\S]*?)<\/h1>/);

  const type = decodeText(eyebrowMatch?.[1] ?? "");
  const name = decodeText(titleMatch?.[1] ?? brandId);

  if (EXCLUDED_BRAND_IDS.has(brandId) || EXCLUDED_TYPES.includes(type)) {
    continue;
  }

  const collections = [];
  const collectionParts = body.split(/<section class="collection" id="/).slice(1);

  if (!collectionParts.length && body.includes('class="palette__grid"')) {
    const items = [];
    const swatchParts = body.split('<li class="swatch">').slice(1);

    for (const swatchPart of swatchParts) {
      const swatchBlock = swatchPart.split("</li>")[0] ?? swatchPart;
      const swatch = parseSwatch(swatchBlock);

      if (swatch) {
        items.push(swatch);
      }
    }

    if (items.length) {
      collections.push({ id: brandId, items });
    }
  }

  for (const part of collectionParts) {
    const collectionIdMatch = part.match(/^([^"]+)"/);
    if (!collectionIdMatch) {
      continue;
    }

    const collectionId = collectionIdMatch[1];
    const collectionBodyStart = collectionIdMatch[0].length;
    const nextCollection = part.search(/\n\s*<section class="collection" id="/);
    const collectionBody = nextCollection === -1
      ? part.slice(collectionBodyStart)
      : part.slice(collectionBodyStart, nextCollection);
    const items = [];

    const swatchParts = collectionBody.split('<li class="swatch">').slice(1);

    for (const swatchPart of swatchParts) {
      const swatchBlock = swatchPart.split("</li>")[0] ?? swatchPart;
      const swatch = parseSwatch(swatchBlock);

      if (swatch) {
        items.push(swatch);
      }
    }

    if (items.length) {
      collections.push({ id: collectionId, items });
    }
  }

  const items = pickItems(collections);

  writeFileSync(
    join(outDir, `${brandId}.json`),
    `${JSON.stringify({ items }, null, 2)}\n`,
    "utf8",
  );

  brands.push({
    id: brandId,
    name,
    type,
    href: `palette.html#${brandId}`,
  });
}

const catalogJs = `window.CATALOG_MINI = ${JSON.stringify({ brands }, null, 2)};\n`;

writeFileSync(catalogJsPath, catalogJs, "utf8");

console.log(`Wrote ${brands.length} brand JSON files and ${catalogJsPath}`);
