/* Project demo overlay.
   A "Demo" link on a project card (data-demo="<id>") opens a glass window
   over the page with that project's self-contained demo (demos/<id>/) in an
   iframe. Deep link: #demo=<id>. Escape, the close button or the backdrop
   dismiss it; the current theme is passed to the demo. */
(function () {
  'use strict';
  var DEMOS = {
    flowproof: { title: 'FlowProof', note: 'Sample data' },
    healthcare: { title: 'Healthcare Database', note: 'Sample data' },
    bloodbank: { title: 'Blood Bank Database', note: 'Sample data' },
    pawprints: { title: 'PawPrints', note: 'Figma prototype' },
    presto: { title: 'Presto redesign', note: 'Coded prototype' },
    itsastart: { title: "It's a Start", note: 'Figma prototype' }
  };
  var overlay = null, frame = null, titleEl = null, openBtn = null, current = null, lastFocus = null, openedAt = 0;

  // Demo funnel events (see ANALYTICS.md); a no-op when analytics.js is absent.
  function track(name, props) { if (window.DKAnalytics) window.DKAnalytics.track(name, props); }
  function seconds() { return Math.round((Date.now() - openedAt) / 1000); }

  function icon(d) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="' + d + '"/></svg>';
  }

  function build() {
    overlay = document.createElement('div');
    overlay.className = 'demo-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Project demo');
    overlay.innerHTML =
      '<div class="demo-window">' +
        '<div class="demo-bar">' +
          '<div class="demo-bar-left"><span class="demo-dot"></span><span class="demo-title"></span><span class="demo-badge">Demo</span></div>' +
          '<div class="demo-bar-right">' +
            '<button type="button" class="demo-btn" data-act="restart" aria-label="Restart demo" data-tip="Restart" data-tip-sub="Back to the sign-in screen" data-tip-nav>' + icon('M3.5 12a8.5 8.5 0 1 0 2.5-6M3.5 3.5V8h4.5') + '</button>' +
            '<a class="demo-btn" data-act="open" target="_blank" rel="noopener noreferrer" aria-label="Open demo in a new tab" data-tip="Open" data-tip-sub="Full screen in a new tab" data-tip-nav>' + icon('M14 4h6v6M20 4l-9 9M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6') + '</a>' +
            '<button type="button" class="demo-btn demo-close" data-act="close" aria-label="Close demo" data-tip="Close" data-tip-sub="Esc" data-tip-nav>' + icon('M6 6l12 12M18 6 6 18') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="demo-body"><iframe class="demo-frame" title="Project demo" loading="eager"></iframe><div class="demo-loading"><span></span></div></div>' +
      '</div>';
    document.body.appendChild(overlay);
    frame = overlay.querySelector('.demo-frame');
    titleEl = overlay.querySelector('.demo-title');
    openBtn = overlay.querySelector('[data-act="open"]');
    overlay.addEventListener('click', function (e) {
      var act = e.target.closest('[data-act]');
      if (act) {
        if (act.dataset.act === 'close') close('button');
        if (act.dataset.act === 'restart') { track('demo_restart', { demo: current, source: 'overlay' }); load(current, true); }
        if (act.dataset.act === 'open') track('demo_new_tab', { demo: current, seconds: seconds() });
        return;
      }
      if (e.target === overlay) close('backdrop');
    });
    frame.addEventListener('load', function () { overlay.classList.remove('loading'); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('open')) close('esc');
    });
  }

  function url(id, restart, via) {
    var theme = document.documentElement.getAttribute('data-theme') || 'light';
    return 'demos/' + id + '/index.html?theme=' + theme + (restart ? '&restart=1' : '') + (via ? '&via=' + via : '');
  }

  function load(id, restart) {
    overlay.classList.add('loading');
    frame.src = url(id, restart);
  }

  function open(id, source) {
    if (!DEMOS[id]) return;
    if (!overlay) build();
    current = id;
    lastFocus = document.activeElement;
    titleEl.textContent = DEMOS[id].title;
    overlay.querySelector('.demo-badge').textContent = 'Demo · ' + DEMOS[id].note;
    openBtn.href = url(id, false, 'overlay');
    load(id, false);
    overlay.classList.add('open');
    document.body.classList.add('demo-open');
    openedAt = Date.now();
    track('demo_open', { demo: id, source: source || 'card' });
    if (history.replaceState) history.replaceState(null, '', '#demo=' + id);
    setTimeout(function () { overlay.querySelector('.demo-close').focus(); }, 50);
  }

  function close(how) {
    if (!overlay || !overlay.classList.contains('open')) return;
    track('demo_close', { demo: current, how: how || 'button', seconds: seconds() });
    overlay.classList.remove('open');
    document.body.classList.remove('demo-open');
    setTimeout(function () { frame.src = 'about:blank'; }, 250);
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    current = null;
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-demo]');
    if (!a) return;
    e.preventDefault();
    open(a.getAttribute('data-demo'), 'card');
  });

  // Escape pressed inside a demo arrives as a message from the iframe.
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'demo-close' && frame && e.source === frame.contentWindow) close('esc');
  });

  // Leaving the page with a demo still open counts as a close, so time spent
  // in the demo is still recorded.
  window.addEventListener('pagehide', function () {
    if (current && overlay && overlay.classList.contains('open')) track('demo_close', { demo: current, how: 'leave', seconds: seconds() });
  });

  // Keep the demo's theme in step when the visitor flips the site theme.
  new MutationObserver(function () {
    if (current && overlay && overlay.classList.contains('open') && frame.contentWindow) {
      try { frame.contentWindow.postMessage({ type: 'theme', theme: document.documentElement.getAttribute('data-theme') || 'light' }, '*'); } catch (x) {}
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  var m = location.hash.match(/^#demo=([a-z]+)$/);
  if (m) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { open(m[1], 'link'); });
    else open(m[1], 'link');
  }
  window.openProjectDemo = function (id) { open(id, 'script'); };
})();
