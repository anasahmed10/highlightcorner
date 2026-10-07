const { test } = require('node:test');
const assert = require('node:assert/strict');
const { page, until, reply, clone, fixture } = require('./helpers/page.cjs');

test('shared context uses ESPN regular season and explicit provider parameters', async t => {
  const p = page(t, 'privacy.html');
  const season = p.doc.createElement('select');
  const week = p.doc.createElement('select');
  const context = await p.w.HC.initSeasonWeek(season, week);
  assert.deepEqual(JSON.parse(JSON.stringify(context)), { season: 2026, week: 5, verified: true });
  assert.equal(season.value, '2026');
  assert.equal(week.value, '5');
  await p.w.HC.scoreboard(4, 2026);
  assert.ok(p.requests.some(url => url.endsWith('/scoreboard?dates=2026&seasontype=2&week=4')));
  assert.equal(p.w.HC.gameURL('1003'), 'game.html?id=1003&season=2026&week=5');
  assert.equal(p.doc.querySelector('.brand').getAttribute('href'), 'index.html?season=2026&week=5');
});

for (const [type, label] of [[3, 'postseason'], [4, 'offseason']]) test(`${label} discovery selects final regular week and labels it`, async t => {
  const p = page(t, 'privacy.html', { fetch: url => {
    if (url.pathname.endsWith('/scoreboard') && !url.search) return reply({ season: { year: 2026, type }, week: { number: 2 }, events: [] });
  } });
  const season = p.doc.createElement('select');
  const week = p.doc.createElement('select');
  const context = await p.w.HC.initSeasonWeek(season, week);
  assert.equal(context.week, 18);
  assert.match(week.selectedOptions[0].textContent, /last regular/);
});

test('preseason rollover defaults to the last completed regular season', async t => {
  const p = page(t, 'privacy.html', { fetch: url => {
    if (url.pathname.endsWith('/scoreboard') && !url.search) return reply({ season: { year: 2027, type: 1 }, week: { number: 3 }, events: [] });
  } });
  const season = p.doc.createElement('select');
  const week = p.doc.createElement('select');
  const context = await p.w.HC.initSeasonWeek(season, week);
  assert.equal(context.season, 2026);
  assert.equal(context.week, 18);
  season.value = '2027';
  const upcoming = p.w.HC.selectSeasonWeek(season, week);
  assert.equal(upcoming.week, 1);
  assert.match(week.selectedOptions[0].textContent, /upcoming/);
});

test('a new regular season selects the matching Sleeper year', async t => {
  const p = page(t, 'fantasy.html', { fetch: url => {
    if (url.pathname.endsWith('/scoreboard')) return reply({ season: { year: 2027, type: 2 }, week: { number: 2 }, events: [] });
    if (url.hostname === 'api.sleeper.app' && url.pathname.endsWith('/regular/2027/2')) return reply(fixture.stats);
  } });
  await until(() => p.doc.querySelector('#fantasy table'));
  assert.equal(p.doc.getElementById('seasonSel').value, '2027');
  assert.equal(p.doc.getElementById('weekSel').value, '2');
  assert.ok(p.requests.some(url => url.endsWith('/regular/2027/2')));
});

test('missing fantasy stats name the selected season and week', async t => {
  const p = page(t, 'fantasy.html', { fetch: url => {
    if (url.hostname === 'api.sleeper.app') return reply({});
  } });
  await until(() => p.doc.querySelector('#fantasy .empty'));
  assert.match(p.doc.querySelector('#fantasy .empty').textContent, /2026 regular season, Week 5/);
});

test('an ESPN response for a different season is rejected', async t => {
  const p = page(t, 'privacy.html', { fetch: url => {
    if (url.pathname.endsWith('/scoreboard') && url.searchParams.has('dates')) {
      return reply({ season: { year: 2027, type: 2 }, events: fixture.scoreboard.events });
    }
  } });
  await assert.rejects(p.w.HC.scoreboard(5, 2026), /season mismatch/);
});

test('scoreboard, highlights and fantasy use the same linked season and week', async t => {
  for (const file of ['index.html', 'highlights.html', 'fantasy.html']) {
    const p = page(t, file, { query: '?season=2026&week=3' });
    await until(() => p.doc.querySelector(file === 'fantasy.html' ? '#fantasy table' : file === 'index.html' ? '#games .game-card' : '#hl .copy-btn'));
    assert.equal(p.doc.getElementById('seasonSel').value, '2026');
    assert.equal(p.doc.getElementById('weekSel').value, '3');
    assert.ok([...p.doc.querySelectorAll('nav a[data-page="fantasy"]')].every(a => a.getAttribute('href').includes('season=2026&week=3')));
    assert.ok(p.requests.some(url => file === 'fantasy.html'
      ? url.endsWith('/regular/2026/3')
      : url.endsWith('/scoreboard?dates=2026&seasontype=2&week=3')));
  }
});

test('future week links explain why they were clamped', async t => {
  const p = page(t, 'index.html', { query: '?season=2026&week=17' });
  await until(() => p.doc.querySelector('#games .game-card'));
  assert.equal(p.doc.getElementById('weekSel').value, '5');
  assert.match(p.doc.getElementById('contextNotice').textContent, /Week 17 is not available.*Week 5/);
  assert.match(p.w.location.search, /week=5/);
});

test('an unavailable provider context is labeled unverified', async t => {
  const p = page(t, 'index.html', { fetch: url => {
    if (url.pathname.endsWith('/scoreboard') && !url.search) throw new Error('discovery offline');
  } });
  await until(() => p.doc.querySelector('#games .game-card'));
  assert.match(p.doc.getElementById('weekSel').selectedOptions[0].textContent, /unverified/);
  assert.match(p.doc.getElementById('contextNotice').textContent, /could not be verified/);
});

test('recap archives carry a season and game links keep it', async t => {
  const recaps = clone(fixture.recaps);
  recaps[0].season = 2026;
  const p = page(t, 'recaps.html', { fetch: url => {
    if (url.pathname.endsWith('/recaps.json')) return reply(recaps);
  } });
  await until(() => p.doc.querySelector('#recaps .recap-card'));
  assert.match(p.doc.querySelector('#recaps .section-title').textContent, /2026.*Week 5/);
  assert.equal(p.doc.querySelector('#recaps h3 a').getAttribute('href'), 'game.html?id=1003&season=2026&week=5');
  assert.ok(p.requests.some(url => url.endsWith('/scoreboard?dates=2026&seasontype=2&week=5')));
});

test('recaps navigation preserves an incoming season and week', async t => {
  const p = page(t, 'recaps.html', { query: '?season=2026&week=4' });
  await until(() => p.doc.querySelector('#recaps .recap-card'));
  assert.equal(p.doc.querySelector('nav a[data-page="fantasy"]').getAttribute('href'), 'fantasy.html?season=2026&week=4');
});

test('overlapping recap weeks remain separate by season', async t => {
  const older = { ...fixture.recaps[0], season: 2026, gameId: '1003' };
  const newer = { ...fixture.recaps[0], season: 2027, gameId: '2003', headline: 'New season game' };
  const p = page(t, 'recaps.html', { fetch: url => {
    if (url.pathname.endsWith('/recaps.json')) return reply([older, newer]);
    if (url.pathname.endsWith('/scoreboard') && url.searchParams.get('dates') === '2027') {
      return reply({ season: { year: 2027, type: 2 }, week: { number: 5 }, events: [] });
    }
  } });
  await until(() => p.doc.querySelectorAll('#recaps .recap-card').length === 2);
  assert.deepEqual([...p.doc.querySelectorAll('#recaps .section-title')].map(el => el.textContent), ['2027 · Week 5', '2026 · Week 5']);
  assert.equal(p.doc.querySelector('#recaps h3[data-outcome] a').getAttribute('href'), 'game.html?id=2003&season=2027&week=5');
});
