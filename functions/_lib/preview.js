import { escapeHtml } from "./html.js";
import { geoKeys } from "./content.js";

export function buildPreviewBar({ pageUrl, config, country, region, variant }) {
  const url = new URL(pageUrl);
  const keys = geoKeys(config);
  const activeGeo = region && keys.includes(`${country}-${region}`)
    ? `${country}-${region}`
    : country;

  const links = [
    linkTo(url, "Default", {}),
    ...keys.map((key) => {
      const [geoCountry, geoRegion] = key.split("-");
      return linkTo(url, key, { country: geoCountry, region: geoRegion, variant }, key === activeGeo);
    }),
  ];

  const variants = ["A", "B"].map((item) => linkTo(
    url,
    item,
    { country: country === "XX" ? "" : country, region, variant: item },
    item === variant,
  ));

  return `<style>
    .geo-preview{position:sticky;top:0;z-index:20;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;padding:8px 16px;background:#14120e;color:#f4efe4;font:12px/1.4 ui-sans-serif,system-ui,sans-serif}
    .geo-preview a{color:#d6ff4a;text-underline-offset:2px}
    .geo-preview strong{font-weight:650}
    .geo-preview .sep{opacity:.45}
  </style>
  <div class="geo-preview">
    <span>Preview · ${escapeHtml(activeGeo)} · variant ${escapeHtml(variant)}</span>
    <span class="sep">|</span>
    ${links.join(" ")}
    <span class="sep">|</span>
    ${variants.join(" ")}
  </div>`;
}

function linkTo(url, label, params, active = false) {
  const next = new URL(url);
  next.search = "";
  next.hash = "";
  for (const [key, value] of Object.entries(params)) {
    if (value) next.searchParams.set(key, value);
  }
  const href = `${next.pathname}${next.search}`;
  const inner = active ? `<strong>${escapeHtml(label)}</strong>` : escapeHtml(label);
  return `<a href="${escapeHtml(href)}">${inner}</a>`;
}
