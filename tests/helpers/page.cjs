const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '../..');
const fixture = require('../fixtures/sports.json');
const clone = value => structuredClone(value);
const reply = data => ({ ok: true, status: 200, json: async () => clone(data) });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

// Resources are never enabled: external scripts, CSS, logos and ads cannot load.
// fetch is an explicit router; unmatched requests fail the test even if the page catches them.
function page(t, filename = 'index.html', options = {}) {
  const errors = [], requests = [], unexpected = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(options.html ?? fs.readFileSync(path.join(root, filename), 'utf8'), {
    url: 'http://localhost:8080/' + (options.urlPath || filename) + (options.query || ''),
    runScripts: 'outside-only', virtualConsole: console
  });
  t.after(() => {
    dom.window.close();
    assert.deepEqual(unexpected, [], 'all fetches must use known fixtures');
    assert.deepEqual(errors, [], 'no uncaught page errors');
  });
  const w = dom.window;
  // Pin freshness checks so the official highlight fixture does not expire in CI.
  w.Date.now = () => Date.parse('2026-10-07T12:00:00Z');
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  for (const [key, value] of Object.entries(options.storage || {})) w.localStorage.setItem(key, value);
  if (options.blockStorage) Object.defineProperty(w, 'localStorage', { get() { throw new Error('Storage blocked'); } });
  const data = clone(fixture);
  w.fetch = async (url, init) => {
    const request = new URL(url, w.location.href);
    requests.push(request.href);
    if (options.fetch) {
      const result = await options.fetch(request, init, data);
      if (result !== undefined) return result;
    }
    if (request.pathname === '/data/highlights.json') return reply(data.highlights);
    if (request.pathname === '/data/recaps.json') return reply(data.recaps);
    if (request.pathname === '/data/players.json') return reply(data.players);
    if (request.hostname === 'site.api.espn.com' && request.pathname.endsWith('/scoreboard')) return reply(data.scoreboard);
    if (request.hostname === 'site.api.espn.com' && request.pathname.endsWith('/summary')) return reply(data.summary);
    if (request.hostname === 'api.sleeper.app' && /^\/v1\/stats\/nfl\/regular\/2026\/\d+$/.test(request.pathname)) return reply(data.stats);
    unexpected.push(request.href);
    throw new Error('Unmocked request: ' + request.href);
  };
  for (const script of w.document.querySelectorAll('script')) {
    const src = script.getAttribute('src');
    if (src && /^https?:/.test(src)) continue;
    w.eval(src ? fs.readFileSync(path.join(root, src), 'utf8') : script.textContent);
  }
  return { dom, w, doc: w.document, requests, data };
}

async function until(predicate, message = 'page state did not resolve') {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.fail(message);
}
function select(w, id, value) {
  const el = w.document.getElementById(id);
  el.value = value;
  el.dispatchEvent(new w.Event('change'));
}
module.exports = { page, until, select, reply, deferred, fixture, clone, root };
