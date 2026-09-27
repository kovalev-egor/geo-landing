import { databaseError } from "../_lib/db.js";
import { ID_RE, json, loadRegistry } from "../_lib/http.js";
import {
  OFFER_KINDS,
  encodeGeos,
  offerIdFromName,
  parseGeos,
  validateOfferUrl,
} from "../_lib/offers.js";
import { loadOfferGraph, routeReport } from "../_lib/routing.js";

export async function onRequest(context) {
  if (!context.env.DB) return json({ error: "database", message: "База D1 не подключена." }, 503);
  const method = context.request.method;
  try {
    if (method === "GET") return listOffers(context);
    if (method === "POST") return createOffer(context);
    if (method === "PUT") return updateOffer(context);
    if (method === "DELETE") return deleteOffer(context);
    return json({ error: "method" }, 405);
  } catch (error) {
    const failure = databaseError(error);
    return json(failure.body, failure.status);
  }
}

async function listOffers(context) {
  const [registry, graph] = await Promise.all([
    loadRegistry(context),
    loadOfferGraph(context.env.DB),
  ]);
  const landingIds = registry.map((item) => item.id);
  const offers = [...graph.offers.values()].map((offer) => ({
    id: offer.id,
    name: offer.name,
    kind: offer.kind,
    url: offer.url,
    button_text: offer.buttonText,
    geos: offer.geos,
    geo_mode: offer.geoMode || "allow",
    landings: landingIds.flatMap((landingId) => {
      const link = (graph.links.get(landingId) || []).find((item) => item.id === offer.id);
      return link ? [{ id: landingId, priority: link.priority }] : [];
    }).sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id)),
  })).sort((left, right) => left.name.localeCompare(right.name, "ru"));
  return json({
    offers,
    landings: registry.map((item) => ({ id: item.id, name: item.name })),
    routes: routeReport(graph, landingIds),
  });
}

async function createOffer(context) {
  const input = await readOfferInput(context);
  if (input.error) return input.error;
  const id = offerIdFromName(input.name);
  await context.env.DB.prepare(
    "INSERT INTO offers (id, name, kind, url, button_text, geos) VALUES (?, ?, ?, ?, ?, ?)",
  ).bind(id, input.name, input.kind, input.url, input.buttonText, encodeGeos(input.geoMode, input.geos)).run();
  return json({ id }, 201);
}

async function updateOffer(context) {
  const body = await readBody(context);
  if (body.error) return body.error;
  if (body.value.action === "links") return updateLinks(context, body.value);
  const input = normalizeOffer(body.value);
  if (input.error) return input.error;
  const id = String(body.value.id || "");
  if (!ID_RE.test(id)) return json({ error: "id", message: "Некорректная ссылка." }, 400);
  const existing = await context.env.DB.prepare("SELECT 1 AS ok FROM offers WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "missing", message: "Ссылка не найдена." }, 404);
  await context.env.DB.prepare(
    "UPDATE offers SET name = ?, kind = ?, url = ?, button_text = ?, geos = ? WHERE id = ?",
  ).bind(input.name, input.kind, input.url, input.buttonText, encodeGeos(input.geoMode, input.geos), id).run();
  return json({ id });
}

async function updateLinks(context, body) {
  const landingId = String(body.landing_id || "");
  if (!ID_RE.test(landingId)) return json({ error: "landing", message: "Некорректный лендинг." }, 400);
  const registry = await loadRegistry(context);
  if (!registry.some((item) => item.id === landingId)) {
    return json({ error: "landing", message: "Такого лендинга нет в проекте." }, 404);
  }
  const offerIds = [];
  for (const item of Array.isArray(body.offer_ids) ? body.offer_ids : []) {
    const id = String(item || "");
    if (!ID_RE.test(id) || offerIds.includes(id)) continue;
    offerIds.push(id);
  }
  if (offerIds.length > 30) return json({ error: "links", message: "Слишком много ссылок у одного лендинга." }, 400);
  if (offerIds.length) {
    const placeholders = offerIds.map(() => "?").join(", ");
    const found = await context.env.DB.prepare(
      `SELECT id FROM offers WHERE id IN (${placeholders})`,
    ).bind(...offerIds).all();
    const known = new Set((found.results || []).map((row) => row.id));
    if (offerIds.some((id) => !known.has(id))) {
      return json({ error: "links", message: "Одна из ссылок уже удалена." }, 400);
    }
  }
  const statements = [
    context.env.DB.prepare("DELETE FROM landing_offers WHERE landing_id = ?").bind(landingId),
    ...offerIds.map((offerId, index) => context.env.DB.prepare(
      "INSERT INTO landing_offers (landing_id, offer_id, priority) VALUES (?, ?, ?)",
    ).bind(landingId, offerId, index)),
  ];
  await context.env.DB.batch(statements);
  return json({ landing_id: landingId, offer_ids: offerIds });
}

async function deleteOffer(context) {
  const id = new URL(context.request.url).searchParams.get("id") || "";
  if (!ID_RE.test(id)) return json({ error: "id", message: "Некорректная ссылка." }, 400);
  await context.env.DB.batch([
    context.env.DB.prepare("DELETE FROM landing_offers WHERE offer_id = ?").bind(id),
    context.env.DB.prepare("DELETE FROM combo_stats WHERE offer_id = ?").bind(id),
    context.env.DB.prepare("DELETE FROM offers WHERE id = ?").bind(id),
  ]);
  return json({ id });
}

async function readOfferInput(context) {
  const body = await readBody(context);
  if (body.error) return body;
  return normalizeOffer(body.value);
}

function normalizeOffer(value) {
  const name = String(value.name || "").trim().slice(0, 120);
  const kind = String(value.kind || "");
  const buttonText = String(value.button_text || "").trim().slice(0, 80);
  const url = validateOfferUrl(kind, value.url);
  const geoMode = value.geo_mode === "deny" ? "deny" : "allow";
  const geos = parseGeos(value.geos);
  if (!name) return { error: json({ error: "name", message: "Укажите название ссылки." }, 400) };
  if (!OFFER_KINDS.has(kind)) return { error: json({ error: "kind", message: "Выберите тип ссылки." }, 400) };
  if (!buttonText) return { error: json({ error: "button", message: "Укажите текст кнопки." }, 400) };
  if (!url) {
    const message = kind === "telegram"
      ? "Для Telegram нужна ссылка вида https://t.me/…"
      : "Нужна ссылка, которая начинается с https://";
    return { error: json({ error: "url", message }, 400) };
  }
  return { name, kind, buttonText, url, geos, geoMode };
}

async function readBody(context) {
  try {
    const raw = await context.request.text();
    if (raw.length > 20000) return { error: json({ error: "payload", message: "Слишком большой запрос." }, 413) };
    return { value: JSON.parse(raw || "{}") };
  } catch {
    return { error: json({ error: "json", message: "Некорректный запрос." }, 400) };
  }
}
