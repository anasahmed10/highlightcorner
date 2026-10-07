const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

async function highlights(map) {
  const dom = new JSDOM(fs.readFileSync('highlights.html', 'utf8'), {
    url: 'https://highlightcorner.com/highlights.html', runScripts: 'outside-only'
  });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  const event = (id, completed) => ({ id, date: '2026-10-04T17:00:00Z',
    status: { type: { state: completed ? 'post' : 'pre', completed } },
    competitions: [{ competitors: [
      { homeAway: 'away', score: '21', team: { abbreviation: 'PHI', displayName: 'Philadelphia Eagles' } },
      { homeAway: 'home', score: '17', team: { abbreviation: 'TB', displayName: 'Tampa Bay Buccaneers' } }
    ] }] });
  const scoreboard = { week: { number: 4 }, events: [event('123', true), event('456', false)] };
  w.fetch = async url => {
    if (String(url).includes('data/highlights.json')) {
      if (map instanceof Error) throw map;
      return { ok: true, json: async () => map };
    }
    return { ok: true, json: async () => scoreboard };
  };
  w.eval(fs.readFileSync('js/app.js', 'utf8'));
  w.eval(fs.readFileSync('js/highlights.js', 'utf8'));
  for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve));
  return dom;
}

test('featured and game buttons use the matched video, and copying uses that same URL', async () => {
  const video = 'https://www.youtube.com/watch?v=Abcdef12345';
  const dom = await highlights({ version: 1, status: 'ready', games: {
    '123': { url: video, source: 'YouTube', channelId: 'UCDVYQ4Zhbm3S2dlz7P1GBDg', verifiedAt: new Date().toISOString() }
  } });
  const doc = dom.window.document;
  const links = Array.from(doc.querySelectorAll('#hl a[target="_blank"]'));
  assert.equal(links.length, 2);
  assert.ok(links.every(link => link.href === video));
  assert.equal(doc.querySelector('#hl .copy-btn').dataset.url, video);
  assert.match(doc.getElementById('hl').textContent, /Highlights available after the game/);
  assert.equal(doc.querySelectorAll('#hl .copy-btn').length, 1);
  dom.window.close();
});

test('a failed map request leaves game navigation and a clear unavailable state', async () => {
  const dom = await highlights(new Error('offline'));
  const doc = dom.window.document;
  assert.match(doc.getElementById('hl').textContent, /Official highlight links temporarily unavailable/);
  assert.equal(doc.querySelectorAll('#hl a[target="_blank"]').length, 0);
  assert.equal(doc.querySelectorAll('#hl a[href^="game.html"]').length, 2);
  dom.window.close();
});
