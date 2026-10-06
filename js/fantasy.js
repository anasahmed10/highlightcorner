/* Fantasy page — weekly leaders from Sleeper */
(function () {
  'use strict';
  HC.initTheme(); HC.initNav('fantasy'); HC.initPrefs();
  const sel = document.getElementById('weekSel');
  const posSel = document.getElementById('posSel');
  const box = document.getElementById('fantasy');
  const segBtns = [...document.querySelectorAll('.seg button')];
  let fmt = 'ppr';
  let posFilter = 'ALL';
  let players = null;
  const byPos = {};   // pos -> rows for current week/format
  const sortState = {}; // pos -> {key:'pts'|'name', dir:1|-1}

  function renderTables() {
    const positions = posFilter === 'ALL' ? POSITIONS : POSITIONS.filter(([p]) => p === posFilter);
    box.innerHTML = positions.map(([pos, label]) => {
      const st = sortState[pos] || { key: 'pts', dir: 1 };
      const list = (byPos[pos] || []).slice().sort((a, b) =>
        st.key === 'name' ? a.name.localeCompare(b.name) * st.dir : (b.pts - a.pts) * st.dir);
      if (!list.length) return '';
      const ind = (key) => st.key === key ? `<span class="sort-ind">${st.dir === 1 ? '▲' : '▼'}</span>` : '';
      const trs = list.map((r, i) =>
        `<tr><td>${i + 1}</td><td class="pl">${HC.esc(r.name)} <span class="pos">${HC.esc(r.team)}</span></td>` +
        `<td>${HC.esc(statline(pos, r.s))}</td><td><strong>${r.pts.toFixed(1)}</strong></td></tr>`).join('');
      return `<table class="stats"><caption>${label}</caption>
        <thead><tr><th>#</th><th class="sortable" data-pos="${pos}" data-sort="name">Player${ind('name')}</th>` +
        `<th>Line</th><th class="sortable" data-pos="${pos}" data-sort="pts">Pts${ind('pts')}</th></tr></thead><tbody>${trs}</tbody></table>`;
    }).join('') || '<div class="empty">No fantasy data for this week yet — the end zones are still empty.</div>';
  }

  box.addEventListener('click', (e) => {
    const th = e.target.closest('th.sortable');
    if (!th) return;
    const pos = th.dataset.pos, key = th.dataset.sort;
    const cur = sortState[pos] || { key: 'pts', dir: 1 };
    sortState[pos] = { key, dir: cur.key === key ? -cur.dir : 1 };
    renderTables();
  });

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
    const week = parseInt(sel.value, 10) || 4;
    box.innerHTML = HC.skeletons(3);
    try {
      if (!players) players = await HC.fetchJSON('data/players.json');
      const stats = await HC.fetchJSON(`https://api.sleeper.app/v1/stats/nfl/regular/2026/${week}`);
      const key = FMT_KEY[fmt];
      const rows = [];
      for (const [pid, s] of Object.entries(stats)) {
        const pts = Number(s[key] || 0);
        if (pts < 8) continue;
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
      for (const p of POSITIONS) byPos[p[0]] = rows.filter(r => r.pos === p[0]).slice(0, 25);
      renderTables();
    } catch (e) {
      box.innerHTML = '<div class="error">Couldn’t load fantasy stats. Your quarterback isn’t the only one having a rough week.</div>';
    }
  }

  segBtns.forEach(b => b.addEventListener('click', () => {
    segBtns.forEach(x => x.classList.remove('active'));
    b.classList.add('active'); fmt = b.dataset.fmt; load();
  }));

  (async function init() {
    await HC.weekOptions(sel, 4);
    sel.value = sel.options[sel.options.length - 1].value;
    sel.addEventListener('change', load);
    posSel.addEventListener('change', () => { posFilter = posSel.value; renderTables(); });
    load();
  })();
})();
