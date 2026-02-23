export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  const host = url.hostname;

  // /teaze and /teaze/*: NEVER redirect. Pass through to _redirects (which serves index.html 200).
  // This allows /teaze to work on pages.dev for testing. No redirect loops.
  const path = url.pathname;
  if (path === "/teaze" || path.startsWith("/teaze/")) {
    return next();
  }

  // Redirect teazr.pages.dev and *.teazr.pages.dev to teazr.app
  // Preserve path + query. Do NOT redirect teazr.app or www.teazr.app (avoid loop).
  const isPreviewHost = host === "teazr.pages.dev" || host.endsWith(".teazr.pages.dev");
  const isProductionHost = host === "teazr.app" || host === "www.teazr.app";

  if (isPreviewHost && !isProductionHost) {
    const destUrl = new URL(request.url);
    destUrl.protocol = 'https:';
    destUrl.hostname = 'teazr.app';
    destUrl.port = '';
    return Response.redirect(destUrl.toString(), 301);
  }

  const response = await next();
  return response;
}
