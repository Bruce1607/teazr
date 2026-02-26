const ALLOWED_EVENTS = new Set([
  'home_opened',
  'send_teaz_clicked',
  'quiz_start_clicked',
  'teaz_opened',
  'copy_clicked',
  'more_options_clicked',
  'quiz_started',
  'quiz_completed'
]);

const MAX_BODY_BYTES = 16 * 1024;
const MAX_EVENT_CHARS = 64;
const MAX_PATH_CHARS = 256;
const MAX_ID_CHARS = 128;
const MAX_PROPS_JSON_CHARS = 4 * 1024;
const MAX_TAB_CHARS = 64;
const MAX_BUCKET_KEY_CHARS = 256;

function capString(value, maxChars) {
  if (typeof value !== 'string') return '';
  return value.slice(0, maxChars);
}

function normalizeProps(rawProps) {
  if (!rawProps || typeof rawProps !== 'object' || Array.isArray(rawProps)) return {};
  try {
    const serialized = JSON.stringify(rawProps);
    if (!serialized || serialized.length > MAX_PROPS_JSON_CHARS) return {};
  } catch (_) {
    return {};
  }
  return rawProps;
}

export async function onRequestPost(context) {
  let rawBody = '';
  try {
    rawBody = await context.request.text();
  } catch (_) {
    return new Response(null, { status: 204 });
  }

  if (!rawBody || rawBody.length > MAX_BODY_BYTES) {
    return new Response(null, { status: 204 });
  }

  let payload = null;
  try {
    payload = JSON.parse(rawBody);
  } catch (_) {
    return new Response(null, { status: 204 });
  }

  const eventName = capString(payload && payload.event, MAX_EVENT_CHARS);

  if (!ALLOWED_EVENTS.has(eventName)) {
    return new Response(null, { status: 204 });
  }

  const safeProps = normalizeProps(payload && payload.props);
  const eventPayload = {
    event: eventName,
    ts: typeof payload.ts === 'number' ? payload.ts : Date.now(),
    path: capString(typeof payload.path === 'string' ? payload.path : '/', MAX_PATH_CHARS),
    session_id: capString(payload && payload.session_id, MAX_ID_CHARS),
    anon_id: capString(payload && payload.anon_id, MAX_ID_CHARS),
    props: safeProps
  };

  console.log(JSON.stringify(eventPayload));

  try {
    const aeBinding = context && context.env ? context.env.AE : null;
    if (!aeBinding || typeof aeBinding.writeDataPoint !== 'function') {
      console.error('[analytics] AE binding missing');
    } else {
      const tab = capString(safeProps && safeProps.tab, MAX_TAB_CHARS);
      const bucketKey = capString(safeProps && safeProps.bucketKey, MAX_BUCKET_KEY_CHARS);
      await Promise.resolve(aeBinding.writeDataPoint({
        blobs: [eventName, eventPayload.path || '', tab || '', bucketKey || ''],
        doubles: [1],
        indexes: [eventPayload.anon_id || '', eventPayload.session_id || '']
      }));
      console.log('[analytics] AE write invoked', eventName);
    }
  } catch (err) {
    console.error('[analytics] AE write failed', err);
  }

  return new Response(null, { status: 204 });
}
