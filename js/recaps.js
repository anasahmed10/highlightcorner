/* Recaps page */
(function () {
  'use strict';
  HC.initTheme(); HC.initNav('recaps'); HC.initPrefs();
  const box = document.getElementById('recaps');
  const lead = document.getElementById('recapsLead');
  const rest = document.getElementById('recapsRest');

  (async function init() {
    lead.innerHTML = HC.skeletons(4);
    try {
      const recaps = await HC.fetchJSON('data/recaps.json');
      if (!recaps.length) throw new Error('empty');
      const weeks = [...new Set(recaps.map(r => r.week))].sort((a, b) => b - a);
      const gamesById = new Map();
      const scoreboards = await Promise.all(weeks.map(w => HC.scoreboard(w).catch(() => null)));
      scoreboards.forEach(sb => (sb?.events || []).forEach(event => {
        gamesById.set(String(event.id), HC.gameInfo(event));
      }));
      const entries = weeks.flatMap(w =>
        recaps.filter(r => r.week === w).map((r, i) => {
          const game = gamesById.get(String(r.gameId));
          const colors = game ? HC.teamTextColors(game.away, game.home) : null;
          return `${i === 0 ? `<h2 class="section-title">Week ${w}</h2>` : ''}
          <article class="recap-card">
            <h3 data-spoiler-placeholder hidden><a href="game.html?id=${HC.esc(r.gameId)}&week=${w}">${HC.esc(r.away)} @ ${HC.esc(r.home)} — View game</a></h3>
            <p data-spoiler-placeholder hidden class="spoiler-notice">Recap hidden. Turn off Hide spoilers in Settings to read it.</p>
            <div data-outcome class="recap-scoreboard">
              <div class="recap-score-team"><span class="recap-score-location">Away</span><strong${colors ? ` style="color:${colors.away}"` : ''}>${HC.esc(r.away)}</strong><span class="recap-score-number">${HC.esc(r.awayScore)}</span></div>
              <span class="recap-score-status">Final</span>
              <div class="recap-score-team"><span class="recap-score-location">Home</span><strong${colors ? ` style="color:${colors.home}"` : ''}>${HC.esc(r.home)}</strong><span class="recap-score-number">${HC.esc(r.homeScore)}</span></div>
            </div>
            <span data-outcome class="verdict ${HC.esc(r.verdict)}">${HC.esc(String(r.verdict).replace(/-/g, ' '))}</span>
            <h3 data-outcome><a href="game.html?id=${HC.esc(r.gameId)}&week=${w}">${HC.esc(r.headline)}</a></h3>
            <div data-outcome>${HC.esc(r.recap).split('\n\n').map(x => `<p>${x}</p>`).join('')}</div>
            <div data-outcome class="keystat"><strong>Key stat:</strong> ${HC.esc(r.keyStat)}</div>
          </article>`;
        })
      );
      lead.innerHTML = entries[0];
      rest.innerHTML = entries.slice(1).join('');
      HC.contentReady(box);
    } catch (e) {
      lead.innerHTML = '<div class="empty">Recaps are still being written — good jokes take a minute.</div>';
      rest.innerHTML = '';
    }
  })();
})();
