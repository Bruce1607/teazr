export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  const host = url.hostname;

  // NOTE: /teaze and /teaze/* are EXCLUDED from Functions via _routes.json.
  // Trailing-slash normalization is handled ONLY by _redirects: /teaze/ -> /teaze 301.
  // Do NOT add redirect logic here to avoid conflict with _redirects or Dashboard rules.

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
