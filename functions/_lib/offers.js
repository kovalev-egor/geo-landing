import { normalizeCountry } from "./geo.js";

export const OFFER_KINDS = new Set(["octocpa", "onlytraffic", "telegram"]);
export const SHARE_ALPHA = 1;
export const EXPLORE_IMPRESSIONS = 40;

export function parseGeos(value) {
  const raw = Array.isArray(value) ? value : String(value || "").split(/[\s,;]+/);
  const geos = [];
  for (const item of raw) {
    const code = normalizeCountry(item);
    if (!code || code === "XX" || geos.includes(code)) continue;
    geos.push(code);
    if (geos.length >= 50) break;
  }
  return geos;
}

export function validateOfferUrl(kind, value) {
  const url = String(value || "").trim();
  if (!url || url.length > 2000) return "";
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return "";
  }
  const host = parsed.hostname.toLowerCase();
  if (kind === "telegram") {
    const allowed = host === "t.me" || host === "telegram.me" || host === "telegram.dog";
    return parsed.protocol === "https:" && allowed ? url : "";
  }
  return parsed.protocol === "https:" ? url : "";
}

export function offerIdFromName(name) {
  const base = String(name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "offer";
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const suffix = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${base}-${suffix}`.slice(0, 64);
}

export function pickOffer(offers, country) {
  const ranked = [...offers].sort((left, right) => left.priority - right.priority || String(left.id).localeCompare(String(right.id)));
  return ranked.find((offer) => offer.geos.length === 0 || offer.geos.includes(country)) || null;
}

export function comboWeights(rows) {
  const leaderClicks = rows.reduce((max, row) => Math.max(max, Number(row.clicks) || 0), 0);
  return rows.map((row) => {
    const clicks = Number(row.clicks) || 0;
    const impressions = Number(row.impressions) || 0;
    const explore = leaderClicks * Math.exp(-impressions / EXPLORE_IMPRESSIONS);
    return { ...row, weight: clicks + explore + SHARE_ALPHA };
  });
}

export function assignShares(rows) {
  const weighted = comboWeights(rows);
  const total = weighted.reduce((sum, row) => sum + row.weight, 0);
  return weighted.map((row) => ({ ...row, share: total ? row.weight / total : 0 }));
}

export function pickWeighted(rows, random) {
  const weighted = comboWeights(rows);
  if (!weighted.length) return null;
  const total = weighted.reduce((sum, row) => sum + row.weight, 0);
  let cursor = random() * total;
  for (const row of weighted) {
    cursor -= row.weight;
    if (cursor <= 0) return row;
  }
  return weighted[weighted.length - 1];
}

export function readStoredGeos(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return parseGeos(parsed);
  } catch {
    return [];
  }
}
