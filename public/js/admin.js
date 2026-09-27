const COUNTRIES = {
  US: "США",
  DE: "Германия",
  JP: "Япония",
  FR: "Франция",
  BR: "Бразилия",
  GB: "Великобритания",
  CA: "Канада",
  XX: "Неизвестно",
};

const RANGES = [
  { id: "all", label: "Всё время" },
  { id: "7", label: "7 дней" },
  { id: "30", label: "30 дней" },
];

const numberFormat = new Intl.NumberFormat("ru-RU");

const app = document.querySelector("#app");
window.addEventListener("hashchange", render);
render();

function parseRoute() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const url = new URL(raw, "https://admin.local");
  const range = url.searchParams.get("range");
  const id = url.pathname.split("/").filter(Boolean)[0] || "";
  return {
    id,
    range: range === "7" || range === "30" ? range : "all",
  };
}

function rangeLabel(range) {
  if (range === "7") return "За 7 дней";
  if (range === "30") return "За 30 дней";
  return "За всё время";
}

function setHash(id, range) {
  const params = new URLSearchParams();
  if (range !== "all") params.set("range", range);
  const query = params.toString();
  location.hash = `${id ? `/${id}` : "/"}${query ? `?${query}` : ""}`;
}

async function render() {
  const route = parseRoute();
  app.replaceChildren(renderHeader(route));
  const main = el("main");
  main.append(el("p", { class: "note" }, "Загрузка…"));
  app.append(main);
  try {
    if (!route.id) {
      const data = await getJson(`/api/landings?range=${route.range}`);
      main.replaceChildren(renderList(data, route));
      document.title = "Лендинги";
      return;
    }
    const data = await getJson(`/api/stats?id=${encodeURIComponent(route.id)}&range=${route.range}`);
    main.replaceChildren(renderDetail(data, route));
    document.title = `${data.landing.name} — лендинги`;
  } catch (error) {
    main.replaceChildren(el("p", { class: "error" }, error.message || "Не удалось загрузить аналитику."));
  }
}

function renderHeader(route) {
  const header = el("header", { class: "top" });
  const title = el("div");
  const brand = el("p", { class: "brand" });
  brand.append(el("a", { href: hashHref("", route.range) }, "Лендинги"));
  title.append(brand, el("p", { class: "sub" }, "Показы, клики и гео по каждому лендингу."));
  const actions = el("div", { class: "top-actions" });
  const logout = el("button", { class: "ghost", type: "button" }, "Выйти");
  logout.addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST" });
    location.href = "/admin/";
  });
  actions.append(logout);
  header.append(title, actions);

  const range = el("div", { class: "range" });
  for (const item of RANGES) {
    const button = el("button", { type: "button", "aria-pressed": String(route.range === item.id) }, item.label);
    button.addEventListener("click", () => setHash(route.id, item.id));
    range.append(button);
  }
  const wrap = el("div");
  wrap.append(header, range);
  return wrap;
}

function renderList(data, route) {
  const wrap = el("div");
  const totals = data.landings.reduce((sum, item) => {
    sum.views += item.views;
    sum.clicks += item.clicks;
    return sum;
  }, { views: 0, clicks: 0 });
  wrap.append(el("p", { class: "note" }, `${rangeLabel(route.range)} · ${formatNumber(totals.views)} ${plural(totals.views, "показ", "показа", "показов")} · ${formatNumber(totals.clicks)} ${plural(totals.clicks, "клик", "клика", "кликов")} · конверсия ${formatConversion(totals.views, totals.clicks)}`));
  const grid = el("div", { class: "grid" });
  for (const landing of data.landings) grid.append(renderCard(landing, data.preview, route));
  wrap.append(grid);
  return wrap;
}

function renderCard(landing, preview, route) {
  const card = el("article", { class: "card" });
  const heading = el("h2");
  heading.append(el("a", { href: hashHref(landing.id, route.range) }, landing.name));
  card.append(heading);
  if (landing.blurb) card.append(el("p", { class: "blurb" }, landing.blurb));
  card.append(metrics(landing));
  card.append(variantTable(landing.variants));
  card.append(el("p", { class: "blurb" }, countryLine(landing.countries)));
  const links = el("p", { class: "links" });
  links.append(el("a", { href: `/l/${landing.id}`, target: "_blank", rel: "noreferrer" }, "Открыть"));
  if (preview) {
    for (const geo of landing.geos) {
      links.append(el("a", { href: previewHref(landing.id, geo), target: "_blank", rel: "noreferrer" }, geo));
    }
  }
  card.append(links);
  return card;
}

function renderDetail(data, route) {
  const landing = data.landing;
  const wrap = el("div");
  const head = el("div", { class: "detail-head" });
  const title = el("div");
  title.append(el("a", { class: "back", href: hashHref("", route.range) }, "← Все лендинги"));
  title.append(el("h2", null, landing.name));
  const meta = [rangeLabel(route.range)];
  if (landing.created_at) meta.push(`в базе с ${formatStamp(landing.created_at)} UTC`);
  else meta.push("первого показа ещё не было");
  title.append(el("p", { class: "blurb" }, meta.join(" · ")));
  const open = el("a", { href: `/l/${landing.id}`, target: "_blank", rel: "noreferrer" }, "Открыть лендинг");
  head.append(title, open);
  wrap.append(head, metrics(landing));

  const columns = el("div", { class: "columns" });
  columns.append(panel("Варианты A/B", variantTable(landing.variants)));
  columns.append(panel("Страны", countryTable(landing.countries)));
  wrap.append(columns);

  wrap.append(panel("Показы по дням, UTC", dayChart(landing.days)));
  wrap.append(panel("Города", cityTable(landing.cities)));
  return wrap;
}

function metrics(landing) {
  const row = el("div", { class: "metrics" });
  row.append(metric("Показы", formatNumber(landing.views)));
  row.append(metric("Клики", formatNumber(landing.clicks)));
  row.append(metric("Конверсия", formatConversion(landing.views, landing.clicks)));
  return row;
}

function metric(label, value) {
  const node = el("div", { class: "metric" });
  node.append(el("span", null, label), el("strong", null, value));
  return node;
}

function panel(title, child) {
  const node = el("section", { class: "panel" });
  node.append(el("h3", null, title), child);
  return node;
}

function variantTable(variants) {
  const table = el("table");
  table.append(tableHead(["Вариант", "Показы", "Клики", "Конверсия"]));
  const body = el("tbody");
  for (const row of variants) {
    body.append(tableRow([
      row.variant,
      formatNumber(row.views),
      formatNumber(row.clicks),
      formatConversion(row.views, row.clicks),
    ]));
  }
  table.append(body);
  return table;
}

function countryTable(countries) {
  if (!countries.length) return el("p", { class: "note" }, "Пока нет показов.");
  const table = el("table");
  table.append(tableHead(["Страна", "Показы", "Клики", "Конверсия"]));
  const body = el("tbody");
  for (const row of countries) {
    body.append(tableRow([
      countryName(row.country),
      formatNumber(row.views),
      formatNumber(row.clicks),
      formatConversion(row.views, row.clicks),
    ]));
  }
  table.append(body);
  return el("div", { class: "scroll" }, table);
}

function cityTable(cities) {
  if (!cities?.length) return el("p", { class: "note" }, "Города появятся, когда Cloudflare передаст город или когда он указан в превью.");
  const table = el("table");
  table.append(tableHead(["Город", "Страна", "Показы", "Клики"]));
  const body = el("tbody");
  for (const row of cities) {
    body.append(tableRow([
      row.city || "Неизвестен",
      countryName(row.country),
      formatNumber(row.views),
      formatNumber(row.clicks),
    ]));
  }
  table.append(body);
  return el("div", { class: "scroll" }, table);
}

function dayChart(days) {
  const max = Math.max(1, ...days.map((day) => day.views));
  const chart = el("div", { class: "days" });
  for (const day of days) {
    const height = Math.max(2, Math.round((day.views / max) * 100));
    const bar = el("div", {
      class: "bar",
      style: `--h:${height}%`,
      title: `${day.day}: ${day.views} показов, ${day.clicks} кликов`,
    });
    const column = el("div", { class: "day" });
    column.append(bar);
    chart.append(column);
  }
  return chart;
}

function countryLine(countries) {
  if (!countries.length) return "Стран пока нет.";
  return `Топ стран: ${countries.map((row) => `${countryName(row.country)} (${formatNumber(row.views)})`).join(", ")}`;
}

function countryName(code) {
  const name = COUNTRIES[code];
  return name ? `${name} · ${code}` : code || "Неизвестно";
}

function previewHref(id, geo) {
  const [country, region] = geo.split("-");
  const params = new URLSearchParams({ country });
  if (region) params.set("region", region);
  return `/l/${id}?${params}`;
}

function hashHref(id, range) {
  const params = new URLSearchParams();
  if (range !== "all") params.set("range", range);
  const query = params.toString();
  return `#${id ? `/${id}` : "/"}${query ? `?${query}` : ""}`;
}

function tableHead(labels) {
  const row = el("tr");
  for (const label of labels) row.append(el("th", null, label));
  return el("thead", null, row);
}

function tableRow(values) {
  const row = el("tr");
  for (const value of values) row.append(el("td", null, value));
  return row;
}

function formatNumber(value) {
  return numberFormat.format(value || 0);
}

function plural(value, one, few, many) {
  const abs = Math.abs(Number(value) || 0) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

function formatConversion(views, clicks) {
  if (!views) return "—";
  return `${(clicks / views * 100).toFixed(1).replace(".", ",")}%`;
}

function formatStamp(stamp) {
  const date = new Date(String(stamp).replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return stamp;
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeZone: "UTC" }).format(date);
}

async function getJson(path) {
  const response = await fetch(path);
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    throw new Error("Сессия недействительна. Обновите страницу и войдите снова.");
  }
  if (!response.ok) throw new Error(data.message || "Запрос завершился ошибкой.");
  return data;
}

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null) continue;
    if (key === "class") node.className = value;
    else node.setAttribute(key, value);
  }
  const list = children == null ? [] : [children];
  for (const child of list) {
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}
