import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildCandidatesPayload,
  createDefaultConfig,
  getRoot,
  loadConfig,
  parsePaletteBrands,
  saveConfig,
  writeBuildArtifacts,
} from "./catalog-mini-lib.mjs";
import { mkdirSync, writeFileSync } from "node:fs";

const root = getRoot();
const palettePath = join(root, "palette.html");
const configPath = join(root, "catalog-mini.config.json");
const args = new Set(process.argv.slice(2));

const html = readFileSync(palettePath, "utf8");
const brands = parsePaletteBrands(html);

if (args.has("--init-config")) {
  const config = createDefaultConfig(brands);
  saveConfig(configPath, config);
  console.log(`Wrote ${configPath}`);
  process.exit(0);
}

if (args.has("--candidates")) {
  const outDir = join(root, "catalog-mini");
  mkdirSync(outDir, { recursive: true });
  const candidatesPath = join(outDir, "_candidates.json");
  writeFileSync(
    candidatesPath,
    `${JSON.stringify(buildCandidatesPayload(brands), null, 2)}\n`,
    "utf8",
  );
  console.log(`Wrote ${candidatesPath}`);
  process.exit(0);
}

const config = loadConfig(configPath, brands);
const result = writeBuildArtifacts({ root, brands, config });

console.log(`Wrote ${result.brandCount} visible brands, ${result.catalogJsPath}`);
