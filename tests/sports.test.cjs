const { test } = require('node:test');
const assert = require('node:assert/strict');
const { page, until, fixture, select, reply, deferred } = require('./helpers/page.cjs');

for (const [index, state, away, home, score] of [
  [0, 'pre', 'TB', 'DAL', '0'], [1, 'in', 'NE', 'NYJ', '14'], [2, 'post', 'PIT', 'CLE', '24']
]) test(`normalizes ${state} games independently of competitor order`, t => {
  const { w } = page(t, 'privacy.html');
  const game = w.HC.gameInfo(fixture.scoreboard.events[index]);
  assert.equal(game.id, String(1001 + index));
  assert.equal(game.state, state);
  assert.equal(game.completed, state === 'post');
  assert.equal(game.away.abbr, away);
  assert.equal(game.home.abbr, home);
  assert.equal(game.away.score, score);
  assert.equal(w.HC.statusClass(game), state === 'in' ? 'live' : state === 'post' ? 'final' : '');
});

test('missing competition, competitors and team metadata normalize safely', t => {
  const { w } = page(t, 'privacy.html');
  for (const input of [{ id: 42 }, { id: 42, competitions: [{}] },
    { id: 42, competitions: [{ competitors: [{ homeAway: 'away' }, { homeAway: 'home' }] }] }]) {
    const game = w.HC.gameInfo(input);
    assert.equal(game.id, '42');
    for (const side of ['away', 'home']) {
      assert.equal(game[side].abbr, '');
      assert.equal(game[side].record, '');
      assert.equal(game[side].winner, false);
      assert.equal(game[side].score, undefined);
    }
  }
});

test('week discovery retains a valid earlier selection and clamps an unavailable future week', async t => {
  const { w, doc } = page(t, 'privacy.html');
  const sel = doc.createElement('select');
  assert.equal(await w.HC.weekOptions(sel, 2), 5);
  assert.equal(sel.value, '2');
  assert.equal(sel.options.length, 5);
  await w.HC.weekOptions(sel, 9);
  assert.equal(sel.value, '5');
  assert.match(sel.selectedOptions[0].textContent, /current/);
});

test('missing/invalid provider week uses a labeled unverified fallback', async t => {
  const { w, data, doc } = page(t, 'privacy.html');
  const sel = doc.createElement('select');
  for (const week of [undefined, { number: 0 }, { number: '5' }]) {
    data.scoreboard.week = week;
    await w.HC.weekOptions(sel);
    assert.equal(sel.value, '1');
    assert.match(sel.options[0].textContent, /unverified/);
  }
});

test('favorites, watched IDs, theme and spoilers persist across a fresh page', t => {
  const first = page(t, 'privacy.html');
  first.w.HC.toggleFavorite('PIT');
  first.w.HC.toggleWatched(1003);
  first.doc.querySelector('.spoiler-toggle').click();
  first.w.localStorage.setItem('hc-theme', 'dark');
  const storage = Object.fromEntries(Object.keys(first.w.localStorage).map(k => [k, first.w.localStorage.getItem(k)]));
  const next = page(t, 'privacy.html', { storage });
  assert.deepEqual(Array.from(next.w.HC.getFavorites()), ['PIT']);
  assert.equal(next.w.HC.isWatched('1003'), true);
  assert.equal(next.w.HC.spoilersHidden(), true);
  assert.equal(next.doc.documentElement.dataset.theme, 'dark');
  next.w.HC.toggleWatched('1003'); next.w.HC.toggleFavorite('PIT');
  assert.equal(next.w.HC.isWatched(1003), false);
  assert.equal(next.w.HC.getFavorites().length, 0);
});

for (const options of [{ blockStorage: true }, { storage: { 'hc:favorites': '{bad', 'hc:watched': 'bad', 'hc:spoilers': 'bad' } }]) {
  test(`preferences recover from ${options.blockStorage ? 'blocked' : 'malformed'} storage`, t => {
    const { w, doc } = page(t, 'privacy.html', options);
    assert.equal(w.HC.getFavorites().length, 0);
    assert.equal(w.HC.isWatched(1003), false);
    assert.equal(w.HC.spoilersHidden(), false);
    w.HC.toggleFavorite('PIT'); w.HC.toggleWatched(1003);
    doc.querySelector('.spoiler-toggle').click();
    assert.equal(w.HC.getFavorites()[0], 'PIT');
    assert.equal(w.HC.isWatched('1003'), true);
    assert.equal(w.HC.spoilersHidden(), true);
  });
}

for (const [file, container, ready] of [
  ['index.html', '#games', '.game-card'], ['highlights.html', '#hl', '.copy-btn'], ['fantasy.html', '#fantasy', 'table']
]) {
  test(`${file}: selected week wins over out-of-order success and failure replies`, async t => {
    const pending = new Map();
    const p = page(t, file, { fetch: url => {
      const week = file === 'fantasy.html' ? url.pathname.match(/2026\/(\d+)$/)?.[1] : url.searchParams.get('week');
      if (week === '2' || week === '3' || week === '4') {
        const d = deferred(); pending.set(week, d); return d.promise;
      }
    } });
    await until(() => p.doc.querySelector(container + ' ' + ready));
    select(p.w, 'weekSel', '2'); select(p.w, 'weekSel', '3'); select(p.w, 'weekSel', '4');
    await until(() => pending.size === 3);
    const latest = file === 'fantasy.html' ? { p1: { pts_ppr: 44 } } : { events: [fixture.scoreboard.events[2]] };
    pending.get('4').resolve(reply(latest));
    await until(() => file === 'fantasy.html'
      ? p.doc.querySelector(container).textContent.includes('44.0')
      : p.doc.querySelector(container).innerHTML.includes('week=4'));
    const rendered = p.doc.querySelector(container).innerHTML;
    if (file === 'fantasy.html') assert.match(rendered, /44\.0/);
    else assert.match(rendered, /week=4/);
    pending.get('2').resolve(reply(file === 'fantasy.html' ? {} : { events: [] }));
    pending.get('3').reject(new Error('late failure'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(p.doc.querySelector(container).innerHTML, rendered);
    assert.equal(p.doc.getElementById('weekSel').value, '4');
    if (file === 'index.html') assert.equal(p.doc.getElementById('refreshScores').disabled, false);
  });

  test(`${file}: API failure resolves loading and retry restores content`, async t => {
    let fail = true;
    const p = page(t, file, { fetch: url => {
      if ((file === 'fantasy.html' && url.hostname === 'api.sleeper.app') ||
          (file !== 'fantasy.html' && url.searchParams.has('week'))) {
        if (fail) return { ok: false, status: 503 };
      }
    } });
    await until(() => p.doc.querySelector(container + ' .error button'));
    assert.equal(p.doc.querySelector(container + ' .skel'), null);
    fail = false;
    p.doc.querySelector(container + ' .error button').click();
    await until(() => p.doc.querySelector(container + ' ' + ready));
    assert.equal(p.doc.querySelector(container + ' .error'), null);
  });
}

test('fantasy format race uses the most recent scoring format and selected week', async t => {
  const pending = [];
  let delay = false;
  const p = page(t, 'fantasy.html', { fetch: url => {
    if (delay && url.hostname === 'api.sleeper.app') {
      const d = deferred(); pending.push(d); return d.promise;
    }
  } });
  await until(() => p.doc.querySelector('#fantasy table'));
  delay = true;
  p.doc.querySelector('[data-fmt="half"]').click();
  p.doc.querySelector('[data-fmt="std"]').click();
  await until(() => pending.length === 2);
  pending[1].resolve(reply(fixture.stats));
  await until(() => p.doc.querySelector('#fantasy table'));
  assert.match(p.doc.querySelector('#fantasy').textContent, /18\.0/);
  assert.match(p.doc.querySelector('#fantasy').textContent, /10\.0/);
  const rendered = p.doc.querySelector('#fantasy').innerHTML;
  pending[0].resolve(reply({ p1: { pts_half_ppr: 99 } }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(p.doc.querySelector('#fantasy').innerHTML, rendered);
  assert.equal(p.doc.querySelector('[data-fmt="std"]').getAttribute('aria-pressed'), 'true');
  assert.ok(p.requests.some(url => url.endsWith('/regular/2026/5')));
});

test('fetch rejects malformed JSON and aborts a stalled request at its configured bound', async t => {
  const { w } = page(t, 'privacy.html');
  w.fetch = async () => ({ ok: true, json: async () => { throw new SyntaxError('bad JSON'); } });
  await assert.rejects(w.HC.fetchJSON('/data/recaps.json'), /bad JSON/);
  const originalTimer = w.setTimeout;
  let deadline;
  w.setTimeout = (fn, ms) => { deadline = ms; return originalTimer(fn, 0); };
  w.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')));
  });
  await assert.rejects(w.HC.fetchJSON('/data/recaps.json'), /aborted/);
  assert.equal(deadline, 12000);
});
