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

let editingOffer = null;

const app = document.querySelector("#app");
window.addEventListener("hashchange", render);
render();

function parseRoute() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const url = new URL(raw, "https://admin.local");
  const range = url.searchParams.get("range");
  const parts = url.pathname.split("/").filter(Boolean);
  return {
    page: parts[0] === "offers" ? "offers" : "landings",
    id: parts[0] === "offers" ? "" : (parts[0] || ""),
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
  if (route.page !== "offers") editingOffer = null;
  app.replaceChildren(renderHeader(route));
  const main = el("main");
  main.append(el("p", { class: "note" }, "Загрузка…"));
  app.append(main);
  try {
    if (route.page === "offers") {
      const data = await getJson("/api/offers");
      main.replaceChildren(renderOffers(data));
      document.title = "Ссылки — лендинги";
      return;
    }
    if (!route.id) {
      const data = await getJson(`/api/landings?range=${route.range}`);
      main.replaceChildren(renderList(data, route));
      document.title = "Лендинги";
      return;
    }
    const [data, catalog] = await Promise.all([
      getJson(`/api/stats?id=${encodeURIComponent(route.id)}&range=${route.range}`),
      getJson("/api/offers"),
    ]);
    main.replaceChildren(renderDetail(data, route, catalog));
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
  const offersLink = el("a", { href: "#/offers" }, "Ссылки");
  const logout = el("button", { class: "ghost", type: "button" }, "Выйти");
  logout.addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST" });
    location.href = "/admin/";
  });
  actions.append(offersLink, logout);
  header.append(title, actions);

  const range = el("div", { class: "range" });
  for (const item of RANGES) {
    const button = el("button", { type: "button", "aria-pressed": String(route.range === item.id) }, item.label);
    button.addEventListener("click", () => setHash(route.id, item.id));
    range.append(button);
  }
  const wrap = el("div");
  wrap.append(header);
  if (route.page !== "offers") wrap.append(range);
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

function renderDetail(data, route, catalog) {
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
  wrap.append(renderLandingLinks(landing, catalog));
  wrap.append(renderLandingShares(landing.id, catalog));
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

const OFFER_KINDS = [
  ["octocpa", "OctoCPA"],
  ["onlytraffic", "OnlyTraffic"],
  ["telegram", "Telegram"],
];

function renderOffers(data) {
  const wrap = el("div");
  wrap.append(el("h2", null, "Ссылки на офферы"));
  wrap.append(el("p", { class: "note" }, "Новый лендинг — это папка в репозитории и пуш в master. Pages публикует её сам. Ссылку, страны, текст кнопки и приоритет меняйте здесь: для этого деплой не нужен. Пока ссылка не подключена к лендингу, главная страница / его не показывает."));
  wrap.append(offerForm(editingOffer));
  const list = el("div", { class: "offer-list" });
  if (!data.offers.length) list.append(el("p", { class: "note" }, "Ссылок пока нет."));
  for (const offer of data.offers) list.append(offerCard(offer, data));
  wrap.append(list, renderShareGroups(data, "Как главная делит трафик"));
  return wrap;
}

function geoLabel(offer) {
  if (offer.geo_mode === "deny") {
    return offer.geos.length ? `все, кроме ${offer.geos.length} стран` : "все страны";
  }
  return offer.geos.length ? offer.geos.join(", ") : "все страны";
}

function offerForm(offer) {
  const form = el("form", { class: "offer-form panel" });
  const name = field("Название", "text", offer?.name || "");
  const kind = el("select", { name: "kind" });
  for (const [id, label] of OFFER_KINDS) {
    const option = el("option", { value: id }, label);
    if ((offer?.kind || "octocpa") === id) option.selected = true;
    kind.append(option);
  }
  const kindWrap = el("label", null, "Тип");
  kindWrap.append(kind);
  const url = field("Ссылка", "url", offer?.url || "", "https://");
  const button = field("Текст кнопки", "text", offer?.button_text || "");
  const geos = field("Страны", "text", (offer?.geos || []).join(", "), "US, DE, BR");
  const all = el("input", { type: "checkbox" });
  const except = el("input", { type: "checkbox" });
  all.checked = Boolean(offer && offer.geo_mode !== "deny" && offer.geos.length === 0);
  except.checked = offer?.geo_mode === "deny";
  const allWrap = el("label", { class: "checks" });
  allWrap.append(all, document.createTextNode("Все страны"));
  const exceptWrap = el("label", { class: "checks" });
  exceptWrap.append(except, document.createTextNode("Все страны, кроме списка"));
  const submit = el("button", { class: "primary", type: "submit" }, offer ? "Сохранить" : "Добавить ссылку");
  const error = el("p", { class: "error" });
  form.append(el("h3", null, offer ? "Изменить ссылку" : "Новая ссылка"), name.label, kindWrap, url.label, button.label, geos.label, allWrap, exceptWrap, submit, error);
  const syncGeos = () => {
    geos.input.disabled = all.checked;
  };
  all.addEventListener("change", () => {
    if (all.checked) except.checked = false;
    syncGeos();
  });
  except.addEventListener("change", () => {
    if (except.checked) all.checked = false;
    syncGeos();
  });
  syncGeos();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";
    const payload = {
      name: name.input.value,
      kind: kind.value,
      url: url.input.value,
      button_text: button.input.value,
      geo_mode: except.checked ? "deny" : "allow",
      geos: all.checked ? [] : geos.input.value.split(/[\s,;]+/).filter(Boolean),
    };
    try {
      if (offer) await sendJson("/api/offers", "PUT", { ...payload, id: offer.id });
      else await sendJson("/api/offers", "POST", payload);
      editingOffer = null;
      render();
    } catch (err) {
      error.textContent = err.message;
    }
  });
  return form;
}

function offerCard(offer, data) {
  const card = el("article", { class: "offer-card" });
  card.append(el("h3", null, offer.name));
  card.append(el("p", { class: "blurb" }, `${kindLabel(offer.kind)} · кнопка «${offer.button_text}» · ${geoLabel(offer)}`));
  card.append(el("p", null, offer.url));
  const used = offer.landings.map((link) => data.landings.find((item) => item.id === link.id)?.name || link.id);
  card.append(el("p", { class: "note" }, used.length ? `Лендинги: ${used.join(", ")}` : "Пока не подключена ни к одному лендингу."));
  const actions = el("div", { class: "offer-actions" });
  const edit = el("button", { type: "button", class: "ghost" }, "Изменить");
  const remove = el("button", { type: "button", class: "ghost" }, "Удалить");
  edit.addEventListener("click", () => {
    editingOffer = offer;
    render();
  });
  remove.addEventListener("click", async () => {
    if (!confirm(`Удалить ссылку «${offer.name}»?`)) return;
    try {
      await sendJson(`/api/offers?id=${encodeURIComponent(offer.id)}`, "DELETE");
      if (editingOffer?.id === offer.id) editingOffer = null;
      render();
    } catch (error) {
      card.append(el("p", { class: "error" }, error.message));
    }
  });
  actions.append(edit, remove);
  card.append(actions);
  return card;
}

function renderLandingLinks(landing, catalog) {
  const attached = catalog.offers
    .filter((offer) => offer.landings.some((item) => item.id === landing.id))
    .sort((left, right) => linkPriority(left, landing.id) - linkPriority(right, landing.id));
  const section = el("section", { class: "panel" });
  section.append(el("h3", null, "Ссылки по приоритету"));
  section.append(el("p", { class: "note" }, "Сначала отбираются ссылки, которым разрешена страна посетителя. Из них на лендинге остаётся самая верхняя."));
  const error = el("p", { class: "error" });
  attached.forEach((offer, index) => {
    const row = el("div", { class: "link-row" });
    row.append(el("strong", null, `${index + 1}. ${offer.name}`));
    row.append(document.createTextNode(`${kindLabel(offer.kind)} · ${offer.button_text} · ${geoLabel(offer)}`));
    const up = el("button", { type: "button", class: "ghost" }, "Выше");
    const down = el("button", { type: "button", class: "ghost" }, "Ниже");
    const remove = el("button", { type: "button", class: "ghost" }, "Убрать");
    up.disabled = index === 0;
    down.disabled = index === attached.length - 1;
    up.addEventListener("click", () => reorderLinks(landing.id, attached, index, -1, error));
    down.addEventListener("click", () => reorderLinks(landing.id, attached, index, 1, error));
    remove.addEventListener("click", () => saveLinks(landing.id, attached.filter((item) => item.id !== offer.id).map((item) => item.id), error));
    row.append(up, down, remove);
    section.append(row);
  });
  if (!attached.length) section.append(el("p", { class: "note" }, "К этому лендингу ссылки ещё не подключены."));
  const select = el("select");
  select.append(el("option", { value: "" }, "Добавить ссылку"));
  for (const offer of catalog.offers) {
    if (attached.some((item) => item.id === offer.id)) continue;
    select.append(el("option", { value: offer.id }, offer.name));
  }
  select.addEventListener("change", () => {
    if (!select.value) return;
    saveLinks(landing.id, [...attached.map((item) => item.id), select.value], error);
  });
  section.append(select, error);
  return section;
}

function renderLandingShares(landingId, catalog) {
  const data = {
    ...catalog,
    routes: (catalog.routes || []).filter((group) => group.candidates.some((row) => row.landing_id === landingId)),
  };
  return renderShareGroups(data, "Доля входа на /");
}

function renderShareGroups(data, title) {
  const section = el("section", { class: "panel" });
  section.append(el("h3", null, title));
  section.append(el("p", { class: "note" }, "Адрес / выбирает связку страна + ссылка + лендинг. Пока кликов нет, лендинги делят трафик поровну. Дальше чаще показывается связка с большим числом кликов. Новый лендинг начинает рядом с лидером и постепенно уходит вниз, если не получает клики."));
  const groups = data.routes || [];
  if (!groups.length) {
    section.append(el("p", { class: "note" }, "Ротация появится, когда хотя бы у одного лендинга будет ссылка."));
    return section;
  }
  for (const group of groups) {
    section.append(el("h3", null, group.country === "*" ? "Все страны" : countryName(group.country)));
    const table = el("table");
    table.append(tableHead(["Лендинг", "Ссылка", "Показы", "Клики", "Доля"]));
    const body = el("tbody");
    for (const row of group.candidates) {
      const name = data.landings.find((item) => item.id === row.landing_id)?.name || row.landing_id;
      body.append(tableRow([
        name,
        row.offer_name,
        formatNumber(row.impressions),
        formatNumber(row.clicks),
        `${(row.share * 100).toFixed(1).replace(".", ",")}%`,
      ]));
    }
    table.append(body);
    section.append(el("div", { class: "scroll" }, table));
  }
  return section;
}

function field(label, type, value, placeholder) {
  const input = el("input", { type, value, placeholder: placeholder || "" });
  const node = el("label", null, label);
  node.append(input);
  return { label: node, input };
}

function kindLabel(kind) {
  return OFFER_KINDS.find((item) => item[0] === kind)?.[1] || kind;
}

function linkPriority(offer, landingId) {
  return offer.landings.find((item) => item.id === landingId)?.priority ?? 0;
}

function reorderLinks(landingId, attached, index, delta, error) {
  const ids = attached.map((item) => item.id);
  const next = index + delta;
  [ids[index], ids[next]] = [ids[next], ids[index]];
  return saveLinks(landingId, ids, error);
}

async function saveLinks(landingId, offerIds, error) {
  error.textContent = "";
  try {
    await sendJson("/api/offers", "PUT", { action: "links", landing_id: landingId, offer_ids: offerIds });
    render();
  } catch (err) {
    error.textContent = err.message;
  }
}

async function sendJson(path, method, body) {
  const response = await fetch(path, {
    method,
    headers: body == null ? undefined : { "content-type": "application/json" },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    throw new Error("Сессия недействительна. Обновите страницу и войдите снова.");
  }
  if (!response.ok) throw new Error(data.message || "Запрос завершился ошибкой.");
  return data;
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
