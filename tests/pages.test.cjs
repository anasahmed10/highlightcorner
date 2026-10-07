const { test } = require('node:test');
const assert = require('node:assert/strict');
const { page, until, select, reply, clone, fixture } = require('./helpers/page.cjs');

for (const [file, ready, nav] of [
  ['index.html', '#games .game-card', 'scores'], ['highlights.html', '#hl .copy-btn', null],
  ['fantasy.html', '#fantasy table', 'fantasy'], ['recaps.html', '#recaps .recap-card', 'recaps'],
  ['game.html', '#game .game-hero', 'scores'], ['privacy.html', '#main h1', null],
  ['404.html', '#main h1', null]
]) test(`${file} smoke: declared scripts initialize and render with fixture data`, async t => {
  const p = page(t, file, { query: file === 'game.html' ? '?id=1003&week=5' : '' });
  await until(() => p.doc.querySelector(ready));
  assert.equal(p.doc.querySelector('#main .loading, #main .skel, #main .error'), null);
  assert.ok(p.doc.querySelector('#settingsDialog'));
  if (nav) assert.equal(p.doc.querySelectorAll(`nav a[data-page="${nav}"][aria-current="page"]`).length, 2);
  else assert.equal(p.doc.querySelector('nav a[aria-current]'), null);
  assert.equal(p.doc.querySelector('#main script'), null, 'provider text never becomes a script');
});

test('scoreboard renders pre/live/final states, favorite and unwatched filters', async t => {
  const p = page(t);
  await until(() => p.doc.querySelectorAll('#games .game-card').length === 3);
  const cards = () => [...p.doc.querySelectorAll('#games .game-card')];
  assert.equal(cards()[0].querySelector('.status').textContent, 'Upcoming');
  assert.ok([...cards()[0].querySelectorAll('.tscore')].every(el => el.textContent === ''));
  assert.match(cards()[1].querySelector('.status.live').textContent, /Q3/);
  assert.equal(cards()[2].querySelector('.status.final').textContent, 'Final');
  assert.equal(cards()[2].getAttribute('aria-label'), 'PIT at CLE');
  assert.ok(cards().every(el => el.dataset.href.endsWith('&season=2026&week=5')));
  p.doc.querySelector('[data-team="PIT"]').click();
  p.doc.querySelector('[data-f="favorites"]').click();
  assert.equal(cards().length, 1);
  cards()[0].querySelector('.watched-toggle').click();
  assert.equal(p.w.HC.isWatched('1003'), true);
  p.doc.querySelector('[data-f="unwatched"]').click();
  assert.equal(cards().length, 2);
});

test('highlights feature only a completed game and use the verified video and preserve selected week in game links', async t => {
  const p = page(t, 'highlights.html');
  await until(() => p.doc.querySelector('#hl .copy-btn'));
  assert.match(p.doc.querySelector('#hl [data-outcome].game-card').textContent, /24–27/);
  const link = p.doc.querySelector('#hl [data-outcome].game-card a');
  assert.equal(new URL(link.href).hostname, 'www.youtube.com');
  assert.equal(link.href, fixture.highlights.games['1003'].url);
  assert.ok([...p.doc.querySelectorAll('#hl a.btn-ghost')].every(a => a.href.endsWith('&season=2026&week=5')));
});

test('fantasy skips unknown players, renders defenses, escapes names and filters positions', async t => {
  const p = page(t, 'fantasy.html');
  await until(() => p.doc.querySelector('#fantasy table'));
  assert.equal(p.doc.querySelectorAll('#fantasy tbody tr').length, 3);
  assert.match(p.doc.querySelector('#fantasy').textContent, /CLE D\/ST/);
  assert.match(p.doc.querySelector('#fantasy').textContent, /Fixture Receiver <b>name<\/b>/);
  assert.equal(p.doc.querySelector('#fantasy b'), null);
  select(p.w, 'posSel', 'WR');
  assert.equal(p.doc.querySelectorAll('#fantasy table').length, 1);
  assert.equal(p.doc.querySelector('#fantasy caption').textContent, 'Wide Receivers');
});

for (const [index, state] of [[0, 'pre'], [1, 'in'], [2, 'post']]) {
  test(`game center ${state}: matchup, URL context, stats and escaped content`, async t => {
    const event = fixture.scoreboard.events[index];
    const p = page(t, 'game.html', { query: `?id=${event.id}&week=5`, fetch: url => {
      if (url.pathname.endsWith('/summary')) {
        const summary = clone(fixture.summary);
        summary.header.status = event.status;
        summary.header.competitions = event.competitions;
        summary.header.competitions[0].date = event.date;
        return reply(summary);
      }
    } });
    await until(() => p.doc.querySelector('.game-hero'));
    assert.ok(p.requests.some(url => url.endsWith('/summary?event=' + event.id)));
    assert.ok(p.requests.some(url => url.endsWith('/scoreboard?dates=2026&seasontype=2&week=5')));
    assert.ok([...p.doc.querySelectorAll('.game-nav a')].every(a => a.href.endsWith('&season=2026&week=5')));
    assert.equal(p.doc.querySelectorAll('.game-nav a').length, index === 1 ? 2 : 1);
    if (state === 'pre') {
      assert.equal(p.doc.querySelector('.mid [data-outcome]').textContent, 'vs');
      assert.equal(p.doc.querySelector('details'), null);
      assert.match(p.doc.querySelector('#game .empty').textContent, /hasn't started/);
    } else {
      assert.match(p.doc.querySelector('.mid').textContent, state === 'in' ? /14–17/ : /24–27/);
      assert.ok(p.doc.querySelector('details[open]'));
      assert.match(p.doc.querySelector('#game').textContent, /Fixture touchdown <script>bad\(\)<\/script>/);
      assert.equal(p.doc.querySelector('#game script'), null);
      assert.match(p.doc.querySelector('#game').textContent, /18\.0/, 'ESPN-derived fantasy points');
      const tab = p.doc.querySelectorAll('.team-tab')[1];
      tab.click();
      assert.equal(tab.getAttribute('aria-selected'), 'true');
    }
  });
}

for (const [file, ready] of [
  ['index.html', '#games .game-card'], ['highlights.html', '#hl .copy-btn'],
  ['fantasy.html', '#fantasy table'], ['recaps.html', '#recaps .recap-card'], ['game.html', '#game .game-hero']
]) test(`${file}: saved spoiler preference hides rendered outcomes and theme changes avoid requests`, async t => {
  const p = page(t, file, { query: '?id=1003&week=5', storage: { 'hc:spoilers': '"hide"' } });
  await until(() => p.doc.querySelector(ready));
  const outcomes = [...p.doc.querySelectorAll('#main [data-outcome]')];
  assert.ok(outcomes.length > 0);
  assert.ok(outcomes.every(el => el.hidden));
  const count = p.requests.length;
  p.doc.dispatchEvent(new p.w.CustomEvent('hc:theme'));
  assert.equal(p.requests.length, count);
  p.doc.querySelector('.spoiler-toggle').click();
  assert.ok([...p.doc.querySelectorAll('#main [data-outcome]')].every(el => !el.hidden));
});

for (const [file, container] of [
  ['index.html', '#games'], ['highlights.html', '#hl'], ['fantasy.html', '#fantasy'], ['recaps.html', '#recaps']
]) test(`${file}: empty provider data resolves loading with usable controls`, async t => {
  const p = page(t, file, { fetch: url => {
    if (url.pathname.endsWith('/scoreboard')) return reply({ week: { number: 5 }, events: [] });
    if (url.hostname === 'api.sleeper.app') return reply({});
    if (url.pathname.endsWith('recaps.json')) return reply([]);
  } });
  await until(() => !p.doc.querySelector(container + ' .loading, ' + container + ' .skel'));
  assert.equal(p.doc.querySelector(container + ' .game-card, ' + container + ' table'), null);
  assert.ok(p.doc.querySelector('#settingsDialog'));
  if (file === 'index.html') {
    // The watched-count remains useful even when the provider returns no games.
    assert.match(p.doc.querySelector(container).textContent, /0 of 0 watched/);
    assert.equal(p.doc.getElementById('refreshScores').disabled, false);
  } else assert.ok(p.doc.querySelector(container + ' .empty'));
});

test('missing game ID gives recovery without requesting a summary', async t => {
  const p = page(t, 'game.html');
  await until(() => p.doc.querySelector('#game .empty'));
  assert.match(p.doc.querySelector('#game').textContent, /No game selected/);
  assert.equal(p.requests.length, 0);
});

test('invalid/unavailable game summary offers recovery and resolves its skeletons', async t => {
  const p = page(t, 'game.html', { query: '?id=invalid&week=5', fetch: url => {
    if (url.pathname.endsWith('/summary')) return { ok: false, status: 404 };
  } });
  await until(() => p.doc.querySelector('#game .error a'));
  assert.equal(p.doc.querySelector('#game .skel'), null);
});

for (const file of ['index.html', 'game.html']) test(`${file}: optional recaps failure preserves sports content`, async t => {
  const p = page(t, file, { query: '?id=1003&week=5', fetch: url => {
    if (url.pathname.endsWith('recaps.json')) throw new Error('recaps offline');
    if (file === 'game.html' && url.pathname.endsWith('/scoreboard')) throw new Error('logos offline');
  } });
  await until(() => p.doc.querySelector(file === 'index.html' ? '#games .game-card' : '#game .game-hero'));
  assert.equal(p.doc.querySelector('#main .error, #main .loading, #main .skel'), null);
});

test('recaps remain readable with failed optional scoreboards and escape editorial text', async t => {
  const p = page(t, 'recaps.html', { fetch: url => {
    if (url.pathname.endsWith('/scoreboard')) throw new Error('offline');
  } });
  await until(() => p.doc.querySelector('#recaps .recap-card'));
  assert.match(p.doc.querySelector('#recaps h3[data-outcome]').textContent, /<b>headline<\/b>/);
  assert.equal(p.doc.querySelector('#recaps b'), null);
  assert.equal(p.doc.querySelectorAll('#recaps [data-outcome] p').length, 2);
  assert.equal(p.doc.querySelector('#recaps h3 a').getAttribute('href'), 'game.html?id=1003&season=2026&week=5');
});
