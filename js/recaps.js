/* Recaps page */
(function () {
  'use strict';
  HC.initTheme(); HC.initNav('recaps'); HC.initPrefs();
  const box = document.getElementById('recaps');

  (async function init() {
    box.innerHTML = HC.skeletons(4);
    try {
      const recaps = await HC.fetchJSON('data/recaps.json');
      if (!recaps.length) throw new Error('empty');
      const weeks = [...new Set(recaps.map(r => r.week))].sort((a, b) => b - a);
      box.innerHTML = weeks.map(w =>
        `<h2 class="section-title">Week ${w}</h2>` +
        recaps.filter(r => r.week === w).map(r => `
          <article class="recap-card">
            <span class="verdict ${HC.esc(r.verdict)}">${HC.esc(String(r.verdict).replace(/-/g, ' '))}</span>
            <h3><a href="game.html?id=${HC.esc(r.gameId)}&week=${w}">${HC.esc(r.headline)}</a></h3>
            <div class="scoreline">${HC.esc(r.away)} ${r.awayScore} @ ${HC.esc(r.home)} ${r.homeScore}</div>
            ${HC.esc(r.recap).split('\n\n').map(x => `<p>${x}</p>`).join('')}
            <div class="keystat"><strong>Key stat:</strong> ${HC.esc(r.keyStat)}</div>
          </article>`).join('')
      ).join('');
    } catch (e) {
      box.innerHTML = '<div class="empty">Recaps are still being written — good jokes take a minute.</div>';
    }
  })();
})();
