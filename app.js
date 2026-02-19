(function() {
  'use strict';

  const COOLDOWN_KEY = 'teazr_cooldown';
  const COOLDOWN_MS = 5 * 60 * 1000;
  const SHARE_BASE = 'https://teazr.app';

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

  function showStart() {
    if (!isShareEntry) challengeBannerData = null;
    if (isShareEntry) {
      render(`
        <div class="start-screen">
          <h1 class="start-title">TEAZR</h1>
          <p class="start-tagline">Discover your flirt energy</p>
          <p class="start-sub">If you dare.</p>
          <button class="btn-start" onclick="TEAZR.start()">START</button>
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
          <p class="start-tagline">Discover your flirt energy</p>
          <p class="start-sub">If you dare.</p>
          <p class="cooldown-msg">Your vibe needs time to recharge. Try again in ${msg}.</p>
          <p class="footer">Made for fun.</p>
        </div>
      `);
      return;
    }
    render(`
      <div class="start-screen">
        <h1 class="start-title">TEAZR</h1>
        <p class="start-tagline">Discover your flirt energy</p>
        <p class="start-sub">If you dare.</p>
        <button class="btn-start" onclick="TEAZR.start()">START</button>
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
  }

  function start() {
    step = 0;
    answers = [];
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
    updateShareName
  };

  function isValidSeedData(data) {
    return data && typeof data.flirt === 'number' && typeof data.mystery === 'number' && typeof data.replyRisk === 'number';
  }

  function init() {
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

  init();
})();
