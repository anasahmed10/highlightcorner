const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function worker() {
  const handlers = {};
  const deleted = [];
  const cached = new Map([['https://highlightcorner.com/game.html', new Response('game shell')]]);
  const puts = [];
  const self = { location: { origin: 'https://highlightcorner.com' }, addEventListener: (name, cb) => { handlers[name] = cb; }, clients: { claim() {} }, skipWaiting() {} };
  const cache = { addAll: async () => {}, put: async (req, response) => { puts.push(response.status); }, match: async req => cached.get(typeof req === 'string' ? req : req.url) };
  const context = vm.createContext({ self, URL, Response, fetch: async () => { throw new Error('offline'); }, caches: { keys: async () => ['hc-old', 'another-app'], delete: async key => { deleted.push(key); }, open: async () => cache, match: cache.match } });
  vm.runInContext(fs.readFileSync('sw.js', 'utf8'), context);
  return { handlers, deleted, puts, context };
}

test('offline game query URLs resolve to the cached game shell', async () => {
  const w = worker(); let response;
  w.handlers.fetch({ request: { method: 'GET', mode: 'navigate', url: 'https://highlightcorner.com/game.html?id=123&week=4' }, respondWith: p => { response = p; } });
  assert.equal(await (await response).text(), 'game shell');
});

test('worker activation preserves other apps caches', async () => {
  const w = worker(); let done;
  w.handlers.activate({ waitUntil: p => { done = p; } });
  await done;
  assert.deepEqual(w.deleted, ['hc-old']);
});

test('failed JSON responses do not poison the offline cache', async () => {
  const w = worker(); let response;
  w.context.fetch = async () => new Response('unavailable', { status: 503 });
  w.handlers.fetch({ request: { method: 'GET', url: 'https://highlightcorner.com/data/recaps.json' }, respondWith: p => { response = p; } });
  assert.equal((await response).status, 503);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(w.puts, []);
});
