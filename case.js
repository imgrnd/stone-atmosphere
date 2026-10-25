const root = document.getElementById("case");
const slugPattern = /^[a-z0-9-]+$/;

function asset(path) {
  return String(path)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function picture(frame) {
  const pic = document.createElement("picture");
  pic.className = "case__picture";

  if (frame.desktop) {
    const source = document.createElement("source");
    source.media = "(min-width: 1024px)";
    source.srcset = asset(frame.desktop);
    pic.append(source);
  }

  const img = document.createElement("img");
  img.className = "case__img";
  img.src = asset(frame.mobile || frame.desktop);
  img.alt = frame.alt || "";
  img.decoding = "async";
  pic.append(img);
  return pic;
}

function figure(frame, caption) {
  const fig = document.createElement("figure");
  fig.className = "case__figure";
  fig.append(picture(frame));

  if (caption) {
    const cap = document.createElement("figcaption");
    cap.className = "case__caption";
    cap.textContent = caption;
    fig.append(cap);
  }

  return fig;
}

function showEmpty(message) {
  root.replaceChildren();
  const block = document.createElement("p");
  block.className = "case__empty";

  const text = document.createElement("span");
  text.textContent = message;

  const link = document.createElement("a");
  link.href = "index.html#spaces";
  link.textContent = "К проектам на главной";

  block.append(text, document.createTextNode(" "), link);
  root.append(block);
  document.title = "Кейс — Атмосфера камня";
}

function renderLead(block) {
  const section = document.createElement("header");
  section.className = "case__lead";

  if (block.eyebrow) {
    const eyebrow = document.createElement("p");
    eyebrow.className = "case__eyebrow";
    eyebrow.textContent = block.eyebrow;
    section.append(eyebrow);
  }

  const title = document.createElement("h1");
  title.className = "case__title";
  title.textContent = block.title || "";

  const copy = document.createElement("div");
  copy.className = "case__lead-copy";
  copy.append(title);

  if (block.text) {
    const text = document.createElement("p");
    text.className = "case__lead-text";
    text.textContent = block.text;
    section.append(copy, text);
  } else {
    section.append(copy);
  }

  return section;
}

function renderMedia(block) {
  return figure(block, block.caption);
}

function renderDuo(block) {
  const section = document.createElement("div");
  section.className = "case__duo";

  (block.items || []).forEach((item) => {
    section.append(figure(item, item.caption));
  });

  return section;
}

function renderSplit(block) {
  const section = document.createElement("section");
  section.className = "case__split";

  if (block.side === "end") {
    section.classList.add("case__split--end");
  }

  const copy = document.createElement("div");
  copy.className = "case__copy";

  if (block.eyebrow) {
    const eyebrow = document.createElement("p");
    eyebrow.className = "case__eyebrow";
    eyebrow.textContent = block.eyebrow;
    copy.append(eyebrow);
  }

  if (block.title) {
    const title = document.createElement("h2");
    title.className = "case__heading";
    title.textContent = block.title;
    copy.append(title);
  }

  if (block.text) {
    const text = document.createElement("p");
    text.className = "case__text";
    text.textContent = block.text;
    copy.append(text);
  }

  if (block.note) {
    const note = document.createElement("p");
    note.className = "case__note";
    note.textContent = block.note;
    copy.append(note);
  }

  section.append(figure(block, block.caption), copy);
  return section;
}

function renderChapter(block) {
  const section = document.createElement("section");
  section.className = "case__chapter";

  if (block.title) {
    const title = document.createElement("h2");
    title.className = "case__heading";
    title.textContent = block.title;
    section.append(title);
  }

  section.append(figure(block, block.caption));
  return section;
}

function renderVideo(block) {
  const fig = document.createElement("figure");
  fig.className = "case__figure";

  const video = document.createElement("video");
  video.className = "case__video";
  video.controls = true;
  video.playsInline = true;
  video.preload = "metadata";

  if (block.poster) {
    video.poster = asset(block.poster);
  }

  if (block.src) {
    const source = document.createElement("source");
    source.src = asset(block.src);
    source.type = "video/mp4";
    video.append(source);
  }

  fig.append(video);

  if (block.caption) {
    const cap = document.createElement("figcaption");
    cap.className = "case__caption";
    cap.textContent = block.caption;
    fig.append(cap);
  }

  return fig;
}

function renderVideos(block) {
  const row = document.createElement("div");
  row.className = "case__videos";

  (block.items || []).forEach((item) => {
    row.append(renderVideo(item));
  });

  return row;
}

function renderCollage(block) {
  const items = (block.items || []).slice(0, 4);
  const section = document.createElement("div");
  section.className = "case__collage";

  if (items.length === 3) {
    section.classList.add("case__collage--3");
  }

  items.forEach((item) => {
    const cell = document.createElement("div");
    cell.className = "case__cell";
    cell.append(figure(item, item.caption));
    section.append(cell);
  });

  return section;
}

async function nextHref(slug) {
  if (!slugPattern.test(slug || "")) {
    return "index.html#spaces";
  }

  try {
    const response = await fetch(`cases/${slug}.json`);

    if (!response.ok) {
      return "index.html#spaces";
    }

    return `case.html?slug=${encodeURIComponent(slug)}`;
  } catch {
    return "index.html#spaces";
  }
}

async function renderNext(block) {
  const link = document.createElement("a");
  link.className = "case__next";
  link.href = await nextHref(block.slug);

  const shot = document.createElement("span");
  shot.className = "case__next-shot";
  shot.append(picture(block));

  const copy = document.createElement("span");
  copy.className = "case__next-copy";

  const eyebrow = document.createElement("span");
  eyebrow.className = "case__eyebrow";
  eyebrow.textContent = "Следующий кейс";

  const title = document.createElement("span");
  title.className = "case__next-title";
  title.textContent = block.title || "";

  copy.append(eyebrow, title);

  const mark = document.createElement("span");
  mark.className = "case__next-mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = "→";

  link.append(shot, copy, mark);
  return link;
}

const renderers = {
  lead: renderLead,
  media: renderMedia,
  duo: renderDuo,
  split: renderSplit,
  chapter: renderChapter,
  collage: renderCollage,
  video: renderVideo,
  videos: renderVideos,
};

async function renderCase(data) {
  document.title = `${data.title || "Кейс"} — Атмосфера камня`;
  root.replaceChildren();

  const blocks = Array.isArray(data.blocks) ? data.blocks : [];

  for (const block of blocks) {
    if (!block || typeof block.type !== "string") {
      continue;
    }

    if (block.type === "next") {
      root.append(await renderNext(block));
      continue;
    }

    const render = renderers[block.type];

    if (!render) {
      continue;
    }

    root.append(render(block));
  }
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug") || "";

  if (!slugPattern.test(slug)) {
    showEmpty("Кейс не найден.");
    return;
  }

  try {
    const response = await fetch(`cases/${slug}.json`);

    if (!response.ok) {
      showEmpty("Кейс не найден.");
      return;
    }

    const data = await response.json();
    await renderCase(data);
  } catch {
    showEmpty("Не удалось открыть кейс.");
  }
}

init();
