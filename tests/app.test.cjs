const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

function app(options = {}) {
  const html = fs.readFileSync('index.html', 'utf8');
  const dom = new JSDOM(html, { url: 'https://highlightcorner.com/', runScripts: 'outside-only' });
  const w = dom.window;
  w.matchMedia = query => ({ matches: options.standalone && query.includes('standalone'), addEventListener() {} });
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.fetch = async () => ({ ok: true, json: async () => ({ week: { number: 7 } }) });
  w.eval(fs.readFileSync('js/app.js', 'utf8'));
  w.HC.initTheme(); w.HC.initNav('scores'); w.HC.initPrefs();
  return dom;
}

test('highlight links reject expired, unofficial, search, and generic collection destinations', () => {
  const dom = app();
  const HC = dom.window.HC;
  const link = { source: 'YouTube', channelId: 'UCDVYQ4Zhbm3S2dlz7P1GBDg',
    url: 'https://www.youtube.com/watch?v=Abcdef12345', verifiedAt: new Date().toISOString() };
  const lookup = entry => HC.highlightLink({ version: 1, games: { '123': entry } }, '123');
  assert.equal(lookup(link).url, link.url);
  assert.equal(lookup({ ...link, channelId: 'imposter' }), null);
  assert.equal(lookup({ ...link, url: 'https://www.youtube.com/results?search_query=NFL' }), null);
  assert.equal(lookup({ ...link, verifiedAt: '2020-01-01T00:00:00Z' }), null);
  assert.equal(lookup({ ...link, url: 'https://www.youtube.com.evil.example/watch?v=Abcdef12345' }), null);
  assert.equal(lookup({ ...link, source: 'NFL.com', url: 'https://www.nfl.com/videos/channel/game-highlights-vc' }), null);
  assert.equal(lookup({ ...link, source: 'NFL.com', url: 'https://www.nfl.com/videos/eagles-vs-buccaneers-highlights-week-4' }).source, 'NFL.com');
  dom.window.close();
});

test('fresh week selection uses the provider current week', async () => {
  const dom = app();
  const select = dom.window.document.getElementById('weekSel');
  await dom.window.HC.weekOptions(select);
  assert.equal(select.value, '7');
  dom.window.close();
});

test('game links use generated matchup pages only for matching season and published IDs', () => {
  const dom = app();
  dom.window.HC_GAME_PAGES = { '401872980': 2026 };
  assert.equal(dom.window.HC.gameURL('401872980', { season: 2026, week: 5 }), 'game-401872980.html');
  assert.equal(dom.window.HC.gameURL('unknown', { season: 2026, week: 5 }), 'game.html?id=unknown&season=2026&week=5');
  assert.equal(dom.window.HC.gameURL('401872980', { season: 2027, week: 6 }), 'game.html?id=401872980&season=2027&week=6');
  dom.window.close();
});

test('visible polling pauses in the background and refreshes when the page returns', async () => {
  const dom = app();
  const w = dom.window;
  let calls = 0;
  const stop = w.HC.startVisiblePolling(() => { calls++; }, 10);
  await new Promise(resolve => w.setTimeout(resolve, 25));
  assert.ok(calls >= 1);

  Object.defineProperty(w.document, 'visibilityState', { configurable: true, value: 'hidden' });
  w.document.dispatchEvent(new w.Event('visibilitychange'));
  const hiddenCalls = calls;
  await new Promise(resolve => w.setTimeout(resolve, 25));
  assert.equal(calls, hiddenCalls);

  Object.defineProperty(w.document, 'visibilityState', { configurable: true, value: 'visible' });
  w.document.dispatchEvent(new w.Event('visibilitychange'));
  assert.equal(calls, hiddenCalls + 1);
  stop();
  dom.window.close();
});

test('week discovery failure leaves a usable selector with an honest fallback', async () => {
  const dom = app();
  dom.window.fetch = async () => { throw new Error('offline'); };
  const select = dom.window.document.getElementById('weekSel');
  await dom.window.HC.weekOptions(select, 3);
  assert.equal(select.value, '3');
  assert.match(select.options[2].textContent, /unverified/);
  dom.window.close();
});

test('mobile and desktop nav expose current-page state, settings has install help', () => {
  const dom = app();
  const doc = dom.window.document;
  assert.equal(doc.querySelectorAll('a[data-page="scores"][aria-current="page"]').length, 2);
  assert.ok(doc.querySelector('#settingsDialog .install-action'));
  assert.match(doc.querySelector('#installHelp').textContent, /Add to Home Screen/);
  dom.window.close();
});

test('manual home-screen action reveals instructions from settings and promotion', () => {
  const dom = app();
  const doc = dom.window.document;
  const help = doc.getElementById('installHelp');
  const settingsAction = doc.querySelector('#settingsDialog .install-action');
  const promoAction = doc.getElementById('installPromoAction');
  assert.equal(help.hidden, true);
  assert.match(settingsAction.textContent, /Show home screen steps/);
  doc.querySelector('.settings-toggle').click();
  settingsAction.click();
  assert.equal(help.hidden, false);
  assert.equal(settingsAction.getAttribute('aria-expanded'), 'true');
  assert.equal(doc.activeElement, help);
  assert.match(help.textContent, /More, then Share/);
  assert.match(help.textContent, /Edit Actions/);

  settingsAction.click();
  assert.equal(help.hidden, true);
  assert.equal(settingsAction.getAttribute('aria-expanded'), 'false');

  doc.getElementById('settingsDialog').close();
  promoAction.click();
  assert.equal(doc.getElementById('settingsDialog').open, true);
  assert.equal(help.hidden, false);
  assert.equal(doc.activeElement, help);
  dom.window.close();
});

test('installation calls the browser prompt only on user action and consumes it once', async () => {
  const dom = app();
  const w = dom.window;
  let prompts = 0;
  const event = new w.Event('beforeinstallprompt', { cancelable: true });
  event.prompt = async () => { prompts++; };
  event.userChoice = Promise.resolve({ outcome: 'dismissed' });
  w.dispatchEvent(event);
  assert.equal(prompts, 0);
  assert.equal(event.defaultPrevented, true);
  w.document.querySelector('.install-action').click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(prompts, 1);
  w.document.querySelector('.install-action').click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(prompts, 1);
  dom.window.close();
});

test('standalone launch hides installation promotion and action', () => {
  const dom = app({ standalone: true });
  assert.ok(dom.window.document.querySelector('.install-action').hidden);
  assert.ok(dom.window.document.querySelector('#installPromo').hidden);
  dom.window.close();
});

test('spoiler protection removes outcomes from accessible content and persists', () => {
  const dom = app();
  const w = dom.window;
  w.document.querySelector('main').insertAdjacentHTML('beforeend', '<div data-outcome>24–27</div>');
  w.document.querySelector('.spoiler-toggle').click();
  assert.equal(w.localStorage.getItem('hc:spoilers'), '"hide"');
  assert.equal(w.document.querySelector('[data-outcome]').hidden, true);
  w.document.querySelector('.spoiler-toggle').click();
  assert.equal(w.document.querySelector('[data-outcome]').hidden, false);
  dom.window.close();
});

test('blocked storage still permits spoiler changes during the session', () => {
  const dom = app();
  const w = dom.window;
  Object.defineProperty(w, 'localStorage', { get() { throw new Error('Storage disabled'); } });
  w.document.querySelector('.spoiler-toggle').click();
  assert.equal(w.document.documentElement.dataset.spoilers, 'hide');
  dom.window.close();
});

test('upcoming scoreboard games do not imply a 0–0 result', async () => {
  const dom = app();
  const w = dom.window;
  const event = { id: 'upcoming', date: '2026-10-08T20:00:00Z', status: { type: { state: 'pre', shortDetail: 'Scheduled' } }, competitions: [{ competitors: [
    { homeAway: 'away', score: '0', team: { abbreviation: 'TB', shortDisplayName: 'Buccaneers' } },
    { homeAway: 'home', score: '0', team: { abbreviation: 'DAL', shortDisplayName: 'Cowboys' } }
  ] }] };
  w.fetch = async url => ({ ok: true, json: async () => String(url).includes('recaps') ? [] : ({ week: { number: 5 }, events: [event] }) });
  w.eval(fs.readFileSync('js/scoreboard.js', 'utf8'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(w.document.querySelector('.tscore').textContent.trim(), '');
  assert.equal(w.document.querySelector('.status').textContent, 'Upcoming');
  dom.window.close();
});

test('fantasy sort buttons keep focus so another activation reverses sorting', async () => {
  const dom = new JSDOM(fs.readFileSync('fantasy.html', 'utf8'), { url: 'https://highlightcorner.com/fantasy.html', runScripts: 'outside-only' });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.fetch = async url => ({ ok: true, json: async () => {
    if (String(url).includes('players.json')) return { p1: { n: 'First Player', p: 'QB', t: 'NE' } };
    if (String(url).includes('sleeper.app')) return { p1: { pts_ppr: 20, pass_yd: 300 } };
    return { week: { number: 5 } };
  } });
  w.eval(fs.readFileSync('js/app.js', 'utf8'));
  w.eval(fs.readFileSync('js/fantasy.js', 'utf8'));
  await new Promise(resolve => setImmediate(resolve));
  const heading = () => [...w.document.querySelectorAll('#fantasy th')].find(th => th.textContent.includes('Player'));
  const button = heading().querySelector('button');
  button.focus();
  button.click();
  assert.equal(w.document.activeElement, button);
  assert.equal(heading().getAttribute('aria-sort'), 'ascending');
  button.click();
  assert.equal(w.document.activeElement, button);
  assert.equal(heading().getAttribute('aria-sort'), 'descending');
  dom.window.close();
});
