import { resolveContent, safeHero } from "./content.js";
import { resolveVariant } from "./cookies.js";
import { recordCombo, recordEvent } from "./db.js";
import { resolveGeo, previewEnabled } from "./geo.js";
import { escapeHtml } from "./html.js";
import { applyTemplate } from "./html.js";
import { ID_RE, loadConfig, loadRegistry, readAsset, text } from "./http.js";
import { buildPreviewBar } from "./preview.js";

export async function serveLanding(context, landingId, selection = null) {
  const { request, env } = context;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return text("Method not allowed", 405);
  }
  if (!ID_RE.test(landingId || "")) return renderNotFound();

  let registry;
  try {
    registry = await loadRegistry(context);
  } catch (error) {
    console.error(error);
    return text("Landing registry is unavailable.", 500);
  }

  const entry = registry.find((item) => item.id === landingId);
  if (!entry) return renderNotFound(registry);

  const config = await loadConfig(context, landingId);
  const templateResponse = await readTemplate(context, landingId);
  if (!config || !templateResponse) return renderNotFound(registry);

  let content;
  try {
    const preview = previewEnabled(env);
    const geo = resolveGeo(request, preview);
    const variantState = resolveVariant(request, landingId, preview);
    content = resolveContent(config, variantState.variant, geo.country, geo.region);
    const hero = safeHero(content.hero, landingId) || `/landings/${landingId}/images/hero-a.svg`;
    const offer = selection?.offer || null;
    const html = applyTemplate(await templateResponse, {
      lang: content.lang || "en",
      eyebrow: content.eyebrow || "",
      headline: content.headline || entry.name,
      subheadline: content.subheadline || "",
      cta: offer?.buttonText || content.cta || "Continue",
      done: content.done || "Saved",
      proof: content.proof || "",
      hero,
      landing_id: landingId,
      variant: variantState.variant,
      country: geo.country,
      region: geo.region,
      city: geo.city,
      offer_id: offer?.id || "",
      offer_url: offer?.url || "",
      preview: preview
        ? buildPreviewBar({
          pageUrl: request.url,
          config,
          country: geo.country,
          region: geo.region,
          variant: variantState.variant,
        })
        : "",
    });

    const headers = new Headers({
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
      "referrer-policy": "strict-origin-when-cross-origin",
      "x-content-type-options": "nosniff",
    });
    if (variantState.cookie) headers.append("set-cookie", variantState.cookie);
    for (const cookie of selection?.cookies || []) headers.append("set-cookie", cookie);

    if (request.method === "GET" && env.DB) {
      const write = recordVisit(env.DB, {
        landingId,
        name: typeof config.name === "string" ? config.name.slice(0, 120) : entry.name,
        variant: variantState.variant,
        country: selection?.country || geo.country,
        region: geo.region,
        city: geo.city,
        offerId: offer?.id || "",
        countImpression: Boolean(selection?.countImpression && offer?.id),
      }).catch((error) => console.error("pageview failed", error));
      if (typeof context.waitUntil === "function") context.waitUntil(write);
      else await write;
      headers.set("x-analytics", "queued");
    } else if (request.method === "GET") {
      headers.set("x-analytics", "no-database");
    }

    return new Response(request.method === "HEAD" ? null : html, { status: 200, headers });
  } catch (error) {
    console.error(error);
    return text("Landing could not be rendered.", 500);
  }
}

async function recordVisit(db, event) {
  await recordEvent(db, "pageviews", event);
  if (!event.countImpression || !event.offerId) return;
  try {
    await recordCombo(db, "impressions", event);
  } catch (error) {
    console.error("combo impression failed", error);
  }
}

async function readTemplate(context, landingId) {
  const response = await readAsset(context, `/landings/${landingId}/index.html`);
  if (!response.ok || response.status >= 300) return null;
  return response.text();
}

function renderNotFound(registry = []) {
  const links = registry.map((item) => `<li><a href="/l/${item.id}">${escapeHtml(item.name)}</a></li>`).join("");
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Landing not found</title>
  <link rel="icon" href="/favicon.svg">
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #14211b; color: #efe7d6; font-family: Georgia, serif; }
    main { width: min(520px, calc(100% - 40px)); }
    a { color: #d6ff4a; }
  </style>
</head>
<body>
  <main>
    <h1>This landing is not in the project.</h1>
    <ul>${links}</ul>
  </main>
</body>
</html>`;
  return new Response(html, {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
