const API = "";

let state = null;
let brands = [];
let selectedId = null;
let limits = { min: 8, max: 16 };

const serverNote = document.getElementById("catalog-admin-server");
const statusEl = document.getElementById("catalog-admin-status");
const brandList = document.getElementById("catalog-admin-brand-list");
const editor = document.getElementById("catalog-admin-editor");
const empty = document.getElementById("catalog-admin-empty");
const brandMeta = document.getElementById("catalog-admin-brand-meta");
const manualPanel = document.getElementById("catalog-admin-manual");
const counterEl = document.getElementById("catalog-admin-counter");
const candidatesEl = document.getElementById("catalog-admin-candidates");
const pickedEl = document.getElementById("catalog-admin-picked");
const searchInput = document.getElementById("catalog-admin-search");
const applyBtn = document.getElementById("catalog-admin-apply");

function itemKey(item) {
  return `${item.code}::${item.image}`;
}

function createItemMain(item) {
  const main = document.createElement("div");
  main.className = "catalog-admin__item-main";

  const thumb = document.createElement("div");
  thumb.className = "catalog-admin__thumb";

  const img = document.createElement("img");
  img.src = item.image;
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";
  thumb.append(img);

  const copy = document.createElement("div");
  copy.className = "catalog-admin__item-copy";

  const name = document.createElement("p");
  name.className = "catalog-admin__item-name";
  name.textContent = item.name;

  const code = document.createElement("p");
  code.className = "catalog-admin__item-code";
  code.textContent = item.code;

  copy.append(name, code);
  main.append(thumb, copy);
  return main;
}

function setStatus(message, tone = "neutral") {
  statusEl.textContent = message;
  statusEl.classList.remove("is-ok", "is-error", "is-neutral");

  if (!message) {
    statusEl.hidden = true;
    return;
  }

  statusEl.hidden = false;

  if (tone === "ok") {
    statusEl.classList.add("is-ok");
  } else if (tone === "error") {
    statusEl.classList.add("is-error");
  } else {
    statusEl.classList.add("is-neutral");
  }
}

function sortedBrands() {
  return [...brands].sort((a, b) => a.order - b.order);
}

function selectedBrand() {
  return brands.find((brand) => brand.id === selectedId) ?? null;
}

function syncConfigFromBrands() {
  const config = { brands: {} };

  brands.forEach((brand, index) => {
    const entry = {
      visible: brand.visible,
      order: brand.order ?? index,
      mode: brand.mode,
    };

    if (brand.mode === "manual") {
      entry.items = brand.items.map((item) => ({
        name: item.name,
        code: item.code,
        image: item.image,
        href: item.href,
        new: Boolean(item.new),
      }));
    }

    config.brands[brand.id] = entry;
  });

  return config;
}

function renderBrandList() {
  brandList.replaceChildren();

  sortedBrands().forEach((brand) => {
    const item = document.createElement("li");
    item.className = "catalog-admin__brand-item";

    if (brand.id === selectedId) {
      item.classList.add("is-active");
    }

    if (!brand.visible) {
      item.classList.add("is-off");
    }

    const row = document.createElement("div");
    row.className = "catalog-admin__brand-row";

    const visible = document.createElement("label");
    visible.className = "catalog-admin__visible";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = brand.visible;
    checkbox.addEventListener("change", () => {
      brand.visible = checkbox.checked;
      setStatus(`Бренд «${brand.name}»: ${brand.visible ? "на главной" : "скрыт"}`, "neutral");
      renderBrandList();
      if (selectedId === brand.id) {
        renderEditor();
      }
    });
    visible.append(checkbox, document.createTextNode("На главной"));
    visible.title = "Показывать вкладку на главной";

    const pick = document.createElement("button");
    pick.type = "button";
    pick.className = "catalog-admin__brand-button";
    pick.innerHTML = `<span class="catalog-admin__brand-name">${brand.name}</span><span class="catalog-admin__brand-type">${brand.type}</span>`;
    pick.addEventListener("click", () => {
      selectedId = brand.id;
      renderBrandList();
      renderEditor();
    });

    const moves = document.createElement("div");
    moves.className = "catalog-admin__moves";

    const up = document.createElement("button");
    up.type = "button";
    up.className = "catalog-admin__move";
    up.textContent = "↑";
    up.setAttribute("aria-label", "Выше в списке");
    up.addEventListener("click", () => moveBrand(brand.id, -1));

    const down = document.createElement("button");
    down.type = "button";
    down.className = "catalog-admin__move";
    down.textContent = "↓";
    down.setAttribute("aria-label", "Ниже в списке");
    down.addEventListener("click", () => moveBrand(brand.id, 1));

    moves.append(up, down);
    row.append(visible, pick, moves);
    item.append(row);
    brandList.append(item);
  });
}

function moveBrand(brandId, direction) {
  const ordered = sortedBrands();
  const index = ordered.findIndex((brand) => brand.id === brandId);

  if (index < 0) {
    return;
  }

  const target = index + direction;

  if (target < 0 || target >= ordered.length) {
    return;
  }

  const currentOrder = ordered[index].order;
  ordered[index].order = ordered[target].order;
  ordered[target].order = currentOrder;
  renderBrandList();
}

function renderEditor() {
  const brand = selectedBrand();

  if (!brand) {
    editor.hidden = true;
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  editor.hidden = false;
  brandMeta.innerHTML = `
    <p class="catalog-admin__brand-name">${brand.name}</p>
    <p class="catalog-admin__brand-stats">
      <span class="catalog-admin__tag">${brand.type}</span>
      <span class="catalog-admin__tag">${brand.candidates.length} в палитре</span>
      <span class="catalog-admin__tag">${brand.visible ? "на главной" : "скрыт"}</span>
    </p>`;

  document.querySelectorAll('input[name="catalog-mode"]').forEach((input) => {
    input.checked = input.value === brand.mode;
  });

  manualPanel.hidden = brand.mode !== "manual";
  renderManualLists();
}

function renderManualLists() {
  const brand = selectedBrand();

  if (!brand || brand.mode !== "manual") {
    return;
  }

  const query = searchInput.value.trim().toLowerCase();
  const pickedKeys = new Set(brand.items.map(itemKey));

  counterEl.textContent = `В слайдере: ${brand.items.length} · нужно ${limits.min}–${limits.max}`;
  counterEl.classList.toggle(
    "is-warning",
    brand.items.length < limits.min || brand.items.length > limits.max,
  );

  candidatesEl.replaceChildren();
  pickedEl.replaceChildren();

  brand.candidates
    .filter((item) => {
      if (!query) {
        return true;
      }

      return item.name.toLowerCase().includes(query) || item.code.toLowerCase().includes(query);
    })
    .forEach((item) => {
      if (pickedKeys.has(itemKey(item))) {
        return;
      }

      const row = document.createElement("li");
      row.className = "catalog-admin__candidate";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "catalog-admin__add";
      button.textContent = "Добавить";
      button.addEventListener("click", () => addItem(item));

      row.append(createItemMain(item), button);
      candidatesEl.append(row);
    });

  brand.items.forEach((item, index) => {
    const row = document.createElement("li");
    row.className = "catalog-admin__picked-item";

    const controls = document.createElement("div");
    controls.className = "catalog-admin__picked-controls";

    const up = document.createElement("button");
    up.type = "button";
    up.className = "catalog-admin__move";
    up.textContent = "↑";
    up.addEventListener("click", () => moveItem(index, -1));

    const down = document.createElement("button");
    down.type = "button";
    down.className = "catalog-admin__move";
    down.textContent = "↓";
    down.addEventListener("click", () => moveItem(index, 1));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "catalog-admin__remove";
    remove.textContent = "Убрать";
    remove.addEventListener("click", () => removeItem(index));

    controls.append(up, down, remove);
    row.append(createItemMain(item), controls);
    pickedEl.append(row);
  });
}

function addItem(item) {
  const brand = selectedBrand();

  if (!brand) {
    return;
  }

  if (brand.items.length >= limits.max) {
    setStatus(`Не больше ${limits.max} образцов в слайдере`, "error");
    return;
  }

  brand.items.push({ ...item });
  renderManualLists();
}

function removeItem(index) {
  const brand = selectedBrand();

  if (!brand) {
    return;
  }

  brand.items.splice(index, 1);
  renderManualLists();
}

function moveItem(index, direction) {
  const brand = selectedBrand();

  if (!brand) {
    return;
  }

  const target = index + direction;

  if (target < 0 || target >= brand.items.length) {
    return;
  }

  const [item] = brand.items.splice(index, 1);
  brand.items.splice(target, 0, item);
  renderManualLists();
}

document.querySelectorAll('input[name="catalog-mode"]').forEach((input) => {
  input.addEventListener("change", () => {
    const brand = selectedBrand();

    if (!brand) {
      return;
    }

    brand.mode = input.value;

    if (brand.mode === "manual" && !brand.items.length) {
      brand.items = brand.candidates.slice(0, limits.min).map((item) => ({ ...item }));
    }

    renderEditor();
  });
});

searchInput.addEventListener("input", renderManualLists);

async function readJson(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      "Ответ сервера не JSON. Запустите python3 scripts/export_stones_server.py (не python3 -m http.server).",
    );
  }
}

async function loadState() {
  const response = await fetch(`${API}/api/catalog-mini/state`);

  if (response.status === 404) {
    throw new Error(
      "API не найден. Остановите процесс на порту 43124 и запустите: python3 scripts/export_stones_server.py",
    );
  }

  if (!response.ok) {
    const payload = await readJson(response).catch(() => ({}));
    throw new Error(payload.error || "Не удалось загрузить состояние мини-каталога");
  }

  const payload = await readJson(response);
  state = payload;
  limits = payload.limits ?? limits;
  brands = payload.brands.map((brand) => ({
    ...brand,
    items: Array.isArray(brand.items) ? brand.items.map((item) => ({ ...item })) : [],
    candidates: Array.isArray(brand.candidates) ? brand.candidates : [],
  }));

  if (!selectedId && brands.length) {
    selectedId = sortedBrands().find((brand) => brand.visible)?.id ?? brands[0].id;
  }

  renderBrandList();
  renderEditor();
}

async function applyToHomepage() {
  const config = syncConfigFromBrands();

  const saveResponse = await fetch(`${API}/api/catalog-mini/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });

  if (!saveResponse.ok) {
    const payload = await readJson(saveResponse);
    throw new Error(payload.error || "Не удалось сохранить настройки");
  }

  const response = await fetch(`${API}/api/catalog-mini/rebuild`, { method: "POST" });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(payload.error || "Не удалось обновить каталог на главной");
  }

  return payload;
}

applyBtn.addEventListener("click", async () => {
  applyBtn.disabled = true;
  const label = applyBtn.textContent;
  applyBtn.textContent = "Применяем…";

  try {
    const payload = await applyToHomepage();
    setStatus(
      `Готово: на главной ${payload.brandCount} брендов (конфиг и catalog-mini.js обновлены)`,
      "ok",
    );
    await loadState();
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    applyBtn.disabled = false;
    applyBtn.textContent = label;
  }
});

async function init() {
  try {
    const health = await fetch(`${API}/api/health`);

    if (!health.ok) {
      throw new Error("offline");
    }

    const healthPayload = await readJson(health);

    if (!healthPayload.ok) {
      throw new Error("offline");
    }

    if (!Array.isArray(healthPayload.features) || !healthPayload.features.includes("catalog-mini")) {
      throw new Error(
        "На порту 43124 старый сервер без админки. Остановите его (Ctrl+C в терминале) и снова запустите: python3 scripts/export_stones_server.py",
      );
    }

    serverNote.hidden = true;
    await loadState();
    setStatus("Готово к редактированию", "neutral");
  } catch (error) {
    serverNote.hidden = false;
    serverNote.textContent = error.message
      || "Запустите python3 scripts/export_stones_server.py и откройте http://127.0.0.1:43124/catalog-admin.html";
    setStatus("", "neutral");
  }
}

init();
