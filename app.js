(function() {
  'use strict';

  const COOLDOWN_KEY = 'teazr_cooldown';
  const COOLDOWN_MS = 12 * 60 * 60 * 1000;

  const QUESTIONS = [
    { q: 'When you see someone you\'re attracted to, you typically…', a: ['Make direct eye contact', 'Glance and look away', 'Stay in your lane'] },
    { q: 'Your approach to getting attention is…', a: ['Bold and confident', 'Subtle hints', 'Hope they notice'] },
    { q: 'In a group, you tend to…', a: ['Own the room', 'Warm up gradually', 'Blend in'] },
    { q: 'When flirting, you prefer…', a: ['Playful teasing', 'Sweet compliments', 'Low-key vibes'] },
    { q: 'Your texting style is…', a: ['Quick wit, quick reply', 'Thoughtful, not desperate', 'When I feel like it'] },
    { q: 'When someone gives you a compliment…', a: ['Own it and volley back', 'Thank them warmly', 'Deflect or downplay'] }
  ];

  const LABELS = {
    elite: { title: 'Elite', tagline: 'Legendary energy. They already know.' },
    high: { title: 'High Voltage', tagline: 'Magnetic. Irresistible pull.' },
    strong: { title: 'Magnetic Presence', tagline: 'Confident waves. Hard to ignore.' },
    medium: { title: 'Warm Glow', tagline: 'Steady charm. Understated appeal.' },
    low: { title: 'Quiet Power', tagline: 'Subtle. Builds over time.' }
  };

  let step = 0;
  let answers = [];
  let lastShareUrl = '';

  function render(html) {
    document.getElementById('app').innerHTML = html;
  }

  function encodeToken(data) {
    const str = JSON.stringify(data);
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_');
  }

  function decodeToken(token) {
    try {
      const s = token.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(s));
    } catch (_) { return null; }
  }

  function getResultUrl(token) {
    const base = window.location.href.split('#')[0];
    return base + '#/r/' + token;
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
    const remaining = getCooldownRemaining();
    if (remaining > 0) {
      const msg = formatCooldown(remaining);
      render(`
        <h1 class="start-title">TEAZR</h1>
        <p class="cooldown-msg">Your vibe needs time to recharge. Try again in ${msg}.</p>
        <p class="footer">Made for fun.</p>
      `);
      return;
    }
    render(`
      <h1 class="start-title">TEAZR</h1>
      <button class="btn-start" onclick="TEAZR.start()">START</button>
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
    render(`
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
    let energy = Math.round(base + rand());
    energy = Math.max(0, Math.min(100, energy));

    if (aCount >= 5 && base >= 85 && Math.random() < 0.025) {
      energy = Math.min(100, 95 + Math.floor(Math.random() * 6));
    }

    const mysteryBase = 100 - energy;
    const mysteryRand = (Math.random() * 12) - 6;
    let mystery = Math.round(mysteryBase + mysteryRand);
    mystery = Math.max(0, Math.min(100, mystery));

    let replyRisk = 'Low';
    if (energy >= 75) replyRisk = 'High';
    else if (energy >= 50) replyRisk = 'Medium';

    let labelKey = 'low';
    if (energy >= 95) labelKey = 'elite';
    else if (energy >= 80) labelKey = 'high';
    else if (energy >= 65) labelKey = 'strong';
    else if (energy >= 45) labelKey = 'medium';

    return { energy, mystery, replyRisk, labelKey };
  }

  function renderResultScreen(data, fromQuiz) {
    const { energy, mystery, replyRisk, labelKey } = data;
    const l = LABELS[labelKey];
    lastShareUrl = getResultUrl(encodeToken(data));

    render(`
      <div class="result-section">
        <p class="result-label">Flirt Energy</p>
        <p class="result-value accent">${energy}</p>
        <p class="result-title">${l.title}</p>
        <p class="result-tagline">${l.tagline}</p>
      </div>
      <div class="result-divider"></div>
      <div class="result-section">
        <p class="result-label">Mystery</p>
        <p class="result-value">${mystery}</p>
      </div>
      <div class="result-divider"></div>
      <div class="result-section">
        <p class="result-label">Reply Risk</p>
        <p class="result-value">${replyRisk}</p>
      </div>
      <div class="result-actions">
        <button class="btn-share-sm" id="btn-copy" onclick="TEAZR.copyLink()">COPY LINK</button>
        <button class="btn-share-sm" id="btn-share" onclick="TEAZR.shareResult()">SHARE</button>
      </div>
      ${fromQuiz ? '<button class="btn-retry" onclick="TEAZR.restart()">TRY AGAIN</button>' : '<a href="#" class="btn-retry" onclick="TEAZR.restart(); return false;">TAKE QUIZ</a>'}
      <p class="footer">Made for fun.</p>
    `);
  }

  function showResult() {
    const data = computeResult();
    setCooldown();
    renderResultScreen(data, true);
  }

  function copyLink() {
    if (!lastShareUrl) return;
    copyResultUrl(lastShareUrl).then(() => {
      const btn = document.getElementById('btn-copy');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = 'COPIED';
        btn.disabled = true;
        setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1000);
      }
    });
  }

  function shareResult() {
    if (!lastShareUrl) return;
    if (navigator.share) {
      navigator.share({
        title: 'TEAZR',
        text: 'Check out my flirt energy result!',
        url: lastShareUrl
      }).catch(() => {
        copyResultUrl(lastShareUrl).then(() => {
          const btn = document.getElementById('btn-share');
          if (btn) { btn.textContent = 'LINK COPIED'; btn.disabled = true; setTimeout(() => { btn.textContent = 'SHARE'; btn.disabled = false; }, 1500); }
        });
      });
    } else {
      copyResultUrl(lastShareUrl).then(() => {
        const btn = document.getElementById('btn-share');
        if (btn) {
          const orig = btn.textContent;
          btn.textContent = 'LINK COPIED';
          btn.disabled = true;
          setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1500);
        }
      });
    }
  }

  function start() {
    step = 0;
    answers = [];
    showQuestion();
  }

  function restart() {
    step = 0;
    answers = [];
    window.location.hash = '';
    showStart();
  }

  window.TEAZR = {
    start,
    restart,
    answer,
    copyLink,
    shareResult
  };

  function init() {
    const hash = (window.location.hash || '').replace(/^#/, '');
    const m = hash.match(/^\/r\/(.+)$/);
    if (m) {
      const data = decodeToken(m[1]);
      if (data && data.energy != null && data.mystery != null && data.replyRisk && data.labelKey && LABELS[data.labelKey]) {
        renderResultScreen(data, false);
        return;
      }
    }
    showStart();
  }

  init();
})();
