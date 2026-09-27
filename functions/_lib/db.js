export function rangeSql(range) {
  if (range === "7") return "created_at >= datetime('now', '-7 days')";
  if (range === "30") return "created_at >= datetime('now', '-30 days')";
  return "1 = 1";
}

export function conversion(views, clicks) {
  if (!views) return null;
  return Math.round((clicks / views) * 1000) / 10;
}

export async function recordCombo(db, field, event) {
  if (field !== "impressions" && field !== "clicks") {
    throw new Error("Unknown combo field");
  }
  await db.prepare(
    `INSERT INTO combo_stats (country, offer_id, landing_id, impressions, clicks)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(country, offer_id, landing_id) DO UPDATE SET ${field} = ${field} + 1`,
  ).bind(
    event.country || "XX",
    event.offerId,
    event.landingId,
    field === "impressions" ? 1 : 0,
    field === "clicks" ? 1 : 0,
  ).run();
}

export async function recordEvent(db, table, event) {
  if (table !== "pageviews" && table !== "clicks") {
    throw new Error("Unknown analytics table");
  }
  const city = event.city || null;
  const region = event.region || null;
  await db.batch([
    db.prepare(
      `INSERT INTO landings (id, name) VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
    ).bind(event.landingId, event.name),
    db.prepare(
      `INSERT INTO ${table} (landing_id, variant, country, region, city) VALUES (?, ?, ?, ?, ?)`,
    ).bind(event.landingId, event.variant, event.country || "XX", region, city),
  ]);
}

export async function collectStats(db, range) {
  const where = rangeSql(range);
  const [views, clicks, viewVariants, clickVariants, viewCountries, clickCountries, catalog] = await db.batch([
    db.prepare(`SELECT landing_id, COUNT(*) AS n FROM pageviews WHERE ${where} GROUP BY landing_id`),
    db.prepare(`SELECT landing_id, COUNT(*) AS n FROM clicks WHERE ${where} GROUP BY landing_id`),
    db.prepare(`SELECT landing_id, variant, COUNT(*) AS n FROM pageviews WHERE ${where} GROUP BY landing_id, variant`),
    db.prepare(`SELECT landing_id, variant, COUNT(*) AS n FROM clicks WHERE ${where} GROUP BY landing_id, variant`),
    db.prepare(`SELECT landing_id, country, COUNT(*) AS n FROM pageviews WHERE ${where} GROUP BY landing_id, country`),
    db.prepare(`SELECT landing_id, country, COUNT(*) AS n FROM clicks WHERE ${where} GROUP BY landing_id, country`),
    db.prepare(`SELECT id, created_at FROM landings`),
  ]);

  return {
    views: indexCount(rows(views), (row) => row.landing_id),
    clicks: indexCount(rows(clicks), (row) => row.landing_id),
    viewVariants: indexCount(rows(viewVariants), (row) => `${row.landing_id}:${row.variant}`),
    clickVariants: indexCount(rows(clickVariants), (row) => `${row.landing_id}:${row.variant}`),
    viewCountries: groupNested(rows(viewCountries)),
    clickCountries: groupNested(rows(clickCountries)),
    createdAt: new Map(rows(catalog).map((row) => [row.id, row.created_at])),
  };
}

export async function collectDetail(db, landingId, range) {
  const where = `landing_id = ? AND ${rangeSql(range)}`;
  const [citiesV, citiesC, daysV, daysC] = await db.batch([
    db.prepare(`SELECT country, COALESCE(city, '') AS city, COUNT(*) AS n FROM pageviews WHERE ${where} GROUP BY country, city`).bind(landingId),
    db.prepare(`SELECT country, COALESCE(city, '') AS city, COUNT(*) AS n FROM clicks WHERE ${where} GROUP BY country, city`).bind(landingId),
    db.prepare(`SELECT date(created_at) AS day, COUNT(*) AS n FROM pageviews WHERE ${where} GROUP BY day`).bind(landingId),
    db.prepare(`SELECT date(created_at) AS day, COUNT(*) AS n FROM clicks WHERE ${where} GROUP BY day`).bind(landingId),
  ]);

  return {
    cities: mergeCities(rows(citiesV), rows(citiesC)).slice(0, 8),
    days: fillDays(rows(daysV), rows(daysC), range),
  };
}

export function buildSummary(entry, stats, countryLimit = 5) {
  const views = stats.views.get(entry.id) || 0;
  const clicks = stats.clicks.get(entry.id) || 0;
  return {
    id: entry.id,
    name: entry.name,
    blurb: entry.blurb || "",
    created_at: stats.createdAt.get(entry.id) || null,
    views,
    clicks,
    conversion: conversion(views, clicks),
    variants: ["A", "B"].map((variant) => {
      const variantViews = stats.viewVariants.get(`${entry.id}:${variant}`) || 0;
      const variantClicks = stats.clickVariants.get(`${entry.id}:${variant}`) || 0;
      return {
        variant,
        views: variantViews,
        clicks: variantClicks,
        conversion: conversion(variantViews, variantClicks),
      };
    }),
    countries: mergeCountries(entry.id, stats).slice(0, countryLimit),
  };
}

function rows(result) {
  return result?.results || [];
}

function indexCount(list, keyFn) {
  const map = new Map();
  for (const row of list) map.set(keyFn(row), Number(row.n) || 0);
  return map;
}

function groupNested(list) {
  const map = new Map();
  for (const row of list) {
    const bucket = map.get(row.landing_id) || new Map();
    bucket.set(row.country || "XX", Number(row.n) || 0);
    map.set(row.landing_id, bucket);
  }
  return map;
}

function mergeCountries(landingId, stats) {
  const views = stats.viewCountries.get(landingId) || new Map();
  const clicks = stats.clickCountries.get(landingId) || new Map();
  const codes = new Set([...views.keys(), ...clicks.keys()]);
  return [...codes].map((country) => {
    const countryViews = views.get(country) || 0;
    const countryClicks = clicks.get(country) || 0;
    return {
      country: country || "XX",
      views: countryViews,
      clicks: countryClicks,
      conversion: conversion(countryViews, countryClicks),
    };
  }).sort((a, b) => b.views - a.views || b.clicks - a.clicks || a.country.localeCompare(b.country));
}

function mergeCities(viewRows, clickRows) {
  const map = new Map();
  const add = (row, field) => {
    const key = `${row.country || "XX"}|${row.city || ""}`;
    const current = map.get(key) || {
      country: row.country || "XX",
      city: row.city || "",
      views: 0,
      clicks: 0,
    };
    current[field] += Number(row.n) || 0;
    map.set(key, current);
  };
  for (const row of viewRows) add(row, "views");
  for (const row of clickRows) add(row, "clicks");
  return [...map.values()]
    .map((row) => ({ ...row, city: row.city || null, conversion: conversion(row.views, row.clicks) }))
    .sort((a, b) => b.views - a.views || b.clicks - a.clicks);
}

function fillDays(viewRows, clickRows, range) {
  const span = range === "7" ? 7 : range === "30" ? 30 : 14;
  const views = new Map(viewRows.map((row) => [row.day, Number(row.n) || 0]));
  const clicks = new Map(clickRows.map((row) => [row.day, Number(row.n) || 0]));
  const days = [];
  for (let offset = span - 1; offset >= 0; offset -= 1) {
    const day = utcDay(offset);
    days.push({
      day,
      views: views.get(day) || 0,
      clicks: clicks.get(day) || 0,
    });
  }
  return days;
}

function utcDay(offset) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

export function databaseError(error) {
  const message = String(error?.message || error);
  console.error(message);
  if (message.includes("no such table")) {
    return {
      status: 503,
      body: {
        error: "schema_missing",
        message: "В D1 нет таблиц. Выполните schema.sql для этой базы.",
      },
    };
  }
  return {
    status: 500,
    body: { error: "database", message: "Не удалось прочитать аналитику." },
  };
}
