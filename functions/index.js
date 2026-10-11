export async function onRequest(context) {
  const url = new URL(context.request.url);
  url.pathname = "/l/alice";
  return Response.redirect(url.toString(), 302);
}
