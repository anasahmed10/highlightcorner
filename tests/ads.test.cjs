const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');

test('ad provider loads once on demand and each manual unit queues once', () => {
  const dom = new JSDOM('<main></main>', { runScripts: 'outside-only' });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false });
  w.adsbygoogle = [];
  w.eval(fs.readFileSync(path.join(root, 'js/ads.js'), 'utf8'));

  w.HC.renderAds();
  assert.equal(w.document.querySelector('script[src*="adsbygoogle.js"]'), null);

  const main = w.document.querySelector('main');
  main.innerHTML = '<div class="ad-slot"><ins class="adsbygoogle"></ins></div>';
  w.HC.renderAds();
  w.HC.renderAds();
  assert.equal(w.document.querySelectorAll('script[src*="adsbygoogle.js"]').length, 1);
  assert.equal(w.adsbygoogle.length, 1);

  main.insertAdjacentHTML('beforeend', '<div class="ad-slot"><ins class="adsbygoogle"></ins></div>');
  w.HC.renderAds();
  assert.equal(w.document.querySelectorAll('script[src*="adsbygoogle.js"]').length, 1);
  assert.equal(w.adsbygoogle.length, 2);
  dom.window.close();
});

test('a blocked provider collapses ad wrappers and does not queue later units', () => {
  const dom = new JSDOM('<main><div class="ad-slot"><ins class="adsbygoogle"></ins></div></main>', { runScripts: 'outside-only' });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false });
  w.adsbygoogle = [];
  w.eval(fs.readFileSync(path.join(root, 'js/ads.js'), 'utf8'));
  w.HC.renderAds();
  const script = w.document.querySelector('script[src*="adsbygoogle.js"]');
  assert.equal(w.document.querySelector('.ad-slot').hasAttribute('data-hc-ad-status'), false, 'pending units retain their slot');
  script.dispatchEvent(new w.Event('error'));

  const slot = w.document.querySelector('.ad-slot');
  assert.equal(slot.getAttribute('data-hc-ad-status'), 'blocked');
  assert.match(fs.readFileSync(path.join(root, 'css/style.css'), 'utf8'), /\.ad-slot\[data-hc-ad-status="blocked"\].*display:\s*none/);
  w.document.querySelector('main').insertAdjacentHTML('beforeend', '<div class="ad-slot"><ins class="adsbygoogle"></ins></div>');
  w.HC.renderAds();
  assert.equal(w.document.querySelectorAll('script[src*="adsbygoogle.js"]').length, 1);
  assert.equal(w.adsbygoogle.length, 1);
  assert.equal(w.document.querySelectorAll('.ad-slot[data-hc-ad-status="blocked"]').length, 2);
  dom.window.close();
});

test('desktop rails are created once and empty provider slots keep their unfilled state', () => {
  const dom = new JSDOM('<main><div class="ad-slot"><ins class="adsbygoogle" data-adsbygoogle-status="done" data-ad-status="unfilled"></ins></div></main>', { runScripts: 'outside-only' });
  const w = dom.window;
  w.matchMedia = () => ({ matches: true });
  w.adsbygoogle = [];
  w.eval(fs.readFileSync(path.join(root, 'js/ads.js'), 'utf8'));
  w.HC.renderAds();
  w.HC.renderAds();
  assert.equal(w.document.querySelectorAll('.ad-rail').length, 2);
  assert.equal(w.document.querySelectorAll('script[src*="adsbygoogle.js"]').length, 1);
  assert.equal(w.adsbygoogle.length, 2);
  assert.equal(w.document.querySelector('.ad-slot ins').getAttribute('data-ad-status'), 'unfilled');
  assert.match(fs.readFileSync(path.join(root, 'css/style.css'), 'utf8'), /\.ad-slot:has\(ins\[data-ad-status="unfilled"\]\)\s*\{\s*display:\s*none/);
  dom.window.close();
});

test('Privacy and 404 pages do not request AdSense without an ad unit', () => {
  for (const file of ['privacy.html', '404.html']) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(html, /adsbygoogle\.js/);
    assert.doesNotMatch(html, /class="ad-slot"/);
  }
});
