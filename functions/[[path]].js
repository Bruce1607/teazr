/**
 * SPA catch-all: serves HTML with 200 for non-asset routes. NO redirects.
 * - /, /index.html -> index.html
 * - /teaze, /teaze/ -> teaze.html
 * - Other SPA routes -> index.html
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
  const pathname = url.pathname.replace(/\/$/, '') || '/';

  if (isAssetPath(pathname)) {
    return context.env.ASSETS.fetch(context.request);
  }

  let htmlPath = '/index.html';
  if (pathname === '/teaze') {
    htmlPath = '/teaze.html';
  }

  const htmlUrl = new URL(htmlPath, url.origin);
  const htmlReq = new Request(htmlUrl, context.request);
  return context.env.ASSETS.fetch(htmlReq);
}
