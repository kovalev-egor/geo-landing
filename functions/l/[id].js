import { prepareFixed } from "../_lib/routing.js";
import { serveLanding } from "../_lib/serve.js";

export async function onRequest(context) {
  const landingId = context.params.id;
  const selection = await prepareFixed(context, landingId);
  return serveLanding(context, landingId, selection);
}
