/* Scoreboard page: filters, favorites, watched */
(function () {
  'use strict';
  HC.initTheme(); HC.initNav('scores'); HC.initPrefs();
  const sel = document.getElementById('weekSel');
  const box = document.getElementById('games');
  const favGrid = document.getElementById('favGrid');
  let recaps = [];
  let highlightMap = null;
  let currentWeek = 1;
  let filter = 'all';
  let eventsCache = [];
  let weekCache = 1;
  let request = 0;
  let loading = false;
  const refresh = document.getElementById("refreshScores");
  const freshness = document.getElementById("freshness");

  function teamRow(t, color) {
    const fav = HC.getFavorites().includes(t.abbr);
    return `<div class="team-row${t.winner ? ' winner' : ''}">
      <img src="${HC.esc(t.logo || '')}" alt="${HC.esc(t.abbr)} logo" loading="lazy" onerror="this.style.visibility='hidden'">
      <div class="tname" style="color:${color}">${fav ? '★ ' : ''}${HC.esc(t.short || t.name)}
        ${t.record ? `<span data-outcome class="trec"> · ${HC.esc(t.record)}</span>` : ''}</div>
      <div data-outcome class="tscore" style="color:${color}">${t.score == null ? '' : HC.esc(t.score)}</div>
    </div>`;
  }

  function renderFavGrid() {
    const favs = HC.getFavorites();
    favGrid.innerHTML = HC.TEAMS32.map(a =>
      `<button class="${favs.includes(a) ? 'on' : ''}" data-team="${a}" aria-pressed="${favs.includes(a)}">${a}</button>`).join('');
    favGrid.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      HC.toggleFavorite(b.dataset.team);
      renderFavGrid(); render();
    }));
  }

  function cardHTML(g) {
    const c = HC.teamTextColors(g.away, g.home);
    const recap = recaps.find(r => String(r.gameId) === g.id);
    const watched = HC.isWatched(g.id);
    const highlight = g.state === 'post' ? HC.highlightLink(highlightMap, g.id) : null;
    return `<div class="game-card" style="--ga:${c.away};--gh:${c.home}" data-href="game.html?id=${g.id}&week=${weekCache}" tabindex="0" role="link"
        aria-label="${HC.esc(g.away.abbr)} at ${HC.esc(g.home.abbr)}">
      <div class="game-meta">
        <span ${g.state === 'pre' ? '' : 'data-outcome'} class="status ${HC.statusClass(g)}">${g.state === 'pre' ? 'Upcoming' : HC.esc(HC.statusLabel(g))}</span>
        <span>${HC.esc(HC.fmtDate(g.date))}</span>
      </div>
      ${teamRow({ ...g.away, score: g.state === 'pre' ? null : g.away.score }, c.away)}${teamRow({ ...g.home, score: g.state === 'pre' ? null : g.home.score }, c.home)}
      <div class="card-foot">
        ${recap ? `<span data-outcome class="chip"><span class="verdict ${HC.esc(recap.verdict)}" style="margin:0">${HC.esc(String(recap.verdict).replace(/-/g, ' '))}</span></span>` : ''}
        <button class="chip watched-toggle" data-id="${g.id}">${watched ? '✓ Watched' : 'Mark watched'}</button>
        <span class="card-actions">
          <a class="chip" href="game.html?id=${HC.esc(g.id)}&week=${weekCache}">View game →</a>
          ${highlight ? `<a class="chip highlight-link" href="${HC.esc(highlight.url)}" target="_blank" rel="noopener noreferrer" aria-label="View Highlights on ${HC.esc(highlight.source)} for ${HC.esc(g.away.abbr)} at ${HC.esc(g.home.abbr)}">View Highlights</a>` : ''}
        </span>
      </div>
    </div>`;
  }

  function render() {
    if (loading) return;
    let evs = eventsCache;
    const favs = HC.getFavorites();
    if (filter === 'favorites') evs = evs.filter(ev => {
      const g = HC.gameInfo(ev);
      return favs.includes(g.away.abbr) || favs.includes(g.home.abbr);
    });
    if (filter === 'unwatched') evs = evs.filter(ev => !HC.isWatched(String(ev.id)));
    const watchedCount = eventsCache.filter(ev => HC.isWatched(String(ev.id))).length;
    let html = `<p class="page-sub">${watchedCount} of ${eventsCache.length} watched</p>`;
    let lastDay = '';
    html += evs.slice().sort((a, b) => new Date(a.date) - new Date(b.date)).map(ev => {
      const g = HC.gameInfo(ev);
      const date = new Date(g.date);
      const day = Number.isNaN(date.getTime()) ? 'Date to be announced' : new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(date);
      const heading = day === lastDay ? '' : `<h2 class="day-heading">${HC.esc(day)}</h2>`;
      lastDay = day;
      return heading + cardHTML(g);
    }).join('') ||
      `<div class="empty">${filter === 'favorites' && !favs.length
        ? 'Pick some favorite teams above to filter the board.'
        : 'No games match this filter.'}</div>`;
    box.innerHTML = html;
    HC.contentReady(box);
    box.querySelectorAll('.game-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('button, a')) return;
        location.href = card.dataset.href;
      });
      card.addEventListener('keydown', e => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('button, a')) {
          e.preventDefault(); location.href = card.dataset.href;
        }
      });
    });
    box.querySelectorAll('.watched-toggle').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const on = HC.toggleWatched(b.dataset.id);
      b.textContent = on ? '✓ Watched' : 'Mark watched';
      render();
    }));
  }

  async function load(quiet = false) {
    const token = ++request;
    const week = parseInt(sel.value, 10) || currentWeek;
    weekCache = week;
    loading = true;
    if (!quiet) {
      refresh.disabled = true;
      box.innerHTML = HC.skeletons(4);
    }
    freshness.textContent = quiet ? 'Checking for live updates…' : 'Updating scores…';
    try {
      const [sb, links] = await Promise.all([
        HC.scoreboard(week),
        HC.fetchJSON('data/highlights.json').catch(() => null)
      ]);
      if (token !== request) return;
      eventsCache = sb.events || [];
      highlightMap = links;
      loading = false;
      render();
      freshness.textContent = navigator.onLine
        ? 'Updated ' + new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date())
        : 'Offline — showing a saved response';
    } catch (e) {
      if (token !== request) return;
      loading = false;
      if (quiet && eventsCache.length) {
        freshness.textContent = 'Couldn’t refresh — showing the last update';
      } else {
        eventsCache = [];
        freshness.textContent = navigator.onLine ? 'Scores unavailable' : 'You’re offline';
        box.innerHTML = '<div class="error"><p>Couldn’t load scores. Try again when you’re connected.</p><button class="btn btn-ghost" id="retryScores">Try again</button></div>';
        document.getElementById('retryScores').addEventListener('click', load);
      }
    } finally { if (token === request && !quiet) refresh.disabled = false; }
  }
  refresh.addEventListener('click', load);
  document.addEventListener('hc:theme', render);
  document.addEventListener('hc:spoilers', render);

  document.querySelectorAll('#filterRow button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#filterRow button').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); filter = b.dataset.f;
    document.querySelectorAll('#filterRow button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); render();
  }));

  (async function init() {
    try { recaps = await HC.fetchJSON('data/recaps.json'); } catch (e) { recaps = []; }
    currentWeek = await HC.weekOptions(sel);
    document.querySelectorAll("#filterRow button").forEach(b => b.setAttribute("aria-pressed", String(b.classList.contains("active"))));
    sel.addEventListener('change', load);
    renderFavGrid();
    load();
    HC.startVisiblePolling(() => load(true));
  })();
})();
