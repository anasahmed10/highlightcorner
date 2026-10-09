const { test } = require('node:test');
const assert = require('node:assert/strict');
const { page, until, select, reply, deferred } = require('./helpers/page.cjs');

test('manual score refresh disables its button and failed week selection cannot retain another week', async t => {
  let fail = false;
  const pending = deferred();
  const p = page(t, 'index.html', { fetch: url => {
    if (url.searchParams.get('week') === '2') return pending.promise;
    if (fail && url.searchParams.has('week')) return { ok: false, status: 503 };
  } });
  await until(() => p.doc.querySelector('.game-card'));
  select(p.w, 'weekSel', '2');
  assert.equal(p.doc.getElementById('refreshScores').disabled, true);
  pending.reject(new Error('blocked'));
  await until(() => p.doc.querySelector('#retryScores'));
  assert.equal(p.doc.querySelector('.game-card'), null);
  select(p.w, 'weekSel', '5');
  await until(() => p.doc.querySelector('.game-card'));
  fail = true;
  p.doc.getElementById('refreshScores').click();
  assert.equal(p.doc.getElementById('refreshScores').disabled, true);
  await until(() => p.doc.querySelector('#retryScores'));
  assert.equal(p.doc.getElementById('refreshScores').disabled, false);
});

for (const [file, ready] of [['index.html', '.game-card'], ['game.html', '.game-hero']]) {
  test(`${file}: malformed optional recap data cannot take down sports content`, async t => {
    const p = page(t, file, { query: '?id=1003&season=2026&week=5', fetch: url => {
      if (url.pathname.endsWith('recaps.json')) return reply([null, { invalid: true }]);
    } });
    await until(() => p.doc.querySelector(ready));
    assert.equal(p.doc.querySelector('#main .error'), null);
  });
}

for (const [file, retry, ready, path] of [
  ['game.html', '#retryGame', '.game-hero', '/summary'],
  ['recaps.html', '#retryRecaps', '.recap-card', '/data/recaps.json']
]) test(`${file}: invalid data has a retry path that restores content`, async t => {
  let fail = true;
  const p = page(t, file, { query: '?id=1003&week=5', fetch: url => {
    if (fail && url.pathname.endsWith(path)) return reply(null);
  } });
  await until(() => p.doc.querySelector(retry));
  assert.equal(p.doc.querySelector('#main .skel'), null);
  fail = false;
  p.doc.querySelector(retry).click();
  await until(() => p.doc.querySelector(ready));
  assert.equal(p.doc.querySelector(retry), null);
});

test('fantasy position changes preserve pending and failed requests instead of restoring previous-week rows', async t => {
  const pending = deferred();
  const p = page(t, 'fantasy.html', { fetch: url => {
    if (url.pathname.endsWith('/2026/2')) return pending.promise;
  } });
  await until(() => p.doc.querySelector('#fantasy table'));
  select(p.w, 'weekSel', '2');
  select(p.w, 'posSel', 'WR');
  assert.ok(p.doc.querySelector('#fantasy .skel'));
  assert.equal(p.doc.querySelector('#fantasy table'), null);
  pending.reject(new Error('blocked'));
  await until(() => p.doc.querySelector('#retryFantasy'));
  select(p.w, 'posSel', 'QB');
  assert.ok(p.doc.querySelector('#retryFantasy'));
});

for (const file of ['index.html', 'highlights.html']) test(`${file}: malformed scoreboard resolves to an error`, async t => {
  const p = page(t, file, { fetch: url => {
    if (url.searchParams.has('week')) return reply({ events: {} });
  } });
  await until(() => p.doc.querySelector('#main .error button'));
  assert.equal(p.doc.querySelector('#main .skel'), null);
});

test('game status falls back to competition status when ESPN omits header status', async t => {
  const p = page(t, 'game.html', { query: '?id=1003&week=5', fetch: (url, _init, data) => {
    if (url.pathname.endsWith('/summary')) {
      const summary = structuredClone(data.summary);
      summary.header.competitions[0].status = summary.header.status;
      delete summary.header.status;
      return reply(summary);
    }
  } });
  await until(() => p.doc.querySelector('.game-hero'));
  assert.match(p.doc.querySelector('.gmeta').textContent, /Final/);
});
