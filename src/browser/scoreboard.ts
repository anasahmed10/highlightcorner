/* Scoreboard page: filters, favorites, watched */
(function () {
  'use strict';
  HC.initTheme(); HC.initNav('scores'); HC.initPrefs();
  const sel = document.getElementById('weekSel') as HTMLSelectElement;
  const seasonSel = document.getElementById('seasonSel') as HTMLSelectElement;
  const box = document.getElementById('games')!;
  const lead = document.getElementById('gamesLead')!;
  const rest = document.getElementById('gamesRest')!;
  const favGrid = document.getElementById('favGrid')!;
  let recaps: Recap[] = [];
  let highlightMap: HighlightMap | null = null;
  let filter = 'all';
  let eventsCache: ESPNEvent[] = [];
  let request = 0;
  let loading = false;
  const refresh = document.getElementById("refreshScores") as HTMLButtonElement;
  const freshness = document.getElementById("freshness")!;

  function teamRow(t: Omit<GameTeam, 'score'> & { score?: string | number | null }, color: string) {
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
    const restoreFocus = HC.captureFocus(favGrid);
    favGrid.innerHTML = HC.TEAMS32.map(a =>
      `<button class="${favs.includes(a) ? 'on' : ''}" data-team="${a}" data-focus-key="favorite-${a}" aria-label="${a} favorite team" aria-pressed="${favs.includes(a)}">${a}</button>`).join('');
    restoreFocus();
    favGrid.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      HC.toggleFavorite(b.dataset.team || '');
      renderFavGrid(); render();
    }));
  }

  function cardHTML(g: GameInfo) {
    const c = HC.teamTextColors(g.away, g.home);
    const recap = recaps.find(r => r?.season === HC.context.season && String(r.gameId) === g.id);
    const watched = HC.isWatched(g.id);
    const highlight = g.state === 'post' ? HC.highlightLink(highlightMap, g.id) : null;
    return `<div class="game-card" style="--ga:${c.away};--gh:${c.home}" data-href="${HC.esc(HC.gameURL(g.id))}" data-focus-key="game-${g.id}" tabindex="0" role="link"
        aria-label="${HC.esc(g.away.abbr)} at ${HC.esc(g.home.abbr)}">
      <div class="game-meta">
        <span ${g.state === 'pre' ? '' : 'data-outcome'} class="status ${HC.statusClass(g)}">${g.state === 'pre' ? 'Upcoming' : HC.esc(HC.statusLabel(g))}</span>
        <span>${HC.esc(HC.fmtDate(g.date))}</span>
      </div>
      ${teamRow({ ...g.away, score: g.state === 'pre' ? null : g.away.score }, c.away)}${teamRow({ ...g.home, score: g.state === 'pre' ? null : g.home.score }, c.home)}
      <div class="card-foot">
        ${recap ? `<span data-outcome class="chip verdict ${HC.esc(recap.verdict)}">${HC.esc(String(recap.verdict).replace(/-/g, ' '))}</span>` : ''}
        <button class="chip watched-toggle" data-id="${g.id}" data-focus-key="watched-${g.id}" aria-pressed="${watched}">${watched ? '✓ Watched' : 'Mark watched'}</button>
        <span class="card-actions">
          <a class="chip" data-focus-key="view-${g.id}" href="${HC.esc(HC.gameURL(g.id))}">View game →</a>
          ${highlight ? `<a class="chip highlight-link" data-focus-key="highlight-${g.id}" href="${HC.esc(highlight.url)}" target="_blank" rel="noopener noreferrer" aria-label="View Highlights on ${HC.esc(highlight.source)} for ${HC.esc(g.away.abbr)} at ${HC.esc(g.home.abbr)}">View Highlights</a>` : ''}
        </span>
      </div>
    </div>`;
  }

  function render() {
    if (loading) return;
    const restoreFocus = HC.captureFocus(box);
    let evs = eventsCache;
    const favs = HC.getFavorites();
    if (filter === 'favorites') evs = evs.filter(ev => {
      const g = HC.gameInfo(ev);
      return favs.includes(g.away.abbr) || favs.includes(g.home.abbr);
    });
    if (filter === 'unwatched') evs = evs.filter(ev => !HC.isWatched(String(ev.id)));
    const watchedCount = eventsCache.filter(ev => HC.isWatched(String(ev.id))).length;
    let lastDay = '';
    const cards = evs.slice().sort((a, b) => Date.parse(a.date || '') - Date.parse(b.date || '')).map(ev => {
      const g = HC.gameInfo(ev);
      const date = new Date(g.date || '');
      const day = Number.isNaN(date.getTime()) ? 'Date to be announced' : new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(date);
      const heading = day === lastDay ? '' : `<h2 class="day-heading">${HC.esc(day)}</h2>`;
      lastDay = day;
      return heading + cardHTML(g);
    });
    lead.innerHTML = `<p class="page-sub">${watchedCount} of ${eventsCache.length} watched</p>` +
      (cards.slice(0, 5).join('') || `<div class="empty">${filter === 'favorites' && !favs.length
        ? 'Pick some favorite teams above to filter the board.'
        : `No games available for the ${HC.context.season} regular season, Week ${HC.context.week}.`}</div>`);
    rest.innerHTML = cards.slice(5).join('');
    HC.contentReady(box);
    restoreFocus();
    box.querySelectorAll<HTMLElement>('.game-card').forEach(card => {
      card.addEventListener('click', e => {
        if ((e.target as HTMLElement).closest('button, a')) return;
        location.href = card.dataset.href || '';
      });
      card.addEventListener('keydown', (e: KeyboardEvent) => {
        if ((e.key === 'Enter' || e.key === ' ') && !(e.target as HTMLElement).closest('button, a')) {
          e.preventDefault(); location.href = card.dataset.href || '';
        }
      });
    });
    box.querySelectorAll<HTMLButtonElement>('.watched-toggle').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const on = HC.toggleWatched(b.dataset.id || '');
      b.textContent = on ? '✓ Watched' : 'Mark watched';
      render();
      if (filter === 'unwatched' && on) {
        const next = box.querySelector<HTMLElement>('.watched-toggle') || document.querySelector<HTMLElement>('[data-f=unwatched]');
        next?.focus({ preventScroll: true });
      }
    }));
  }

  async function load(quiet = false) {
    if (quiet && loading) return;
    const token = ++request;
    const week = parseInt(sel.value, 10) || 1;
    HC.setContext(seasonSel.value, week, HC.seasonWindow.verified);
    loading = true;
    if (!quiet) {
      refresh.disabled = true;
      lead.innerHTML = HC.skeletons(4);
      rest.innerHTML = '';
    }
    freshness.textContent = quiet ? 'Checking for live updates…' : 'Updating scores…';
    try {
      const [sb, links] = await Promise.all([
        HC.scoreboard(week, HC.context.season),
        HC.fetchJSON<HighlightMap>('data/highlights.json').catch(() => null)
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
        lead.innerHTML = '<div class="error"><p>Couldn’t load scores. Try again when you’re connected.</p><button class="btn btn-ghost" id="retryScores">Try again</button></div>';
        rest.innerHTML = '';
        document.getElementById('retryScores')!.addEventListener('click', () => load());
      }
    } finally { if (token === request && !quiet) refresh.disabled = false; }
  }
  refresh.addEventListener('click', () => load());
  document.addEventListener('hc:theme', render);
  document.addEventListener('hc:spoilers', render);

  document.querySelectorAll<HTMLButtonElement>('#filterRow button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll<HTMLButtonElement>('#filterRow button').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); filter = b.dataset.f || 'all';
    document.querySelectorAll<HTMLButtonElement>('#filterRow button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); render();
  }));

  (async function init() {
    const [stored] = await Promise.all([
      HC.fetchRecaps().catch(() => []),
      HC.initSeasonWeek(seasonSel, sel)
    ]);
    recaps = Array.isArray(stored) ? stored : [];
    document.querySelectorAll<HTMLButtonElement>("#filterRow button").forEach(b => b.setAttribute("aria-pressed", String(b.classList.contains("active"))));
    sel.addEventListener('change', () => load());
    seasonSel.addEventListener('change', () => { HC.selectSeasonWeek(seasonSel, sel); load(); });
    renderFavGrid();
    load();
    HC.startVisiblePolling(() => load(true));
  })();
})();
