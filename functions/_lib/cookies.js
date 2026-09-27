export function readCookie(request, name) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey !== name) continue;
    const raw = rest.join("=");
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return "";
}

export function serializeCookie(name, value, { maxAge, secure = false, httpOnly = true } = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "SameSite=Lax",
  ];
  if (httpOnly) parts.push("HttpOnly");
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function resolveVariant(request, landingId, preview) {
  const cookieName = `glab_${landingId}`;
  const url = new URL(request.url);

  if (preview) {
    const forced = url.searchParams.get("variant");
    if (forced === "A" || forced === "B") {
      return { variant: forced, cookie: null };
    }
  }

  const existing = readCookie(request, cookieName);
  if (existing === "A" || existing === "B") {
    return { variant: existing, cookie: null };
  }

  const variant = crypto.getRandomValues(new Uint8Array(1))[0] < 128 ? "A" : "B";
  return {
    variant,
    cookie: serializeCookie(cookieName, variant, {
      maxAge: 60 * 60 * 24 * 30,
      secure: url.protocol === "https:",
      httpOnly: true,
    }),
  };
}
