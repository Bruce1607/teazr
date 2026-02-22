/**
 * Analytics event collector - returns 204, no personal data stored.
 * POST /api/event
 * Body: { event, ts, path, props, v }
 * No IP, no full user agent, no message content stored server-side.
 */
export async function onRequestPost(context) {
  try {
    if (context.request.headers.get('content-type')?.includes('application/json')) {
      const body = await context.request.json();
      console.log(JSON.stringify(body));
    }
  } catch (_) {
    // ignore parse errors
  }
  return new Response(null, { status: 204 });
}
