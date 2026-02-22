export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  const host = url.hostname;

  // Redirect teazr.pages.dev and *.teazr.pages.dev to teazr.app
  // Preserve path + query. Do NOT redirect teazr.app or www.teazr.app (avoid loop).
  const isPreviewHost = host === "teazr.pages.dev" || host.endsWith(".teazr.pages.dev");
  const isProductionHost = host === "teazr.app" || host === "www.teazr.app";

  if (isPreviewHost && !isProductionHost) {
    const dest = `https://teazr.app${url.pathname}${url.search}`;
    return Response.redirect(dest, 301);
  }

  return next();
}
