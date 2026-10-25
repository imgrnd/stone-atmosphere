const API = "";

let catalog = null;
let lastPayload = null;

const form = document.getElementById("stones-export-form");
const brandSelect = document.getElementById("stones-export-brand");
const collectionSelect = document.getElementById("stones-export-collection");
const brandField = document.getElementById("stones-export-brand-field");
const hint = document.getElementById("stones-export-hint");
const serverNote = document.getElementById("stones-export-server");
const resultSection = document.getElementById("stones-export-result");
const statsEl = document.getElementById("stones-export-stats");
const previewEl = document.getElementById("stones-export-preview");
const jsonEl = document.getElementById("stones-export-json");
const downloadBtn = document.getElementById("stones-export-download");

function currentSource() {
  return form.querySelector('input[name="source"]:checked').value;
}

function interstoneBrands() {
  return catalog.brands.filter((brand) => brand.id !== "staron" && brand.id !== "himacs");
}

function partnerCollections(brandId) {
  return catalog.collections.filter((item) => item.brand === brandId);
}

function fillBrands() {
  const source = currentSource();
  brandSelect.replaceChildren();

  if (source === "interstone") {
    brandField.hidden = false;
    interstoneBrands().forEach((brand) => {
      brandSelect.append(new Option(`${brand.name} (${brand.id})`, brand.id));
    });
    fillCollections();
    hint.textContent = "Для Interstone можно выбрать одну коллекцию или выгрузить все коллекции бренда по списку из stones.json.";
    return;
  }

  if (source === "staron") {
    brandField.hidden = true;
    collectionSelect.replaceChildren(new Option("Выберите коллекцию Staron", ""));
    partnerCollections("staron").forEach((collection) => {
      collectionSelect.append(new Option(collection.name, collection.id));
    });
    hint.textContent = "Для Staron выгружается одна коллекция со страницы staron.ru/catalog.";
    return;
  }

  brandField.hidden = true;
  collectionSelect.replaceChildren(new Option("Весь каталог HI-MACS", ""));
  partnerCollections("himacs").forEach((collection) => {
    collectionSelect.append(new Option(collection.name, collection.id));
  });
  hint.textContent = "Для HI-MACS можно выгрузить весь каталог с hi-macs.ru/colors или одну коллекцию.";
}

function fillCollections() {
  const brandId = brandSelect.value;
  const current = collectionSelect.value;
  collectionSelect.replaceChildren(new Option("Все коллекции бренда", ""));

  catalog.collections
    .filter((item) => item.brand === brandId)
    .forEach((collection) => {
      const label = collection.whole ? `${collection.name} (весь бренд)` : collection.name;
      collectionSelect.append(new Option(label, collection.id));
    });

  const still = [...collectionSelect.options].some((option) => option.value === current);
  collectionSelect.value = still ? current : "";
}

async function loadCatalog() {
  const response = await fetch(`${API}/api/catalog`);

  if (!response.ok) {
    throw new Error("Не удалось прочитать stones.json");
  }

  catalog = await response.json();
}

async function checkServer() {
  try {
    const response = await fetch(`${API}/api/health`);
    if (!response.ok) {
      throw new Error("offline");
    }
    serverNote.hidden = true;
    await loadCatalog();
    fillBrands();
  } catch {
    serverNote.hidden = false;
    serverNote.textContent = "Запустите локальный сервер: python3 scripts/export_stones_server.py — затем откройте http://127.0.0.1:43124/stones-export.html";
  }
}

function renderResult(payload) {
  lastPayload = payload;
  resultSection.hidden = false;
  downloadBtn.disabled = false;

  const stats = payload.stats || {};
  const lines = [
    `Оттенков: ${payload.shades.length}`,
    `без изменений: ${stats.kept ?? "—"}`,
    `обновлено URL: ${stats.updated ?? "—"}`,
    `новых: ${stats.new ?? "—"}`,
  ];
  statsEl.textContent = lines.join(" · ");

  previewEl.replaceChildren();
  payload.shades.slice(0, 24).forEach((shade) => {
    const item = document.createElement("li");
    item.className = "stones-export__card";
    const image = document.createElement("img");
    image.src = shade.url;
    image.alt = "";
    image.width = 120;
    image.height = 68;
    image.loading = "lazy";
    image.decoding = "async";
    const copy = document.createElement("div");
    const name = document.createElement("p");
    name.className = "stones-export__card-name";
    name.textContent = shade.name;
    const meta = document.createElement("p");
    meta.className = "stones-export__card-meta";
    meta.textContent = shade.code;
    copy.append(name, meta);
    item.append(image, copy);
    previewEl.append(item);
  });

  if (payload.shades.length > 24) {
    const more = document.createElement("li");
    more.className = "stones-export__more";
    more.textContent = `Ещё ${payload.shades.length - 24} оттенков в JSON ниже`;
    previewEl.append(more);
  }

  const fragment = {
    shades: payload.shades,
  };

  if (payload.collection) {
    const collection = catalog.collections.find(
      (item) => item.brand === payload.brand && item.id === payload.collection,
    );
    if (collection) {
      fragment.collections = [collection];
    }
  } else if (payload.collections?.length) {
    fragment.collections = catalog.collections.filter(
      (item) => item.brand === payload.brand && payload.collections.includes(item.id),
    );
  }

  jsonEl.value = `${JSON.stringify(fragment, null, 2)}\n`;
}

form.addEventListener("change", (event) => {
  if (event.target.name === "source") {
    fillBrands();
  }
  if (event.target === brandSelect) {
    fillCollections();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const source = currentSource();
  const brandId = source === "interstone" ? brandSelect.value : source;
  const collectionId = collectionSelect.value || null;

  if (source === "staron" && !collectionId) {
    hint.textContent = "Выберите коллекцию Staron.";
    return;
  }

  const submit = form.querySelector(".stones-export__submit");
  submit.disabled = true;
  hint.textContent = "Загрузка с сайта партнёра…";

  try {
    const response = await fetch(`${API}/api/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, brandId, collectionId }),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Ошибка выгрузки");
    }

    renderResult(payload);
    hint.textContent = "Готово. Скопируйте фрагмент в stones.json и запустите python3 scripts/fetch-stones.py";
  } catch (error) {
    hint.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

downloadBtn.addEventListener("click", () => {
  if (!lastPayload) {
    return;
  }

  const blob = new Blob([jsonEl.value], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const name = lastPayload.collection || lastPayload.brand || "export";
  link.href = url;
  link.download = `stones-${name}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

checkServer();
