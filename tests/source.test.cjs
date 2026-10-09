const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const { root } = require('./helpers/page.cjs');
const readJSON = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

test('committed recaps satisfy the reader contract with unique game IDs', () => {
  const recaps = readJSON('data/recaps.json');
  assert.ok(Array.isArray(recaps) && recaps.length > 0);
  const ids = new Set();
  for (const recap of recaps) {
    for (const key of ['gameId', 'away', 'home', 'headline', 'recap', 'keyStat']) {
      assert.ok(nonempty(recap[key]), `${recap.gameId}: ${key} must be text`);
    }
    assert.match(recap.gameId, /^\d+$/);
    assert.ok(!ids.has(recap.gameId), `duplicate game ID ${recap.gameId}`);
    ids.add(recap.gameId);
    assert.ok(Number.isInteger(recap.week) && recap.week >= 1 && recap.week <= 18);
    assert.ok(Number.isInteger(recap.season) && recap.season >= 2026, `${recap.gameId}: season`);
    for (const key of ['awayScore', 'homeScore']) assert.ok(Number.isInteger(recap[key]) && recap[key] >= 0, `${recap.gameId}: ${key}`);
    assert.ok(['nail-biter', 'comfortable', 'garbage-time', 'blowout'].includes(recap.verdict));
    assert.notEqual(recap.away, recap.home);
  }
});

test('committed player map preserves compact name/position/team records', () => {
  const players = readJSON('data/players.json');
  assert.ok(players && typeof players === 'object' && !Array.isArray(players));
  assert.ok(Object.keys(players).length > 0);
  for (const [id, player] of Object.entries(players)) {
    assert.ok(nonempty(id) && nonempty(player.n), `${id}: player name`);
    assert.ok(['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(player.p), `${id}: position`);
    // An empty team is legitimate for free agents; do not assert current roster facts.
    assert.equal(typeof player.t, 'string', `${id}: team`);
  }
});

test('every public HTML page references existing local assets and valid script syntax', () => {
  for (const file of fs.readdirSync(root).filter(name => name.endsWith('.html'))) {
    const dom = new JSDOM(fs.readFileSync(path.join(root, file), 'utf8'));
    try {
      for (const el of dom.window.document.querySelectorAll('script[src], link[href], img[src], a[href]')) {
        const ref = el.getAttribute(el.hasAttribute('src') ? 'src' : 'href');
        if (!ref || /^(?:[a-z]+:|\/\/|#)/i.test(ref)) continue;
        const target = decodeURIComponent(ref.split(/[?#]/)[0]).replace(/^\//, '');
        assert.ok(fs.existsSync(path.join(root, target)), `${file}: missing asset ${ref}`);
      }
      for (const script of dom.window.document.querySelectorAll('script:not([src])')) {
        assert.doesNotThrow(() => new vm.Script(script.textContent, { filename: file }));
      }
    } finally { dom.window.close(); }
  }
  for (const file of [...fs.readdirSync(path.join(root, 'js')).filter(name => name.endsWith('.js')).map(name => 'js/' + name), 'sw.js']) {
    assert.doesNotThrow(() => new vm.Script(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file }));
  }
});

test('every committed browser script has TypeScript source and page initializers are external', () => {
  for (const file of fs.readdirSync(path.join(root, 'js')).filter(name => name.endsWith('.js'))) {
    assert.ok(fs.existsSync(path.join(root, 'src/browser', file.replace(/\.js$/, '.ts'))), `${file}: missing TypeScript source`);
  }
  assert.ok(fs.existsSync(path.join(root, 'src/worker/sw.ts')));
  for (const [page, script] of [['privacy.html', 'js/privacy.js'], ['404.html', 'js/not-found.js']]) {
    const dom = new JSDOM(fs.readFileSync(path.join(root, page), 'utf8'));
    try {
      assert.ok(dom.window.document.querySelector(`script[src="${script}"]`), `${page}: missing ${script}`);
      assert.equal(dom.window.document.querySelectorAll('script:not([src])').length, 0, `${page}: inline initializer`);
    } finally { dom.window.close(); }
  }
});

test('manifest parses and its start URL and icons exist in the public shell', () => {
  const manifest = readJSON('manifest.webmanifest');
  for (const ref of [manifest.start_url, ...manifest.icons.map(icon => icon.src)]) {
    const file = ref.split(/[?#]/)[0].replace(/^\//, '');
    assert.ok(fs.existsSync(path.join(root, file)), `manifest asset ${ref}`);
  }
});
