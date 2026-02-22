export async function onRequest({ request, next }) {
  const url = new URL(request.url);

  if (url.hostname === "teazr.pages.dev") {
    url.hostname = "teazr.app";
    return Response.redirect(url.toString(), 301);
  }

  return next();
}
