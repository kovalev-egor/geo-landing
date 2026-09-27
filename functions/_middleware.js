import { adminCookie, isAuthorized, loginPage, safeEqual } from "./_lib/auth.js";

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const { pathname } = url;

  if (request.headers.get("x-geo-asset") === "1" && pathname.startsWith("/landings/")) {
    return context.next();
  }

  if (pathname === "/landings/_registry.json" || /^\/landings\/[a-z0-9-]+\/config\.json$/.test(pathname)) {
    return new Response("Not found", { status: 404 });
  }

  const rawLanding = pathname.match(/^\/landings\/([a-z0-9-]+)(?:\/(?:index\.html)?)?$/);
  if (rawLanding) {
    const dest = new URL(`/l/${rawLanding[1]}`, url);
    dest.search = url.search;
    return Response.redirect(dest.toString(), 302);
  }

  const trailing = pathname.match(/^\/l\/([a-z0-9-]+)\/$/);
  if (trailing) {
    const dest = new URL(`/l/${trailing[1]}`, url);
    dest.search = url.search;
    return Response.redirect(dest.toString(), 302);
  }

  if (pathname === "/api/click" || pathname === "/api/logout") {
    return context.next();
  }

  const needsAuth = pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/api/landings" || pathname === "/api/stats";
  if (!needsAuth) return context.next();

  if (!context.env?.ADMIN_KEY) {
    if (pathname.startsWith("/api/")) {
      return Response.json({ error: "unauthorized", message: "ADMIN_KEY не задан." }, { status: 401 });
    }
    return html(loginPage("missing"), 200);
  }

  if (request.method === "POST" && (pathname === "/admin" || pathname === "/admin/")) {
    return handleLogin(context);
  }

  const auth = await isAuthorized(request, context.env);
  if (!auth.ok) {
    if (pathname.startsWith("/api/")) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    return html(loginPage(null), 200);
  }

  if (auth.freshKey && request.method === "GET" && !pathname.startsWith("/api/")) {
    return new Response(null, {
      status: 302,
      headers: {
        location: "/admin/",
        "set-cookie": adminCookie(auth.freshKey, url),
        "cache-control": "no-store",
      },
    });
  }

  const response = await context.next();
  if (!auth.freshKey) return response;
  const headers = new Headers(response.headers);
  headers.append("set-cookie", adminCookie(auth.freshKey, url));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function handleLogin(context) {
  const url = new URL(context.request.url);
  let key = "";
  try {
    const form = await context.request.formData();
    key = String(form.get("key") || "");
  } catch {
    key = "";
  }
  if (key.length > 200 || !safeEqual(key, context.env.ADMIN_KEY || "")) {
    return html(loginPage("invalid"), 200);
  }
  return new Response(null, {
    status: 302,
    headers: {
      location: "/admin/",
      "set-cookie": adminCookie(key, url),
      "cache-control": "no-store",
    },
  });
}

function html(body, status) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
