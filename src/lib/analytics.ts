export type AnalyticsEvent =
  | 'teaz_opened'
  | 'copy_clicked'
  | 'more_options_clicked'
  | 'quiz_started'
  | 'quiz_completed';

type AnalyticsIdentity = {
  session_id: string;
  anon_id: string;
};

const EVENT_API_URL = '/api/event';
const ANALYTICS_ANON_ID_KEY = 'teazr_anon_id';
const ALLOWED_EVENTS: Record<AnalyticsEvent, true> = {
  teaz_opened: true,
  copy_clicked: true,
  more_options_clicked: true,
  quiz_started: true,
  quiz_completed: true
};

let sessionId = '';
let anonId = '';
let initialized = false;

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function init(): AnalyticsIdentity {
  if (initialized) {
    return { session_id: sessionId, anon_id: anonId };
  }

  sessionId = createId();
  anonId = '';

  if (typeof window !== 'undefined') {
    try {
      const existingAnonId = window.localStorage.getItem(ANALYTICS_ANON_ID_KEY);
      if (existingAnonId && existingAnonId.length > 0) {
        anonId = existingAnonId;
      } else {
        anonId = createId();
        window.localStorage.setItem(ANALYTICS_ANON_ID_KEY, anonId);
      }
    } catch (_) {
      anonId = createId();
    }
  } else {
    anonId = createId();
  }

  initialized = true;
  return { session_id: sessionId, anon_id: anonId };
}

export function track(event: AnalyticsEvent, props: Record<string, unknown> = {}): void {
  if (!ALLOWED_EVENTS[event]) return;
  if (typeof window === 'undefined') return;

  const ids = init();
  const payload = {
    event,
    ts: Date.now(),
    path: window.location?.pathname || '/',
    session_id: ids.session_id,
    anon_id: ids.anon_id,
    props
  };
  const body = JSON.stringify(payload);

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const sent = navigator.sendBeacon(EVENT_API_URL, new Blob([body], { type: 'application/json' }));
    if (sent) return;
  }

  void fetch(EVENT_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true
  }).catch(() => undefined);
}
