const ALLOWED_EVENTS = new Set([
  'teaze_opened',
  'copy_clicked',
  'share_clicked',
  'quiz_started',
  'quiz_completed'
]);

const MAX_BODY_BYTES = 2048;
const MAX_STR = 256;
const RATE_WINDOW_MS = 60000;
const RATE_MAX = 60;
const CLEANUP_INTERVAL_MS = 300000;

const rateMap = new Map();
let lastCleanup = Date.now();

function getClientIp(request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for') ||
    'unknown'
  );
}

function isRateLimited(ip) {
  const now = Date.now();
  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    lastCleanup = now;
    for (const [key, entry] of rateMap) {
      if (now - entry.start > RATE_WINDOW_MS) rateMap.delete(key);
    }
  }
  const entry = rateMap.get(ip);
  if (!entry || now - entry.start > RATE_WINDOW_MS) {
    rateMap.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > RATE_MAX;
}

function cap(value, max) {
  if (typeof value !== 'string') return '';
  return value.slice(0, max);
}

const ALLOWED_PROP_KEYS = ['context', 'category', 'moment', 'style', 'quiz_version'];

function sanitizeProps(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out = {};
  for (const k of ALLOWED_PROP_KEYS) {
    if (raw[k] == null) continue;
    const v = raw[k];
    if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string') out[k] = v.slice(0, 64);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function onRequest(context) {
  if (context.request.method !== 'POST') {
    return new Response(null, { status: 405 });
  }

  const ip = getClientIp(context.request);
  if (isRateLimited(ip)) {
    return new Response(null, { status: 429 });
  }

  let rawBody = '';
  try {
    rawBody = await context.request.text();
  } catch (_) {
    return new Response(null, { status: 400 });
  }

  if (!rawBody) {
    return new Response(null, { status: 400 });
  }
  if (rawBody.length > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (_) {
    return new Response(null, { status: 400 });
  }

  if (!payload || typeof payload.event !== 'string' || !ALLOWED_EVENTS.has(payload.event)) {
    return new Response(null, { status: 400 });
  }

  const event = {
    event: payload.event,
    ts: typeof payload.ts === 'number' ? payload.ts : Date.now(),
    path: cap(payload.path, MAX_STR),
    source: cap(payload.source, 32),
    ref_domain: cap(payload.ref_domain, MAX_STR),
    in_app: payload.in_app === true
  };
  const props = sanitizeProps(payload.props);
  if (props) event.props = props;

  console.log(JSON.stringify(event));

  try {
    const ae = context.env && context.env.AE;
    if (ae && typeof ae.writeDataPoint === 'function') {
      await Promise.resolve(ae.writeDataPoint({
        blobs: [
          event.event,
          event.path || '',
          event.source || '',
          event.ref_domain || '',
          props ? JSON.stringify(props) : ''
        ],
        doubles: [1, event.in_app ? 1 : 0],
        indexes: [event.source || '']
      }));
    }
  } catch (err) {
    console.error('[analytics] AE write failed', err);
  }

  return new Response(null, { status: 204 });
}
