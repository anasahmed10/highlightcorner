const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM, VirtualConsole } = require('jsdom');

const video = 'https://www.youtube.com/watch?v=Abcdef12345';
const entry = () => ({ url: video, source: 'YouTube', channelId: 'UCDVYQ4Zhbm3S2dlz7P1GBDg', verifiedAt: new Date().toISOString() });
async function board(map) {
  const errors = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM(fs.readFileSync('index.html', 'utf8'), { url: 'https://highlightcorner.com/', runScripts: 'outside-only', virtualConsole: console });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  const event = (id, state) => ({ id, date: '2026-10-04T17:00:00Z', status: { type: { state, completed: state === 'post' } }, competitions: [{ competitors: [
    { homeAway: 'away', score: '21', team: { abbreviation: 'PHI', displayName: 'Philadelphia Eagles' } },
    { homeAway: 'home', score: '17', team: { abbreviation: 'TB', displayName: 'Tampa Bay Buccaneers' } }
  ] }] });
  const scores = { week: { number: 4 }, events: [event('matched', 'post'), event('missing', 'post'), event('future', 'pre')] };
  w.fetch = async url => {
    if (String(url).includes('data/highlights.json')) {
      if (map instanceof Error) throw map;
      return { ok: true, json: async () => map };
    }
    return { ok: true, json: async () => String(url).includes('recaps') ? [] : scores };
  };
  w.eval(fs.readFileSync('js/app.js', 'utf8'));
  w.eval(fs.readFileSync('js/scoreboard.js', 'utf8'));
  for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve));
  return { dom, errors };
}

test('score cards expose verified highlights beside game links without intercepting link activation', async () => {
  const { dom, errors } = await board({ version: 1, status: 'ready', games: { matched: entry(), future: entry() } });
  const w = dom.window;
  const doc = w.document;
  const highlights = doc.querySelectorAll('#games .highlight-link');
  assert.equal(highlights.length, 1);
  const link = highlights[0];
  assert.equal(link.href, video);
  assert.equal(link.previousElementSibling.textContent, 'View game →');
  assert.equal(link.target, '_blank');
  assert.ok(link.rel.includes('noopener'));
  assert.equal(doc.querySelectorAll('#games .card-actions a[href^="game.html"]').length, 3);
  assert.equal(doc.querySelectorAll('a[data-page="highlights"]').length, 0);
  const enter = new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  link.dispatchEvent(enter);
  assert.equal(enter.defaultPrevented, false);
  // Suppress jsdom's external navigation while checking the card click handler.
  link.addEventListener('click', event => event.preventDefault());
  link.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(errors.length, 0);
  w.document.dispatchEvent(new w.Event('hc:theme'));
  assert.equal(doc.querySelector('.highlight-link').href, video);
  dom.window.close();
});

test('unavailable highlight data leaves score cards and game navigation usable', async () => {
  const { dom } = await board(new Error('unavailable'));
  const doc = dom.window.document;
  assert.equal(doc.querySelectorAll('#games .game-card').length, 3);
  assert.equal(doc.querySelectorAll('#games .highlight-link').length, 0);
  assert.equal(doc.querySelectorAll('#games .card-actions a').length, 3);
  assert.match(doc.getElementById('freshness').textContent, /Updated/);
  dom.window.close();
});
