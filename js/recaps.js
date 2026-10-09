/* Recaps page */
(function () {
  'use strict';
  HC.initTheme(); HC.initNav('recaps'); HC.initPrefs();
  const box = document.getElementById('recaps');
  const lead = document.getElementById('recapsLead');
  const rest = document.getElementById('recapsRest');

  async function load() {
    lead.innerHTML = HC.skeletons(4);
    try {
      const recaps = await HC.fetchJSON('data/recaps.json');
      if (!Array.isArray(recaps)) throw new Error('Invalid recap archive');
      if (!recaps.length) {
        lead.innerHTML = '<div class="empty">Recaps are still being written — good jokes take a minute.</div>';
        rest.innerHTML = '';
        return;
      }
      const weeks = [...new Map(recaps.map(r => [`${r.season}-${r.week}`, { season: r.season, week: r.week }])).values()]
        .sort((a, b) => b.season - a.season || b.week - a.week);
      const gamesById = new Map();
      const scoreboards = await Promise.all(weeks.map(({ season, week }) => HC.scoreboard(week, season).catch(() => null)));
      scoreboards.forEach(sb => (sb?.events || []).forEach(event => {
        gamesById.set(String(event.id), HC.gameInfo(event));
      }));
      const entries = weeks.flatMap(({ season, week }) =>
        recaps.filter(r => r.season === season && r.week === week).map((r, i) => {
          const game = gamesById.get(String(r.gameId));
          const colors = game ? HC.teamTextColors(game.away, game.home) : null;
          return `${i === 0 ? `<h2 class="section-title">${season} · Week ${week}</h2>` : ''}
          <article class="recap-card">
            <h3 data-spoiler-placeholder hidden><a href="${HC.esc(HC.gameURL(r.gameId, { season, week }))}">${HC.esc(r.away)} @ ${HC.esc(r.home)} — View game</a></h3>
            <p data-spoiler-placeholder hidden class="spoiler-notice">Recap hidden. Turn off Hide spoilers in Settings to read it.</p>
            <div data-outcome class="recap-scoreboard">
              <div class="recap-score-team"><span class="recap-score-location">Away</span><strong${colors ? ` style="color:${colors.away}"` : ''}>${HC.esc(r.away)}</strong><span class="recap-score-number">${HC.esc(r.awayScore)}</span></div>
              <span class="recap-score-status">Final</span>
              <div class="recap-score-team"><span class="recap-score-location">Home</span><strong${colors ? ` style="color:${colors.home}"` : ''}>${HC.esc(r.home)}</strong><span class="recap-score-number">${HC.esc(r.homeScore)}</span></div>
            </div>
            <span data-outcome class="verdict ${HC.esc(r.verdict)}">${HC.esc(String(r.verdict).replace(/-/g, ' '))}</span>
            <h3 data-outcome><a href="${HC.esc(HC.gameURL(r.gameId, { season, week }))}">${HC.esc(r.headline)}</a></h3>
            <div data-outcome>${HC.esc(r.recap).split('\n\n').map(x => `<p>${x}</p>`).join('')}</div>
            <div data-outcome class="keystat"><strong>Key stat:</strong> ${HC.esc(r.keyStat)}</div>
          </article>`;
        })
      );
      lead.innerHTML = entries[0];
      rest.innerHTML = entries.slice(1).join('');
      HC.contentReady(box);
    } catch (e) {
      lead.innerHTML = '<div class="error"><p>Couldn’t load recaps. Try again when you’re connected.</p><button class="btn btn-ghost" id="retryRecaps">Try again</button></div>';
      rest.innerHTML = '';
      document.getElementById('retryRecaps').addEventListener('click', load);
    }
  }
  load();
})();
