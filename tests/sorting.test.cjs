const { test } = require('node:test');
const assert = require('node:assert/strict');
const { page, until, reply, clone, fixture } = require('./helpers/page.cjs');

const names = table => [...table.querySelectorAll('tbody tr')].map(row => row.cells[0].textContent.trim());
const control = (table, label) => [...table.querySelectorAll('thead th button')]
  .find(button => button.textContent.trim().startsWith(label));

test('game tables sort every header and keep all box score players', async t => {
  const summary = clone(fixture.summary);
  summary.scoringPlays.push({ period: { number: 1 }, clock: { displayValue: '12:30' }, team: { abbreviation: 'CLE' }, text: 'Field goal', awayScore: 0, homeScore: 3 });
  summary.boxscore.players[0].statistics.push({ name: 'receiving', text: 'Receiving', keys: ['receptions', 'receivingYards'], labels: ['REC', 'YDS'], athletes: [
    { athlete: { id: 'r1', displayName: 'Alpha' }, stats: ['2', '30'] },
    { athlete: { id: 'r2', displayName: 'Bravo' }, stats: ['10', '25'] },
    { athlete: { id: 'r3', displayName: 'Charlie' }, stats: ['5', '20'] },
    ...Array.from({ length: 7 }, (_, i) => ({ athlete: { id: `extra${i}`, displayName: `Extra ${i}` }, stats: ['1', String(19 - i)] }))
  ] });
  summary.boxscore.teams[0].statistics.push({ name: 'firstDowns', displayValue: '12' });
  summary.boxscore.teams[1].statistics.push({ name: 'firstDowns', displayValue: '19' });
  const p = page(t, 'game.html', { query: '?id=1003&season=2026&week=5', fetch: url =>
    url.pathname.endsWith('/summary') ? reply(summary) : undefined });
  await until(() => p.doc.querySelector('#game table'));
  const tables = [...p.doc.querySelectorAll('#game table.stats')];
  assert.ok(tables.length >= 4);
  assert.ok(tables.every(table => [...table.querySelectorAll('thead th')].every(th => th.querySelector('button'))));
  const receiving = tables.find(table => table.caption?.textContent.includes('Receiving'));
  assert.equal(receiving.tBodies[0].rows.length, 10);
  const rec = control(receiving, 'REC');
  rec.focus(); rec.click();
  assert.equal(names(receiving)[0], 'Bravo');
  assert.equal(receiving.querySelector('th[aria-sort="descending"] button'), rec);
  assert.equal(p.doc.activeElement, rec);
  rec.click();
  assert.equal(names(receiving)[0], 'Extra 0');
  const scoring = tables.find(table => table.caption?.textContent === 'Q1');
  assert.deepEqual([...scoring.querySelectorAll('thead th')].map(th => th.textContent.trim()), ['Clock', 'Play', 'Score']);
  control(scoring, 'Clock').click();
  assert.match(scoring.tBodies[0].rows[0].cells[0].textContent, /12:30/);
  const team = tables.find(table => table.querySelector('thead th:nth-child(2)')?.textContent.trim() === 'Stat');
  control(team, 'PIT').click();
  assert.equal(team.tBodies[0].rows[0].cells[1].textContent, 'Total Yards');
});

test('fantasy sorts all columns, includes nonzero low and negative scores, and restores sort after rerender', async t => {
  const stats = { ...fixture.stats, p3: { pts_ppr: -2, pts_half_ppr: -2, pts_std: -2, rec: 1 }, p4: { pts_ppr: 0, pts_half_ppr: 0, pts_std: 0 } };
  const players = { ...fixture.players, p3: { n: 'Negative Receiver', p: 'WR', t: 'PIT' }, p4: { n: 'Zero Receiver', p: 'WR', t: 'PIT' } };
  const p = page(t, 'fantasy.html', { fetch: url => {
    if (url.pathname.endsWith('/data/players.json')) return reply(players);
    if (url.hostname === 'api.sleeper.app') return reply(stats);
  } });
  await until(() => p.doc.querySelector('#fantasy table'));
  const wr = () => [...p.doc.querySelectorAll('#fantasy table')].find(table => table.caption.textContent === 'Wide Receivers');
  assert.equal(wr().tBodies[0].rows.length, 2);
  assert.ok([...wr().querySelectorAll('thead th')].every(th => th.querySelector('button')));
  control(wr(), 'Player').click();
  assert.match(wr().tBodies[0].rows[0].cells[1].textContent, /Fixture Receiver/);
  assert.equal(wr().tBodies[0].rows[0].cells[0].textContent, '1');
  p.doc.getElementById('posSel').value = 'WR';
  p.doc.getElementById('posSel').dispatchEvent(new p.w.Event('change'));
  assert.match(wr().querySelector('th[aria-sort="ascending"]')?.textContent.trim(), /^Player/);
  control(wr(), 'Pts').click();
  assert.match(wr().tBodies[0].rows[0].cells[1].textContent, /Fixture Receiver/);
  assert.equal(wr().tBodies[0].rows[1].cells[0].textContent, '2');
});

test('shared sorting compares combined numbers and keeps missing values last after rerender', t => {
  const p = page(t, 'privacy.html');
  const host = p.doc.createElement('div');
  p.doc.body.append(host);
  const markup = `<table class="stats" data-sort-id="fixture-pairs"><thead><tr><th data-sort-type="text">Player</th><th data-sort-type="number">Made/Att</th></tr></thead><tbody>
    <tr><td>Alpha</td><td>2/10</td></tr><tr><td>Bravo</td><td>10/12</td></tr><tr><td>Charlie</td><td>2/8</td></tr><tr><td>Missing</td><td>—</td></tr>
    </tbody></table>`;
  host.innerHTML = markup;
  p.w.HC.contentReady(host);
  control(host.querySelector('table'), 'Made/Att').click();
  assert.deepEqual(names(host.querySelector('table')), ['Bravo', 'Alpha', 'Charlie', 'Missing']);
  host.innerHTML = markup;
  p.w.HC.contentReady(host);
  assert.deepEqual(names(host.querySelector('table')), ['Bravo', 'Alpha', 'Charlie', 'Missing']);
  control(host.querySelector('table'), 'Made/Att').click();
  assert.deepEqual(names(host.querySelector('table')), ['Charlie', 'Alpha', 'Bravo', 'Missing']);
});

test('scoring clocks keep missing values after valid plays in either direction', t => {
  const p = page(t, 'privacy.html');
  const host = p.doc.createElement('div');
  p.doc.body.append(host);
  host.innerHTML = `<table class="stats" data-sort-id="fixture-clocks"><thead><tr><th data-sort-type="clock">Clock</th></tr></thead><tbody>
    <tr><td>8:30</td></tr><tr><td></td></tr><tr><td>12:45</td></tr>
    </tbody></table>`;
  p.w.HC.contentReady(host);
  const table = host.querySelector('table');
  control(table, 'Clock').click();
  assert.deepEqual(names(table), ['12:45', '8:30', '']);
  control(table, 'Clock').click();
  assert.deepEqual(names(table), ['8:30', '12:45', '']);
});
