/* Highlights page — automatically matched official game videos */
(function () {
  'use strict';
  HC.initTheme(); HC.initNav('highlights'); HC.initPrefs();
  const sel = document.getElementById('weekSel');
  const seasonSel = document.getElementById('seasonSel');
  const box = document.getElementById('hl');
  const lead = document.getElementById('hlLead');
  const rest = document.getElementById('hlRest');
  let cached = null;
  let cachedLinks = null;
  let request = 0;
  let loading = false;
  const status = document.createElement('p');
  status.className = 'page-sub';
  status.setAttribute('role', 'status');
  box.before(status);

  async function load(renderOnly = false, quiet = false) {
    if (quiet && loading) return;
    const token = renderOnly ? request : ++request;
    if (!renderOnly) loading = true;
    const week = parseInt(sel.value, 10) || 1;
    HC.setContext(seasonSel.value, week, HC.seasonWindow.verified);
    if (!quiet) {
      lead.innerHTML = HC.skeletons(4);
      rest.innerHTML = '';
    }
    try {
      const useCache = renderOnly && cached;
      const [sb, links] = await Promise.all([
        useCache ? cached : HC.scoreboard(week, HC.context.season),
        useCache ? cachedLinks : HC.fetchJSON('data/highlights.json').catch(() => null)
      ]);
      if (token !== request) return;
      loading = false;
      status.textContent = '';
      cached = sb;
      cachedLinks = links;
      const restoreFocus = HC.captureFocus(box);
      const events = sb.events || [];
      const infos = events.map(HC.gameInfo);

      // curated pick: highest-scoring completed game
      let feat = '';
      const done = infos.filter(g => g.completed && g.away.score != null && g.home.score != null);
      if (done.length) {
        const top = done.sort((a, b) =>
          (Number(b.away.score) + Number(b.home.score)) - (Number(a.away.score) + Number(a.home.score)))[0];
        const c = HC.teamTextColors(top.away, top.home);
        const highlight = HC.highlightLink(links, top.id);
        feat = `<div data-outcome class="game-card" style="border:2px solid var(--accent)">
          <div class="game-meta"><span class="status">🔥 Highest-scoring game</span><span>${HC.esc(HC.fmtDate(top.date))}</span></div>
          <div style="font-weight:800;font-size:1.15rem">
            <span style="color:${c.away}">${HC.esc(top.away.abbr)}</span>
            <span class="blur-score" style="color:var(--text)"> ${HC.esc(top.away.score)}–${HC.esc(top.home.score)} </span>
            <span style="color:${c.home}">${HC.esc(top.home.abbr)}</span>
          </div>
          <div class="card-foot center" style="margin-top:12px">${highlight
            ? `<a class="btn btn-primary" href="${HC.esc(highlight.url)}" target="_blank" rel="noopener">▶ Watch highlights on ${HC.esc(highlight.source)}</a>`
            : `<p class="page-sub">${HC.esc(HC.highlightPending(links, true))}</p>`}</div>
        </div>`;
      }

      const cards = infos.map(g => {
        const c = HC.teamTextColors(g.away, g.home);
        const score = (g.completed || g.state === 'in') && g.away.score != null
          ? `<span data-outcome class="blur-score"> · ${HC.esc(g.away.score)}–${HC.esc(g.home.score)}</span>` : '';
        const watched = HC.isWatched(g.id);
        const highlight = HC.highlightLink(links, g.id);
        return `<div class="game-card" style="--ga:${c.away};--gh:${c.home}">
          <div class="game-meta">
            <span><span data-outcome class="status ${HC.statusClass(g)}">${HC.esc(HC.statusLabel(g))}</span>${score}</span>
            <span>${HC.esc(HC.fmtDate(g.date))}</span>
          </div>
          <div class="team-row"><img src="${HC.esc(g.away.logo || '')}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
            <div class="tname" style="color:${c.away}">${HC.esc(g.away.short || g.away.name)}</div>
            ${watched ? '<span class="chip">✓ Watched</span>' : ''}</div>
          <div class="team-row"><img src="${HC.esc(g.home.logo || '')}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
            <div class="tname" style="color:${c.home}">${HC.esc(g.home.short || g.home.name)}</div></div>
          <div class="card-foot center" style="margin-top:12px">
            ${highlight
              ? `<a class="btn btn-primary" href="${HC.esc(highlight.url)}" target="_blank" rel="noopener">▶ Watch highlights on ${HC.esc(highlight.source)}</a>`
              : `<p class="page-sub">${HC.esc(HC.highlightPending(links, g.completed))}</p>`}
            <a class="btn btn-ghost" href="${HC.esc(HC.gameURL(g.id))}">Game page</a>
            ${highlight ? `<button class="chip copy-btn" data-focus-key="copy-${g.id}" data-url="${HC.esc(highlight.url)}">⧉ Copy highlight link</button>` : ''}
          </div>
        </div>`;
      });
      lead.innerHTML = feat + (cards.slice(0, 3).join('') || `<div class="empty">No games available for the ${HC.context.season} regular season, Week ${week}.</div>`);
      rest.innerHTML = cards.slice(3).join('');
      box.querySelectorAll('.copy-btn').forEach(b => b.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        HC.copyLink(b.dataset.url, b);
      }));
      HC.contentReady(box);
      restoreFocus();
    } catch (e) {
      if (token !== request) return;
      loading = false;
      if (quiet && cached) status.textContent = 'Couldn’t refresh — showing the last update';
      if (!quiet || !cached) {
        lead.innerHTML = '<div class="error"><p>Couldn’t load the games. Blame the refs.</p><button class="btn btn-ghost" id="retryHighlights">Try again</button></div>';
        rest.innerHTML = '';
        document.getElementById('retryHighlights').addEventListener('click', () => load());
      }
    }
  }

  document.addEventListener('hc:theme', () => { if (cached && !loading) load(true); });
  (async function init() {
    await HC.initSeasonWeek(seasonSel, sel);
    sel.addEventListener('change', () => { cached = null; load(); });
    seasonSel.addEventListener('change', () => { HC.selectSeasonWeek(seasonSel, sel); cached = null; load(); });
    load();
    HC.startVisiblePolling(() => load(false, true));
  })();
})();
