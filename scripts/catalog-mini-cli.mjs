import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  MAX_ITEMS,
  MIN_ITEMS,
  buildBrandItems,
  buildCandidatesPayload,
  getRoot,
  loadConfig,
  parsePaletteBrands,
  resolveBrandEntry,
  saveConfig,
  validateManualItems,
  writeBuildArtifacts,
} from "./catalog-mini-lib.mjs";

const root = getRoot();
const palettePath = join(root, "palette.html");
const configPath = join(root, "catalog-mini.config.json");
const candidatesPath = join(root, "catalog-mini", "_candidates.json");
const command = process.argv[2];

function readPaletteBrands() {
  const html = readFileSync(palettePath, "utf8");
  return parsePaletteBrands(html);
}

function readCandidates(brands) {
  if (existsSync(candidatesPath)) {
    return JSON.parse(readFileSync(candidatesPath, "utf8"));
  }

  return buildCandidatesPayload(brands);
}

function readCurrentItems(brandId) {
  const path = join(root, "catalog-mini", `${brandId}.json`);

  if (!existsSync(path)) {
    return [];
  }

  const data = JSON.parse(readFileSync(path, "utf8"));
  return Array.isArray(data.items) ? data.items : [];
}

function buildState() {
  const brands = readPaletteBrands();
  const config = loadConfig(configPath, brands);
  const candidates = readCandidates(brands);

  const brandRows = brands.map((brand, index) => {
    const entry = resolveBrandEntry(config, brand.id, index);
    const candidateBrand = candidates.brands.find((item) => item.id === brand.id);
    let items = entry.mode === "manual" ? entry.items : readCurrentItems(brand.id);

    try {
      if (entry.mode === "manual") {
        validateManualItems(entry.items);
      }
    } catch {
      items = readCurrentItems(brand.id);
    }

    return {
      id: brand.id,
      name: brand.name,
      type: brand.type,
      href: brand.href,
      visible: entry.visible,
      order: entry.order,
      mode: entry.mode,
      itemCount: items.length,
      items,
      candidates: candidateBrand?.items ?? [],
    };
  });

  brandRows.sort((a, b) => a.order - b.order);

  return {
    config,
    limits: { min: MIN_ITEMS, max: MAX_ITEMS },
    brands: brandRows,
  };
}

function validateConfigPayload(config, brands) {
  if (!config || typeof config !== "object" || !config.brands) {
    throw new Error("Некорректный конфиг");
  }

  const brandIds = new Set(brands.map((brand) => brand.id));

  for (const [brandId, entry] of Object.entries(config.brands)) {
    if (!brandIds.has(brandId)) {
      continue;
    }

    if (entry.mode === "manual") {
      validateManualItems(entry.items ?? []);
    }
  }
}

async function readStdinJson() {
  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function main() {
  if (command === "state") {
    process.stdout.write(`${JSON.stringify(buildState())}\n`);
    return;
  }

  if (command === "candidates") {
    const brands = readPaletteBrands();
    process.stdout.write(`${JSON.stringify(buildCandidatesPayload(brands))}\n`);
    return;
  }

  if (command === "save") {
    const brands = readPaletteBrands();
    const payload = await readStdinJson();
    validateConfigPayload(payload, brands);
    saveConfig(configPath, payload);
    process.stdout.write('{"ok":true}\n');
    return;
  }

  if (command === "rebuild") {
    const brands = readPaletteBrands();
    const config = loadConfig(configPath, brands);
    validateConfigPayload(config, brands);
    const result = writeBuildArtifacts({ root, brands, config });
    process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
