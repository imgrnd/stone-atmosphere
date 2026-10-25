import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const TARGET = 12;
export const MIN_ITEMS = 8;
export const MAX_ITEMS = 16;

export const DEFAULT_HIDDEN_BRANDS = new Set(["techgres", "kerama-marazzi"]);

export function getRoot() {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

export function decodeText(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export function parseSwatch(block) {
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

export function parsePaletteBrands(html) {
  const brandChunks = html.split(/<section class="palette" id="/).slice(1);
  const brands = [];

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
    const collections = [];
    const collectionParts = body.split(/<section class="collection" id="/).slice(1);

    if (!collectionParts.length && body.includes('class="palette__grid"')) {
      const items = [];

      for (const swatchPart of body.split('<li class="swatch">').slice(1)) {
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

      for (const swatchPart of collectionBody.split('<li class="swatch">').slice(1)) {
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

    brands.push({
      id: brandId,
      name,
      type,
      href: `palette.html#${brandId}`,
      collections,
    });
  }

  return brands;
}

export function pickItems(collections) {
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
        new: Boolean(item.new),
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

export function allCandidateItems(brand) {
  const items = [];

  for (const collection of brand.collections) {
    for (const item of collection.items) {
      items.push({
        name: item.name,
        code: item.code,
        image: item.image,
        href: `palette.html#${collection.id}`,
        new: Boolean(item.new),
      });
    }
  }

  return items;
}

export function itemKey(item) {
  return `${item.code}::${item.image}`;
}

export function createDefaultConfig(brands) {
  const config = { brands: {} };

  brands.forEach((brand, index) => {
    config.brands[brand.id] = {
      visible: !DEFAULT_HIDDEN_BRANDS.has(brand.id),
      order: index,
      mode: "auto",
    };
  });

  return config;
}

export function loadConfig(configPath, brands) {
  if (!existsSync(configPath)) {
    return createDefaultConfig(brands);
  }

  const raw = JSON.parse(readFileSync(configPath, "utf8"));
  const config = { brands: { ...raw.brands } };

  brands.forEach((brand, index) => {
    if (!config.brands[brand.id]) {
      config.brands[brand.id] = {
        visible: !DEFAULT_HIDDEN_BRANDS.has(brand.id),
        order: index,
        mode: "auto",
      };
    }
  });

  return config;
}

export function saveConfig(configPath, config) {
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function resolveBrandEntry(config, brandId, paletteIndex) {
  const entry = config.brands[brandId] ?? {
    visible: !DEFAULT_HIDDEN_BRANDS.has(brandId),
    order: paletteIndex,
    mode: "auto",
  };

  return {
    visible: Boolean(entry.visible),
    order: Number.isFinite(entry.order) ? entry.order : paletteIndex,
    mode: entry.mode === "manual" ? "manual" : "auto",
    items: Array.isArray(entry.items) ? entry.items : [],
  };
}

export function validateManualItems(items) {
  if (items.length < MIN_ITEMS || items.length > MAX_ITEMS) {
    throw new Error(`В ручном режиме нужно от ${MIN_ITEMS} до ${MAX_ITEMS} образцов`);
  }
}

export function buildBrandItems(brand, entry) {
  if (entry.mode === "manual") {
    validateManualItems(entry.items);
    return entry.items.map((item) => ({
      name: item.name,
      code: item.code,
      image: item.image,
      href: item.href || brand.href,
      new: Boolean(item.new),
    }));
  }

  return pickItems(brand.collections);
}

export function buildCandidatesPayload(brands) {
  return {
    brands: brands.map((brand) => ({
      id: brand.id,
      name: brand.name,
      type: brand.type,
      href: brand.href,
      candidateCount: allCandidateItems(brand).length,
      items: allCandidateItems(brand),
    })),
  };
}

export function buildCatalog(brands, config) {
  const publicBrands = [];
  const outputs = brands.map((brand, index) => {
    const entry = resolveBrandEntry(config, brand.id, index);
    const items = buildBrandItems(brand, entry);

    if (entry.visible) {
      publicBrands.push({
        id: brand.id,
        name: brand.name,
        type: brand.type,
        href: brand.href,
        order: entry.order,
      });
    }

    return {
      brandId: brand.id,
      items,
      entry,
    };
  });

  publicBrands.sort((a, b) => a.order - b.order);

  return {
    publicBrands: publicBrands.map(({ order, ...brand }) => brand),
    outputs,
  };
}

export function writeBuildArtifacts({ root, brands, config }) {
  const outDir = join(root, "catalog-mini");
  const catalogJsPath = join(root, "catalog-mini.js");
  const configPath = join(root, "catalog-mini.config.json");
  const candidatesPath = join(outDir, "_candidates.json");

  mkdirSync(outDir, { recursive: true });

  const { publicBrands, outputs } = buildCatalog(brands, config);

  for (const output of outputs) {
    writeFileSync(
      join(outDir, `${output.brandId}.json`),
      `${JSON.stringify({ items: output.items }, null, 2)}\n`,
      "utf8",
    );
  }

  const catalogJs = `window.CATALOG_MINI = ${JSON.stringify({ brands: publicBrands }, null, 2)};\n`;
  writeFileSync(catalogJsPath, catalogJs, "utf8");
  writeFileSync(candidatesPath, `${JSON.stringify(buildCandidatesPayload(brands), null, 2)}\n`, "utf8");

  return {
    brandCount: publicBrands.length,
    catalogJsPath,
    candidatesPath,
    configPath,
  };
}
