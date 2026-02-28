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

  const TEAZE_MOMENTS = ['START', 'KEEP_GOING', 'RECONNECT', 'FOLLOW_UP', 'CLOSE_KINDLY', 'BOUNDARY'];
  const TEAZE_MOMENTS_DISPLAY = { START: 'START', KEEP_GOING: 'KEEP GOING', RECONNECT: 'RECONNECT', FOLLOW_UP: 'FOLLOW UP', CLOSE_KINDLY: 'CLOSE KINDLY', BOUNDARY: 'BOUNDARY' };
  const TEAZE_STYLES = ['PLAYFUL', 'CLASSY'];
  const TEAZE_RECENT_MAX = 12;
  const RECENT_COPIED_MAX = 30;
  const SAVED_MAX = 60;
  const TEAZE_TAB_KEY = 'teazr_teaze_tab';
  const TEAZE_SEEDED_KEY = 'teaze_seeded';
  const APP_VERSION = '4';

  let teazeCategory = 'GENERAL';
  let teazeMoment = 'START';
  let teazeStyle = 'PLAYFUL';
  let teazeCurrentIds = [];
  let teazeSeedBannerData = null;
  let teazeActiveTab = 'TODAY';

  const QUESTIONS = [
    { q: 'YOU SEE THEM. WHAT DO YOU DO?', a: ['I TEXT FIRST.', 'I LET THEM NOTICE ME.', 'I SAY SOMETHING BOLD.'] },
    { q: 'YOUR FIRST MESSAGE STYLE?', a: ['PLAYFUL + QUICK.', 'CALM + MINIMAL.', 'CHAOS ON PURPOSE.'] },
    { q: 'THEY REPLY LATE\u2026', a: ['I KEEP IT LIGHT.', 'I GO QUIET TOO.', 'I CALL IT OUT (SOFTLY).'] },
    { q: 'YOUR MAIN WEAPON?', a: ['HUMOR.', 'SILENCE + TIMING.', 'DIRECTNESS.'] },
    { q: 'YOUR VIBE IN ONE WORD?', a: ['WARM.', 'UNREADABLE.', 'INTENSE.'] },
    { q: 'IF IT\u2019S NOT IT\u2026', a: ['KIND CLOSE.', 'CLEAN EXIT.', 'I SAY IT STRAIGHT.'] }
  ];

  const TAP_REACTIONS = ['W.', 'NOTED.', 'SAY LESS.', 'BOLD.', 'VALID.', 'DANGEROUS.', 'CLEAN.', 'OKAYYY.', 'RESPECT.', 'IYKYK.'];

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
      'Respectfully\u2026 you\'re dangerous.',
      'Chaos, but make it cute.',
      'You\'re the plot twist.',
      'Bold energy. No seatbelt.',
      'They\'re not ready for you.'
    ],
    ruleB: [
      'Unreadable. That\'s the flex.',
      'Quiet vibe. Loud impact.',
      'You move like a secret.',
      'You\'re the cliffhanger.',
      'No context. Still iconic.'
    ],
    ruleC: [
      'Clean rizz. Safe hands.',
      'Flirty but respectful\u2014W.',
      'Warm energy. Zero chaos.',
      'High charm, low stress.',
      'Green flag with rizz.'
    ],
    ruleD: [
      'Good vibes, no cringe.',
      'Soft confidence wins.',
      'Chill rizz. Real energy.',
      'Low drama. High standard.',
      'Balanced. Dangerous in silence.'
    ],
    default: [
      'Main character, low volume.',
      'Energy: controlled.',
      'You don\'t chase. You choose.',
      'You\'re the reason people overthink.',
      'Soft vibe, strong presence.'
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

  function makeShareUrl(data) {
    const shortSeed = data.flirt + '.' + data.mystery + '.' + data.replyRisk;
    return SHARE_BASE + '/?s=' + shortSeed;
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
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  let _cooldownInterval = null;
  function clearCooldownTimer() {
    if (_cooldownInterval) { clearInterval(_cooldownInterval); _cooldownInterval = null; }
  }
  function startCooldownTimer(onTick) {
    clearCooldownTimer();
    _cooldownInterval = setInterval(function() {
      const remaining = getCooldownRemaining();
      if (remaining <= 0) {
        clearCooldownTimer();
        onTick(0);
      } else {
        onTick(remaining);
      }
    }, 1000);
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

  function teazeBucketKey(moment, style) {
    return 'teazr:last12:' + String(moment).replace(/\s+/g, '_') + ':' + String(style);
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

  function pickTeazeMessages(moment, style) {
    const bucket = (typeof window.getTeazeBucket === 'function')
      ? window.getTeazeBucket('GENERAL', moment, style)
      : [];
    if (!bucket || !bucket.length) return [];

    const bk = teazeBucketKey(moment, style);
    const recentIds = getTeazeRecentIds(bk, TEAZE_RECENT_MAX);
    const recentSet = new Set(recentIds);

    const preferred = bucket.filter(function(m) { return !recentSet.has(String(m.id)); });
    let pool = preferred.length >= 3 ? preferred : bucket;

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
      m: teazeMoment,
      s: teazeStyle,
      i: teazeCurrentIds.slice(0, 3),
      l: teazeMoment + '/' + teazeStyle
    };
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
    const bk = teazeBucketKey(teazeMoment, teazeStyle);
    const bucket = (typeof window.getTeazeBucket === 'function')
      ? window.getTeazeBucket('GENERAL', teazeMoment, teazeStyle)
      : [];
    const poolSize = bucket ? bucket.length : 0;
    const seen = {};
    let uniqueCount = 0;
    let repeats = 0;
    for (let i = 0; i < 100; i++) {
      const picked = pickTeazeMessages(teazeMoment, teazeStyle);
      if (picked.length) {
        const ids = picked.map(function(m) { return m.id; });
        saveTeazeRecentIds(bk, getTeazeRecentIds(bk).concat(ids));
      }
      for (let j = 0; j < picked.length; j++) {
        const id = picked[j].id;
        if (seen[id]) repeats++;
        else { seen[id] = true; uniqueCount++; }
      }
    }
    return { bucketKey: bk, poolSize, uniqueCount, repeats };
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
      if (!TEAZE_MOMENTS.includes(momentRaw)) return null;
      const style = (data.s === 'PLAYFUL' || data.s === 'CLASSY') ? data.s : 'PLAYFUL';
      return {
        moment: momentRaw,
        style: style,
        ids: Array.isArray(data.i) ? data.i.slice(0, 3) : [],
        label: typeof data.l === 'string' ? data.l : (momentRaw + '/' + style)
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

    const bk = teazeBucketKey(teazeMoment, teazeStyle);
    const messages = pickTeazeMessages(teazeMoment, teazeStyle);
    if (!messages || messages.length === 0) {
      teazeEmptyRetries = (teazeEmptyRetries || 0) + 1;
      render(`
        <div class="teaze-screen" data-teaze-root>
          <h1 class="teaze-title">GEN Z DM LINES</h1>
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
    saveTeazeRecentIds(bk, getTeazeRecentIds(bk).concat(teazeCurrentIds));

    const momentOpts = TEAZE_MOMENTS.map(function(m) {
      const escaped = m.replace(/'/g, '&#39;');
      const label = TEAZE_MOMENTS_DISPLAY[m] || m;
      return `<button type="button" class="teaze-selector-btn ${teazeMoment === m ? 'active' : ''}" data-moment="${escaped}">${label.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</button>`;
    }).join('');
    const styleOpts = TEAZE_STYLES.map(function(s) {
      return `<button type="button" class="teaze-selector-btn ${teazeStyle === s ? 'active' : ''}" data-style="${s}">${s}</button>`;
    }).join('');

    const msgBlocks = messages.map(function(m, idx) {
      const escaped = m.text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const saved = isSaved(m.text);
      return `
        <div class="teaze-message-card teaze-card-inline" data-id="${m.id}">
          <p class="teaze-message-text">${escaped}</p>
          <button type="button" class="btn-teaze-copy-inline" data-action="copy" data-id="${m.id}" data-index="${idx}">COPY</button>
        </div>
      `;
    }).join('');

    const safetyMicrocopy = teazeMoment === 'BOUNDARY' ? '<p class="teaze-safety-microcopy">If you feel unsafe, stop replying and use platform block/report.</p>' : '';
    const bannerHtml = teazeSeedBannerData ? buildTeazeSeedBanner() : '';

    render(`
      <div class="teaze-screen" data-teaze-root>
        ${bannerHtml}
        <h1 class="teaze-title">GEN Z DM LINES</h1>
        <div class="teaze-selectors">
          <div class="teaze-selector-group">
            <label class="teaze-selector-label">Moments</label>
            <div class="teaze-selector-btns">${momentOpts}</div>
          </div>
          <div class="teaze-selector-group">
            <label class="teaze-selector-label">Styles</label>
            <div class="teaze-selector-btns">${styleOpts}</div>
          </div>
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
        <p class="teaze-category-microcopy">Gen Z DM lines. Copy/paste.</p>
        ${safetyMicrocopy}
        ${buildA2HSHint()}
        ${isQaMode() ? '<div class="teaze-qa-panel" data-qa-panel><button type="button" data-action="qa-run">Run 100 spins</button><pre id="teaze-qa-output"></pre></div>' : ''}
      </div>
    `);
  }

  function setTeazeMoment(m) {
    if (m === teazeMoment) return;
    teazeMoment = m;
    teazeCurrentIds = [];
    showTeazeScreen();
  }

  function setTeazeStyle(s) {
    if (s === teazeStyle) return;
    teazeStyle = s;
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
    const bucket = (typeof window.getTeazeBucket === 'function')
      ? window.getTeazeBucket('GENERAL', teazeMoment, teazeStyle)
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
    app.addEventListener('click', function handleTeazeClick(e) {
      if (!app.querySelector('[data-teaze-root]')) return;
      const target = e.target;
      const tabBtn = target.closest('[data-tab]');
      const momentBtn = target.closest('[data-moment]');
      const styleBtn = target.closest('[data-style]');
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
    teazeMoment = 'START';
    teazeStyle = 'PLAYFUL';
    teazeCurrentIds = [];
    teazeActiveTab = 'TODAY';
    if (seed) {
      teazeMoment = seed.moment;
      teazeStyle = seed.style || 'PLAYFUL';
    }
    sendTeazeEvent('teaze_opened', { moment: teazeMoment, style: teazeStyle });
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
    clearCooldownTimer();
    if (!isShareEntry) challengeBannerData = null;
    const remaining = isShareEntry ? 0 : getCooldownRemaining();
    const disabled = remaining > 0;
    const cdLabel = disabled ? 'Try again in ' + formatCooldown(remaining) : '';

    render(`
      <div class="start-screen">
        <h1 class="start-title">TEAZR</h1>
        <p class="start-headline">BETTER DMs — LESS OVERTHINKING.</p>
        <p class="start-subline">PICK A MOMENT. COPY A LINE. PASTE IN DM.</p>
        <div class="home-actions">
          <button type="button" class="btn-home-action${disabled ? ' btn-disabled' : ''}" id="home-quiz-btn" onclick="TEAZR.start()"${disabled ? ' disabled' : ''}>FLIRT ENERGY CHECK</button>
          ${disabled ? '<p class="home-cooldown-label" id="home-cooldown-label">' + cdLabel + '</p>' : ''}
          <a href="/teaze?v=2" class="btn-home-action" onclick="event.preventDefault();TEAZR.navigateToTeaze();">SEND A TEAZ</a>
        </div>
      </div>
    `);

    if (disabled) {
      startCooldownTimer(function(ms) {
        const btn = document.getElementById('home-quiz-btn');
        const lbl = document.getElementById('home-cooldown-label');
        if (ms <= 0) {
          if (btn) { btn.disabled = false; btn.classList.remove('btn-disabled'); }
          if (lbl) lbl.remove();
        } else {
          if (lbl) lbl.textContent = 'Try again in ' + formatCooldown(ms);
        }
      });
    }
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
        Someone got: ${challengeBannerData.flirtLabel} / ${challengeBannerData.mysteryLabel} / ${challengeBannerData.replyRiskLabel} — can you beat it?
      </div>
    ` : '';
    const progressPct = ((step) / QUESTIONS.length) * 100;
    render(`
      ${banner}
      <div class="quiz-header">
        <p class="quiz-title">FLIRT ENERGY CHECK</p>
        <p class="quiz-sub">NO CONTEXT. JUST VIBES.</p>
      </div>
      <div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:${progressPct}%"></div></div>
      <p class="quiz-counter">${step + 1} / 6</p>
      <p class="quiz-question">${q.q}</p>
      <div class="quiz-answers">${buttons}</div>
      <div id="tap-reaction" class="tap-reaction"></div>
    `);
  }

  function answer(idx) {
    answers.push(idx);
    step++;
    const reaction = TAP_REACTIONS[Math.floor(Math.random() * TAP_REACTIONS.length)];
    const el = document.getElementById('tap-reaction');
    if (el) {
      el.textContent = reaction;
      el.classList.add('tap-reaction-visible');
    }
    const btns = document.querySelectorAll('.btn-answer');
    btns.forEach(function(b) { b.disabled = true; });
    setTimeout(function() {
      showQuestion();
    }, 200);
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


  function renderResultScreen(data, fromQuiz) {
    clearCooldownTimer();
    const flirtLabel = labelForScore(data.flirt, FLIRT_LABELS);
    const mysteryLabel = labelForScore(data.mystery, MYSTERY_LABELS);
    const replyRiskLabel = labelForScore(data.replyRisk, REPLY_RISK_LABELS);
    const oneLiner = getOneLiner(data.flirt, data.mystery, data.replyRisk);

    lastShareUrl = makeShareUrl(data);
    lastResultData = { ...data, flirtLabel, mysteryLabel, replyRiskLabel, oneLiner };

    const remaining = getCooldownRemaining();
    const cdActive = remaining > 0;
    const tryAgainLabel = cdActive ? 'TRY AGAIN (' + formatCooldown(remaining) + ')' : 'Try again';

    render(`
      <div class="result-container">
        <button type="button" class="result-back-btn" onclick="TEAZR.navigateHome()" aria-label="Back to home">\u2190</button>
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
        <p class="screenshot-title">NO CONTEXT.</p>
        <p class="screenshot-sub">Just vibes.</p>
        <p class="result-gen-z-liner">${oneLiner}</p>
        <div class="result-actions">
          <button class="btn-primary" id="btn-whatsapp" onclick="TEAZR.shareWhatsApp()">Share on WhatsApp</button>
          <button class="btn-secondary" id="btn-copy" onclick="TEAZR.copyLink()">Copy link</button>
          <button class="btn-tertiary${cdActive ? ' btn-disabled' : ''}" id="btn-try-again" onclick="TEAZR.restart()"${cdActive ? ' disabled' : ''}>${tryAgainLabel}</button>
          ${cdActive ? '<p class="result-cooldown-hint">Try again in 5 min</p>' : ''}
        </div>
      </div>
    `);

    if (cdActive) {
      startCooldownTimer(function(ms) {
        const btn = document.getElementById('btn-try-again');
        const hint = document.querySelector('.result-cooldown-hint');
        if (ms <= 0) {
          if (btn) { btn.disabled = false; btn.classList.remove('btn-disabled'); btn.textContent = 'Try again'; }
          if (hint) hint.remove();
        } else {
          if (btn) btn.textContent = 'TRY AGAIN (' + formatCooldown(ms) + ')';
        }
      });
    }
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
    const url = makeShareUrl(lastResultData);
    lastShareUrl = url;
    copyResultUrl(url).then(() => {
      showToast('Link copied');
      emitAnalytics('copy_link_clicked');
      sendEvent('copy_clicked', { context: 'quiz_result' });
    }).catch(() => showToast('Could not copy'));
  }

  function shareWhatsApp() {
    if (!lastResultData) return;
    const url = makeShareUrl(lastResultData);
    lastShareUrl = url;
    const { flirtLabel, mysteryLabel, replyRiskLabel, oneLiner } = lastResultData;
    const shareText = `TEAZR: ${flirtLabel}/${mysteryLabel}/${replyRiskLabel} — "${oneLiner}" ${url}`;
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
      challengeBannerData = {
        flirtLabel: labelForScore(seedData.flirt, FLIRT_LABELS),
        mysteryLabel: labelForScore(seedData.mystery, MYSTERY_LABELS),
        replyRiskLabel: labelForScore(seedData.replyRisk, REPLY_RISK_LABELS)
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
