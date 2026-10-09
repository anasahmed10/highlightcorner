/* AdSense: in-flow units + desktop side rails. Ads serve only after Google
   approves the site; until then slots stay empty and harmless. */
(function () {
  'use strict';
  var CLIENT = 'ca-pub-1549898506474594';
  var initialized = new WeakSet();

  function addRails() {
    if (!window.matchMedia || !window.matchMedia('(min-width: 1280px)').matches) return;
    if (document.querySelector('.ad-rail')) return;
    ['left', 'right'].forEach(function (side) {
      var d = document.createElement('div');
      d.className = 'ad-rail ' + side;
      d.setAttribute('aria-hidden', 'true');
      d.innerHTML = '<ins class="adsbygoogle" style="display:block;width:160px;height:600px"'
        + ' data-ad-client="' + CLIENT + '" data-ad-slot="9881709462" data-ad-format="auto"></ins>';
      document.body.appendChild(d);
    });
  }

  function renderAds() {
    try {
      addRails();
      document.querySelectorAll('ins.adsbygoogle').forEach(function (unit) {
        if (initialized.has(unit) || unit.hasAttribute('data-adsbygoogle-status')) return;
        if (unit.closest('.ad-rail') && !window.matchMedia('(min-width: 1280px)').matches) return;
        initialized.add(unit);
        try { (window.adsbygoogle = window.adsbygoogle || []).push({}); }
        catch (e) { initialized.delete(unit); }
      });
    } catch (e) {}
  }
  window.HC = window.HC || {};
  window.HC.renderAds = renderAds;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderAds);
  else renderAds();
})();
