/* Highlights page — one-tap YouTube deep links per game */
(function () {
  'use strict';
  HC.initTheme(); HC.initNav('highlights'); HC.initPrefs();
  const sel = document.getElementById('weekSel');
  const box = document.getElementById('hl');
  let cached = null;
  let request = 0;

  async function load(renderOnly = false) {
    const token = ++request;
    const week = parseInt(sel.value, 10) || 1;
    box.innerHTML = HC.skeletons(4);
    try {
      const sb = renderOnly && cached ? cached : await HC.scoreboard(week);
      if (token !== request) return;
      cached = sb;
      const events = sb.events || [];
      const infos = events.map(HC.gameInfo);

      // curated pick: highest-scoring completed game
      let feat = '';
      const done = infos.filter(g => g.completed && g.away.score != null && g.home.score != null);
      if (done.length) {
        const top = done.sort((a, b) =>
          (Number(b.away.score) + Number(b.home.score)) - (Number(a.away.score) + Number(a.home.score)))[0];
        const c = HC.teamTextColors(top.away, top.home);
        feat = `<a data-outcome class="game-card" style="border:2px solid var(--accent);text-decoration:none" target="_blank" rel="noopener"
            href="${HC.ytSearchURL(week, top.away.abbr, top.home.abbr)}">
          <div class="game-meta"><span class="status">🔥 Highest-scoring game</span><span>${HC.esc(HC.fmtDate(top.date))}</span></div>
          <div style="font-weight:800;font-size:1.15rem">
            <span style="color:${c.away}">${HC.esc(top.away.abbr)}</span>
            <span class="blur-score" style="color:var(--text)"> ${HC.esc(top.away.score)}–${HC.esc(top.home.score)} </span>
            <span style="color:${c.home}">${HC.esc(top.home.abbr)}</span>
          </div>
          <div class="card-foot center" style="margin-top:12px"><span class="btn btn-yt">▶ Watch highlights</span></div>
        </a>`;
      }

      box.innerHTML = feat + infos.map(g => {
        const c = HC.teamTextColors(g.away, g.home);
        const score = (g.completed || g.state === 'in') && g.away.score != null
          ? `<span data-outcome class="blur-score"> · ${HC.esc(g.away.score)}–${HC.esc(g.home.score)}</span>` : '';
        const watched = HC.isWatched(g.id);
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
            <a class="btn btn-yt" href="${HC.ytSearchURL(week, g.away.abbr, g.home.abbr)}" target="_blank" rel="noopener">▶ Watch highlights</a>
            <a class="btn btn-ghost" href="game.html?id=${g.id}&week=${week}">Game page</a>
            <button class="chip copy-btn" data-url="${HC.ytSearchURL(week, g.away.abbr, g.home.abbr)}">⧉ Copy link</button>
          </div>
        </div>`;
      }).join('') || '<div class="empty">No games found for this week.</div>';
      box.querySelectorAll('.copy-btn').forEach(b => b.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        HC.copyLink(b.dataset.url, b);
      }));
      HC.contentReady(box);
    } catch (e) {
      if (token !== request) return;
      box.innerHTML = '<div class="error"><p>Couldn’t load the games. Blame the refs.</p><button class="btn btn-ghost" id="retryHighlights">Try again</button></div>';
      document.getElementById('retryHighlights').addEventListener('click', () => load());
    }
  }

  document.addEventListener('hc:theme', () => { if (cached) load(true); });
  (async function init() {
    await HC.weekOptions(sel);
    sel.value = sel.options[sel.options.length - 1].value;
    sel.addEventListener('change', () => { cached = null; load(); });
    load();
  })();
})();
