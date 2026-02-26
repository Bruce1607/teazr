const ALLOWED_EVENTS = new Set([
  'teaz_opened',
  'copy_clicked',
  'more_options_clicked',
  'quiz_started',
  'quiz_completed'
]);

export async function onRequestPost(context) {
  let payload = null;

  try {
    payload = await context.request.json();
  } catch (_) {
    return new Response(null, { status: 204 });
  }

  const eventName = payload && typeof payload.event === 'string'
    ? payload.event
    : '';

  if (!ALLOWED_EVENTS.has(eventName)) {
    return new Response(null, { status: 204 });
  }

  const eventPayload = {
    event: eventName,
    ts: typeof payload.ts === 'number' ? payload.ts : Date.now(),
    path: typeof payload.path === 'string' ? payload.path : '/',
    session_id: typeof payload.session_id === 'string' ? payload.session_id : null,
    anon_id: typeof payload.anon_id === 'string' ? payload.anon_id : null,
    props: payload && payload.props && typeof payload.props === 'object' ? payload.props : {}
  };

  console.log(JSON.stringify(eventPayload));
  return new Response(null, { status: 204 });
}
