export const ID_RE = /^[a-z0-9-]{1,64}$/;

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function text(body, status = 200, extra = {}) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      ...extra,
    },
  });
}

export function readRange(url) {
  const value = url.searchParams.get("range");
  return value === "7" || value === "30" ? value : "all";
}

export async function readAsset(context, pathname) {
  if (!context.env?.ASSETS?.fetch) {
    throw new Error("ASSETS binding is missing");
  }
  const url = new URL(context.request.url);
  url.pathname = pathname;
  url.search = "";
  url.hash = "";
  return context.env.ASSETS.fetch(new Request(url.toString(), {
    method: "GET",
    headers: { "x-geo-asset": "1", accept: "*/*" },
  }));
}

export async function loadRegistry(context) {
  const response = await readAsset(context, "/landings/_registry.json");
  if (!response.ok) throw new Error("registry missing");
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error("registry invalid");
  return data.filter((item) => item && ID_RE.test(item.id) && typeof item.name === "string").map((item) => ({
    id: item.id,
    name: String(item.name).slice(0, 120),
    blurb: typeof item.blurb === "string" ? item.blurb.slice(0, 180) : "",
  }));
}

export async function loadConfig(context, landingId) {
  const response = await readAsset(context, `/landings/${landingId}/config.json`);
  if (!response.ok) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}
