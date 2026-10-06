/* Highlight Corner — shared core: theme, data helpers, team colors, formatting */
(function () {
  'use strict';
  const HC = window.HC = {};

  /* ---------- theme ---------- */
  const root = document.documentElement;
  function currentTheme() {
    return root.getAttribute('data-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    try { localStorage.setItem('hc-theme', t); } catch (e) {}
    document.querySelectorAll('.theme-toggle').forEach(b => {
      b.textContent = t === 'dark' ? '☀️' : '🌙';
      b.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    });
    document.dispatchEvent(new CustomEvent('hc:theme', { detail: t }));
  }
  HC.initTheme = function () {
    let t = null;
    try { t = localStorage.getItem('hc-theme'); } catch (e) {}
    applyTheme(t || currentTheme());
    document.querySelectorAll('.theme-toggle').forEach(b =>
      b.addEventListener('click', () => applyTheme(currentTheme() === 'dark' ? 'light' : 'dark')));
  };
  HC.theme = () => currentTheme();

  /* ---------- nav ---------- */
  HC.initNav = function (active) {
    document.querySelectorAll('nav.main-nav a').forEach(a => {
      if (a.dataset.page === active) a.classList.add('active');
    });
  };

  /* ---------- fetch ---------- */
  HC.fetchJSON = async function (url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
    return r.json();
  };

  /* ---------- ESPN ---------- */
  const SB = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
  HC.scoreboard = (week) => HC.fetchJSON(week ? `${SB}?week=${week}` : SB);
  HC.gameSummary = (id) => HC.fetchJSON(
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${id}`);

  HC.gameInfo = function (event) {
    const comp = (event.competitions || [])[0] || {};
    const teams = comp.competitors || [];
    const away = teams.find(t => t.homeAway === 'away') || teams[1] || {};
    const home = teams.find(t => t.homeAway === 'home') || teams[0] || {};
    const st = event.status || {};
    const type = st.type || {};
    return {
      id: String(event.id),
      date: event.date,
      statusText: type.shortDetail || type.detail || '',
      state: type.state || '', // pre | in | post
      completed: type.completed === true,
      away: {
        abbr: (away.team || {}).abbreviation || '',
        name: (away.team || {}).displayName || '',
        short: (away.team || {}).shortDisplayName || '',
        score: away.score, winner: away.winner === true,
        record: (away.records || [])[0] ? away.records[0].summary : '',
        color: (away.team || {}).color, altColor: (away.team || {}).alternateColor,
        logo: (away.team || {}).logo
      },
      home: {
        abbr: (home.team || {}).abbreviation || '',
        name: (home.team || {}).displayName || '',
        short: (home.team || {}).shortDisplayName || '',
        score: home.score, winner: home.winner === true,
        record: (home.records || [])[0] ? home.records[0].summary : '',
        color: (home.team || {}).color, altColor: (home.team || {}).alternateColor,
        logo: (home.team || {}).logo
      }
    };
  };

  /* ---------- dates: always viewer-local, always labeled ---------- */
  HC.fmtDate = function (iso) {
    if (!iso) return '';
    try {
      return new Intl.DateTimeFormat(undefined, {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
      }).format(new Date(iso));
    } catch (e) { return iso; }
  };
  HC.fmtDateShort = function (iso) {
    if (!iso) return '';
    try {
      return new Intl.DateTimeFormat(undefined, {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
      }).format(new Date(iso));
    } catch (e) { return iso; }
  };

  /* ---------- YouTube deep links ---------- */
  HC.ytSearchURL = (week, awayAbbr, homeAbbr) =>
    'https://www.youtube.com/results?search_query=' +
    encodeURIComponent(`NFL Week ${week} ${awayAbbr} vs ${homeAbbr} highlights`);

  /* ---------- team colors: logo-based, readable, matchup-aware ---------- */
  function hexToRgb(h) {
    h = String(h || '').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    if (isNaN(n) || h.length !== 6) return null;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function relLum([r, g, b]) {
    const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  function contrast(rgb1, rgb2) {
    const l1 = relLum(rgb1), l2 = relLum(rgb2);
    const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
    return (hi + 0.05) / (lo + 0.05);
  }
  function rgbStr([r, g, b]) { return `rgb(${r},${g},${b})`; }
  function colorDist(a, b) {
    return Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2);
  }
  // nudge a color toward better contrast with bg without leaving its hue family
  function ensureContrast(fg, bg, minRatio) {
    if (contrast(fg, bg) >= minRatio) return fg;
    const target = relLum(bg) > 0.5 ? [0, 0, 0] : [255, 255, 255];
    let best = fg, bestR = contrast(fg, bg);
    for (let i = 1; i <= 10; i++) {
      const t = i / 10;
      const mix = fg.map((c, k) => Math.round(c + (target[k] - c) * t));
      const r = contrast(mix, bg);
      if (r > bestR) { bestR = r; best = mix; }
      if (r >= minRatio) return mix;
    }
    return best;
  }

  HC.teamTextColors = function (away, home) {
    const dark = HC.theme() === 'dark';
    const bg = dark ? [14, 16, 19] : [246, 247, 249];
    function pick(team) {
      const cands = [team.color, team.altColor].map(hexToRgb).filter(Boolean);
      if (!cands.length) return dark ? [255, 255, 255] : [20, 22, 26];
      cands.sort((a, b) => contrast(b, bg) - contrast(a, bg));
      return ensureContrast(cands[0], bg, 3.2);
    }
    let ca = pick(away), ch = pick(home);
    // matchup-aware: if the two colors look too similar, move one toward its alternate
    if (colorDist(ca, ch) < 95) {
      const altB = [home.altColor, home.color].map(hexToRgb).filter(Boolean)
        .map(c => ensureContrast(c, bg, 3.2))
        .sort((a, b) => colorDist(ca, b) - colorDist(ca, a))[0];
      if (altB && colorDist(ca, altB) > colorDist(ca, ch)) ch = altB;
      else {
        const altA = [away.altColor, away.color].map(hexToRgb).filter(Boolean)
          .map(c => ensureContrast(c, bg, 3.2))
          .sort((a, b) => colorDist(b, ch) - colorDist(a, ch))[0];
        if (altA && colorDist(altA, ch) > colorDist(ca, ch)) ca = altA;
      }
    }
    return { away: rgbStr(ca), home: rgbStr(ch) };
  };

  /* ---------- misc ---------- */
  HC.esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  HC.weekOptions = async function (selectEl, selectedWeek) {
    const sb = await HC.scoreboard();
    const cur = (sb.week || {}).number || 4;
    selectEl.innerHTML = '';
    for (let w = 1; w <= cur; w++) {
      const o = document.createElement('option');
      o.value = w; o.textContent = 'Week ' + w + (w === cur ? ' (current)' : '');
      if (w === (selectedWeek || cur)) o.selected = true;
      selectEl.appendChild(o);
    }
    return cur;
  };

  HC.statusClass = (g) => g.state === 'in' ? 'live' : (g.completed ? 'final' : '');
  HC.statusLabel = (g) => g.state === 'in' ? '● ' + g.statusText : g.statusText;

  /* ---------- preferences: spoiler-free, favorites, watched (localStorage) ---------- */
  const store = {
    get(k, fb) { try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch (e) { return fb; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  HC.prefs = store;
  HC.TEAMS32 = ['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC','LV','LAC','LAR','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SF','SEA','TB','TEN','WSH'];

  HC.spoilersHidden = () => store.get('hc:spoilers', 'show') === 'hide';
  HC.applySpoilers = function () {
    document.documentElement.dataset.spoilers = HC.spoilersHidden() ? 'hide' : 'show';
    document.querySelectorAll('.spoiler-toggle').forEach(b => {
      b.textContent = HC.spoilersHidden() ? '🙈' : '👁';
      b.setAttribute('aria-label', 'Spoiler-free mode ' + (HC.spoilersHidden() ? 'on' : 'off'));
      b.classList.toggle('on', HC.spoilersHidden());
    });
  };
  HC.initPrefs = function () {
    HC.applySpoilers();
    document.querySelectorAll('.spoiler-toggle').forEach(b =>
      b.addEventListener('click', () => {
        store.set('hc:spoilers', HC.spoilersHidden() ? 'show' : 'hide');
        HC.applySpoilers();
      }));
  };
  HC.isWatched = (id) => (store.get('hc:watched', []) || []).includes(String(id));
  HC.toggleWatched = (id) => {
    id = String(id);
    let w = store.get('hc:watched', []) || [];
    w = w.includes(id) ? w.filter(x => x !== id) : [...w, id];
    store.set('hc:watched', w);
    return w.includes(id);
  };
  HC.getFavorites = () => store.get('hc:favorites', []) || [];
  HC.toggleFavorite = (abbr) => {
    let f = HC.getFavorites();
    f = f.includes(abbr) ? f.filter(x => x !== abbr) : [...f, abbr];
    store.set('hc:favorites', f);
    return f.includes(abbr);
  };

  /* ---------- PWA: register the service worker ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
  /* ---------- UX helpers: skeletons, copy-link, scroll-to-top ---------- */
  HC.skeletons = function (n, rows) {
    n = n || 4; rows = rows || 2;
    let h = '';
    for (let i = 0; i < n; i++) {
      h += '<div class="skel-card" aria-hidden="true"><div class="skel" style="height:14px;width:45%;margin-bottom:6px"></div>';
      for (let r = 0; r < rows; r++) {
        h += '<div class="skel-row"><div class="skel" style="height:34px;width:34px;border-radius:50%;flex:0 0 auto"></div>' +
          '<div class="skel" style="height:16px;flex:1"></div><div class="skel" style="height:20px;width:52px;flex:0 0 auto"></div></div>';
      }
      h += '<div class="skel" style="height:38px;margin-top:12px"></div></div>';
    }
    return h;
  };

  HC.copyLink = async function (text, btn) {
    const done = () => {
      if (!btn) return;
      const orig = btn.textContent;
      btn.textContent = 'Copied ✓'; btn.disabled = true;
      setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1400);
    };
    try { await navigator.clipboard.writeText(text); done(); }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (_) {}
      ta.remove();
    }
  };

  (function initScrollTop() {
    const b = document.createElement('button');
    b.id = 'toTop'; b.textContent = '↑'; b.setAttribute('aria-label', 'Back to top');
    document.body.appendChild(b);
    window.addEventListener('scroll', () => b.classList.toggle('show', window.scrollY > 600), { passive: true });
    b.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  })();
})();
