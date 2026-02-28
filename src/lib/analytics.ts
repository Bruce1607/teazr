export type AnalyticsEvent =
  | 'teaze_opened'
  | 'copy_clicked'
  | 'share_clicked'
  | 'quiz_started'
  | 'quiz_completed';

type SourceInfo = {
  source: 'tiktok' | 'instagram' | 'facebook' | 'direct' | 'unknown';
  ref_domain: string;
  in_app: boolean;
};

const EVENT_API_URL = '/api/event';
const ALLOWED_EVENTS: Record<AnalyticsEvent, true> = {
  teaze_opened: true,
  copy_clicked: true,
  share_clicked: true,
  quiz_started: true,
  quiz_completed: true
};

let _sourceCache: SourceInfo | null = null;

export function detectSource(): SourceInfo {
  if (_sourceCache) return _sourceCache;

  let source: SourceInfo['source'] = 'unknown';
  let ref_domain = '';
  let in_app = false;

  try {
    const params = new URLSearchParams(window.location.search);
    const paramVal = (params.get('utm_source') || params.get('src') || '').toLowerCase();
    if (paramVal === 'tiktok' || paramVal === 'tt') source = 'tiktok';
    else if (paramVal === 'instagram' || paramVal === 'ig') source = 'instagram';
    else if (paramVal === 'facebook' || paramVal === 'fb') source = 'facebook';
  } catch (_) {}

  try {
    if (document.referrer) {
      ref_domain = new URL(document.referrer).hostname || '';
      if (source === 'unknown') {
        if (ref_domain.includes('tiktok.com')) source = 'tiktok';
        else if (ref_domain.includes('instagram.com')) source = 'instagram';
        else if (ref_domain.includes('facebook.com')) source = 'facebook';
      }
    }
  } catch (_) {}

  try {
    const ua = navigator.userAgent || '';
    if (/TikTok/i.test(ua)) { in_app = true; if (source === 'unknown') source = 'tiktok'; }
    else if (/Instagram/i.test(ua)) { in_app = true; if (source === 'unknown') source = 'instagram'; }
    else if (/FBAN|FBAV/i.test(ua)) { in_app = true; if (source === 'unknown') source = 'facebook'; }
  } catch (_) {}

  if (source === 'unknown' && !ref_domain && !in_app) source = 'direct';

  _sourceCache = { source, ref_domain, in_app };
  return _sourceCache;
}

export function track(event: AnalyticsEvent, props: Record<string, unknown> = {}): void {
  if (!ALLOWED_EVENTS[event]) return;
  if (typeof window === 'undefined') return;

  try {
    const src = detectSource();
    const payload = {
      event,
      ts: Date.now(),
      path: window.location?.pathname || '/',
      source: src.source,
      ref_domain: src.ref_domain,
      in_app: src.in_app,
      ...(Object.keys(props).length > 0 ? { props } : {})
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
  } catch (_) {}
}
