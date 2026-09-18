/**
 * Progressive-enhancement script inlined into every page. The page works without it
 * (links, forms and native scrolling); the script only adds:
 * - pan buttons that scroll the graph area (revealed here, hidden in the HTML),
 * - keyboard zoom on the focused graph area (+ / - / 0 follow the zoom links),
 * - centring the selected node in the graph area on load,
 * - an offline banner that stops form submission while offline, so typed text stays on screen.
 * It never changes domain state and makes no requests of its own.
 * Kept as plain ES2020 source because the browser receives it verbatim.
 */
export const CLIENT_SCRIPT = `(function () {
  'use strict';
  var viewport = document.querySelector('[data-graph-viewport]');
  if (viewport) {
    var scroller = viewport.querySelector('[data-graph-scroll]');
    viewport.querySelectorAll('[data-pan]').forEach(function (btn) {
      btn.hidden = false;
      btn.addEventListener('click', function () {
        var d = String(btn.getAttribute('data-pan')).split(',').map(Number);
        scroller.scrollBy({ left: d[0] * scroller.clientWidth * 0.4, top: d[1] * scroller.clientHeight * 0.4, behavior: 'smooth' });
      });
    });
    scroller.addEventListener('keydown', function (e) {
      var key = e.key === '+' || e.key === '=' ? 'in' : e.key === '-' ? 'out' : e.key === '0' ? 'fit' : '';
      if (!key) return;
      var link = viewport.querySelector('a[data-zoom-key="' + key + '"]');
      if (link) { e.preventDefault(); link.click(); }
    });
    var selected = scroller.querySelector('[data-selected="true"]');
    if (selected && !scroller.classList.contains('fit')) {
      var box = selected.getBoundingClientRect();
      var area = scroller.getBoundingClientRect();
      scroller.scrollLeft += box.left - area.left - (area.width - box.width) / 2;
      scroller.scrollTop += box.top - area.top - (area.height - box.height) / 2;
    }
  }
  var banner = document.querySelector('[data-offline-banner]');
  function sync() { if (banner) banner.hidden = navigator.onLine !== false; }
  window.addEventListener('online', sync);
  window.addEventListener('offline', sync);
  sync();
  document.addEventListener('submit', function (e) {
    if (navigator.onLine === false) { e.preventDefault(); sync(); if (banner) { banner.setAttribute('tabindex', '-1'); banner.focus(); } }
  }, true);
})();`;
