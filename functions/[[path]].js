/**
 * SPA catch-all: serves index.html with 200 for non-asset routes (/, /teaze, etc).
 * Passes through static assets to ASSETS. NO redirects, NO rewrites.
 */
const ASSET_EXTENSIONS = new Set([
  '.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.webp',
  '.map', '.json', '.txt', '.woff2', '.woff', '.ttf'
]);

function isAssetPath(pathname) {
  if (pathname.startsWith('/assets/')) return true;
  const lastSlash = pathname.lastIndexOf('/');
  const lastPart = lastSlash >= 0 ? pathname.slice(lastSlash) : pathname;
  const extIdx = lastPart.lastIndexOf('.');
  if (extIdx <= 0) return false;
  const ext = lastPart.slice(extIdx).toLowerCase();
  return ASSET_EXTENSIONS.has(ext);
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const pathname = url.pathname;

  if (isAssetPath(pathname)) {
    return context.env.ASSETS.fetch(context.request);
  }

  // SPA shell: serve index.html with 200
  const indexUrl = new URL('/index.html', url.origin);
  const indexReq = new Request(indexUrl, context.request);
  return context.env.ASSETS.fetch(indexReq);
}
