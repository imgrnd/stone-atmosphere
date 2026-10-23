function initPaletteFilter() {
  const bar = document.querySelector(".palette-filter");

  if (!bar || !document.querySelector(".palette")) {
    return;
  }

  const brands = [...document.querySelectorAll(".palette")];
  const brandSelect = bar.querySelector("[data-brand]");
  const collectionSelect = bar.querySelector("[data-collection]");
  const news = bar.querySelector("[data-news]");
  const search = bar.querySelector("[data-search]");
  const empty = document.querySelector(".palette-filter__empty");

  brands.forEach((section) => {
    brandSelect.append(new Option(section.querySelector(".palette__title").textContent, section.id));
  });

  function fillCollections() {
    const brandId = brandSelect.value;
    const current = collectionSelect.value;
    const sections = brands.filter((section) => !brandId || section.id === brandId);

    collectionSelect.replaceChildren(new Option("Коллекция", ""));

    sections.forEach((section) => {
      const brandName = section.querySelector(".palette__title").textContent;

      section.querySelectorAll(".collection").forEach((collection) => {
        const name = collection.querySelector(".collection__title").textContent;
        const label = brandId ? name : `${brandName} — ${name}`;
        collectionSelect.append(new Option(label, collection.id));
      });
    });

    const still = [...collectionSelect.options].some((option) => option.value === current);
    collectionSelect.value = still ? current : "";
  }

  function apply() {
    const brandId = brandSelect.value;
    const collectionId = collectionSelect.value;
    const query = search.value.trim().toLowerCase();
    const onlyNew = news.getAttribute("aria-pressed") === "true";
    let visible = 0;

    document.querySelectorAll(".swatch").forEach((swatch) => {
      const palette = swatch.closest(".palette");
      const collection = swatch.closest(".collection");
      const name = swatch.querySelector(".swatch__name").textContent.toLowerCase();
      const code = swatch.querySelector(".swatch__code").textContent.toLowerCase();
      const match = (!brandId || palette.id === brandId)
        && (!collectionId || (collection && collection.id === collectionId))
        && (!onlyNew || swatch.querySelector(".swatch__badge"))
        && (!query || name.includes(query) || code.includes(query));

      swatch.hidden = !match;

      if (match) {
        visible += 1;
      }
    });

    document.querySelectorAll(".collection").forEach((collection) => {
      const shown = [...collection.querySelectorAll(".swatch")].some((swatch) => !swatch.hidden);
      collection.hidden = !shown;
    });

    brands.forEach((section) => {
      const shown = [...section.querySelectorAll(".swatch")].some((swatch) => !swatch.hidden);
      section.hidden = !shown;
    });

    empty.hidden = visible !== 0;
  }

  function readHash() {
    const id = decodeURIComponent(location.hash.replace(/^#/, ""));

    if (!id) {
      return;
    }

    const collection = document.getElementById(id);
    const brand = brands.find((section) => section.id === id);

    if (collection && collection.classList.contains("collection")) {
      brandSelect.value = collection.closest(".palette").id;
      fillCollections();
      collectionSelect.value = id;
      return;
    }

    if (brand) {
      brandSelect.value = id;
      fillCollections();
    }
  }

  function remember() {
    const id = collectionSelect.value || brandSelect.value;
    const next = id ? `#${id}` : location.pathname;

    if (`${location.pathname}${location.hash}` !== `${location.pathname}${id ? `#${id}` : ""}`) {
      history.replaceState(null, "", next);
    }
  }

  brandSelect.addEventListener("change", () => {
    fillCollections();
    apply();
    remember();
  });

  collectionSelect.addEventListener("change", () => {
    apply();
    remember();
  });

  search.addEventListener("input", apply);

  news.addEventListener("click", () => {
    const on = news.getAttribute("aria-pressed") !== "true";
    news.setAttribute("aria-pressed", on ? "true" : "false");
    apply();
  });

  fillCollections();
  readHash();
  apply();

  const current = document.getElementById(decodeURIComponent(location.hash.replace(/^#/, "")));

  if (current) {
    current.scrollIntoView();
  }
}

function initMaterialsFilter() {
  const root = document.querySelector(".brands");

  if (!root || document.querySelector(".palette")) {
    return;
  }

  const cards = [...root.querySelectorAll(".brand")];
  const brandSelect = root.querySelector("[data-brand]");
  const search = root.querySelector("[data-search]");
  const empty = root.querySelector(".palette-filter__empty");

  if (!brandSelect || !cards.length) {
    return;
  }

  const seen = new Set();

  cards.forEach((card) => {
    const id = card.dataset.brand;

    if (!id || seen.has(id)) {
      return;
    }

    seen.add(id);
    brandSelect.append(new Option(card.dataset.brandName || id, id));
  });

  function apply() {
    const brandId = brandSelect.value;
    const query = search.value.trim().toLowerCase();
    let visible = 0;

    cards.forEach((card) => {
      const name = card.querySelector(".brand__name").textContent.toLowerCase();
      const brand = (card.dataset.brandName || "").toLowerCase();
      const match = (!brandId || card.dataset.brand === brandId)
        && (!query || name.includes(query) || brand.includes(query));

      card.hidden = !match;

      if (match) {
        visible += 1;
      }
    });

    empty.hidden = visible !== 0;
  }

  brandSelect.addEventListener("change", apply);
  search.addEventListener("input", apply);
  apply();
}

initPaletteFilter();
initMaterialsFilter();
