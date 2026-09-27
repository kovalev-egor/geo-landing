import { prepareHome } from "./_lib/routing.js";
import { serveLanding } from "./_lib/serve.js";

export async function onRequest(context) {
  const selection = await prepareHome(context);
  return serveLanding(context, selection.landingId, selection);
}
