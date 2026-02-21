/**
 * Analytics event collector - returns 204, no external dependencies.
 * POST /api/event
 * Body: { event, moment?, style?, messageId?, ts? }
 */
export async function onRequestPost(context) {
  try {
    if (context.request.headers.get('content-type')?.includes('application/json')) {
      await context.request.json();
    }
  } catch (_) {
    // ignore parse errors
  }
  return new Response(null, { status: 204 });
}
