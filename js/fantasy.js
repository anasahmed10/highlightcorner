/* Fantasy page — weekly leaders from Sleeper */
(function () {
  'use strict';
  HC.initTheme(); HC.initNav('fantasy'); HC.initPrefs();
  const sel = document.getElementById('weekSel');
  const seasonSel = document.getElementById('seasonSel');
  const posSel = document.getElementById('posSel');
  const box = document.getElementById('fantasy');
  const segBtns = [...document.querySelectorAll('.seg button')];
  let fmt = 'ppr';
  let posFilter = 'ALL';
  let players = null;
  let request = 0;
  let loading = false;
  let statsReady = false;
  const byPos = {};   // pos -> rows for current week/format

  function renderTables() {
    if (loading || !statsReady) return;
    const positions = posFilter === 'ALL' ? POSITIONS : POSITIONS.filter(([p]) => p === posFilter);
    box.innerHTML = positions.map(([pos, label]) => {
      const list = byPos[pos] || [];
      if (!list.length) return '';
      const trs = list.map((r, i) =>
        `<tr><td>${i + 1}</td><td class="pl" data-sort-value="${HC.esc(r.name)} ${HC.esc(r.team)}">${HC.esc(r.name)} <span class="pos">${HC.esc(r.team)}</span>` +
        `<span class="fantasy-mobile-line">${HC.esc(statline(pos, r.s))}</span></td>` +
        `<td class="fantasy-points"><strong>${r.pts.toFixed(1)}</strong></td><td class="fantasy-line">${HC.esc(statline(pos, r.s))}</td></tr>`).join('');
      return `<table class="stats fantasy-stats" data-sort-id="fantasy-${pos}" data-sort-default="2"><caption>${label}</caption>
        <thead><tr><th data-sort-type="number">#</th><th data-sort-type="text">Player</th>` +
        `<th class="fantasy-points" data-sort-type="number">Pts</th><th class="fantasy-line" data-sort-type="text">Line</th></tr></thead><tbody>${trs}</tbody></table>`;
    }).join('') || `<div class="empty">No fantasy stats available for the ${HC.context.season} regular season, Week ${HC.context.week} yet.</div>`;
    HC.contentReady(box);
  }

  const FMT_KEY = { ppr: 'pts_ppr', half: 'pts_half_ppr', std: 'pts_std' };
  const POSITIONS = [
    ['QB', 'Quarterbacks'], ['RB', 'Running Backs'], ['WR', 'Wide Receivers'],
    ['TE', 'Tight Ends'], ['K', 'Kickers'], ['DST', 'Defenses']
  ];

  function statline(pos, s) {
    const n = v => (v == null ? 0 : Number(v));
    if (pos === 'QB') return `${n(s.pass_yd)} pass yds, ${n(s.pass_td)} TD, ${n(s.pass_int)} INT · ${n(s.rush_yd)} rush yds`;
    if (pos === 'RB') return `${n(s.rush_att)} att, ${n(s.rush_yd)} yds, ${n(s.rush_td)} TD · ${n(s.rec)} rec, ${n(s.rec_yd)} yds`;
    if (pos === 'WR' || pos === 'TE') return `${n(s.rec_tgt)} tgt, ${n(s.rec)} rec, ${n(s.rec_yd)} yds, ${n(s.rec_td)} TD`;
    if (pos === 'K') return `${n(s.fgm)} FG · ${n(s.xpm)} XP`;
    if (pos === 'DST') return `${n(s.def_sack)} sacks, ${n(s.def_int)} INT, ${n(s.def_fum_rec)} FR · ${n(s.pts_allow)} pts allowed`;
    return '';
  }

  async function load() {
    const token = ++request;
    const week = parseInt(sel.value, 10) || 1;
    HC.setContext(seasonSel.value, week, HC.seasonWindow.verified);
    const season = HC.context.season;
    loading = true;
    statsReady = false;
    for (const [position] of POSITIONS) byPos[position] = [];
    box.innerHTML = HC.skeletons(3);
    try {
      if (!players) {
        const map = await HC.fetchJSON('data/players.json');
        if (!map || typeof map !== 'object' || Array.isArray(map)) throw new Error('Invalid player map');
        players = map;
      }
      const stats = await HC.fetchJSON(`https://api.sleeper.app/v1/stats/nfl/regular/${season}/${week}`);
      if (token !== request) return;
      if (!stats || typeof stats !== 'object' || Array.isArray(stats)) throw new Error('Invalid fantasy stats');
      const key = FMT_KEY[fmt];
      const rows = [];
      for (const [pid, s] of Object.entries(stats)) {
        if (!s || typeof s !== 'object') continue;
        const pts = Number(s[key] || 0);
        if (pts === 0 || !Number.isFinite(pts)) continue;
        let pos, name, team;
        if (pid.startsWith('TEAM_')) { pos = 'DST'; team = pid.slice(5); name = team + ' D/ST'; }
        else {
          const p = players[pid];
          if (!p) continue;
          pos = p.p; name = p.n; team = p.t;
        }
        rows.push({ pos, name, team, pts, s });
      }
      rows.sort((a, b) => b.pts - a.pts);
      for (const p of POSITIONS) byPos[p[0]] = rows.filter(r => r.pos === p[0]);
      loading = false;
      statsReady = true;
      renderTables();
    } catch (e) {
      if (token !== request) return;
      loading = false;
      box.innerHTML = '<div class="error">Couldn’t load fantasy stats. Your quarterback isn’t the only one having a rough week.<p><button class="btn btn-ghost" id="retryFantasy">Try again</button></p></div>';
      document.getElementById('retryFantasy').addEventListener('click', load);
    }
  }

  segBtns.forEach(b => b.addEventListener('click', () => {
    segBtns.forEach(x => x.classList.remove('active'));
    b.classList.add('active'); segBtns.forEach(x => x.setAttribute('aria-pressed', String(x === b))); fmt = b.dataset.fmt; load();
  }));

  (async function init() {
    segBtns.forEach(b => b.setAttribute("aria-pressed", String(b.classList.contains("active"))));
    await HC.initSeasonWeek(seasonSel, sel);
    sel.addEventListener('change', load);
    seasonSel.addEventListener('change', () => { HC.selectSeasonWeek(seasonSel, sel); load(); });
    posSel.addEventListener('change', () => { posFilter = posSel.value; renderTables(); });
    load();
  })();
})();
