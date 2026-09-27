import { clearAdminCookie } from "../_lib/auth.js";

export function onRequestPost(context) {
  return new Response(null, {
    status: 204,
    headers: {
      "set-cookie": clearAdminCookie(new URL(context.request.url)),
      "cache-control": "no-store",
    },
  });
}
