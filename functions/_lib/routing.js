import { serializeCookie, readCookie } from "./cookies.js";
import { previewEnabled, resolveGeo } from "./geo.js";
import { loadRegistry } from "./http.js";
import { assignShares, pickOffer, pickWeighted, readStoredGeos } from "./offers.js";

const ROUTE_COOKIE = "gl_route";
const MONTH = 60 * 60 * 24 * 30;

export function routeToken(landingId, offerId) {
  return `${landingId}.${offerId}`;
}

export async function prepareHome(context) {
  const fallback = { landingId: "alice", offer: null, cookies: [], countImpression: false, country: "" };
  if (!context.env?.DB) return fallback;
  try {
    const registry = await loadRegistry(context);
    const preview = previewEnabled(context.env);
    const geo = resolveGeo(context.request, preview);
    const graph = await loadOfferGraph(context.env.DB);
    const candidates = candidatesForCountry(graph, registry.map((item) => item.id), geo.country);
    if (!candidates.length) return { ...fallback, country: geo.country };
    const stuck = candidates.find((item) => routeToken(item.landingId, item.offer.id) === readCookie(context.request, ROUTE_COOKIE));
    const picked = stuck || pickWeighted(candidates, randomUnit());
    const cookies = [];
    if (!stuck) {
      cookies.push(cookie(context.request, ROUTE_COOKIE, routeToken(picked.landingId, picked.offer.id)));
    }
    return {
      landingId: picked.landingId,
      offer: picked.offer,
      cookies,
      countImpression: !stuck,
      country: geo.country,
    };
  } catch (error) {
    console.error("route failed", error);
    return fallback;
  }
}

export async function prepareFixed(context, landingId) {
  const empty = { offer: null, cookies: [], countImpression: false, country: "" };
  if (!context.env?.DB) return empty;
  try {
    const preview = previewEnabled(context.env);
    const geo = resolveGeo(context.request, preview);
    const graph = await loadOfferGraph(context.env.DB);
    const offer = pickOffer(graph.links.get(landingId) || [], geo.country);
    if (!offer) return { ...empty, country: geo.country };
    const cookieName = `gl_imp_${landingId}`;
    const seen = readCookie(context.request, cookieName) === offer.id;
    return {
      offer,
      cookies: seen ? [] : [cookie(context.request, cookieName, offer.id)],
      countImpression: !seen,
      country: geo.country,
    };
  } catch (error) {
    console.error("offer failed", error);
    return empty;
  }
}

export async function loadOfferGraph(db) {
  const [offersResult, linksResult, statsResult] = await db.batch([
    db.prepare("SELECT id, name, kind, url, button_text, geos FROM offers"),
    db.prepare("SELECT landing_id, offer_id, priority FROM landing_offers"),
    db.prepare("SELECT country, offer_id, landing_id, impressions, clicks FROM combo_stats"),
  ]);
  const offers = new Map();
  for (const row of offersResult?.results || []) {
    const stored = readStoredGeos(row.geos);
    offers.set(row.id, {
      id: row.id,
      name: row.name,
      kind: row.kind,
      url: row.url,
      buttonText: row.button_text,
      geos: stored.codes,
      geoMode: stored.mode,
    });
  }
  const links = new Map();
  for (const row of linksResult?.results || []) {
    const offer = offers.get(row.offer_id);
    if (!offer) continue;
    const list = links.get(row.landing_id) || [];
    list.push({ ...offer, priority: Number(row.priority) || 0 });
    links.set(row.landing_id, list);
  }
  const stats = new Map();
  for (const row of statsResult?.results || []) {
    stats.set(`${row.country}|${row.offer_id}|${row.landing_id}`, {
      impressions: Number(row.impressions) || 0,
      clicks: Number(row.clicks) || 0,
    });
  }
  return { offers, links, stats };
}

export function candidatesForCountry(graph, landingIds, country) {
  const candidates = [];
  for (const landingId of landingIds) {
    const offer = pickOffer(graph.links.get(landingId) || [], country);
    if (!offer) continue;
    const stat = graph.stats.get(`${country}|${offer.id}|${landingId}`) || { impressions: 0, clicks: 0 };
    candidates.push({
      landingId,
      offer,
      impressions: stat.impressions,
      clicks: stat.clicks,
    });
  }
  return candidates;
}

export function routeReport(graph, landingIds) {
  const countries = new Set();
  let worldwide = false;
  for (const offer of graph.offers.values()) {
    if (!offer.geos.length) worldwide = true;
    for (const code of offer.geos) countries.add(code);
  }
  for (const key of graph.stats.keys()) countries.add(key.split("|")[0]);
  const labels = [...countries].filter((code) => code && code !== "XX").sort();
  if (!labels.length && worldwide) labels.push("*");
  return labels.map((country) => ({
    country,
    candidates: assignShares(candidatesForCountry(graph, landingIds, country === "*" ? "ZZ" : country)).map((row) => ({
      landing_id: row.landingId,
      offer_id: row.offer.id,
      offer_name: row.offer.name,
      impressions: row.impressions,
      clicks: row.clicks,
      share: row.share,
    })),
  })).filter((group) => group.candidates.length);
}

function cookie(request, name, value) {
  const url = new URL(request.url);
  return serializeCookie(name, value, {
    maxAge: MONTH,
    secure: url.protocol === "https:",
    httpOnly: true,
  });
}

function randomUnit() {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] / 4294967296;
}
