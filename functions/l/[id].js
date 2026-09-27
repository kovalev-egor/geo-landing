import { serveLanding } from "../_lib/serve.js";

export function onRequest(context) {
  return serveLanding(context, context.params.id);
}
