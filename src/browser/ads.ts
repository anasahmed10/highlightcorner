/* Manual AdSense units load the provider only when a page has an ad slot. */
(function () {
  'use strict';
  var CLIENT = 'ca-pub-1549898506474594';
  var initialized = new WeakSet<HTMLModElement>();
  var adsScript: HTMLScriptElement | null = null;
  var adsScriptFailed = false;

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

  function markBlocked(unit: HTMLModElement) {
    var wrapper = unit.closest('.ad-slot, .ad-rail');
    if (wrapper) wrapper.setAttribute('data-hc-ad-status', 'blocked');
  }

  function ensureAdsScript(units: HTMLModElement[]) {
    if (adsScript || adsScriptFailed) return;
    adsScript = document.createElement('script');
    adsScript.async = true;
    adsScript.crossOrigin = 'anonymous';
    adsScript.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + CLIENT;
    adsScript.addEventListener('error', function () {
      adsScriptFailed = true;
      units.forEach(markBlocked);
      document.querySelectorAll<HTMLModElement>('ins.adsbygoogle').forEach(function (unit) {
        if (!unit.hasAttribute('data-adsbygoogle-status')) markBlocked(unit);
      });
    }, { once: true });
    document.head.appendChild(adsScript);
  }

  function renderAds() {
    try {
      addRails();
      var units = Array.from(document.querySelectorAll<HTMLModElement>('ins.adsbygoogle')).filter(function (unit) {
        if (initialized.has(unit) || unit.hasAttribute('data-adsbygoogle-status')) return false;
        if (unit.closest('.ad-rail') && (!window.matchMedia || !window.matchMedia('(min-width: 1280px)').matches)) return false;
        return true;
      });
      if (!units.length) return;
      if (adsScriptFailed) {
        units.forEach(markBlocked);
        return;
      }
      ensureAdsScript(units);
      units.forEach(function (unit) {
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
