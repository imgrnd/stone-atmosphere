const INTERVAL = 5000;

function setSelectedTab(tabEls, selectedTab) {
  tabEls.forEach((item) => {
    const on = item === selectedTab;
    item.setAttribute("aria-selected", on ? "true" : "false");
    item.tabIndex = on ? 0 : -1;
  });
}

function initTablist(root, { tabs, onSelect, activateOnFocus = true }) {
  const tabEls = tabs ?? [...root.querySelectorAll('[role="tab"]')];

  tabEls.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      onSelect(tab);
    });

    tab.addEventListener("keydown", (event) => {
      const forward = event.key === "ArrowRight";
      const back = event.key === "ArrowLeft";

      if (!forward && !back && event.key !== "Home" && event.key !== "End") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      let next = tab;

      if (event.key === "Home") {
        next = tabEls[0];
      } else if (event.key === "End") {
        next = tabEls[tabEls.length - 1];
      } else {
        const delta = forward ? 1 : -1;
        next = tabEls[(index + delta + tabEls.length) % tabEls.length];
      }

      next.focus({ preventScroll: true });
      next.scrollIntoView({ block: "nearest", inline: "nearest" });

      if (activateOnFocus) {
        onSelect(next);
      }
    });
  });

  return tabEls;
}

const slides = [...document.querySelectorAll(".hero__picture")];
const tabs = [...document.querySelectorAll(".hero__caption")];
const lead = document.querySelector(".hero__lead");
const heroPanel = document.querySelector("#hero-panel");
const heroTablist = document.querySelector(".hero__captions");

let index = 0;
let timer = 0;

function show(next) {
  index = (next + slides.length) % slides.length;

  slides.forEach((slide, i) => {
    slide.classList.toggle("hero__picture--active", i === index);
  });

  const activeTab = tabs[index];

  if (activeTab) {
    setSelectedTab(tabs, activeTab);

    if (heroPanel) {
      heroPanel.setAttribute("aria-labelledby", activeTab.id);
    }
  }

  lead.textContent = slides[index].dataset.text;
  start();
}

function start() {
  window.clearInterval(timer);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  timer = window.setInterval(() => {
    show(index + 1);
  }, INTERVAL);
}

if (heroTablist && tabs.length) {
  initTablist(heroTablist, {
    tabs,
    onSelect: (tab) => {
      show(tabs.indexOf(tab));
    },
  });
}

document.querySelectorAll('a[href="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
  });
});

const menu = document.querySelector(".menu");
const panel = document.querySelector(".menu__panel");
const openButton = document.querySelector(".header__open");
const desktop = window.matchMedia("(min-width: 1024px)");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const header = document.querySelector(".header");
let closing = false;

function placeHeader() {
  if (header.classList.contains("header--page")) {
    return;
  }

  if (desktop.matches) {
    closing = false;
    header.classList.toggle("header--solid", window.scrollY > 0);
    return;
  }

  header.classList.toggle(
    "header--solid",
    window.scrollY > 0 || menu.classList.contains("menu--open") || closing
  );
}

function onPanelClosed(event) {
  if (event.target !== panel || event.propertyName !== "transform") {
    return;
  }

  panel.removeEventListener("transitionend", onPanelClosed);
  closing = false;
  placeHeader();
}

function placeMenu() {
  const bottom = document.querySelector(".header").getBoundingClientRect().bottom;
  menu.style.top = `${bottom}px`;
}

function setMenu(open) {
  const wasOpen = menu.classList.contains("menu--open");

  if (desktop.matches) {
    panel.removeEventListener("transitionend", onPanelClosed);
    closing = false;
    menu.classList.remove("menu--open");
    menu.inert = false;
    menu.removeAttribute("aria-hidden");
    openButton.setAttribute("aria-label", "Меню");
    openButton.setAttribute("aria-expanded", "false");
    document.body.classList.remove("is-locked");
    return;
  }

  panel.removeEventListener("transitionend", onPanelClosed);

  if (open) {
    closing = false;
    openButton.blur();
  } else if (wasOpen && !reduceMotion.matches) {
    closing = true;
    header.classList.add("header--solid");
    panel.addEventListener("transitionend", onPanelClosed);
  } else {
    closing = false;
  }

  menu.classList.toggle("menu--open", open);
  openButton.setAttribute("aria-label", open ? "Закрыть" : "Меню");
  openButton.setAttribute("aria-expanded", open ? "true" : "false");
  document.body.classList.toggle("is-locked", open);
  menu.inert = !open;
  menu.setAttribute("aria-hidden", open ? "false" : "true");
  placeHeader();
  placeMenu();

  if (!open && wasOpen) {
    openButton.focus();
  }
}

openButton.addEventListener("click", () => {
  setMenu(!menu.classList.contains("menu--open"));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menu.classList.contains("menu--open")) {
    setMenu(false);
  }
});

desktop.addEventListener("change", () => {
  setMenu(false);
  placeHeader();
});

window.addEventListener("resize", () => {
  if (!desktop.matches) {
    placeMenu();
  }

  placeHeader();
});

window.addEventListener("scroll", placeHeader, { passive: true });

document.querySelectorAll(".menu a[href^='#']").forEach((link) => {
  link.addEventListener("click", () => {
    setMenu(false);
  });
});

setMenu(false);
placeHeader();

if (slides.length && lead) {
  start();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderCatalogSlide(item) {
  const alt = escapeHtml(`${item.name} ${item.code}`);
  const badge = item.new
    ? '<span class="material__badge">Новинка</span>'
    : "";

  return `<li class="swiper-slide">
    <a class="material" href="${escapeHtml(item.href)}">
      <div class="material__frame">
        <img src="${escapeHtml(item.image)}" alt="${alt}" loading="lazy" decoding="async">
      </div>
      <div class="material__info">
        <h3 class="material__name">${escapeHtml(item.name)}</h3>
        <p class="material__meta">
          <span class="material__code">${escapeHtml(item.code)}</span>
          ${badge}
        </p>
      </div>
    </a>
  </li>`;
}

function buildCatalogBrandTabs(brandList, brands) {
  brandList.replaceChildren();

  brands.forEach((brand, index) => {
    const tab = document.createElement("button");
    tab.className = "catalog__brand";
    tab.id = `brand-${brand.id}`;
    tab.type = "button";
    tab.role = "tab";
    tab.setAttribute("aria-selected", index === 0 ? "true" : "false");
    tab.setAttribute("aria-controls", "catalog-panel");
    tab.dataset.brand = brand.id;
    tab.dataset.href = brand.href;
    tab.tabIndex = index === 0 ? 0 : -1;

    const name = document.createElement("span");
    name.className = "catalog__brand-name";
    name.textContent = brand.name;

    const type = document.createElement("span");
    type.className = "catalog__brand-type";
    type.textContent = brand.type;

    tab.append(name, type);
    brandList.append(tab);
  });
}

async function initCatalog() {
  const panel = document.querySelector(".catalog__panel");
  const stage = document.querySelector(".catalog__stage");
  const swiperEl = document.querySelector(".catalog__swiper");
  const grid = document.querySelector(".catalog__grid");
  const empty = document.querySelector(".catalog__empty");
  const controls = document.querySelector(".catalog__controls");
  const brandList = document.querySelector(".catalog__brand-list");
  const brands = window.CATALOG_MINI?.brands ?? [];

  if (!panel || !stage || !swiperEl || !grid || !brandList || !brands.length || !window.Swiper) {
    return;
  }

  buildCatalogBrandTabs(brandList, brands);
  const tabs = [...brandList.querySelectorAll('[role="tab"]')];
  const more = panel.querySelector(".catalog__more");
  const brandCache = new Map();
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const gap = parseFloat(getComputedStyle(swiperEl).getPropertyValue("--slide-gap")) || 14;
  const count = panel.querySelector(".catalog__count");

  stage.setAttribute("aria-labelledby", tabs[0].id);

  const catalogSwiper = new Swiper(swiperEl, {
    slidesPerView: "auto",
    spaceBetween: gap,
    speed: motion.matches ? 0 : 450,
    watchOverflow: true,
    roundLengths: true,
    threshold: 8,
    touchReleaseOnEdges: true,
    navigation: {
      nextEl: panel.querySelector(".catalog__next"),
      prevEl: panel.querySelector(".catalog__prev"),
    },
    a11y: {
      enabled: true,
      prevSlideMessage: "Предыдущие образцы",
      nextSlideMessage: "Следующие образцы",
    },
    keyboard: {
      enabled: false,
      onlyInViewport: false,
    },
  });

  function paintCount() {
    const total = catalogSwiper.slides.length;

    if (!total) {
      count.textContent = "";
      return;
    }

    const current = catalogSwiper.activeIndex + 1;
    count.textContent = `${String(current).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  }

  catalogSwiper.on("slideChange", paintCount);
  catalogSwiper.on("update", paintCount);

  function keysOn() {
    catalogSwiper.keyboard.enable();
  }

  function keysOff(event) {
    const next = event.relatedTarget;

    if (stage.contains(next) || controls.contains(next)) {
      return;
    }

    catalogSwiper.keyboard.disable();
  }

  stage.addEventListener("focusin", keysOn);
  controls.addEventListener("focusin", keysOn);
  stage.addEventListener("focusout", keysOff);
  controls.addEventListener("focusout", keysOff);

  motion.addEventListener("change", () => {
    catalogSwiper.params.speed = motion.matches ? 0 : 450;
  });

  async function loadBrand(brandId) {
    if (brandCache.has(brandId)) {
      return brandCache.get(brandId);
    }

    const response = await fetch(`catalog-mini/${brandId}.json`);

    if (!response.ok) {
      throw new Error(`catalog-mini/${brandId}.json`);
    }

    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items : [];
    brandCache.set(brandId, items);
    return items;
  }

  function setPanelState(hasSlides) {
    empty.hidden = hasSlides;
    panel.classList.toggle("catalog__panel--empty", !hasSlides);
  }

  function resetCatalogSlideHeights() {
    catalogSwiper.slides.forEach((slide) => {
      slide.style.removeProperty("height");
    });

    catalogSwiper.el.style.removeProperty("height");
    catalogSwiper.wrapperEl.style.removeProperty("height");
  }

  function equalizeCatalogSlides() {
    resetCatalogSlideHeights();

    const slides = [...catalogSwiper.slides];

    if (!slides.length) {
      return;
    }

    let maxHeight = 0;

    slides.forEach((slide) => {
      maxHeight = Math.max(maxHeight, slide.offsetHeight);
    });

    if (!maxHeight) {
      return;
    }

    slides.forEach((slide) => {
      slide.style.height = `${maxHeight}px`;
    });
  }

  function syncCatalogLayout() {
    catalogSwiper.updateSlides();
    catalogSwiper.updateSize();
    catalogSwiper.update();

    requestAnimationFrame(() => {
      equalizeCatalogSlides();
      catalogSwiper.update();
    });
  }

  function watchCatalogImages() {
    const images = [...grid.querySelectorAll(".material__frame img")];
    let pending = images.filter((img) => !img.complete).length;

    if (!pending) {
      return;
    }

    images.forEach((img) => {
      if (img.complete) {
        return;
      }

      img.addEventListener("load", () => {
        pending -= 1;

        if (pending === 0) {
          equalizeCatalogSlides();
          catalogSwiper.update();
        }
      }, { once: true });
    });
  }

  async function applyBrand(tab) {
    const brandId = tab.dataset.brand;

    if (more) {
      more.href = tab.dataset.href || `palette.html#${brandId}`;
    }

    let items = [];

    try {
      items = await loadBrand(brandId);
    } catch {
      items = [];
    }

    grid.innerHTML = items.map(renderCatalogSlide).join("");
    setPanelState(items.length > 0);

    if (catalogSwiper.slides.length) {
      catalogSwiper.slideTo(0, 0);
    }

    syncCatalogLayout();
    watchCatalogImages();
    paintCount();
  }

  async function showBrand(tab) {
    if (tab.getAttribute("aria-selected") === "true") {
      return;
    }

    setSelectedTab(tabs, tab);
    stage.setAttribute("aria-labelledby", tab.id);

    if (motion.matches) {
      await applyBrand(tab);
      return;
    }

    stage.classList.add("is-fading");
    await new Promise((resolve) => {
      window.setTimeout(resolve, 200);
    });
    await applyBrand(tab);
    stage.classList.remove("is-fading");
  }

  initTablist(brandList, {
    tabs,
    onSelect: (tab) => {
      showBrand(tab);
    },
  });

  await applyBrand(tabs[0]);

  window.addEventListener("resize", () => {
    syncCatalogLayout();
  });

  const prefetch = tabs[1];

  if (prefetch && "requestIdleCallback" in window) {
    requestIdleCallback(() => {
      loadBrand(prefetch.dataset.brand).catch(() => {});
    });
  }
}

initCatalog();

function initMaterialFrames() {
  if (!window.Swiper) {
    return;
  }

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

  document.querySelectorAll(".materials__frames").forEach((frames) => {
    const swiperEl = frames.querySelector(".materials__swiper");
    const count = frames.querySelector(".materials__count");

    if (!swiperEl || !count) {
      return;
    }

    const gap = parseFloat(getComputedStyle(swiperEl).getPropertyValue("--slide-gap")) || 14;

    const framesSwiper = new Swiper(swiperEl, {
      slidesPerView: "auto",
      spaceBetween: gap,
      speed: motion.matches ? 0 : 450,
      watchOverflow: true,
      roundLengths: true,
      threshold: 8,
      touchReleaseOnEdges: true,
      navigation: {
        nextEl: frames.querySelector(".materials__next"),
        prevEl: frames.querySelector(".materials__prev"),
      },
      a11y: {
        enabled: true,
        prevSlideMessage: "Предыдущий кадр",
        nextSlideMessage: "Следующий кадр",
      },
      keyboard: {
        enabled: false,
        onlyInViewport: false,
      },
    });

    function paintCount() {
      const total = framesSwiper.slides.length;

      if (!total) {
        count.textContent = "";
        return;
      }

      const current = framesSwiper.activeIndex + 1;
      count.textContent = `${String(current).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
    }

    framesSwiper.on("slideChange", paintCount);
    framesSwiper.on("update", paintCount);
    paintCount();

    function keysOn() {
      framesSwiper.keyboard.enable();
    }

    function keysOff(event) {
      if (frames.contains(event.relatedTarget)) {
        return;
      }

      framesSwiper.keyboard.disable();
    }

    frames.addEventListener("focusin", keysOn);
    frames.addEventListener("focusout", keysOff);

    motion.addEventListener("change", () => {
      framesSwiper.params.speed = motion.matches ? 0 : 450;
    });
  });
}

initMaterialFrames();

function initMaterials() {
  const section = document.querySelector(".materials");

  if (!section || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const items = [...section.querySelectorAll(".materials__item")];
  section.classList.add("is-ready");

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      entry.target.classList.add("is-in");
      observer.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0 });

  items.forEach((item) => observer.observe(item));
}

initMaterials();

function formatPhone(value) {
  let digits = value.replace(/\D/g, "");

  if (digits.startsWith("8")) {
    digits = "7" + digits.slice(1);
  }

  if (digits.startsWith("7")) {
    digits = digits.slice(1);
  }

  digits = digits.slice(0, 10);

  let out = "+7";

  if (!digits) {
    return out;
  }

  out += " (" + digits.slice(0, 3);

  if (digits.length >= 3) {
    out += ")";
  }

  if (digits.length > 3) {
    out += " " + digits.slice(3, 6);
  }

  if (digits.length > 6) {
    out += "-" + digits.slice(6, 8);
  }

  if (digits.length > 8) {
    out += "-" + digits.slice(8, 10);
  }

  return out;
}

function initBrief() {
  const form = document.querySelector(".brief__form");

  if (!form) {
    return;
  }

  const phone = form.querySelector('input[name="phone"]');
  const consent = form.querySelector('input[name="consent"]');
  const file = form.querySelector('input[type="file"]');
  const fileName = form.querySelector(".brief__file-name");
  const fileLabel = fileName ? fileName.textContent : "";
  const notice = document.getElementById("brief-notice");

  const briefStatus = new URLSearchParams(window.location.search).get("brief");

  if (notice) {
    if (briefStatus === "sent") {
      notice.hidden = false;
      notice.textContent = "Заявка отправлена. Мы свяжемся с вами в ближайшее время.";
    } else if (briefStatus === "error") {
      notice.hidden = false;
      notice.textContent = "Не удалось отправить заявку. Проверьте телефон, согласие и файл (PDF, JPG, PNG до 8 МБ).";
    }
  }

  phone.addEventListener("focus", () => {
    if (!phone.value) {
      phone.value = "+7";
    }
  });

  phone.addEventListener("blur", () => {
    if (phone.value === "+7") {
      phone.value = "";
    }
  });

  phone.addEventListener("input", () => {
    phone.setCustomValidity("");
    const next = formatPhone(phone.value);
    phone.value = next === "+7" && phone.value.replace(/\D/g, "").length === 0 ? "+7" : next;
  });

  form.addEventListener("submit", (event) => {
    const digits = phone.value.replace(/\D/g, "");

    if (digits.length !== 11) {
      event.preventDefault();
      phone.setCustomValidity("Введите телефон полностью");
      phone.reportValidity();
      return;
    }

    if (consent && !consent.checked) {
      event.preventDefault();
      consent.setCustomValidity("Нужно согласие на обработку данных");
      consent.reportValidity();
      return;
    }

    if (consent) {
      consent.setCustomValidity("");
    }
  });

  if (!file || !fileName) {
    return;
  }

  file.addEventListener("change", () => {
    const picked = file.files && file.files[0];

    if (!picked) {
      fileName.textContent = fileLabel;
      return;
    }

    if (!/\.(pdf|jpe?g|png)$/i.test(picked.name)) {
      file.value = "";
      fileName.textContent = fileLabel;
      file.setCustomValidity("Можно прикрепить PDF, JPG или PNG");
      file.reportValidity();
      return;
    }

    file.setCustomValidity("");
    fileName.textContent = picked.name;
  });
}

initBrief();

function initFaq() {
  const items = [...document.querySelectorAll(".faq__item")];

  if (!items.length) {
    return;
  }

  items.forEach((item) => {
    item.addEventListener("toggle", () => {
      if (!item.open) {
        return;
      }

      items.forEach((other) => {
        if (other !== item) {
          other.open = false;
        }
      });
    });
  });
}

initFaq();
