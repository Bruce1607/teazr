export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  const host = url.hostname;
  const pathname = url.pathname;

  // Canonical: /teaze (no trailing slash). /teaze/ -> /teaze 301 only; NEVER redirect /teaze -> anywhere
  // Query string (v, cb, utm, fbclid) preserved
  if (pathname === '/teaze/') {
    const dest = new URL(request.url);
    dest.pathname = '/teaze';
    return Response.redirect(dest.toString(), 301);
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

  // /teaze HTML: disable caching so IG in-app and Chrome always get latest (no stale version)
  if (pathname === '/teaze' || pathname.startsWith('/teaze/')) {
    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers)
    });
    newResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    newResponse.headers.set('Pragma', 'no-cache');
    newResponse.headers.set('Expires', '0');
    return newResponse;
  }

  return response;
}
