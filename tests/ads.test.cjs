const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

test('manual ad initialization covers each unit once, including later game content', () => {
  const dom = new JSDOM('<main><ins class="adsbygoogle"></ins></main>', { runScripts: 'outside-only' });
  const w = dom.window;
  w.matchMedia = () => ({ matches: true });
  w.adsbygoogle = [];
  w.eval(fs.readFileSync('js/ads.js', 'utf8'));
  w.HC.renderAds();
  w.HC.renderAds();
  assert.equal(w.document.querySelectorAll('ins.adsbygoogle').length, 3);
  assert.equal(w.adsbygoogle.length, 3);
  w.document.querySelector('main').insertAdjacentHTML('beforeend', '<ins class="adsbygoogle"></ins>');
  w.HC.renderAds();
  assert.equal(w.adsbygoogle.length, 4);
  dom.window.close();
});
