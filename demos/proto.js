/* Prototype runner for the design case studies. A screen is either an image
   of the final design with tap targets ("hot" areas, in percent of the image)
   or a coded screen rendered by a function. Tapping outside a target flashes
   the targets, the same affordance Figma prototypes use. */
(function () {
  'use strict';
  var params = new URLSearchParams(location.search);
  document.documentElement.setAttribute('data-theme', params.get('theme') === 'dark' ? 'dark' : 'light');
  // Escape inside the demo closes the portfolio overlay around it.
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && window.parent !== window) window.parent.postMessage({ type: 'demo-close' }, '*'); });
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'theme') document.documentElement.setAttribute('data-theme', e.data.theme === 'dark' ? 'dark' : 'light');
  });

  var cfg, current, showHot = false, toastTimer, history = [];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function toast(msg) {
    var t = document.querySelector('.proto-toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  function go(key, opts) {
    if (!cfg.screens[key]) return;
    if (current && !(opts && opts.replace)) history.push(current);
    current = key;
    render();
  }
  function back() { if (history.length) { current = history.pop(); render(); } }

  function render() {
    var s = cfg.screens[current];
    var screen = document.querySelector('.proto-screen');
    screen.style.setProperty('--ratio', s.ratio || cfg.ratio || 0.52);
    if (s.img) {
      screen.innerHTML = '<img src="' + esc(s.img) + '" alt="' + esc(s.label) + ' screen" draggable="false">' +
        (s.hot || []).map(function (h, i) {
          return '<button class="hot" data-hot="' + i + '" aria-label="' + esc(h.label || 'Go to ' + h.to) + '" style="left:' + h.x + '%;top:' + h.y + '%;width:' + h.w + '%;height:' + h.h + '%"></button>';
        }).join('');
    } else {
      screen.innerHTML = '<div class="proto-phone"><div class="app">' + s.html(cfg.state) + '</div></div>';
      if (s.after) s.after(screen, cfg.state);
    }
    screen.classList.toggle('show-hot', showHot && !!s.img);
    document.querySelectorAll('.proto-steps button').forEach(function (b) { b.classList.toggle('on', b.dataset.step === current || (cfg.screens[current].step === b.dataset.step)); });
    var hint = document.querySelector('.proto-hint'); if (hint) hint.textContent = s.hint || cfg.hint || '';
  }

  function build() {
    var steps = cfg.order.map(function (k, i) { return '<button data-step="' + k + '"><i>' + (i + 1) + '</i><span>' + esc(cfg.screens[k].label) + '</span></button>'; }).join('');
    document.body.innerHTML =
      '<div class="proto"><aside class="proto-side">' +
        '<div><div class="kind">' + esc(cfg.kind || 'Interactive prototype') + '</div><h1>' + esc(cfg.name) + '</h1></div>' +
        '<p>' + esc(cfg.blurb) + '</p>' +
        '<div class="proto-steps">' + steps + '</div>' +
        '<div class="proto-tools"><button data-tool="hot">Show tap targets</button><button data-tool="restart">Restart</button></div>' +
        '<div class="proto-hint"></div>' +
      '</aside><main class="proto-stage"><div class="proto-screen"></div></main></div><div class="proto-toast" role="status"></div>';

    document.body.addEventListener('click', function (e) {
      var el;
      if ((el = e.target.closest('[data-step]'))) { history = []; current = el.dataset.step; render(); return; }
      if ((el = e.target.closest('[data-tool]'))) {
        if (el.dataset.tool === 'hot') { showHot = !showHot; el.classList.toggle('on', showHot); render(); }
        else { history = []; cfg.state = cfg.initialState ? cfg.initialState() : {}; current = cfg.start; render(); }
        return;
      }
      var s = cfg.screens[current];
      if ((el = e.target.closest('[data-hot]'))) {
        var h = s.hot[+el.dataset.hot];
        if (h.toast) toast(h.toast);
        if (h.to === 'back') back(); else if (h.to) go(h.to);
        return;
      }
      if ((el = e.target.closest('[data-to]'))) {
        if (el.dataset.toast) toast(el.dataset.toast);
        if (el.dataset.to === 'back') back(); else go(el.dataset.to);
        return;
      }
      if (s.img && e.target.closest('.proto-screen')) {
        var scr = document.querySelector('.proto-screen');
        scr.classList.remove('flash'); void scr.offsetWidth; scr.classList.add('flash');
      }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Backspace' && !/input|textarea/i.test(e.target.tagName)) back(); });
  }

  window.Proto = {
    init: function (config) {
      cfg = config; cfg.state = cfg.initialState ? cfg.initialState() : {};
      current = cfg.start; build(); render();
      cfg.order.concat(Object.keys(cfg.screens)).forEach(function (k) { var s = cfg.screens[k]; if (s && s.img) { var i = new Image(); i.src = s.img; } });
    },
    go: go, back: back, toast: toast, esc: esc, render: function () { render(); }
  };
})();
