import { readCookie, serializeCookie } from "./cookies.js";

export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.byteLength !== right.byteLength || left.byteLength === 0) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

export async function isAuthorized(request, env) {
  const expected = env?.ADMIN_KEY || "";
  if (!expected) return { ok: false, freshKey: null, missing: true };

  const url = new URL(request.url);
  const queryKey = url.searchParams.get("key") || "";
  if (queryKey && queryKey.length <= 200 && safeEqual(queryKey, expected)) {
    return { ok: true, freshKey: queryKey, missing: false };
  }

  const cookieKey = readCookie(request, "gl_admin");
  if (cookieKey && safeEqual(cookieKey, expected)) {
    return { ok: true, freshKey: null, missing: false };
  }

  return { ok: false, freshKey: null, missing: false };
}

export function adminCookie(value, url) {
  return serializeCookie("gl_admin", value, {
    maxAge: 60 * 60 * 24 * 7,
    secure: url.protocol === "https:",
    httpOnly: true,
  });
}

export function clearAdminCookie(url) {
  return serializeCookie("gl_admin", "", {
    maxAge: 0,
    secure: url.protocol === "https:",
    httpOnly: true,
  });
}

export function loginPage(reason) {
  const message = reason === "missing"
    ? "Задайте ADMIN_KEY в .dev.vars или секретом Pages."
    : reason === "invalid"
      ? "Неверный ключ."
      : "Введите ключ доступа. Его можно также передать как ?key= один раз: cookie сохранится на 7 дней.";

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Вход — лендинги</title>
  <link rel="icon" href="/favicon.svg">
  <style>
    :root { color-scheme: light; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #ece7dc; color: #1c1915; font-family: "Segoe UI", system-ui, sans-serif; }
    main { width: min(420px, calc(100% - 32px)); background: #f7f4ee; border: 1px solid #d9d2c5; padding: 28px 24px 24px; }
    p.brand { margin: 0; font-family: Georgia, "Iowan Old Style", serif; font-style: italic; font-size: 28px; }
    p.note { color: #5e584e; line-height: 1.45; }
    label { display: block; font-size: 13px; margin-bottom: 14px; }
    input { width: 100%; box-sizing: border-box; margin-top: 6px; padding: 10px 12px; border: 1px solid #cfc6b6; background: #fff; font: inherit; }
    button { border: 0; background: #1f6b4a; color: #f7f4ee; padding: 10px 16px; font: inherit; cursor: pointer; }
    button:focus-visible, input:focus-visible { outline: 2px solid #1c1915; outline-offset: 2px; }
  </style>
</head>
<body>
  <main>
    <p class="brand">Лендинги</p>
    <p class="note">${message}</p>
    <form method="post" action="/admin/">
      <label>Ключ доступа
        <input type="password" name="key" autocomplete="current-password" required autofocus>
      </label>
      <button type="submit">Войти</button>
    </form>
  </main>
</body>
</html>`;
}
