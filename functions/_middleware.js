export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  const host = url.hostname;

  // Redirect *.pages.dev (including teazr.pages.dev) to teazr.app
  if (host.endsWith(".pages.dev")) {
    const dest = `https://teazr.app${url.pathname}${url.search}`;
    return Response.redirect(dest, 301);
  }

  return next();
}
