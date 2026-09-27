export function previewEnabled(env) {
  return env?.GEO_PREVIEW === "1" || env?.GEO_PREVIEW === "true";
}

export function normalizeCountry(value) {
  const country = String(value || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(country) ? country : "";
}

export function normalizeRegion(value) {
  const region = String(value || "").trim().toUpperCase();
  return /^[A-Z0-9]{1,3}$/.test(region) ? region : "";
}

export function sanitizeCity(value) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 80);
}

export function resolveGeo(request, preview) {
  const cf = request.cf || {};
  let country = normalizeCountry(cf.country);
  if (country === "XX") country = "";
  let region = normalizeRegion(cf.regionCode);
  let city = sanitizeCity(typeof cf.city === "string" ? cf.city : "");

  if (preview) {
    const url = new URL(request.url);
    const queryCountry = normalizeCountry(url.searchParams.get("country"));
    if (queryCountry) {
      country = queryCountry;
      region = normalizeRegion(url.searchParams.get("region"));
      const queryCity = sanitizeCity(url.searchParams.get("city") || "");
      city = queryCity;
    }
  }

  return {
    country: country || "XX",
    region,
    city,
  };
}
