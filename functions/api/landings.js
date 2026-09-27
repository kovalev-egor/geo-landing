import { geoKeys } from "../_lib/content.js";
import { buildSummary, collectStats, databaseError } from "../_lib/db.js";
import { json, loadConfig, loadRegistry, readRange } from "../_lib/http.js";
import { previewEnabled } from "../_lib/geo.js";

export async function onRequestGet(context) {
  if (!context.env.DB) return json({ error: "database", message: "База D1 не подключена." }, 503);

  try {
    const url = new URL(context.request.url);
    const range = readRange(url);
    const [registry, stats] = await Promise.all([
      loadRegistry(context),
      collectStats(context.env.DB, range),
    ]);
    const landings = [];
    for (const entry of registry) {
      const config = await loadConfig(context, entry.id);
      landings.push({
        ...buildSummary(entry, stats, 3),
        geos: config ? geoKeys(config) : [],
      });
    }
    return json({
      range,
      preview: previewEnabled(context.env),
      landings,
    });
  } catch (error) {
    if (String(error?.message || error).includes("registry")) {
      return json({ error: "registry", message: "Не удалось прочитать список лендингов." }, 500);
    }
    const failure = databaseError(error);
    return json(failure.body, failure.status);
  }
}
