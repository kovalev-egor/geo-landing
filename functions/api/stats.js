import { geoKeys } from "../_lib/content.js";
import { buildSummary, collectDetail, collectStats, databaseError } from "../_lib/db.js";
import { previewEnabled } from "../_lib/geo.js";
import { ID_RE, json, loadConfig, loadRegistry, readRange } from "../_lib/http.js";

export async function onRequestGet(context) {
  if (!context.env.DB) return json({ error: "database", message: "База D1 не подключена." }, 503);

  const url = new URL(context.request.url);
  const landingId = url.searchParams.get("id") || "";
  if (!ID_RE.test(landingId)) return json({ error: "invalid id" }, 400);

  try {
    const registry = await loadRegistry(context);
    const entry = registry.find((item) => item.id === landingId);
    if (!entry) return json({ error: "not_found", message: "Лендинг не найден." }, 404);

    const range = readRange(url);
    const [stats, detail, config] = await Promise.all([
      collectStats(context.env.DB, range),
      collectDetail(context.env.DB, landingId, range),
      loadConfig(context, landingId),
    ]);

    return json({
      range,
      preview: previewEnabled(context.env),
      landing: {
        ...buildSummary(entry, stats, 10),
        geos: config ? geoKeys(config) : [],
        cities: detail.cities,
        days: detail.days,
      },
    });
  } catch (error) {
    if (String(error?.message || error).includes("registry")) {
      return json({ error: "registry", message: "Не удалось прочитать список лендингов." }, 500);
    }
    const failure = databaseError(error);
    return json(failure.body, failure.status);
  }
}
