import { prepareHome } from "../_lib/routing.js";
import { serveLanding } from "../_lib/serve.js";

export async function onRequest(context) {
  const landingId = context.params.id;
  if (landingId !== "alice") {
    const url = new URL(context.request.url);
    url.pathname = "/l/alice";
    return Response.redirect(url.toString(), 302);
  }
  const selection = await prepareHome(context);
  return serveLanding(context, selection.landingId, selection);
}
