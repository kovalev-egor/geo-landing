import { recordEvent } from "../_lib/db.js";
import { normalizeCountry, normalizeRegion, previewEnabled, resolveGeo, sanitizeCity } from "../_lib/geo.js";
import { ID_RE, json, loadRegistry } from "../_lib/http.js";

export async function onRequestPost(context) {
  let payload;
  try {
    const raw = await context.request.text();
    if (raw.length > 2048) return json({ error: "payload too large" }, 413);
    payload = JSON.parse(raw || "{}");
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const landingId = String(payload.landing_id || "");
  const variant = payload.variant === "A" || payload.variant === "B" ? payload.variant : "";
  if (!ID_RE.test(landingId) || !variant) return json({ error: "invalid payload" }, 400);

  let registry;
  try {
    registry = await loadRegistry(context);
  } catch (error) {
    console.error(error);
    return json({ error: "registry" }, 500);
  }
  const entry = registry.find((item) => item.id === landingId);
  if (!entry) return json({ error: "unknown landing" }, 404);
  if (!context.env.DB) return json({ error: "database unavailable" }, 503);

  const preview = previewEnabled(context.env);
  const geo = resolveGeo(context.request, preview);
  const country = preview ? (normalizeCountry(payload.country) || geo.country) : geo.country;
  const region = preview ? normalizeRegion(payload.region) : geo.region;
  const city = preview ? sanitizeCity(typeof payload.city === "string" ? payload.city : "") : geo.city;

  try {
    await recordEvent(context.env.DB, "clicks", {
      landingId,
      name: entry.name,
      variant,
      country,
      region,
      city,
    });
  } catch (error) {
    console.error("click failed", error);
    const message = String(error?.message || error);
    if (message.includes("no such table")) {
      return json({ error: "schema_missing" }, 503);
    }
    return json({ error: "database" }, 500);
  }

  return new Response(null, { status: 204 });
}
