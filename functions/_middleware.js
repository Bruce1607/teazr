const CANONICAL_HOST = 'teazr.app';

function withCanonicalHost(url) {
  const target = new URL(url.toString());
  target.protocol = 'https:';
  target.hostname = CANONICAL_HOST;
  target.port = '';
  return target;
}

export function onRequest(context) {
  const url = new URL(context.request.url);
  const host = url.hostname.toLowerCase();

  // Canonicalize non-primary hosts first (permanent).
  if (host === 'www.teazr.app' || host.endsWith('.pages.dev')) {
    return Response.redirect(withCanonicalHost(url).toString(), 301);
  }

  // Temporary redirect for old entry route while preserving query params.
  if (host === CANONICAL_HOST && (url.pathname === '/teaze' || url.pathname === '/teaze/')) {
    const target = withCanonicalHost(url);
    target.pathname = '/';
    return Response.redirect(target.toString(), 302);
  }

  return context.next();
}
