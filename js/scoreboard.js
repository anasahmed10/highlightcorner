/* Scoreboard page: filters, favorites, watched */
(function () {
  'use strict';
  HC.initTheme(); HC.initNav('scores'); HC.initPrefs();
  const sel = document.getElementById('weekSel');
  const box = document.getElementById('games');
  const favGrid = document.getElementById('favGrid');
  let recaps = [];
  let currentWeek = 4;
  let filter = 'all';
  let eventsCache = [];
  let weekCache = 4;

  function teamRow(t, color) {
    const fav = HC.getFavorites().includes(t.abbr);
    return `<div class="team-row${t.winner ? ' winner' : ''}">
      <img src="${HC.esc(t.logo || '')}" alt="${HC.esc(t.abbr)} logo" loading="lazy" onerror="this.style.visibility='hidden'">
      <div class="tname" style="color:${color}">${fav ? '★ ' : ''}${HC.esc(t.short || t.name)}
        ${t.record ? `<span class="trec"> · ${HC.esc(t.record)}</span>` : ''}</div>
      <div class="tscore" style="color:${color}">${t.score == null ? '' : HC.esc(t.score)}</div>
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
    return `<div class="game-card" style="--ga:${c.away};--gh:${c.home}" data-href="game.html?id=${g.id}&week=${weekCache}" tabindex="0" role="link"
        aria-label="${HC.esc(g.away.abbr)} at ${HC.esc(g.home.abbr)}, ${HC.esc(g.statusText)}">
      <div class="game-meta">
        <span class="status ${HC.statusClass(g)}">${HC.esc(HC.statusLabel(g))}</span>
        <span>${HC.esc(HC.fmtDate(g.date))}</span>
      </div>
      ${teamRow(g.away, c.away)}${teamRow(g.home, c.home)}
      <div class="card-foot">
        ${recap ? `<span class="chip"><span class="verdict ${HC.esc(recap.verdict)}" style="margin:0">${HC.esc(String(recap.verdict).replace(/-/g, ' '))}</span></span>` : ''}
        <button class="chip watched-toggle" data-id="${g.id}">${watched ? '✓ Watched' : 'Mark watched'}</button>
        <span class="chip">Box score →</span>
      </div>
    </div>`;
  }

  function render() {
    let evs = eventsCache;
    const favs = HC.getFavorites();
    if (filter === 'favorites') evs = evs.filter(ev => {
      const g = HC.gameInfo(ev);
      return favs.includes(g.away.abbr) || favs.includes(g.home.abbr);
    });
    if (filter === 'unwatched') evs = evs.filter(ev => !HC.isWatched(String(ev.id)));
    const watchedCount = eventsCache.filter(ev => HC.isWatched(String(ev.id))).length;
    let html = `<p class="page-sub">${watchedCount} of ${eventsCache.length} watched</p>`;
    html += evs.map(ev => cardHTML(HC.gameInfo(ev))).join('') ||
      `<div class="empty">${filter === 'favorites' && !favs.length
        ? 'Pick some favorite teams above to filter the board.'
        : 'No games match this filter.'}</div>`;
    box.innerHTML = html;
    box.querySelectorAll('.game-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        location.href = card.dataset.href;
      });
      card.addEventListener('keydown', e => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('button')) {
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

  async function load() {
    const week = parseInt(sel.value, 10) || currentWeek;
    weekCache = week;
    box.innerHTML = HC.skeletons(6);
    try {
      const sb = await HC.scoreboard(week);
      eventsCache = sb.events || [];
      currentWeek = (sb.week || {}).number || week;
      render();
      document.addEventListener('hc:theme', () => render(), { once: true });
    } catch (e) {
      box.innerHTML = '<div class="error">Couldn’t load scores. The Wi-Fi appears to be running a prevent defense.</div>';
    }
  }

  document.querySelectorAll('#filterRow button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#filterRow button').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); filter = b.dataset.f; render();
  }));

  (async function init() {
    try { recaps = await HC.fetchJSON('data/recaps.json'); } catch (e) { recaps = []; }
    currentWeek = await HC.weekOptions(sel, currentWeek);
    sel.addEventListener('change', load);
    renderFavGrid();
    load();
  })();
})();
