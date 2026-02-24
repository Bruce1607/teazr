/**
 * SPA catch-all: serves index.html for all non-asset routes (e.g. /teaze, /).
 * Static assets are excluded via _routes.json and never reach this function.
 */
export async function onRequest(context) {
  const url = new URL('/index.html', context.request.url);
  return context.env.ASSETS.fetch(new Request(url, context.request));
}
