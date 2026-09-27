const LIMITS = {
  lang: 12,
  eyebrow: 80,
  headline: 180,
  subheadline: 500,
  cta: 80,
  done: 180,
  proof: 180,
};

export function resolveContent(config, variant, country, region) {
  const variants = config?.variants || {};
  const chosen = variants[variant] || variants.A || variants.B;
  if (!chosen?.default) {
    throw new Error("Landing config has no variants");
  }

  const geo = chosen.geo || {};
  const countryLayer = country && country !== "XX" ? geo[country] || {} : {};
  const regionKey = country && region ? `${country}-${region}` : "";
  const regionLayer = regionKey ? geo[regionKey] || {} : {};
  const merged = { ...chosen.default, ...countryLayer, ...regionLayer };

  for (const [key, limit] of Object.entries(LIMITS)) {
    if (merged[key] != null) merged[key] = String(merged[key]).slice(0, limit);
  }
  return merged;
}

export function safeHero(hero, landingId) {
  const value = String(hero || "");
  const pattern = new RegExp(
    `^/landings/${landingId}/images/[a-z0-9._-]+\\.(?:svg|png|jpe?g|webp|gif|avif)$`,
    "i",
  );
  return pattern.test(value) ? value : "";
}

export function geoKeys(config) {
  const keys = new Set();
  for (const bucket of Object.values(config?.variants || {})) {
    for (const key of Object.keys(bucket?.geo || {})) {
      if (/^[A-Z]{2}(?:-[A-Z0-9]{1,3})?$/.test(key)) keys.add(key);
    }
  }
  return [...keys];
}
