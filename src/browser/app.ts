/* Highlight Corner — shared core: theme, data helpers, team colors, formatting */
(function () {
  'use strict';
  const HC = window.HC = {} as HCAPI;

  /* Shared app chrome is present before page scripts initialize preferences. */
  const dialog = document.createElement('dialog');
  dialog.id = 'settingsDialog';
  dialog.setAttribute('aria-labelledby', 'settingsTitle');
  dialog.innerHTML = `<div class="flex items-center justify-between gap-3">
    <div><p class="eyebrow">YOUR GAME DAY</p><h2 id="settingsTitle">Make it yours</h2></div>
    <button class="icon-button" id="closeSettings" aria-label="Close settings"><img src="icons/ui/x.svg" alt="" width="22" height="22"></button>
    </div>
    <div class="settings-row flex items-center justify-between gap-4"><div><strong>Appearance</strong><p>Switch between light and dark.</p></div><button class="theme-toggle">Theme</button></div>
    <div class="settings-row flex items-center justify-between gap-4"><div><strong>Hide spoilers</strong><p>Hide scores, outcomes, recaps, and stats.</p></div><button class="spoiler-toggle" aria-pressed="false">Off</button></div>
    <div class="settings-install"><h3>Game day, one tap away</h3><p>Add Highlight Corner to your home screen for quick access.</p>
    <button class="btn btn-primary install-action flex items-center justify-center gap-2"><img src="icons/ui/download.svg" alt="" width="18" height="18">Add to Home Screen</button>
    <div id="installHelp" class="install-help" tabindex="-1"><p><strong>iPhone / iPad</strong><br>Open this site in Safari. Open the Share menu, tap Add to Home Screen, then Add. Keep Open as Web App on if shown.</p><p><strong>Android</strong><br>Open your browser’s menu and choose Install app or Add to Home screen. If you’re in another app’s browser, open this site in Chrome first.</p></div>
    </div><a class="settings-privacy" href="privacy.html">Privacy &amp; data sources →</a>`;
  document.body.appendChild(dialog);
  document.querySelectorAll('.settings-toggle').forEach(b => b.addEventListener('click', () => dialog.showModal()));
  document.getElementById('closeSettings')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) dialog.close();
  }});
  const promo = document.createElement('aside');
  promo.id = 'installPromo'; promo.className = 'install-promo'; promo.hidden = true;
  promo.setAttribute('aria-label', 'Add Highlight Corner to your home screen');
  promo.innerHTML = `<div class="flex items-start justify-between gap-3"><div><p class="eyebrow">YOUR HOME-SCREEN HUDDLE</p><h2>Keep game day close.</h2><p>Scores, highlights, and recaps. One tap away.</p></div><button class="icon-button" id="dismissInstall" aria-label="Dismiss home-screen suggestion"><img src="icons/ui/x.svg" alt="" width="20" height="20"></button></div><button class="btn btn-primary install-action" id="installPromoAction">Add to Home Screen</button>`;
  document.querySelector('main')!.appendChild(promo);

  /* ---------- theme ---------- */
  const root = document.documentElement;
  function currentTheme() {
    return root.getAttribute('data-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  function applyTheme(t: string) {
    root.setAttribute('data-theme', t);
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = t === 'dark' ? '#0e1013' : '#f6f7f9';
    try { localStorage.setItem('hc-theme', t); } catch (e) {}
    document.querySelectorAll('.theme-toggle').forEach(b => {
      b.textContent = t === 'dark' ? 'Dark' : 'Light';
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
    document.querySelectorAll<HTMLElement>('nav a[data-page]').forEach(a => {
      const on = a.dataset.page === active;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    const params = new URLSearchParams(location.search);
    const season = Number(params.get('season'));
    const week = Number(params.get('week'));
    if (Number.isInteger(season) && season >= 2026 && season <= 2100 &&
        Number.isInteger(week) && week >= 1 && week <= 18) HC.setContext(season, week);
  };

  /* ---------- fetch ---------- */
  HC.fetchJSON = async function (url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const r = await fetch(url, { signal: controller.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
      return await r.json();
    } finally { clearTimeout(timeout); }
  };

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
  HC.fetchRecaps = async () => {
    const value = await HC.fetchJSON('data/recaps.json');
    if (!Array.isArray(value)) throw new Error('Invalid recap archive');
    return value.filter((recap): recap is Recap => isRecord(recap) &&
      typeof recap.gameId === 'string' && typeof recap.season === 'number' &&
      typeof recap.week === 'number' && typeof recap.away === 'string' &&
      typeof recap.home === 'string' && typeof recap.awayScore === 'number' &&
      typeof recap.homeScore === 'number' && typeof recap.headline === 'string' &&
      typeof recap.recap === 'string' && typeof recap.keyStat === 'string' &&
      ['nail-biter', 'comfortable', 'garbage-time', 'blowout'].includes(String(recap.verdict)));
  };

  /* Poll live data only while the page is in front, without overlapping requests. */
  HC.startVisiblePolling = function (callback, interval = 60000) {
    let timer: number | null = null;
    let running = false;
    let stopped = false;
    const clear = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };
    const schedule = () => {
      clear();
      if (!stopped && document.visibilityState !== 'hidden') {
        timer = window.setTimeout(run, interval);
      }
    };
    const run = async () => {
      clear();
      if (stopped || running || document.visibilityState === 'hidden') return;
      running = true;
      try { await callback(); }
      catch (e) { /* A failed update must not stop future polling or reject a timer callback. */ }
      finally {
        running = false;
        schedule();
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') clear();
      else run();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    schedule();
    return () => {
      stopped = true;
      clear();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  };

  /* ---------- ESPN ---------- */
  const SB = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
  HC.scoreboard = async (week, season) => {
    let url = week ? `${SB}?week=${week}` : SB;
    if (season) {
      const query = new URLSearchParams({ dates: String(season), seasontype: '2' });
      if (week) query.set('week', String(week));
      url = `${SB}?${query}`;
    }
    const raw = await HC.fetchJSON(url);
    if (!isRecord(raw) || (raw.events != null && (!Array.isArray(raw.events) || !raw.events.every(isRecord))))
      throw new Error('Invalid ESPN scoreboard');
    const data = raw as unknown as ESPNScoreboard;
    if (season && data.season && (Number(data.season.year) !== Number(season) || Number(data.season.type) !== 2)) {
      throw new Error('ESPN season mismatch');
    }
    return data;
  };
  HC.gameSummary = async (id) => {
    const data = await HC.fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${id}`);
    if (!isRecord(data)) throw new Error('Invalid ESPN game summary');
    return data as unknown as ESPNGameSummary;
  };

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
        record: away.records?.[0]?.summary || '',
        color: (away.team || {}).color, altColor: (away.team || {}).alternateColor,
        logo: (away.team || {}).logo
      },
      home: {
        abbr: (home.team || {}).abbreviation || '',
        name: (home.team || {}).displayName || '',
        short: (home.team || {}).shortDisplayName || '',
        score: home.score, winner: home.winner === true,
        record: home.records?.[0]?.summary || '',
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

  /* ---------- Automatically matched official highlight links ---------- */
  HC.highlightLink = (map, id) => {
    const link = map && map.version === 1 && map.games && map.games[String(id)];
    if (!link || typeof link.url !== 'string') return null;
    const age = Date.now() - Date.parse(link.verifiedAt);
    if (!Number.isFinite(age) || age < -300000 || age > 30 * 86400000) return null;
    try {
      const url = new URL(link.url);
      if (url.protocol !== 'https:' || url.username || url.password) return null;
      if (link.source === 'YouTube' && link.channelId === 'UCDVYQ4Zhbm3S2dlz7P1GBDg' &&
          url.hostname === 'www.youtube.com' && url.pathname === '/watch' &&
          /^[A-Za-z0-9_-]{11}$/.test(url.searchParams.get('v') || '')) {
        return { url: url.href, source: 'YouTube' };
      }
      if (link.source === 'NFL.com' && url.hostname === 'www.nfl.com' &&
          /^\/videos\/[^/]+$/.test(url.pathname)) return { url: url.href, source: 'NFL.com' };
    } catch (e) {}
    return null;
  };

  HC.highlightPending = (map, completed) => !completed
    ? 'Highlights available after the game'
    : !map || map.status !== 'ready'
      ? 'Official highlight links temporarily unavailable'
      : 'Official highlights not available yet';

  /* ---------- team colors: logo-based, readable, matchup-aware ---------- */
  type RGB = [number, number, number];
  function hexToRgb(h: string | undefined): RGB | null {
    h = String(h || '').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    if (isNaN(n) || h.length !== 6) return null;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function relLum([r, g, b]: RGB) {
    const f = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  function contrast(rgb1: RGB, rgb2: RGB) {
    const l1 = relLum(rgb1), l2 = relLum(rgb2);
    const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
    return (hi + 0.05) / (lo + 0.05);
  }
  function rgbStr([r, g, b]: RGB) { return `rgb(${r},${g},${b})`; }
  function colorDist(a: RGB, b: RGB) {
    return Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2);
  }
  // nudge a color toward better contrast with bg without leaving its hue family
  function ensureContrast(fg: RGB, bg: RGB, minRatio: number): RGB {
    if (contrast(fg, bg) >= minRatio) return fg;
    const target: RGB = relLum(bg) > 0.5 ? [0, 0, 0] : [255, 255, 255];
    let best = fg, bestR = contrast(fg, bg);
    for (let i = 1; i <= 10; i++) {
      const t = i / 10;
      const mix = fg.map((c, k) => Math.round(c + (target[k] - c) * t)) as RGB;
      const r = contrast(mix, bg);
      if (r > bestR) { bestR = r; best = mix; }
      if (r >= minRatio) return mix;
    }
    return best;
  }

  HC.teamTextColors = function (away, home) {
    const dark = HC.theme() === 'dark';
    const bg: RGB = dark ? [23, 26, 32] : [255, 255, 255];
    function pick(team: { color?: string; altColor?: string }): RGB {
      const cands = [team.color, team.altColor].map(hexToRgb).filter((rgb): rgb is RGB => rgb !== null);
      if (!cands.length) return dark ? [255, 255, 255] : [20, 22, 26];
      cands.sort((a, b) => contrast(b, bg) - contrast(a, bg));
      return ensureContrast(cands[0], bg, 4.5);
    }
    let ca = pick(away), ch = pick(home);
    // matchup-aware: if the two colors look too similar, move one toward its alternate
    if (colorDist(ca, ch) < 95) {
      const altB = [home.altColor, home.color].map(hexToRgb).filter((rgb): rgb is RGB => rgb !== null)
        .map(c => ensureContrast(c, bg, 4.5))
        .sort((a, b) => colorDist(ca, b) - colorDist(ca, a))[0];
      if (altB && colorDist(ca, altB) > colorDist(ca, ch)) ch = altB;
      else {
        const altA = [away.altColor, away.color].map(hexToRgb).filter((rgb): rgb is RGB => rgb !== null)
          .map(c => ensureContrast(c, bg, 4.5))
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
    let cur = selectedWeek || 1;
    let verified = false;
    try {
      const sb = await HC.scoreboard();
      if (sb.week?.number && Number.isInteger(sb.week.number) && sb.week.number > 0) { cur = sb.week.number; verified = true; }
    } catch (e) {}
    selectEl.innerHTML = '';
    for (let w = 1; w <= cur; w++) {
      const o = document.createElement('option');
      o.value = String(w); o.textContent = 'Week ' + w + (w === cur ? (verified ? ' (current)' : ' (unverified)') : '');
      if (w === (selectedWeek && selectedWeek <= cur ? selectedWeek : cur)) o.selected = true;
      selectEl.appendChild(o);
    }
    return cur;
  };

  /* One regular-season context shared by scores, highlights, fantasy and game links. */
  HC.context = null!;
  HC.gameURL = (id, context = HC.context) => {
    const value = String(id);
    if (/^[0-9]+$/.test(value) && Number(window.HC_GAME_PAGES?.[value]) === Number(context?.season)) {
      return `game-${value}.html`;
    }
    const query = new URLSearchParams({ id: String(id) });
    if (context?.season) query.set('season', String(context.season));
    if (context?.week) query.set('week', String(context.week));
    return `game.html?${query}`;
  };
  HC.setContext = function (season, week, verified = true) {
    HC.context = { season: Number(season), week: Number(week), verified };
    document.querySelectorAll('nav a[data-page], a.brand, a.back-link[href^="index.html"]').forEach(link => {
      const url = new URL(link.getAttribute('href') || '', location.href);
      url.searchParams.set('season', String(season));
      url.searchParams.set('week', String(week));
      link.setAttribute('href', url.pathname.split('/').pop() + url.search);
    });
    if (location.pathname.endsWith('.html') && !location.pathname.endsWith('recaps.html') &&
        !/\/game-[0-9]+\.html$/.test(location.pathname)) {
      const url = new URL(location.href);
      url.searchParams.set('season', String(season));
      url.searchParams.set('week', String(week));
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
    return HC.context;
  };
  HC.selectSeasonWeek = function (seasonEl, weekEl, requestedWeek) {
    const info = HC.seasonWindow;
    const season = Number(seasonEl.value);
    const latest = season < info.providerSeason ? 18 : info.currentWeek;
    const wanted = Number(requestedWeek);
    const week = Number.isInteger(wanted) && wanted >= 1 && wanted <= latest ? wanted : latest;
    weekEl.innerHTML = '';
    for (let n = 1; n <= latest; n++) {
      const option = document.createElement('option');
      option.value = String(n);
      option.textContent = `Week ${n}`;
      if (n === latest && season === info.providerSeason) {
        option.textContent += info.phase === 'upcoming' ? ' (upcoming)' :
          info.phase === 'last' ? ' (last regular week)' :
          info.verified ? ' (current)' : ' (unverified)';
      }
      if (n === week) option.selected = true;
      weekEl.appendChild(option);
    }
    let notice = document.getElementById('contextNotice')!;
    if (!notice && weekEl.parentNode) {
      notice = document.createElement('span');
      notice.id = 'contextNotice';
      notice.className = 'context-notice';
      notice.setAttribute('role', 'status');
      weekEl.after(notice);
    }
    if (notice) {
      const requested = requestedWeek != null && String(requestedWeek) !== '' ? String(requestedWeek) : null;
      notice.textContent = requested && Number(requested) !== week
        ? `Week ${requested} is not available for the ${season} regular season. Showing Week ${week}.`
        : !info.verified ? `Season and week could not be verified. Showing Week ${week}.`
        : info.phase === 'upcoming' && season === info.providerSeason
          ? `${season} regular-season Week 1 is upcoming. Games and stats may not be available yet.` : '';
      notice.hidden = !notice.textContent;
    }
    return HC.setContext(season, week, info.verified && season <= info.providerSeason);
  };
  HC.initSeasonWeek = async function (seasonEl, weekEl) {
    let sb = null;
    try { sb = await HC.scoreboard(); } catch (e) {}
    const today = new Date();
    const fallbackYear = today.getFullYear() - (today.getMonth() < 7 ? 1 : 0);
    const reportedYear = Number(sb?.season?.year ?? sb?.leagues?.[0]?.season?.year);
    const verified = Number.isInteger(reportedYear) && reportedYear >= 2026 && reportedYear <= 2100;
    const providerSeason = verified ? reportedYear : fallbackYear;
    const type = Number(sb?.season?.type ?? sb?.leagues?.[0]?.season?.type?.type);
    const reportedWeek = Number(sb?.week?.number);
    const regularWeek = type === 2 && Number.isInteger(reportedWeek) && reportedWeek >= 1 && reportedWeek <= 18;
    const phase = type === 1 ? 'upcoming' : type === 3 || type === 4 ? 'last' : 'current';
    const currentWeek = regularWeek ? reportedWeek : phase === 'last' ? 18 : 1;
    HC.seasonWindow = { providerSeason, currentWeek, verified: verified && (regularWeek || phase !== 'current'), phase };
    seasonEl.innerHTML = '';
    const first = Math.min(2026, providerSeason);
    for (let year = first; year <= providerSeason; year++) {
      const option = document.createElement('option');
      option.value = String(year);
      option.textContent = `${year} regular season`;
      seasonEl.appendChild(option);
    }
    const params = new URLSearchParams(location.search);
    const requestedSeason = Number(params.get('season'));
    const defaultSeason = phase === 'upcoming' && providerSeason > first ? providerSeason - 1 : providerSeason;
    seasonEl.value = String(Number.isInteger(requestedSeason) && requestedSeason >= first && requestedSeason <= providerSeason ? requestedSeason : defaultSeason);
    return HC.selectSeasonWeek(seasonEl, weekEl, params.get('week'));
  };

  HC.statusClass = (g) => g.state === 'in' ? 'live' : (g.completed ? 'final' : '');
  HC.statusLabel = (g) => g.state === 'in' ? '● ' + g.statusText : g.statusText;

  /* ---------- preferences: spoiler-free, favorites, watched (localStorage) ---------- */
  const sessionPrefs: Record<string, unknown> = Object.create(null);
  const store = {
    get<T>(k: string, fb: T): T {
      const fallback = Object.hasOwn(sessionPrefs, k) ? sessionPrefs[k] : fb;
      try { const v = localStorage.getItem(k); return v == null ? fallback as T : JSON.parse(v) as T; }
      catch (e) { return fallback as T; }
    },
    set<T>(k: string, v: T) { sessionPrefs[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  HC.prefs = store;
  HC.TEAMS32 = ['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC','LV','LAC','LAR','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SF','SEA','TB','TEN','WSH'];

  HC.spoilersHidden = () => store.get<string>('hc:spoilers', 'show') === 'hide';
  HC.applySpoilers = function () {
    document.documentElement.dataset.spoilers = HC.spoilersHidden() ? 'hide' : 'show';
    document.querySelectorAll('.spoiler-toggle').forEach(b => {
      b.textContent = HC.spoilersHidden() ? 'On' : 'Off';
      b.setAttribute('aria-pressed', String(HC.spoilersHidden()));
      b.setAttribute('aria-label', 'Spoiler-free mode ' + (HC.spoilersHidden() ? 'on' : 'off'));
      b.classList.toggle('on', HC.spoilersHidden());
    });
    document.querySelectorAll<HTMLElement>('[data-outcome]').forEach(el => { el.hidden = HC.spoilersHidden(); });
    document.querySelectorAll<HTMLElement>('[data-spoiler-placeholder]').forEach(el => { el.hidden = !HC.spoilersHidden(); });
  };
  HC.initPrefs = function () {
    HC.applySpoilers();
    document.querySelectorAll('.spoiler-toggle').forEach(b =>
      b.addEventListener('click', () => {
        store.set('hc:spoilers', HC.spoilersHidden() ? 'show' : 'hide');
        HC.applySpoilers();
        document.dispatchEvent(new CustomEvent('hc:spoilers'));
      }));
  };
  HC.isWatched = (id) => (store.get<string[]>('hc:watched', []) || []).includes(String(id));
  HC.toggleWatched = (id) => {
    id = String(id);
    let w = store.get<string[]>('hc:watched', []) || [];
    w = w.includes(id) ? w.filter(x => x !== id) : [...w, id];
    store.set('hc:watched', w);
    return w.includes(id);
  };
  HC.getFavorites = () => store.get<string[]>('hc:favorites', []) || [];
  HC.toggleFavorite = (abbr) => {
    let f = HC.getFavorites();
    f = f.includes(abbr) ? f.filter(x => x !== abbr) : [...f, abbr];
    store.set('hc:favorites', f);
    return f.includes(abbr);
  };

  /* Installation is progressive: native prompt where supported, instructions elsewhere. */
  let installEvent: BeforeInstallPromptEvent | null = null;
  let installedThisSession = false;
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const installButtons = [...document.querySelectorAll<HTMLButtonElement>('.install-action')];
  function updateInstall() {
    const installed = standalone() || installedThisSession;
    installButtons.forEach(b => {
      b.hidden = installed;
      b.textContent = installEvent ? 'Install Highlight Corner' : 'Add to Home Screen';
    });
    document.getElementById('installHelp')!.hidden = installed;
    if (installed) promo.hidden = true;
  }
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); installEvent = e as BeforeInstallPromptEvent; updateInstall();
  });
  window.addEventListener('appinstalled', () => {
    installedThisSession = true; installEvent = null; installButtons.forEach(b => { b.hidden = true; });
    promo.hidden = true; document.getElementById('installHelp')!.hidden = true;
  });
  window.matchMedia('(display-mode: standalone)').addEventListener('change', updateInstall);
  installButtons.forEach(b => b.addEventListener('click', async () => {
    if (installEvent) {
      const event: BeforeInstallPromptEvent = installEvent; installEvent = null;
      installButtons.forEach(btn => { btn.disabled = true; });
      try { await event.prompt(); await event.userChoice; }
      catch (e) { if (!dialog.open) dialog.showModal(); }
      finally { installButtons.forEach(btn => { btn.disabled = false; }); updateInstall(); }
    } else {
      if (!dialog.open) dialog.showModal();
      document.getElementById('installHelp')!.focus();
    }
  }));
  document.getElementById('dismissInstall')!.addEventListener('click', () => {
    store.set('hc:install-dismissed', Date.now()); promo.hidden = true;
  });
  /* Preserve an existing keyboard target through synchronous content replacement. */
  HC.captureFocus = function (root) {
    const active = document.activeElement as HTMLElement | null;
    const key = active && root.contains(active) ? active.dataset.focusKey || active.id : null;
    return () => {
      if (!key) return;
      const next = Array.from(root.querySelectorAll<HTMLElement>('[data-focus-key], [id]'))
        .find(el => (el.dataset.focusKey || el.id) === key);
      if (next && !next.closest('[hidden]')) next.focus({ preventScroll: true });
    };
  };

  HC.initTabs = function (root) {
    root.querySelectorAll<HTMLElement>('[data-tabgroup]').forEach((group, index) => {
      const tabs = [...group.querySelectorAll<HTMLElement>('.team-tab')];
      const panes = [...group.querySelectorAll<HTMLElement>('.team-pane')];
      const prefix = `${root.id}-${group.dataset.tabgroup || `teams-${index}`}`;
      const list = group.querySelector('[role="tablist"]')!;
      const label = group.closest('details')?.querySelector('summary span')?.textContent.trim() || 'Game';
      list.setAttribute('aria-label', label + ' teams');
      const activate = (selected: HTMLElement) => {
        tabs.forEach((tab, i) => {
          const on = tab === selected;
          tab.classList.toggle('active', on);
          tab.setAttribute('aria-selected', String(on));
          tab.tabIndex = on ? 0 : -1;
          panes[i].classList.toggle('active', on);
          panes[i].hidden = !on;
        });
      };
      tabs.forEach((tab, i) => {
        tab.id = `${prefix}-tab-${i}`;
        tab.setAttribute('aria-controls', `${prefix}-panel-${i}`);
        panes[i].id = `${prefix}-panel-${i}`;
        panes[i].setAttribute('aria-labelledby', tab.id);
        panes[i].tabIndex = 0;
        tab.addEventListener('click', () => activate(tab));
        tab.addEventListener('keydown', (event: KeyboardEvent) => {
          let next;
          if (event.key === 'ArrowRight') next = (i + 1) % tabs.length;
          else if (event.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
          else if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = tabs.length - 1;
          else return;
          event.preventDefault();
          activate(tabs[next]);
          tabs[next].focus();
        });
      });
      if (tabs.length) activate(tabs.find(tab => tab.classList.contains('active')) || tabs[0]);
    });
  };

  const sortStatus = document.createElement('p');
  sortStatus.className = 'sr-only';
  sortStatus.setAttribute('role', 'status');
  sortStatus.setAttribute('aria-atomic', 'true');
  document.body.append(sortStatus);
  const tableSorts = new Map<string, { column: number; dir: number }>();
  type SortValue = string | number | number[] | null;
  const sortValue = (cell: HTMLTableCellElement, type: string): SortValue => {
    const raw = (cell.dataset.sortValue ?? cell.textContent).trim();
    if (type === 'text') return raw;
    if (type === 'clock' || /^\d+:\d{2}$/.test(raw)) {
      if (!/^\d+:\d{2}$/.test(raw)) return null;
      const parts = raw.split(':').map(Number);
      return parts[0] * 60 + parts[1];
    }
    const numbers = raw.replace(/(\d)[–-](\d)/g, '$1/$2').match(/-?\d+(?:\.\d+)?/g);
    return numbers ? numbers.map(Number) : null;
  };
  const compareValues = (a: SortValue, b: SortValue): number => {
    if (a == null) return b == null ? 0 : 1;
    if (b == null) return -1;
    if (Array.isArray(a) && Array.isArray(b)) {
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const diff = (a[i] ?? 0) - (b[i] ?? 0);
        if (diff) return diff;
      }
      return 0;
    }
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  };
  HC.sortTables = function (root) {
    root.querySelectorAll<HTMLTableElement>('table.stats[data-sort-id]').forEach(table => {
      const heads = [...table.querySelectorAll<HTMLTableCellElement>('thead th')];
      const body = table.tBodies[0];
      if (!body || !heads.length) return;
      const id = table.dataset.sortId || '';
      const rows = [...body.rows];
      rows.forEach((row, index) => { row.dataset.originalOrder = String(index); });
      const apply = () => {
        const state = tableSorts.get(id);
        heads.forEach((th, index) => {
          th.setAttribute('aria-sort', state?.column === index ? (state.dir === 1 ? 'ascending' : 'descending') : 'none');
          const button = th.querySelector('button');
          if (button) {
            const direction = state?.column === index && state.dir === 1 ? 'descending' :
              state?.column === index ? 'ascending' : th.dataset.sortType === 'text' ? 'ascending' : 'descending';
            button.setAttribute('aria-label', `${button.dataset.label}: sort ${direction}`);
          }
          const indicator = th.querySelector('.sort-ind');
          if (indicator) indicator.textContent = state?.column === index ? (state.dir === 1 ? ' ▲' : ' ▼') : '';
        });
        if (!state) return;
        const type = heads[state.column]?.dataset.sortType || 'text';
        const sorted = [...body.rows].sort((a, b) => {
          const aValue = sortValue(a.cells[state.column], type);
          const bValue = sortValue(b.cells[state.column], type);
          if (aValue == null || bValue == null) {
            if (aValue == null && bValue != null) return 1;
            if (bValue == null && aValue != null) return -1;
          }
          return compareValues(aValue, bValue) * state.dir ||
            Number(a.dataset.originalOrder) - Number(b.dataset.originalOrder);
        });
        body.append(...sorted);
      };
      heads.forEach((th, index) => {
        const label = th.textContent.trim();
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'table-sort';
        button.textContent = label;
        button.dataset.label = label;
        button.dataset.focusKey = `sort-${id}-${index}`;
        const indicator = document.createElement('span');
        indicator.className = 'sort-ind';
        indicator.setAttribute('aria-hidden', 'true');
        button.append(indicator);
        th.replaceChildren(button);
        button.addEventListener('click', () => {
          const current = tableSorts.get(id);
          const dir = current?.column === index ? -current.dir : th.dataset.sortType === 'text' ? 1 : -1;
          tableSorts.set(id, { column: index, dir });
          apply();
          const title = table.caption?.textContent.trim() || table.closest('details')?.querySelector('summary span')?.textContent.trim() || 'Statistics';
          sortStatus.textContent = `${title}: sorted by ${label}, ${dir === 1 ? 'ascending' : 'descending'}.`;
        });
      });
      if (!tableSorts.has(id) && table.dataset.sortDefault != null) {
        tableSorts.set(id, { column: Number(table.dataset.sortDefault), dir: Number(table.dataset.sortDir || -1) });
      }
      apply();
    });
  };
  HC.contentReady = function (box) {
    HC.sortTables(box);
    HC.initTabs(box);
    HC.applySpoilers();
    if (box.id === 'games' && !standalone() && !installedThisSession && Date.now() - store.get('hc:install-dismissed', 0) > 30 * 86400000) {
      const cards = box.querySelectorAll('.game-card');
      if (cards.length) { cards[Math.min(2, cards.length - 1)].after(promo); promo.hidden = false; }
    }
  };
  updateInstall();
  const offlineNotice = document.createElement('p');
  offlineNotice.className = 'spoiler-notice'; offlineNotice.setAttribute('role', 'status');
  offlineNotice.textContent = 'You’re offline. Saved pages and recaps may be available; scores and fantasy stats need a connection.';
  document.querySelector('main')!.prepend(offlineNotice);
  const updateConnection = () => { offlineNotice.hidden = navigator.onLine; };
  window.addEventListener('online', updateConnection); window.addEventListener('offline', updateConnection); updateConnection();

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
    b.addEventListener('click', () => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  })();
})();
