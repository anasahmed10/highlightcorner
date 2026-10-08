/* Game page: box score, advanced stats, fantasy, recap, injuries, highlights */
(function () {
  'use strict';
  HC.initTheme(); HC.initNav('scores'); HC.initPrefs();
  const box = document.getElementById('game');
  const adBox = document.getElementById('gameAd');
  const params = new URLSearchParams(location.search);
  const gameId = params.get('id');
  const weekParam = params.get('week');
  const seasonParam = params.get('season');
  let gameState = '';
  let currentTeams = null;
  let syncRecapToggle = () => {};
  let stopPolling = () => {};
  let adsInitialized = false;

  document.addEventListener('hc:spoilers', () => syncRecapToggle());
  window.addEventListener('resize', () => syncRecapToggle());
  document.addEventListener('hc:theme', () => {
    if (!currentTeams) return;
    const colors = HC.teamTextColors(currentTeams.away, currentTeams.home);
    const hero = box.querySelector('.game-hero');
    if (hero) {
      hero.style.setProperty('--ga', colors.away);
      hero.style.setProperty('--gh', colors.home);
    }
    box.querySelectorAll('.team-tab').forEach(tab => {
      tab.style.setProperty('--team', tab.textContent.trim() === currentTeams.awayAbbr ? colors.away : colors.home);
    });
  });

  const TEAM_STATS = [
    ['firstDowns', '1st Downs'], ['thirdDownEff', '3rd Down'], ['fourthDownEff', '4th Down'],
    ['totalYards', 'Total Yards'], ['yardsPerPlay', 'Yards / Play'],
    ['netPassingYards', 'Pass Yards'], ['rushingYards', 'Rush Yards'],
    ['turnovers', 'Turnovers'], ['rushingAttempts', 'Rush Att'], ['completionAttempts', 'Comp / Att'],
    ['sacksYardsLost', 'Sacks (Yds Lost)'], ['totalPenaltiesYards', 'Penalties (Yds)'],
    ['redZoneAttempts', 'Red Zone Att'], ['totalDrives', 'Drives'], ['possessionTime', 'Possession']
  ];

  const num = v => {
    if (v == null) return 0;
    const m = String(v).match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : 0;
  };
  function getStat(stats, keys, key) {
    const i = (keys || []).indexOf(key);
    return i < 0 ? 0 : num(stats[i]);
  }

  /* PPR fantasy points from ESPN box-score groups, merged per athlete */
  function computeFantasy(boxPlayers) {
    const acc = new Map();
    const bump = (a, teamAbbr, patch) => {
      const id = a.athlete.id;
      if (!acc.has(id)) acc.set(id, { name: a.athlete.displayName, team: teamAbbr, pts: 0, line: {} });
      const e = acc.get(id);
      for (const k of Object.keys(patch)) { e.line[k] = (e.line[k] || 0) + patch[k]; }
    };
    (boxPlayers || []).forEach(teamGroup => {
      const tabbr = (teamGroup.team || {}).abbreviation || '';
      (teamGroup.statistics || []).forEach(g => {
        const keys = g.keys || [];
        (g.athletes || []).forEach(a => {
          const st = a.stats || [];
          if (g.name === 'passing') bump(a, tabbr, {
            py: getStat(st, keys, 'passingYards'), ptd: getStat(st, keys, 'passingTouchdowns'),
            pint: getStat(st, keys, 'interceptions')
          });
          else if (g.name === 'rushing') bump(a, tabbr, {
            ry: getStat(st, keys, 'rushingYards'), rtd: getStat(st, keys, 'rushingTouchdowns')
          });
          else if (g.name === 'receiving') bump(a, tabbr, {
            rec: getStat(st, keys, 'receptions'), rcy: getStat(st, keys, 'receivingYards'),
            rctd: getStat(st, keys, 'receivingTouchdowns')
          });
          else if (g.name === 'fumbles') bump(a, tabbr, { fl: getStat(st, keys, 'fumblesLost') });
          else if (g.name === 'kicking') bump(a, tabbr, {
            fgm: getStat(st, keys, 'fieldGoalsMade'), xpm: getStat(st, keys, 'extraPointsMade')
          });
        });
      });
    });
    const out = [];
    acc.forEach(e => {
      const L = e.line;
      e.pts = (L.py || 0) * 0.04 + (L.ptd || 0) * 4 - (L.pint || 0) * 2 +
        (L.ry || 0) * 0.1 + (L.rtd || 0) * 6 + (L.rec || 0) * 1 +
        (L.rcy || 0) * 0.1 + (L.rctd || 0) * 6 - (L.fl || 0) * 2 +
        (L.fgm || 0) * 3 + (L.xpm || 0) * 1;
      if (e.pts !== 0) out.push(e);
    });
    return out.sort((a, b) => b.pts - a.pts);
  }

  function fantasyLine(e) {
    const L = e.line, p = [];
    if (L.py) p.push(`${L.py} pass yds${L.ptd ? `, ${L.ptd} TD` : ''}${L.pint ? `, ${L.pint} INT` : ''}`);
    if (L.ry) p.push(`${L.ry} rush yds${L.rtd ? `, ${L.rtd} TD` : ''}`);
    if (L.rec) p.push(`${L.rec} rec, ${L.rcy || 0} yds${L.rctd ? `, ${L.rctd} TD` : ''}`);
    if (L.fgm) p.push(`${L.fgm} FG, ${L.xpm || 0} XP`);
    return p.join(' · ') || '—';
  }

  function playerTable(teamAbbr, group, sortKey) {
    const keys = group.keys || [], labels = group.labels || [];
    const idx = keys.indexOf(sortKey);
    const athletes = [...(group.athletes || [])]
      .sort((a, b) => num((b.stats || [])[idx]) - num((a.stats || [])[idx]));
    if (!athletes.length) return '';
    const keep = labels.map((_, i) => i).filter(i => i < 6);
    const rows = athletes.map(a => {
      const cells = keep.map(i => `<td>${HC.esc((a.stats || [])[i] ?? '—')}</td>`).join('');
      return `<tr><td class="pl">${HC.esc(a.athlete.displayName)}</td>${cells}</tr>`;
    }).join('');
    const heads = keep.map(i => `<th data-sort-type="number">${HC.esc(labels[i])}</th>`).join('');
    const defaultColumn = keep.indexOf(idx) + 1;
    return `<table class="stats" data-sort-id="box-${HC.esc(teamAbbr)}-${HC.esc(group.name)}"${defaultColumn ? ` data-sort-default="${defaultColumn}"` : ''}><caption>${HC.esc(teamAbbr)} ${HC.esc(group.text || '')}</caption>
      <thead><tr><th data-sort-type="text">Player</th>${heads}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  /* Injuries with team tabs (away first), same styling as the box score tabs */
  function injuriesSection(injuries, away, home, colors) {
    if (!injuries || !injuries.length) return '';
    const abbrOf = e => (((e.team || {}).abbreviation) || '').toUpperCase();
    const order = [(((away.team || {}).abbreviation) || '').toUpperCase(),
                   (((home.team || {}).abbreviation) || '').toUpperCase()];
    const sorted = [...injuries].sort((a, b) => order.indexOf(abbrOf(a)) - order.indexOf(abbrOf(b)));
    if (!sorted.some(e => (e.injuries || []).length)) return '';
    const tabs = sorted.map((entry, i) => {
      const color = i === 0 ? colors.away : colors.home;
      return `<button class="team-tab${i === 0 ? ' active' : ''}" data-tab="${i}" role="tab"
        aria-selected="${i === 0}" style="--team:${color}">${HC.esc(abbrOf(entry) || 'Team')}</button>`;
    }).join('');
    const panes = sorted.map((entry, i) => {
      const list = (entry.injuries || []).map(inj => {
        const nm = ((inj.athlete || {}).displayName) || 'Unknown player';
        const cm = inj.details || inj.longComment || inj.shortComment || '';
        return `<div class="injury"><div><span class="who">${HC.esc(nm)}</span>
          &nbsp;<span class="st">${HC.esc(inj.status || '')}</span></div>
          <div class="cm">${HC.esc(cm)}${inj.date ? ` <em>(${HC.esc(HC.fmtDateShort(inj.date))})</em>` : ''}</div></div>`;
      }).join('') || '<div class="empty">No injuries reported.</div>';
      return `<div class="team-pane${i === 0 ? ' active' : ''}" data-pane="${i}" role="tabpanel">${list}</div>`;
    }).join('');
    return `<div data-tabgroup><div class="team-tabs" role="tablist">${tabs}</div>${panes}</div>`;
  }

  /* Collapsible game-page sections (dropdowns); scoring summary hides by default */
  function collapsible(titleHtml, bodyHtml, isOpen, count) {
    return `<details class="collapsible"${isOpen ? ' open' : ''}>` +
      `<summary class="section-title collapsible-head"><span>${titleHtml}</span>` +
      (count != null ? `<span class="count">${count}</span>` : '') +
      `<span class="chev" aria-hidden="true">▾</span></summary>` +
      `<div class="collapsible-body">${bodyHtml}</div></details>`;
  }

  function scoringSection(plays) {
    if (!plays || !plays.length) return '';
    const byQ = {};
    plays.forEach(p => {
      const q = (p.period || {}).number || 0;
      (byQ[q] = byQ[q] || []).push(p);
    });
    const sections = Object.keys(byQ).sort((a, b) => a - b).map(q => {
      const label = q == 5 ? 'OT' : 'Q' + q;
      const rows = byQ[q].map(p =>
        `<tr><td>${HC.esc(((p.clock || {}).displayValue) || '')}</td>
         <td class="pl"><strong>${HC.esc(((p.team || {}).abbreviation) || '')}</strong> ${HC.esc(p.text || '')}</td>
         <td>${HC.esc(p.awayScore)}–${HC.esc(p.homeScore)}</td></tr>`).join('');
      return `<table class="stats" data-sort-id="scoring-${q}"><caption>${label}</caption>
        <thead><tr><th data-sort-type="clock">Clock</th><th data-sort-type="text">Play</th><th data-sort-type="number">Score</th></tr></thead><tbody>${rows}</tbody></table>`;
    }).join('');
    return sections;
  }

  /* Box score with team tabs (away first), tab colors from team palette */
  function boxScoreTabs(groups, away, home, colors) {
    if (!groups || !groups.length) return '';
    const abbrOf = t => ((t.team || {}).abbreviation) || '';
    const order = [abbrOf(away), abbrOf(home)];
    const sorted = [...groups].sort((a, b) =>
      order.indexOf(abbrOf(a)) - order.indexOf(abbrOf(b)));
    const tabs = sorted.map((tg, i) => {
      const color = i === 0 ? colors.away : colors.home;
      return `<button class="team-tab${i === 0 ? ' active' : ''}" data-tab="${i}" role="tab"
        aria-selected="${i === 0}" style="--team:${color}">${HC.esc(abbrOf(tg))}</button>`;
    }).join('');
    const panes = sorted.map((tg, i) => {
      const abbr = abbrOf(tg);
      let tables = '';
      (tg.statistics || []).forEach(sg => {
        if (sg.name === 'passing') tables += playerTable(abbr, sg, 'passingYards');
        else if (sg.name === 'rushing') tables += playerTable(abbr, sg, 'rushingYards');
        else if (sg.name === 'receiving') tables += playerTable(abbr, sg, 'receivingYards');
        else if (sg.name === 'kicking') tables += playerTable(abbr, sg, 'fieldGoalsMade');
      });
      return `<div class="team-pane${i === 0 ? ' active' : ''}" data-pane="${i}" role="tabpanel">
        <div class="table-wrap">${tables || '<div class="empty">No player stats yet.</div>'}</div></div>`;
    }).join('');
    return `<div data-tabgroup><div class="team-tabs" role="tablist">${tabs}</div>${panes}</div>`;
  }

  function teamStatsSection(teams) {
    if (!teams || teams.length < 2) return '';
    const [aT, hT] = teams;
    const val = (t, key) => {
      const s = (t.statistics || []).find(x => x.name === key);
      return s ? (s.displayValue ?? s.value ?? s.summary ?? '') : '';
    };
    const rows = TEAM_STATS.map(([key, label]) => {
      const av = val(aT, key), hv = val(hT, key);
      if (!av && !hv) return '';
      const aNum = parseFloat(av), hNum = parseFloat(hv);
      const aCls = !isNaN(aNum) && !isNaN(hNum) && aNum > hNum ? ' style="font-weight:800"' : '';
      const hCls = !isNaN(aNum) && !isNaN(hNum) && hNum > aNum ? ' style="font-weight:800"' : '';
      return `<tr><td${aCls}>${HC.esc(av)}</td><td class="pl" style="text-align:center;color:var(--muted)">${HC.esc(label)}</td><td${hCls}>${HC.esc(hv)}</td></tr>`;
    }).join('');
    if (!rows) return '';
    const aAbbr = ((aT.team || {}).abbreviation) || 'AWAY';
    const hAbbr = ((hT.team || {}).abbreviation) || 'HOME';
    return `<div class="table-wrap"><table class="stats" data-sort-id="team-stats">
      <thead><tr><th data-sort-type="number">${HC.esc(aAbbr)}</th><th data-sort-type="text" style="text-align:center">Stat</th><th data-sort-type="number">${HC.esc(hAbbr)}</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }

  async function loadGame(quiet = false) {
    if (!gameId) { box.innerHTML = '<div class="empty">No game selected. <a href="index.html">Back to scores</a>.</div>'; return; }
    const uiState = {
      openSections: Array.from(box.querySelectorAll('details'), section => section.open),
      activeTabs: Array.from(box.querySelectorAll('[data-tabgroup]'), group => {
        const active = group.querySelector('.team-tab.active');
        return active ? active.textContent.trim() : '';
      }),
      recapExpanded: Boolean(box.querySelector('#recapText.expanded'))
    };
    if (!quiet) box.innerHTML = HC.skeletons(3);
    try {
      const [d, recaps, highlightMap] = await Promise.all([
        HC.gameSummary(gameId),
        HC.fetchJSON('data/recaps.json').catch(() => []),
        HC.fetchJSON('data/highlights.json').catch(() => null)
      ]);
      const comp = ((d.header || {}).competitions || [])[0] || {};
      const gameDate = new Date(comp.date);
      const dateSeason = Number.isNaN(gameDate.getTime()) ? null :
        gameDate.getUTCFullYear() - (gameDate.getUTCMonth() < 3 ? 1 : 0);
      const summarySeason = Number(d.header?.season?.year ?? comp.season?.year ?? dateSeason);
      const requestedSeason = Number(seasonParam);
      const season = Number.isInteger(requestedSeason) && requestedSeason >= 2000 && requestedSeason <= 2100
        ? requestedSeason : summarySeason;
      const reportedWeek = Number(d.header?.week?.number ?? comp.week?.number);
      const requestedWeek = Number(weekParam);
      const week = Number.isInteger(requestedWeek) && requestedWeek >= 1 && requestedWeek <= 18
        ? requestedWeek : Number.isInteger(reportedWeek) && reportedWeek >= 1 && reportedWeek <= 18 ? reportedWeek : 1;
      if (Number.isInteger(season) && season >= 2000 && season <= 2100) HC.setContext(season, week);
      const sb = await HC.scoreboard(week, season || undefined).catch(() => null);
      const teams = comp.competitors || [];
      const away = teams.find(t => t.homeAway === 'away') || {};
      const home = teams.find(t => t.homeAway === 'home') || {};
      const st = (d.header || {}).status || {};
      const state = ((st.type || {}).state) || '';
      gameState = state;
      currentTeams = {
        away: away.team || {}, home: home.team || {},
        awayAbbr: (away.team || {}).abbreviation || ''
      };
      const c = HC.teamTextColors(away.team || {}, home.team || {});
      const recap = (recaps || []).find(r => r.season === season && String(r.gameId) === String(gameId));
      const venue = (((d.gameInfo || {}).venue) || {}).fullName || '';
      const highlight = HC.highlightLink(highlightMap, gameId);

      // prev/next game within the week, ordered by kickoff (spoiler-safe: no scores)
      let navHtml = '';
      try {
        const events = ((sb || {}).events || [])
          .map(e => ({ id: String(e.id), date: e.date, info: HC.gameInfo(e) }))
          .sort((a, b) => new Date(a.date) - new Date(b.date));
        const idx = events.findIndex(e => e.id === String(gameId));
        if (idx >= 0 && events.length > 1) {
          const lbl = e => `${e.info.away.abbr} @ ${e.info.home.abbr}`;
          const btn = (e, dir) =>
            `<a class="btn btn-ghost game-nav-btn" href="${HC.gameURL(e.id, { season, week })}">${dir === 'prev' ? '← ' : ''}${HC.esc(lbl(e))}${dir === 'next' ? ' →' : ''}</a>`;
          const prev = events[idx - 1], next = events[idx + 1];
          navHtml = (prev && next)
            ? `<nav class="game-nav" aria-label="Other games this week">${btn(prev, 'prev')}${btn(next, 'next')}</nav>`
            : `<nav class="game-nav single" aria-label="Other games this week">${btn(prev || next, prev ? 'prev' : 'next')}</nav>`;
        }
      } catch (e) {}

      const heroScore = state === 'pre' ? 'vs' :
        `<span style="color:${c.away}">${HC.esc(away.score ?? '')}</span><span class="dash">–</span><span style="color:${c.home}">${HC.esc(home.score ?? '')}</span>`;
      // team logos aren't in the summary payload; pull them from the scoreboard
      const logoByAbbr = {};
      try {
        for (const e of ((sb || {}).events || [])) {
          for (const comp of (((e.competitions || [])[0] || {}).competitors || [])) {
            const ab = (((comp.team || {}).abbreviation) || '').toUpperCase();
            if (ab && (comp.team || {}).logo) logoByAbbr[ab] = comp.team.logo;
          }
        }
      } catch (e) {}
      const logoFor = (t) => (t.team || {}).logo ||
        logoByAbbr[((((t.team || {}).abbreviation) || '').toUpperCase())] || '';
      const side = (t, color) => `<div class="side">
          <img src="${HC.esc(logoFor(t))}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
          <div class="nm" style="color:${color}">${HC.esc((t.team || {}).shortDisplayName || (t.team || {}).displayName || '')}</div>
        </div>`;

      let html = `<div class="game-hero" style="--ga:${c.away};--gh:${c.home}">
          <div class="matchup">${side(away, c.away)}<div class="mid"><span data-outcome>${heroScore}</span><span data-spoiler-placeholder hidden>vs</span></div>${side(home, c.home)}</div>
          <div class="gmeta"><span data-outcome>${HC.esc(((st.type || {}).shortDetail) || '')} · </span> ${HC.esc(HC.fmtDate(comp.date))}${venue ? ' · ' + HC.esc(venue) : ''}</div>
        </div>
        ${highlight
          ? `<a class="btn btn-primary btn-block-center" target="_blank" rel="noopener" href="${HC.esc(highlight.url)}">▶ Watch highlights on ${HC.esc(highlight.source)}</a>`
          : `<p class="page-sub" style="text-align:center;margin:16px 0">${HC.esc(HC.highlightPending(highlightMap, state === 'post'))}</p>`}
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn btn-ghost" id="watchedBtn" style="flex:1">${HC.isWatched(gameId) ? '✓ Watched' : 'Mark as watched'}</button>
          <button class="btn btn-ghost" id="copyGameBtn" style="flex:0 0 auto" aria-label="Copy link to this game" title="Copy link to this game">⧉</button>
        </div>
        ${navHtml}
        <p data-spoiler-placeholder hidden class="spoiler-notice">Scores, recaps, and game stats are hidden. Turn off Hide spoilers in Settings to reveal them.</p>`;

      if (recap) {
        const recapColors = HC.teamTextColors(away.team || {}, home.team || {});
        html += `<article data-outcome class="recap-card" style="margin-top:14px">
          <div class="recap-scoreboard">
            <div class="recap-score-team"><span class="recap-score-location">Away</span><strong style="color:${recapColors.away}">${HC.esc(recap.away)}</strong><span class="recap-score-number">${HC.esc(recap.awayScore)}</span></div>
            <span class="recap-score-status">Final</span>
            <div class="recap-score-team"><span class="recap-score-location">Home</span><strong style="color:${recapColors.home}">${HC.esc(recap.home)}</strong><span class="recap-score-number">${HC.esc(recap.homeScore)}</span></div>
          </div>
          <span class="verdict ${HC.esc(recap.verdict)}">${HC.esc(String(recap.verdict).replace(/-/g, ' '))}</span>
          <h3>${HC.esc(recap.headline)}</h3>
          <div class="recap-text" id="recapText">${HC.esc(recap.recap).split('\n\n').map(x => `<p>${x}</p>`).join('')}</div>
          <button class="recap-toggle" id="recapToggle" aria-expanded="false">Show more ▾</button>
          <div class="keystat"><strong>Key stat:</strong> ${HC.esc(recap.keyStat)}</div>
        </article>`;
      }

      if (state !== 'pre') {
        html += '<section data-outcome aria-label="Game statistics">';
        const scoringBody = scoringSection(d.scoringPlays);
        if (scoringBody) html += collapsible('Scoring Summary', scoringBody, false, (d.scoringPlays || []).length);
        const groups = (d.boxscore || {}).players || [];
        const boxBody = boxScoreTabs(groups, away, home, c);
        if (boxBody) html += collapsible('Box Score', boxBody, true);
        const teamBody = teamStatsSection((d.boxscore || {}).teams);
        if (teamBody) html += collapsible('Team Stats', teamBody, false);

        // fantasy leaders for this game
        const fTop = computeFantasy(groups);
        if (fTop.length) {
          const fBody = `<table class="stats" data-sort-id="game-fantasy" data-sort-default="3"><thead><tr><th data-sort-type="number">#</th><th data-sort-type="text">Player</th><th data-sort-type="text">Line</th><th data-sort-type="number">Pts</th></tr></thead><tbody>` +
            fTop.map((e, i) => `<tr><td>${i + 1}</td><td class="pl">${HC.esc(e.name)} <span class="pos">${HC.esc(e.team)}</span></td><td>${HC.esc(fantasyLine(e))}</td><td><strong>${e.pts.toFixed(1)}</strong></td></tr>`).join('') +
            `</tbody></table>`;
          html += collapsible('Game Fantasy Points <span class="tag">(PPR)</span>', fBody, false);
        }
        const injBody = injuriesSection(d.injuries, away, home, c);
        if (injBody) {
          const injCount = (d.injuries || []).reduce((n, e) => n + ((e.injuries || []).length), 0);
          html += collapsible('🚑 Injuries', injBody, false, injCount);
        }
        html += '</section>';
      } else {
        html += `<div class="empty">This game hasn't started yet — box score, fantasy and injuries will appear here after kickoff.</div>`;
      }

      box.innerHTML = html;
      HC.contentReady(box);
      Array.from(box.querySelectorAll('details')).forEach((section, i) => {
        if (uiState.openSections[i] !== undefined) section.open = uiState.openSections[i];
      });
      box.querySelectorAll('[data-tabgroup]').forEach(group => {
        const tabs = group.querySelectorAll('.team-tab');
        const panes = group.querySelectorAll('.team-pane');
        tabs.forEach(t => t.addEventListener('click', () => {
          tabs.forEach(x => {
            const on = x === t;
            x.classList.toggle('active', on);
            x.setAttribute('aria-selected', on);
          });
          panes.forEach(p => p.classList.toggle('active', p.dataset.pane === t.dataset.tab));
        }));
      });
      box.querySelectorAll('[data-tabgroup]').forEach((group, i) => {
        const wanted = uiState.activeTabs[i];
        const tab = Array.from(group.querySelectorAll('.team-tab')).find(t => t.textContent.trim() === wanted);
        if (tab) tab.click();
      });
      const wb = document.getElementById('watchedBtn');
      if (wb) wb.addEventListener('click', () => {
        wb.textContent = HC.toggleWatched(gameId) ? '✓ Watched' : 'Mark as watched';
      });
      const cb = document.getElementById('copyGameBtn');
      if (cb) cb.addEventListener('click', () => HC.copyLink(location.href, cb));
      const rt = document.getElementById('recapText');
      const rtg = document.getElementById('recapToggle');
      syncRecapToggle = () => {};
      if (rt && rtg) {
        const updateRecapToggle = () => {
          if (!HC.spoilersHidden() && !rt.classList.contains('expanded')) {
            rtg.style.display = rt.scrollHeight > rt.clientHeight + 2 ? '' : 'none';
          }
        };
        const setExpanded = expanded => {
          rt.classList.toggle('expanded', expanded);
          rtg.setAttribute('aria-expanded', String(expanded));
          rtg.innerHTML = expanded ? 'Show less ▴' : 'Show more ▾';
        };
        if (uiState.recapExpanded) setExpanded(true);
        syncRecapToggle = updateRecapToggle;
        syncRecapToggle();
        rtg.addEventListener('click', () => {
          setExpanded(!rt.classList.contains('expanded'));
        });
      }
      if (HC.renderAds && !adsInitialized) {
        adBox.innerHTML = '<div class="ad-slot"><ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-1549898506474594" data-ad-slot="4662837100" data-ad-format="auto" data-full-width-responsive="true"></ins></div>';
        HC.renderAds();
        adsInitialized = true;
      }
      document.title = `Highlight Corner — ${(away.team || {}).abbreviation} @ ${(home.team || {}).abbreviation}`;
    } catch (e) {
      if (!quiet) box.innerHTML = '<div class="error">Couldn’t load this game — it may have been flexed out of existence. <a href="index.html">Back to scores</a>.</div>';
    }
  }

  loadGame().finally(() => {
    stopPolling = HC.startVisiblePolling(() => {
      if (gameState === 'post') { stopPolling(); return; }
      return loadGame(true);
    });
  });
})();
