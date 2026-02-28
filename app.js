(function() {
  'use strict';
  var TEAZR_BUILD = 'fcb008a-emergency';
  if (typeof console !== 'undefined' && console.log) { console.log('TEAZR BUILD:', TEAZR_BUILD); }
  // Defensive: unregister any stuck service worker (none in our code, but clears rogue/cached SW)
  if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
    navigator.serviceWorker.getRegistrations().then(function(regs) {
      regs.forEach(function(r) { r.unregister(); });
    });
  }

  const COOLDOWN_KEY = 'teazr_cooldown';
  const COOLDOWN_MS = 5 * 60 * 1000;
  const SHARE_BASE = 'https://teazr.app';

  const TEAZE_MOMENTS = ['START', 'KEEP_GOING', 'RECONNECT', 'CLOSE_KINDLY', 'BOUNDARY'];
  const TEAZE_MOMENTS_FLIRTY = ['START', 'KEEP_GOING', 'RECONNECT', 'CLOSE_KINDLY'];
  const TEAZE_MOMENTS_DISPLAY = { START: 'START', KEEP_GOING: 'KEEP GOING', RECONNECT: 'RECONNECT', CLOSE_KINDLY: 'CLOSE KINDLY', BOUNDARY: 'BOUNDARY' };
  const TEAZE_STYLES = ['PLAYFUL', 'CLASSY'];
  const TEAZE_SITUATIONS_BOUNDARY = [
    { id: 'unwanted_pic', label: 'Unwanted pic' },
    { id: 'too_pushy', label: 'Too pushy / won\'t stop' }
  ];
  const TEAZE_SITUATIONS_GENERAL = [
    { id: 'ANY', label: 'Any' },
    { id: 'after_story', label: 'After their story' },
    { id: 'late_reply', label: 'Late reply' },
    { id: 'first_message', label: 'First message' },
    { id: 'reschedule', label: 'Reschedule' },
    { id: 'they_went_quiet', label: 'They went quiet' }
  ];
  const TEAZE_RECENT_MAX = 30;
  const RECENT_COPIED_MAX = 30;
  const SAVED_MAX = 60;
  const CATEGORY_STORAGE_KEY = 'teazr_category';
  const TEAZE_TAB_KEY = 'teazr_teaze_tab';
  const TEAZE_SEEDED_KEY = 'teaze_seeded';
  const APP_VERSION = '4';

  let teazeCategory = 'GENERAL';
  let teazeMoment = 'START';
  let teazeStyle = 'CLASSY';
  let teazeSituation = 'ANY';
  let teazeCurrentIds = [];
  let teazeSeedBannerData = null;
  let teazeActiveTab = 'TODAY';

  const QUESTIONS = [
    { q: 'When you see someone you\'re attracted to, you typically…', a: ['Make direct eye contact', 'Glance and look away', 'Stay in your lane'] },
    { q: 'Your approach to getting attention is…', a: ['Bold and confident', 'Subtle hints', 'Hope they notice'] },
    { q: 'In a group, you tend to…', a: ['Own the room', 'Warm up gradually', 'Blend in'] },
    { q: 'When flirting, you prefer…', a: ['Playful teasing', 'Sweet compliments', 'Low-key vibes'] },
    { q: 'Your texting style is…', a: ['Quick wit, quick reply', 'Thoughtful, not desperate', 'When I feel like it'] },
    { q: 'When someone gives you a compliment…', a: ['Own it and volley back', 'Thank them warmly', 'Deflect or downplay'] }
  ];

  function labelForScore(score, labels) {
    if (score <= 20) return labels[0];
    if (score <= 40) return labels[1];
    if (score <= 60) return labels[2];
    if (score <= 80) return labels[3];
    return labels[4];
  }

  const FLIRT_LABELS = ['Cold', 'Low-key', 'Warm', 'Bold', 'Electric'];
  const MYSTERY_LABELS = ['Obvious', 'Open book', 'Balanced', 'Intriguing', 'Enigma'];
  const REPLY_RISK_LABELS = ['Safe', 'Mild', 'Spicy', 'High', 'Danger'];

  const ONE_LINERS = {
    ruleA: [
      'This could be legendary… or chaotic.',
      'You\'re playing with fire. Respect.',
      'One message away from a plot twist.'
    ],
    ruleB: [
      'Silent but deadly. Interesting.',
      'Mysterious energy. They\'ll overthink this.',
      'Low flirt, high mystery — dangerous combo.'
    ],
    ruleC: [
      'Smooth. Confident. Very sendable.',
      'Big charm, low risk — go for it.',
      'You\'re basically a green light.'
    ],
    ruleD: [
      'Balanced vibes. Play it cool.',
      'You\'re in the sweet spot.',
      'Nothing wild… yet.'
    ],
    default: [
      'Chaos potential detected.',
      'This is a vibe. Trust it.',
      'Proceed with playful confidence.'
    ]
  };

  function getOneLiner(flirt, mystery, risk) {
    if (risk >= 81) return ONE_LINERS.ruleA[Math.floor(Math.random() * ONE_LINERS.ruleA.length)];
    if (mystery >= 81 && flirt <= 40) return ONE_LINERS.ruleB[Math.floor(Math.random() * ONE_LINERS.ruleB.length)];
    if (flirt >= 81 && risk <= 40) return ONE_LINERS.ruleC[Math.floor(Math.random() * ONE_LINERS.ruleC.length)];
    if (flirt >= 41 && flirt <= 60 && mystery >= 41 && mystery <= 60 && risk >= 41 && risk <= 60) {
      return ONE_LINERS.ruleD[Math.floor(Math.random() * ONE_LINERS.ruleD.length)];
    }
    return ONE_LINERS.default[Math.floor(Math.random() * ONE_LINERS.default.length)];
  }

  let step = 0;
  let answers = [];
  let lastShareUrl = '';
  let lastResultData = null;
  let challengeBannerData = null;
  let isShareEntry = false;
  let shareName = '';

  function render(html) {
    document.getElementById('app').innerHTML = html;
  }

  function toUrlSafeBase64(str) {
    return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromUrlSafeBase64(encoded) {
    try {
      let s = encoded.replace(/-/g, '+').replace(/_/g, '/');
      while (s.length % 4) s += '=';
      return decodeURIComponent(escape(atob(s)));
    } catch (_) { return null; }
  }

  function makeShareUrl(data, name) {
    const shortSeed = data.flirt + '.' + data.mystery + '.' + data.replyRisk;
    let url = SHARE_BASE + '/?s=' + shortSeed;
    if (name && name.length > 0) {
      url += '&n=' + encodeURIComponent(name);
    }
    return url;
  }

  function parseSeedParam() {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const s = params.get('s');
    if (!s) return null;
    const dotMatch = String(s).match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (dotMatch) {
      const flirt = Math.max(0, Math.min(100, parseInt(dotMatch[1], 10)));
      const mystery = Math.max(0, Math.min(100, parseInt(dotMatch[2], 10)));
      const replyRisk = Math.max(0, Math.min(100, parseInt(dotMatch[3], 10)));
      return { flirt, mystery, replyRisk };
    }
    const decoded = fromUrlSafeBase64(decodeURIComponent(s));
    if (!decoded) return null;
    try {
      const data = JSON.parse(decoded);
      if (data && typeof data.f === 'number' && typeof data.m === 'number' && typeof data.r === 'number') {
        return {
          flirt: Math.max(0, Math.min(100, data.f)),
          mystery: Math.max(0, Math.min(100, data.m)),
          replyRisk: Math.max(0, Math.min(100, data.r))
        };
      }
      return null;
    } catch (_) { return null; }
  }

  function parseNameParam() {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const n = params.get('n');
    if (!n || typeof n !== 'string') return null;
    const sanitized = sanitizeName(n);
    return sanitized && sanitized.length > 0 ? sanitized : null;
  }

  function sanitizeName(input) {
    if (typeof input !== 'string') return '';
    let s = input.trim();
    if (s.length > 20) s = s.slice(0, 20);
    return s.replace(/[^a-zA-Z0-9 _]/g, '');
  }

  function emitAnalytics(eventName) {
    if (typeof window === 'undefined') return;
    if (window.dataLayer) {
      window.dataLayer.push({ event: eventName });
    }
    if (window.gtag) {
      window.gtag('event', eventName);
    }
  }

  /** Lean analytics: allowlisted events + source attribution, no PII / no tracking IDs. */
  const ANALYTICS_ALLOWED_EVENTS = {
    teaze_opened: true,
    copy_clicked: true,
    share_clicked: true,
    quiz_started: true,
    quiz_completed: true
  };
  const ANALYTICS_PROPS_KEYS = ['context', 'category', 'moment', 'style', 'quiz_version'];

  let _sourceCache = null;
  function detectSource() {
    if (_sourceCache) return _sourceCache;
    let source = 'unknown';
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
          if (ref_domain.indexOf('tiktok.com') !== -1) source = 'tiktok';
          else if (ref_domain.indexOf('instagram.com') !== -1) source = 'instagram';
          else if (ref_domain.indexOf('facebook.com') !== -1) source = 'facebook';
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
    _sourceCache = { source: source, ref_domain: ref_domain, in_app: in_app };
    return _sourceCache;
  }

  const qaEvents = [];
  const QA_MAX_EVENTS = 20;
  function qaLogEvent(payload) {
    if (!isQaMode()) return;
    qaEvents.push(payload);
    if (qaEvents.length > QA_MAX_EVENTS) qaEvents.shift();
    try { console.log('[TEAZR QA]', payload); } catch (_) {}
    renderQaOverlay();
  }
  function renderQaOverlay() {
    if (!isQaMode()) return;
    let panel = document.getElementById('teazr-qa-overlay');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'teazr-qa-overlay';
      panel.style.cssText = 'position:fixed;bottom:0;right:0;width:340px;max-height:260px;overflow-y:auto;background:rgba(0,0,0,0.92);color:#0f0;font:11px/1.4 monospace;padding:8px;z-index:99999;pointer-events:auto;border-top-left-radius:8px;';
      document.body.appendChild(panel);
    }
    let html = '<div style="color:#fff;font-weight:bold;margin-bottom:4px">QA Events (' + qaEvents.length + ')</div>';
    for (let i = qaEvents.length - 1; i >= 0; i--) {
      const e = qaEvents[i];
      const time = new Date(e.ts).toLocaleTimeString();
      html += '<div style="border-bottom:1px solid #333;padding:2px 0">';
      html += '<span style="color:#ff0">' + time + '</span> ';
      html += '<span style="color:#0ff">' + e.event + '</span>';
      html += ' <span style="color:#aaa">src=' + e.source + (e.in_app ? ' in-app' : '') + '</span>';
      if (e.props && Object.keys(e.props).length > 0) {
        html += '<br><span style="color:#888">' + JSON.stringify(e.props) + '</span>';
      }
      html += '</div>';
    }
    panel.innerHTML = html;
  }

  function sanitizeAnalyticsProps(props) {
    if (!props || typeof props !== 'object') return {};
    const out = {};
    for (let i = 0; i < ANALYTICS_PROPS_KEYS.length; i++) {
      const k = ANALYTICS_PROPS_KEYS[i];
      if (!Object.prototype.hasOwnProperty.call(props, k) || props[k] == null) continue;
      const v = props[k];
      if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
      else out[k] = String(v);
    }
    return out;
  }

  function sendEvent(eventName, props) {
    if (typeof window === 'undefined') return;
    if (!Object.prototype.hasOwnProperty.call(ANALYTICS_ALLOWED_EVENTS, eventName)) return;
    try {
      const src = detectSource();
      const safeProps = sanitizeAnalyticsProps(props || {});
      const payload = {
        event: eventName,
        ts: Date.now(),
        path: getPath(),
        source: src.source,
        ref_domain: src.ref_domain,
        in_app: src.in_app
      };
      if (Object.keys(safeProps).length > 0) payload.props = safeProps;
      qaLogEvent(payload);
      const body = JSON.stringify(payload);
      const url = '/api/event';
      if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))) return;
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true
      }).catch(function() {});
    } catch (_) {}
  }

  function sendTeazeEvent(eventName, props) {
    sendEvent(eventName, props);
  }

  function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    toast.offsetHeight;
    toast.classList.add('toast-visible');
    setTimeout(() => {
      toast.classList.remove('toast-visible');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  function copyResultUrl(url) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(url);
    }
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return Promise.resolve(ok);
  }

  function setCooldown() {
    localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
  }

  function getCooldownRemaining() {
    const t = parseInt(localStorage.getItem(COOLDOWN_KEY), 10);
    if (!t || isNaN(t)) return 0;
    const elapsed = Date.now() - t;
    return Math.max(0, COOLDOWN_MS - elapsed);
  }

  function formatCooldown(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h ? `${h}h ${m}m` : `${m}m`;
  }

  /** Banned phrases (case-insensitive). Runtime safety filter. */
  const TEAZE_BANNED_PHRASES = [
    'all is well', 'i trust', 'at your earliest convenience', 'on your end',
    'hope you\'re doing well', 'kindly', 'dear', 'sincerely', 'regards',
    'following up', 'per my last message', 'touch base', 'circling back',
    'i wanted to reach out', 'please advise', 'just checking in',
    'i was wondering if', 'i feel like', 'i think that', 'i just', 'maybe',
    'if that makes sense', 'how are you doing today', 'good morning', 'good evening',
    'no worries at all', 'i hope this finds you well', 'trauma', 'healing',
    'attachment style', 'attachment styles'
  ];

  function hasBannedPhrase(text) {
    if (!text || typeof text !== 'string') return false;
    const lower = text.toLowerCase();
    for (let i = 0; i < TEAZE_BANNED_PHRASES.length; i++) {
      if (lower.indexOf(TEAZE_BANNED_PHRASES[i]) !== -1) return true;
    }
    return false;
  }

  /**
   * Bucket key for anti-repeat: category|moment|style|situation.
   */
  function teazeBucketKey(category, moment, style, situation) {
    const m = String(moment).replace(/\s+/g, '_');
    const sty = (m === 'BOUNDARY') ? '' : String(style);
    const sit = situation ? String(situation) : (m === 'BOUNDARY' ? 'unwanted_pic' : 'ANY');
    return 'teaz_v3:' + String(category) + '|' + m + '|' + sty + '|' + sit;
  }

  function getEffectiveSituation(moment, situation) {
    const m = String(moment).replace(/\s+/g, '_');
    if (m === 'BOUNDARY') return situation || 'unwanted_pic';
    return situation || 'ANY';
  }

  /** Returns last N shown IDs for this bucket from localStorage. maxCount limits how many we use (for small buckets). */
  function getTeazeRecentIds(bucketKey, maxCount) {
    try {
      const raw = localStorage.getItem(bucketKey);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      const normalized = arr.map(function(id) { return String(id); });
      const n = maxCount != null ? Math.min(maxCount, TEAZE_RECENT_MAX) : TEAZE_RECENT_MAX;
      return normalized.slice(-n);
    } catch (_) { return []; }
  }

  /** Keeps only the last N IDs per bucket. Overwrites older history. */
  function saveTeazeRecentIds(bucketKey, ids) {
    try {
      localStorage.setItem(bucketKey, JSON.stringify(ids.slice(-TEAZE_RECENT_MAX)));
    } catch (_) {}
  }

  const RECENT_COPIED_KEY = 'teazr_recent_copied';
  const SAVED_KEY = 'teazr_saved';

  function getRecentCopied() {
    try {
      const raw = localStorage.getItem(RECENT_COPIED_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
  }

  function addToRecentCopied(text) {
    if (!text || typeof text !== 'string') return;
    let arr = getRecentCopied();
    const trimmed = text.trim();
    if (!trimmed) return;
    arr = arr.filter(function (x) { return x.text !== trimmed; });
    arr.unshift({ text: trimmed, ts: Date.now() });
    try {
      localStorage.setItem(RECENT_COPIED_KEY, JSON.stringify(arr.slice(0, RECENT_COPIED_MAX)));
    } catch (_) {}
  }

  function getSaved() {
    try {
      const raw = localStorage.getItem(SAVED_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
  }

  function isSaved(text) {
    const saved = getSaved();
    return saved.some(function (x) { return x.text === (text || '').trim(); });
  }

  function toggleSaved(text) {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.trim();
    if (!trimmed) return false;
    let arr = getSaved();
    const idx = arr.findIndex(function (x) { return x.text === trimmed; });
    if (idx >= 0) {
      arr.splice(idx, 1);
    } else {
      arr = arr.filter(function (x) { return x.text !== trimmed; });
      arr.unshift({ text: trimmed, ts: Date.now() });
      arr = arr.slice(0, SAVED_MAX);
    }
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(arr));
    } catch (_) {}
    return idx < 0;
  }

  /**
   * Picks 3 suggestions with anti-repeat. excludeIds = currently visible 3 (must not reappear on MORE OPTIONS).
   * - If bucket has fewer than N+6 items, reduce N for this bucket (graceful degrade).
   * - Preferred: not in exclude, not in last-N history.
   * - Fallback: not in exclude (allow recent if pool small).
   * - Content filter: reject suggestions with banned phrases; replace with another.
   */
  function pickTeazeMessages(category, moment, style, situation, excludeIds) {
    const effSit = getEffectiveSituation(moment, situation);
    const bucket = (typeof window.getTeazeBucket === 'function')
      ? window.getTeazeBucket(category, moment, style, effSit)
      : [];
    if (!bucket || !bucket.length) return [];

    const bucketKey = teazeBucketKey(category, moment, style, effSit);
    // Graceful degrade: if bucket has fewer than N+6, use smaller N so we can still get fresh sets
    const effectiveMax = Math.min(TEAZE_RECENT_MAX, Math.max(0, bucket.length - 6));
    const recentIds = getTeazeRecentIds(bucketKey, effectiveMax);
    const exclude = new Set((excludeIds || []).map(function(id) { return String(id); }));

    const preferred = bucket.filter(function(m) {
      return !exclude.has(String(m.id)) && !recentIds.includes(String(m.id));
    });
    const fallback = bucket.filter(function(m) { return !exclude.has(String(m.id)); });
    let pool = preferred.length >= 3 ? preferred : fallback;
    if (pool.length === 0) pool = bucket;

    const shuffled = pool.slice().sort(function() { return Math.random() - 0.5; });
    let picked = shuffled.slice(0, 3);

    // Content filter: replace any with banned phrases
    for (let i = 0; i < picked.length; i++) {
      if (hasBannedPhrase(picked[i].text)) {
        const pickedIds = {};
        for (let k = 0; k < picked.length; k++) pickedIds[picked[k].id] = true;
        for (let j = 0; j < shuffled.length; j++) {
          const m = shuffled[j];
          if (!pickedIds[m.id] && !hasBannedPhrase(m.text)) {
            picked[i] = m;
            pickedIds[m.id] = true;
            break;
          }
        }
      }
    }

    return picked;
  }

  function makeTeazeShareUrl() {
    const obj = {
      c: teazeCategory,
      m: teazeMoment,
      s: teazeStyle,
      sit: teazeMoment === 'BOUNDARY' ? teazeSituation : (teazeSituation !== 'ANY' ? teazeSituation : null),
      i: teazeCurrentIds.slice(0, 3)
    };
    if (teazeMoment === 'BOUNDARY') {
      obj.l = (teazeMoment || '') + '/' + (teazeSituation || '');
    } else {
      obj.l = (teazeMoment || '') + '/' + (teazeStyle || '') + (teazeSituation && teazeSituation !== 'ANY' ? '/' + teazeSituation : '');
    }
    const json = JSON.stringify(obj);
    const enc = toUrlSafeBase64(json);
    return SHARE_BASE + '/teaze?s=' + encodeURIComponent(enc);
  }

  function getTeazeShareText(url) {
    if (teazeSeedBannerData) {
      const lbl = teazeSeedBannerData.label || (teazeSeedBannerData.moment || '') + '/' + (teazeSeedBannerData.style || teazeSeedBannerData.situation || '');
      return 'Someone sent a Teaz (' + lbl + '). Try yours: ' + url;
    }
    return 'Try \'Send a Teaz\' on Teazr: ' + (url || 'teazr.app/teaze');
  }

  function isQaMode() {
    const q = typeof window !== 'undefined' && window.location && window.location.search;
    return q ? new URLSearchParams(q).get('qa') === '1' : false;
  }

  function runQaSpins() {
    const bucketKey = teazeBucketKey(teazeCategory, teazeMoment, teazeStyle, getEffectiveSituation(teazeMoment, teazeSituation));
    const effSit = getEffectiveSituation(teazeMoment, teazeSituation);
    const bucket = (typeof window.getTeazeBucket === 'function')
      ? window.getTeazeBucket(teazeCategory, teazeMoment, teazeStyle, effSit)
      : [];
    const poolSize = bucket ? bucket.length : 0;
    const winSize = Math.min(30, Math.max(0, poolSize - 3));
    const seen = {};
    let uniqueCount = 0;
    let repeats = 0;
    let excludeIds = [];
    for (let i = 0; i < 100; i++) {
      const picked = pickTeazeMessages(teazeCategory, teazeMoment, teazeStyle, teazeSituation, excludeIds);
      excludeIds = picked.map(function(m) { return m.id; });
      if (picked.length) {
        const recent = getTeazeRecentIds(bucketKey, winSize);
        saveTeazeRecentIds(bucketKey, recent.concat(excludeIds));
      }
      for (let j = 0; j < picked.length; j++) {
        const id = picked[j].id;
        if (seen[id]) repeats++;
        else { seen[id] = true; uniqueCount++; }
      }
    }
    return { bucketKey, poolSize, winSize, uniqueCount, repeats };
  }

  function buildA2HSHint() {
    try {
      if (localStorage.getItem('teazr_a2hs_dismissed')) return '';
    } catch (_) { return ''; }
    const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/.test(ua);
    let msg = '';
    if (isIOS) msg = 'Share → Add to Home Screen';
    else if (isAndroid) msg = 'Add to Home screen from browser menu';
    if (!msg) return '';
    return '<div class="teaze-a2hs-hint" data-a2hs>' +
      msg + ' <button type="button" class="teaze-a2hs-dismiss" data-action="dismiss-a2hs" aria-label="Dismiss">×</button>' +
      '</div>';
  }

  function buildTeazeSeedBanner() {
    if (!teazeSeedBannerData) return '';
    const lbl = (teazeSeedBannerData.label || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return '<div class="teaze-seed-banner" data-teaze-banner>' +
      'Someone sent: ' + lbl + ' — pick yours ' +
      '<button type="button" class="teaze-banner-hide" data-action="hide-banner" aria-label="Hide">×</button>' +
      '</div>';
  }

  const TEAZE_UI_VERSION = '2';

  /** Reusable BackButton: show on all non-home routes. history.back() if length>1 else navigate("/"). */
  function buildBackButton() {
    return '<div class="app-back-bar">' +
      '<button type="button" class="app-back-btn" data-app-back aria-label="Back to home">←</button>' +
      '</div>';
  }

  function ensureBackButton() {
    var path = getPath();
    var wrap = document.getElementById('app-back-wrap');
    if (path === '/') {
      if (wrap) wrap.innerHTML = '';
      return;
    }
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'app-back-wrap';
      document.body.insertBefore(wrap, document.getElementById('app'));
    }
    wrap.innerHTML = buildBackButton();
  }

  function handleBackToHome() {
    try {
      const sameOriginReferrer =
        document.referrer && (
          document.referrer.includes("teazr.app") ||
          document.referrer.includes("teazr.pages.dev")
        );

      if (sameOriginReferrer && window.history.length > 1) {
        window.history.back();
      } else {
        navigateHome();
      }
    } catch (_) {
      navigateHome();
    }
  }

  function getTeazeBaseUrl() {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    params.delete('tab');
    const qs = params.toString();
    return '/teaze' + (qs ? '?' + qs : '');
  }

  function ensureTeazeHistorySeeded() {
    try {
      if (sessionStorage.getItem(TEAZE_SEEDED_KEY) === '1') return;
    } catch (_) { return; }
    if (!window.history || !window.history.replaceState || !window.history.pushState) return;
    const baseUrl = getTeazeBaseUrl();
    window.history.replaceState({ teaze: true }, '', baseUrl);
    window.history.pushState({ teaze: true, seed: true }, '', baseUrl);
    try { sessionStorage.setItem(TEAZE_SEEDED_KEY, '1'); } catch (_) {}
  }

  function parseTeazeSeedParam() {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const s = params.get('s');
    if (!s || typeof s !== 'string') return null;
    try {
      const decoded = fromUrlSafeBase64(decodeURIComponent(s));
      if (!decoded) return null;
      const data = JSON.parse(decoded);
      if (!data || typeof data.m !== 'string') return null;
      const momentRaw = String(data.m).trim().replace(/\s+/g, '_');
      const category = data.c && (data.c === 'GENERAL' || data.c === 'FLIRTY') ? data.c : 'GENERAL';
      const momentsForCat = category === 'GENERAL' ? TEAZE_MOMENTS : TEAZE_MOMENTS_FLIRTY;
      if (!momentsForCat.includes(momentRaw)) return null;
      let style = 'CLASSY';
      let situation = null;
      if (momentRaw === 'BOUNDARY') {
        situation = (data.sit === 'unwanted_pic' || data.sit === 'too_pushy') ? data.sit : 'unwanted_pic';
        if (category !== 'GENERAL') return null;
      } else {
        style = (data.s === 'PLAYFUL' || data.s === 'CLASSY') ? data.s : 'CLASSY';
        situation = (data.sit && ['ANY','after_story','late_reply','first_message','reschedule','they_went_quiet'].indexOf(data.sit) >= 0) ? data.sit : 'ANY';
      }
      return {
        category: category,
        moment: momentRaw,
        style: style,
        situation: situation,
        ids: Array.isArray(data.i) ? data.i.slice(0, 3) : [],
        label: typeof data.l === 'string' ? data.l : (momentRaw + '/' + (situation || style))
      };
    } catch (_) { return null; }
  }

  let teazeEmptyRetries = 0;

  function renderRecentOrSavedTab(list, emptyMsg) {
    const bannerHtml = teazeSeedBannerData ? buildTeazeSeedBanner() : '';
    const itemsHtml = list.length === 0
      ? '<p class="teaze-empty-hint">' + (emptyMsg || 'Nothing here yet.') + '</p>'
      : list.map(function(item) {
          const t = (item.text || '').trim();
          const escaped = t.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
          const saved = isSaved(t);
          return `
            <div class="teaze-message-card">
              <p class="teaze-message-text">${escaped}</p>
              <div class="teaze-card-actions">
                <button type="button" class="btn-teaze-copy" data-action="copy" data-text="${escaped}">COPY</button>
                <button type="button" class="btn-teaze-save ${saved ? 'saved' : ''}" data-action="save-toggle" data-text="${escaped}">${saved ? 'SAVED' : 'SAVE'}</button>
              </div>
            </div>`;
        }).join('');
    render(`
      <div class="teaze-screen" data-teaze-root>
        ${bannerHtml}
        <h1 class="teaze-title">SEND A TEAZ</h1>
        <div class="teaze-tabs">
          <button type="button" class="teaze-tab ${teazeActiveTab === 'TODAY' ? 'active' : ''}" data-tab="TODAY">TODAY</button>
          <button type="button" class="teaze-tab ${teazeActiveTab === 'COPIED' ? 'active' : ''}" data-tab="COPIED">COPIED</button>
          <button type="button" class="teaze-tab ${teazeActiveTab === 'SAVED' ? 'active' : ''}" data-tab="SAVED">SAVED</button>
        </div>
        <div class="teaze-messages">${itemsHtml}</div>
        ${buildA2HSHint()}
      </div>
    `);
  }

  function showTeazeScreen() {
    if (teazeActiveTab === 'COPIED') {
      const copied = getRecentCopied();
      renderRecentOrSavedTab(copied, 'Nothing copied yet.');
      return;
    }
    if (teazeActiveTab === 'SAVED') {
      const saved = getSaved();
      renderRecentOrSavedTab(saved, 'No saved lines.');
      return;
    }

    const bucketKey = teazeBucketKey(teazeCategory, teazeMoment, teazeStyle, getEffectiveSituation(teazeMoment, teazeSituation));
    const messages = pickTeazeMessages(teazeCategory, teazeMoment, teazeStyle, teazeSituation, teazeCurrentIds);
    if (!messages || messages.length === 0) {
      teazeEmptyRetries = (teazeEmptyRetries || 0) + 1;
      render(`
        <div class="teaze-screen" data-teaze-root>
          <h1 class="teaze-title">SEND A TEAZ</h1>
          <p class="teaze-loading">Loading…</p>
        </div>
      `);
      if (teazeEmptyRetries < 10) {
        setTimeout(showTeazeScreen, 50);
      }
      return;
    }
    teazeEmptyRetries = 0;
    teazeCurrentIds = messages.map(function(m) { return m.id; });
    saveTeazeRecentIds(bucketKey, getTeazeRecentIds(bucketKey).concat(teazeCurrentIds));

    const momentsForCat = teazeCategory === 'GENERAL' ? TEAZE_MOMENTS : TEAZE_MOMENTS_FLIRTY;
    const momentOpts = momentsForCat.map(function(m) {
      const escaped = m.replace(/'/g, '&#39;');
      const label = TEAZE_MOMENTS_DISPLAY[m] || m;
      return `<button type="button" class="teaze-selector-btn ${teazeMoment === m ? 'active' : ''}" data-moment="${escaped}">${label.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</button>`;
    }).join('');
    const styleOpts = teazeMoment === 'BOUNDARY' ? '' : TEAZE_STYLES.map(function(s) {
      return `<button type="button" class="teaze-selector-btn ${teazeStyle === s ? 'active' : ''}" data-style="${s}">${s}</button>`;
    }).join('');
    const situationList = teazeMoment === 'BOUNDARY' ? TEAZE_SITUATIONS_BOUNDARY : TEAZE_SITUATIONS_GENERAL;
    const situationGroupHtml = teazeMoment === 'BOUNDARY'
      ? situationList.map(function(sit) {
          return `<button type="button" class="teaze-selector-btn ${teazeSituation === sit.id ? 'active' : ''}" data-situation="${sit.id}">${sit.label.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</button>`;
        }).join('')
      : situationList.map(function(sit) {
          return `<option value="${sit.id}" ${teazeSituation === sit.id ? 'selected' : ''}>${sit.label.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</option>`;
        }).join('');
    const situationUi = `
      <div class="teaze-selector-group">
        <label class="teaze-selector-label">Situation</label>
        ${teazeMoment === 'BOUNDARY' ? '<div class="teaze-selector-btns">' + situationGroupHtml + '</div>' : '<select class="teaze-situation-select" data-situation-select aria-label="Situation" style="font-size:16px">' + situationGroupHtml + '</select>'}
      </div>`;

    const msgBlocks = messages.map(function(m, idx) {
      const escaped = m.text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const saved = isSaved(m.text);
      return `
        <div class="teaze-message-card" data-id="${m.id}">
          <p class="teaze-message-text">${escaped}</p>
          <div class="teaze-card-actions">
            <button type="button" class="btn-teaze-copy" data-action="copy" data-id="${m.id}" data-index="${idx}">COPY</button>
            <button type="button" class="btn-teaze-save ${saved ? 'saved' : ''}" data-action="save-toggle" data-id="${m.id}" aria-label="${saved ? 'Unsave' : 'Save'}">${saved ? 'SAVED' : 'SAVE'}</button>
          </div>
        </div>
      `;
    }).join('');

    const styleGroupHtml = teazeMoment === 'BOUNDARY' ? '' : `
      <div class="teaze-selector-group">
        <label class="teaze-selector-label">Styles</label>
        <div class="teaze-selector-btns">${styleOpts}</div>
      </div>`;
    const categoryOpts = `
      <div class="teaze-selector-group">
        <label class="teaze-selector-label">Category</label>
        <div class="teaze-category-toggle">
          <button type="button" class="teaze-selector-btn ${teazeCategory === 'GENERAL' ? 'active' : ''}" data-category="GENERAL">GENERAL</button>
          <button type="button" class="teaze-selector-btn ${teazeCategory === 'FLIRTY' ? 'active' : ''}" data-category="FLIRTY">FLIRTY</button>
        </div>
      </div>`;
    const safetyMicrocopy = teazeMoment === 'BOUNDARY' ? '<p class="teaze-safety-microcopy">If you feel unsafe, stop replying and use platform block/report.</p>' : '';
    const bannerHtml = teazeSeedBannerData ? buildTeazeSeedBanner() : '';
    const categoryMicrocopy = teazeCategory === 'GENERAL' ? 'Short. Human. Copy/paste.' : 'Playful, not cringe.';

    render(`
      <div class="teaze-screen" data-teaze-root>
        ${bannerHtml}
        <h1 class="teaze-title">SEND A TEAZ</h1>
        <div class="teaze-selectors">
          ${categoryOpts}
          <div class="teaze-selector-group">
            <label class="teaze-selector-label">Moments</label>
            <div class="teaze-selector-btns">${momentOpts}</div>
          </div>
          ${styleGroupHtml}
          ${situationUi}
        </div>
        <div class="teaze-tabs">
          <button type="button" class="teaze-tab ${teazeActiveTab === 'TODAY' ? 'active' : ''}" data-tab="TODAY">TODAY</button>
          <button type="button" class="teaze-tab ${teazeActiveTab === 'COPIED' ? 'active' : ''}" data-tab="COPIED">COPIED</button>
          <button type="button" class="teaze-tab ${teazeActiveTab === 'SAVED' ? 'active' : ''}" data-tab="SAVED">SAVED</button>
        </div>
        <div class="teaze-suggestions-header">
          <div class="btn-teaze-more-wrap">
            <button type="button" class="btn-teaze-more" data-action="new-options">MORE ↻</button>
          </div>
        </div>
        <div class="teaze-messages">${msgBlocks}</div>
        <p class="teaze-category-microcopy">${categoryMicrocopy}</p>
        ${safetyMicrocopy}
        <div class="teaze-share-row">
          <p class="teaze-share-hint">Screenshot & share.</p>
          <button type="button" class="btn-teaze-whatsapp" data-action="share-whatsapp">SHARE ON WHATSAPP</button>
          <button type="button" class="btn-teaze-copy-link" data-action="copy-link">COPY LINK</button>
        </div>
        ${buildA2HSHint()}
        ${isQaMode() ? '<div class="teaze-qa-panel" data-qa-panel><button type="button" data-action="qa-run">Run 100 spins</button><pre id="teaze-qa-output"></pre></div>' : ''}
      </div>
    `);
  }

  function setTeazeCategory(c) {
    if (c === teazeCategory) return;
    teazeCategory = c;
    try { localStorage.setItem(CATEGORY_STORAGE_KEY, c); } catch (_) {}
    if (c === 'FLIRTY' && teazeMoment === 'BOUNDARY') {
      teazeMoment = 'START';
      teazeSituation = 'ANY';
      teazeStyle = 'CLASSY';
    }
    teazeCurrentIds = [];
    showTeazeScreen();
  }

  function setTeazeMoment(m) {
    if (m === teazeMoment) return;
    teazeMoment = m;
    teazeSituation = (m === 'BOUNDARY') ? 'unwanted_pic' : 'ANY';
    teazeCurrentIds = [];
    showTeazeScreen();
  }

  function setTeazeStyle(s) {
    if (s === teazeStyle) return;
    teazeStyle = s;
    teazeCurrentIds = [];
    showTeazeScreen();
  }

  function setTeazeSituation(sit) {
    if (sit === teazeSituation) return;
    teazeSituation = sit;
    teazeCurrentIds = [];
    showTeazeScreen();
  }

  function copyTeazeText(text) {
    if (!text) return;
    const decoded = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#39;/g, "'");
    copyResultUrl(decoded).then(function() {
      addToRecentCopied(decoded);
      showToast('Copied');
      sendTeazeEvent('copy_clicked', { context: 'teaze_message', category: teazeCategory, moment: teazeMoment, style: teazeStyle });
    }).catch(function() { showToast('Could not copy'); });
  }

  function toggleTeazeSave(text) {
    if (!text) return;
    const decoded = typeof text === 'string' && text.indexOf('&') >= 0
      ? text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#39;/g, "'")
      : text;
    const nowSaved = toggleSaved(decoded);
    showToast(nowSaved ? 'Saved' : 'Removed');
    if (teazeActiveTab === 'SAVED' || teazeActiveTab === 'TODAY' || teazeActiveTab === 'COPIED') showTeazeScreen();
  }

  function getMessageTextById(messageId) {
    const effSit = getEffectiveSituation(teazeMoment, teazeSituation);
    const bucket = (typeof window.getTeazeBucket === 'function')
      ? window.getTeazeBucket(teazeCategory, teazeMoment, teazeStyle, effSit)
      : [];
    const msg = bucket && bucket.find(function(m) { return m.id === messageId; });
    return msg ? msg.text : null;
  }

  function copyTeazeMessage(messageId, index) {
    const text = getMessageTextById(messageId);
    if (!text) return;
    copyResultUrl(text).then(function() {
      addToRecentCopied(text);
      showToast('Copied');
      const btn = document.querySelector('[data-action="copy"][data-id="' + messageId + '"]');
      if (btn) {
        btn.textContent = 'COPIED';
        btn.classList.add('copied');
        btn.disabled = true;
        setTimeout(function() {
          btn.textContent = 'COPY';
          btn.classList.remove('copied');
          btn.disabled = false;
        }, 1000);
      }
      sendTeazeEvent('copy_clicked', { context: 'teaze_message', category: teazeCategory, moment: teazeMoment, style: teazeStyle });
    }).catch(function() { showToast('Could not copy'); });
  }

  function newTeazeOptions() {
    const btn = document.querySelector('[data-action="new-options"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'REFRESHING…';
    }
    setTimeout(function() {
      showTeazeScreen();
    }, 280);
  }

  function shareTeazeWhatsApp() {
    const url = makeTeazeShareUrl();
    const text = getTeazeShareText(url);
    const encoded = encodeURIComponent(text);
    window.open('https://wa.me/?text=' + encoded, '_blank', 'noopener');
    sendEvent('share_clicked', { context: 'whatsapp' });
  }

  function copyTeazeLink() {
    const url = makeTeazeShareUrl();
    copyResultUrl(url).then(function() {
      const btn = document.querySelector('[data-action="copy-link"]');
      if (btn) {
        btn.textContent = 'COPIED';
        btn.classList.add('copied');
        btn.disabled = true;
        setTimeout(function() {
          btn.textContent = 'COPY LINK';
          btn.classList.remove('copied');
          btn.disabled = false;
        }, 1000);
      }
      sendEvent('share_clicked', { context: 'copy_link' });
    }).catch(function() { showToast('Could not copy'); });
  }

  function setupGlobalBackButton() {
    document.addEventListener('click', function handleAppBack(e) {
      var target = e.target && e.target.closest ? e.target.closest('[data-app-back]') : null;
      if (target) {
        e.preventDefault();
        handleBackToHome();
      }
    });
  }

  function setupTeazeClickDelegation() {
    const app = document.getElementById('app');
    if (!app) return;
    app.addEventListener('change', function handleTeazeChange(e) {
      if (e.target && e.target.getAttribute && e.target.getAttribute('data-situation-select') !== null && app.querySelector('[data-teaze-root]')) {
        const val = e.target.value;
        if (val && val !== teazeSituation) setTeazeSituation(val);
      }
    });
    app.addEventListener('click', function handleTeazeClick(e) {
      if (!app.querySelector('[data-teaze-root]')) return;
      const target = e.target;
      const tabBtn = target.closest('[data-tab]');
      const categoryBtn = target.closest('[data-category]');
      const momentBtn = target.closest('[data-moment]');
      const styleBtn = target.closest('[data-style]');
      const situationBtn = target.closest('[data-situation]');
      const actionEl = target.closest('[data-action]');
      if (tabBtn) {
        const tab = tabBtn.getAttribute('data-tab');
        if (tab && tab !== teazeActiveTab) {
          teazeActiveTab = tab;
          try { localStorage.setItem(TEAZE_TAB_KEY, tab); } catch (_) {}
          showTeazeScreen();
        }
        return;
      }

      if (categoryBtn) {
        const c = categoryBtn.getAttribute('data-category');
        if (c && (c === 'GENERAL' || c === 'FLIRTY')) setTeazeCategory(c);
        return;
      }
      if (momentBtn) {
        const m = momentBtn.getAttribute('data-moment');
        if (m) setTeazeMoment(m.replace(/&#39;/g, "'"));
        return;
      }
      if (styleBtn) {
        const s = styleBtn.getAttribute('data-style');
        if (s) setTeazeStyle(s);
        return;
      }
      if (situationBtn) {
        const sit = situationBtn.getAttribute('data-situation');
        if (sit) setTeazeSituation(sit);
        return;
      }
      if (actionEl) {
        const action = actionEl.getAttribute('data-action');
        if (action === 'new-options') {
          newTeazeOptions();
          return;
        }
        if (action === 'copy') {
          const textRaw = actionEl.getAttribute('data-text');
          if (textRaw != null) {
            copyTeazeText(textRaw);
            return;
          }
          const idRaw = actionEl.getAttribute('data-id');
          const idxRaw = actionEl.getAttribute('data-index');
          if (idRaw != null && String(idRaw).length > 0) {
            const index = idxRaw != null ? parseInt(idxRaw, 10) : 0;
            copyTeazeMessage(String(idRaw), isNaN(index) ? 0 : index);
          }
          return;
        }
        if (action === 'save-toggle') {
          const textRaw = actionEl.getAttribute('data-text');
          if (textRaw != null) {
            toggleTeazeSave(textRaw);
            return;
          }
          const idRaw = actionEl.getAttribute('data-id');
          if (idRaw != null) {
            const text = getMessageTextById(String(idRaw));
            if (text) toggleTeazeSave(text);
          }
          return;
        }
        if (action === 'share-whatsapp') {
          shareTeazeWhatsApp();
          return;
        }
        if (action === 'copy-link') {
          copyTeazeLink();
          return;
        }
        if (action === 'hide-banner') {
          teazeSeedBannerData = null;
          showTeazeScreen();
          return;
        }
        if (action === 'dismiss-a2hs') {
          try { localStorage.setItem('teazr_a2hs_dismissed', '1'); } catch (_) {}
          const el = document.querySelector('[data-a2hs]');
          if (el) el.remove();
          return;
        }
        if (action === 'qa-run') {
          const out = document.getElementById('teaze-qa-output');
          if (out) {
            const r = runQaSpins();
            out.textContent = 'bucketKey: ' + r.bucketKey + '\npoolSize: ' + r.poolSize + '\nantiRepeatWindow: ' + r.winSize + '\nuniqueReturned: ' + r.uniqueCount + '\nrepeats: ' + r.repeats;
          }
          return;
        }
      }
    });
  }

  function initTeaze() {
    ensureTeazeHistorySeeded();
    const seed = parseTeazeSeedParam();
    teazeSeedBannerData = seed;
    try {
      const stored = localStorage.getItem(CATEGORY_STORAGE_KEY);
      teazeCategory = (stored === 'FLIRTY' || stored === 'GENERAL') ? stored : 'GENERAL';
    } catch (_) { teazeCategory = 'GENERAL'; }
    teazeMoment = 'START';
    teazeStyle = 'CLASSY';
    teazeSituation = 'ANY';
    teazeCurrentIds = [];
    teazeActiveTab = 'TODAY';
    if (seed) {
      teazeCategory = seed.category;
      teazeMoment = seed.moment;
      teazeStyle = seed.style || 'CLASSY';
      teazeSituation = seed.situation || (seed.moment === 'BOUNDARY' ? 'unwanted_pic' : 'ANY');
      if (teazeCategory === 'FLIRTY' && teazeMoment === 'BOUNDARY') {
        teazeMoment = 'START';
        teazeSituation = 'ANY';
        teazeStyle = 'CLASSY';
      }
    }
    sendTeazeEvent('teaze_opened', { category: teazeCategory, moment: teazeMoment, style: teazeStyle });
    ensureBackButton();
    showTeazeScreen();
  }

  function navigateToTeaze() {
    var url;
    if (getPath() === '/teaze') {
      url = getTeazeBaseUrl();
    } else {
      url = '/teaze?v=' + TEAZE_UI_VERSION;
    }
    // Preserve qa and src parameters
    const params = new URLSearchParams(window.location.search);
    if (params.get('qa')) {
      url += (url.includes('?') ? '&' : '?') + 'qa=' + params.get('qa');
    }
    if (params.get('src')) {
      url += (url.includes('?') ? '&' : '?') + 'src=' + params.get('src');
    }
    try { sessionStorage.setItem('teazr_from_home', '1'); } catch (_) {}
    if (window.history && window.history.pushState) {
      window.history.pushState({ teaze: true }, '', url);
    } else {
      window.location.href = url;
      return;
    }
    initTeaze();
  }

  function navigateHome() {
    var url = '/';
    // Preserve qa parameter
    const params = new URLSearchParams(window.location.search);
    if (params.get('qa')) {
      url += '?qa=' + params.get('qa');
    }
    if (window.history && window.history.pushState) {
      window.history.pushState({}, '', url);
    } else {
      window.location.href = url;
    }
    init();
  }

  function showStart() {
    if (!isShareEntry) challengeBannerData = null;
    if (isShareEntry) {
      render(`
        <div class="start-screen">
          <h1 class="start-title">TEAZR</h1>
          <p class="start-headline">BETTER DMs — LESS OVERTHINKING.</p>
          <p class="start-subline">PICK A MOMENT. COPY A LINE. PASTE IN DM.</p>
          <a href="/teaze?v=2" class="btn-primary-teaze" onclick="event.preventDefault();TEAZR.navigateToTeaze();">SEND A TEAZ</a>
          <div class="quiz-secondary-wrap">
            <button type="button" class="btn-quiz-secondary" onclick="TEAZR.start()">TAKE THE QUIZ</button>
            <p class="quiz-helper">6 questions · 30 seconds</p>
            <p class="quiz-fun-note">Discover your flirt energy. If you dare.</p>
          </div>
        </div>
      `);
      return;
    }
    const remaining = getCooldownRemaining();
    if (remaining > 0) {
      const msg = formatCooldown(remaining);
      render(`
        <div class="start-screen">
          <h1 class="start-title">TEAZR</h1>
          <p class="start-headline">BETTER DMs — LESS OVERTHINKING.</p>
          <p class="start-subline">PICK A MOMENT. COPY A LINE. PASTE IN DM.</p>
          <p class="cooldown-msg">Your vibe needs time to recharge. Try again in ${msg}.</p>
          <a href="/teaze?v=2" class="btn-primary-teaze" onclick="event.preventDefault();TEAZR.navigateToTeaze();">SEND A TEAZ</a>
          <div class="quiz-secondary-wrap">
            <p class="quiz-fun-note">Discover your flirt energy. If you dare.</p>
          </div>
          <p class="footer">Made for fun.</p>
        </div>
      `);
      return;
    }
    render(`
      <div class="start-screen">
        <h1 class="start-title">TEAZR</h1>
        <p class="start-headline">BETTER DMs — LESS OVERTHINKING.</p>
        <p class="start-subline">PICK A MOMENT. COPY A LINE. PASTE IN DM.</p>
        <a href="/teaze?v=2" class="btn-primary-teaze" onclick="event.preventDefault();TEAZR.navigateToTeaze();">SEND A TEAZ</a>
        <div class="quiz-secondary-wrap">
          <button type="button" class="btn-quiz-secondary" onclick="TEAZR.start()">TAKE THE QUIZ</button>
          <p class="quiz-helper">6 questions · 30 seconds</p>
          <p class="quiz-fun-note">Discover your flirt energy. If you dare.</p>
        </div>
      </div>
    `);
  }

  function showQuestion() {
    if (step >= QUESTIONS.length) {
      showResult();
      return;
    }
    const q = QUESTIONS[step];
    const buttons = q.a.map((opt, i) =>
      `<button class="btn-answer" onclick="TEAZR.answer(${i})">${opt}</button>`
    ).join('');
    const banner = challengeBannerData ? `
      <div class="challenge-banner">
        ${challengeBannerData.sharerName ? challengeBannerData.sharerName + ' got' : 'Someone got'}: ${challengeBannerData.flirtLabel} / ${challengeBannerData.mysteryLabel} / ${challengeBannerData.replyRiskLabel} — can you beat it?
      </div>
    ` : '';
    render(`
      ${banner}
      <p class="quiz-counter">${step + 1} / 6</p>
      <p class="quiz-question">${q.q}</p>
      <div class="quiz-answers">${buttons}</div>
    `);
  }

  function answer(idx) {
    answers.push(idx);
    step++;
    showQuestion();
  }

  function computeResult() {
    const aCount = answers.filter(i => i === 0).length;
    let base = 0;
    answers.forEach((idx) => {
      if (idx === 0) base += 18;
      else if (idx === 1) base += 11;
      else base += 5;
    });
    base = Math.round((base / 102) * 88) + 8;

    const rand = () => (Math.random() * 6) - 3;
    let flirt = Math.round(base + rand());
    flirt = Math.max(0, Math.min(100, flirt));

    if (aCount >= 5 && base >= 85 && Math.random() < 0.025) {
      flirt = Math.min(100, 95 + Math.floor(Math.random() * 6));
    }

    const mysteryBase = 100 - flirt;
    const mysteryRand = (Math.random() * 12) - 6;
    let mystery = Math.round(mysteryBase + mysteryRand);
    mystery = Math.max(0, Math.min(100, mystery));

    let replyRisk = Math.round(flirt * 0.6 + mystery * 0.2 + (Math.random() * 20 - 10));
    replyRisk = Math.max(0, Math.min(100, replyRisk));

    return { flirt, mystery, replyRisk };
  }

  function getSanitizedShareName(val) {
    const s = sanitizeName(typeof val === 'string' ? val : '');
    return s.length > 0 ? s : null;
  }

  function updateShareName(raw) {
    shareName = getSanitizedShareName(raw) || '';
    if (lastResultData) {
      lastShareUrl = makeShareUrl(lastResultData, shareName || null);
    }
  }

  function renderResultScreen(data, fromQuiz) {
    const flirtLabel = labelForScore(data.flirt, FLIRT_LABELS);
    const mysteryLabel = labelForScore(data.mystery, MYSTERY_LABELS);
    const replyRiskLabel = labelForScore(data.replyRisk, REPLY_RISK_LABELS);
    const oneLiner = getOneLiner(data.flirt, data.mystery, data.replyRisk);

    shareName = '';
    lastShareUrl = makeShareUrl(data);
    lastResultData = { ...data, flirtLabel, mysteryLabel, replyRiskLabel, oneLiner };

    render(`
      <div class="result-container">
        <div class="screenshot-card">
          <h2 class="result-wordmark">TEAZR</h2>
          <div class="result-scores">
            <p class="result-line">Flirt Energy: ${data.flirt} — ${flirtLabel}</p>
            <p class="result-line">Mystery Level: ${data.mystery} — ${mysteryLabel}</p>
            <p class="result-line">Reply Risk: ${data.replyRisk} — ${replyRiskLabel}</p>
          </div>
          <hr class="result-oneliner-divider" />
          <p class="result-oneliner">${oneLiner}</p>
          <p class="result-footer">Try yours: teazr.app</p>
        </div>
        <p class="screenshot-title">Screenshot & share</p>
        <p class="screenshot-sub">Post it or send it to someone 😉</p>
        <div class="result-actions">
          <div class="share-name-row">
            <label class="share-name-label" for="teazr-name-input">Your name (optional)</label>
            <input type="text" id="teazr-name-input" placeholder="e.g., Bruno" maxlength="20"
                   oninput="TEAZR.updateShareName(this.value)" />
          </div>
          <button class="btn-primary" id="btn-whatsapp" onclick="TEAZR.shareWhatsApp()">Share on WhatsApp</button>
          <button class="btn-secondary" id="btn-copy" onclick="TEAZR.copyLink()">Copy link</button>
          <button class="btn-tertiary" onclick="TEAZR.restart()">Try again</button>
        </div>
      </div>
    `);
  }

  function showResult() {
    const data = computeResult();
    setCooldown();
    sendEvent('quiz_completed', { quiz_version: QUIZ_VERSION });
    renderResultScreen(data, true);
    const shareUrl = makeShareUrl(data);
    if (window.history && window.history.replaceState) {
      window.history.replaceState({ teazr: true }, '', shareUrl);
    }
  }

  function copyLink() {
    if (!lastResultData) return;
    const input = document.getElementById('teazr-name-input');
    const name = input ? getSanitizedShareName(input.value) : null;
    const url = makeShareUrl(lastResultData, name);
    lastShareUrl = url;
    copyResultUrl(url).then(() => {
      showToast('Link copied');
      emitAnalytics('copy_link_clicked');
      sendEvent('copy_clicked', { context: 'quiz_result' });
    }).catch(() => showToast('Could not copy'));
  }

  function shareWhatsApp() {
    if (!lastResultData) return;
    const input = document.getElementById('teazr-name-input');
    const name = input ? getSanitizedShareName(input.value) : null;
    const url = makeShareUrl(lastResultData, name);
    lastShareUrl = url;
    const { flirtLabel, mysteryLabel, replyRiskLabel, oneLiner } = lastResultData;
    const shareText = name
      ? `TEAZR: ${name} got ${flirtLabel}/${mysteryLabel}/${replyRiskLabel} — "${oneLiner}" ${url}`
      : `TEAZR: ${flirtLabel}/${mysteryLabel}/${replyRiskLabel} — "${oneLiner}" ${url}`;
    const encoded = encodeURIComponent(shareText);
    window.open('https://wa.me/?text=' + encoded, '_blank', 'noopener');
    emitAnalytics('share_whatsapp_clicked');
    sendEvent('share_clicked', { context: 'whatsapp' });
  }

  const QUIZ_VERSION = '1';

  function start() {
    step = 0;
    answers = [];
    sendEvent('quiz_started', { quiz_version: QUIZ_VERSION });
    showQuestion();
  }

  function restart() {
    step = 0;
    answers = [];
    lastShareUrl = '';
    lastResultData = null;
    challengeBannerData = null;
    isShareEntry = false;
    shareName = '';
    const cleanUrl = (typeof window !== 'undefined' && window.location)
      ? (window.location.origin + (window.location.pathname || '/'))
      : SHARE_BASE + '/';
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, '', cleanUrl);
    } else {
      window.location.hash = '';
    }
    showStart();
  }

  window.TEAZR = {
    start,
    restart,
    answer,
    copyLink,
    shareWhatsApp,
    updateShareName,
    navigateToTeaze,
    navigateHome,
    setTeazeMoment,
    setTeazeStyle,
    copyTeazeMessage,
    newTeazeOptions
  };

  function isValidSeedData(data) {
    return data && typeof data.flirt === 'number' && typeof data.mystery === 'number' && typeof data.replyRisk === 'number';
  }

  function getPath() {
    const p = typeof window !== 'undefined' && window.location ? window.location.pathname || '/' : '/';
    return p.replace(/\/+$/, '') || '/';
  }

  function isTeazeRoute() {
    return getPath() === '/teaze';
  }

  function init() {
    detectSource();
    ensureBackButton();
    if (isTeazeRoute()) {
      initTeaze();
      return;
    }
    const seedData = parseSeedParam();
    if (seedData && isValidSeedData(seedData)) {
      isShareEntry = true;
      const sharerName = parseNameParam();
      challengeBannerData = {
        flirtLabel: labelForScore(seedData.flirt, FLIRT_LABELS),
        mysteryLabel: labelForScore(seedData.mystery, MYSTERY_LABELS),
        replyRiskLabel: labelForScore(seedData.replyRisk, REPLY_RISK_LABELS),
        sharerName: sharerName
      };
    }
    showStart();
  }

  if (typeof window !== 'undefined') {
    setupGlobalBackButton();
    setupTeazeClickDelegation();
    window.addEventListener('popstate', function() {
      const path = getPath();
      if (path === '/teaze') {
        try {
          if (sessionStorage.getItem('teazr_from_home') === '1' && window.history.length > 1) {
            sessionStorage.removeItem('teazr_from_home');
            window.history.back();
            return;
          }
        } catch (_) {}
        showTeazeScreen();
        ensureBackButton();
        return;
      }
      init();
      ensureBackButton();
    });
  }

  init();
  ensureBackButton();
})();
