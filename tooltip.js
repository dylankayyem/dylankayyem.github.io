/* Shared glass tooltip for icons and logos.
   Desktop: shows on hover and keyboard focus.
   Touch:   tap toggles the tooltip; links marked data-tip-guard open on a
            second tap, and nav items (data-tip-nav) navigate immediately. */
(function () {
  'use strict';
  var tip = document.createElement('div');
  tip.className = 'tip';
  tip.id = 'tip';
  tip.setAttribute('role', 'tooltip');
  tip.setAttribute('aria-hidden', 'true');
  document.body.appendChild(tip);

  var current = null;
  var mode = null;
  var lastPointer = 'mouse';
  var GAP = 8, EDGE = 12;

  function line(cls, text) {
    var s = document.createElement('span');
    s.className = cls;
    s.textContent = text;
    tip.appendChild(s);
  }

  function place(el) {
    var r = el.getBoundingClientRect();
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var vw = window.innerWidth, vh = window.innerHeight;
    var x = r.left + r.width / 2 - w / 2;
    x = Math.max(EDGE, Math.min(x, vw - w - EDGE));
    var y = r.top - h - GAP;
    var below = y < EDGE;
    if (below) y = Math.min(r.bottom + GAP, vh - h - EDGE);
    tip.style.left = Math.round(x) + 'px';
    tip.style.top = Math.round(y) + 'px';
    tip.classList.toggle('below', below);
  }

  function show(el, mode_) {
    var title = el.getAttribute('data-tip');
    if (!title) return;
    tip.textContent = '';
    line('tip-title', title);
    var sub = el.getAttribute('data-tip-sub');
    if (sub) line('tip-sub', sub);
    if (mode_ === 'touch' && el.hasAttribute('data-tip-guard')) line('tip-hint', 'Tap again to open');
    current = el;
    mode = mode_;
    el.setAttribute('aria-describedby', 'tip');
    tip.setAttribute('aria-hidden', 'false');
    place(el);
    tip.classList.add('show');
  }

  function hide() {
    if (current) current.removeAttribute('aria-describedby');
    current = null;
    mode = null;
    tip.classList.remove('show');
    tip.setAttribute('aria-hidden', 'true');
  }

  function target(e) {
    var n = e.target && e.target.closest ? e.target.closest('[data-tip]') : null;
    return n;
  }

  document.addEventListener('pointerdown', function (e) {
    lastPointer = e.pointerType || 'mouse';
  }, true);

  // Hover (mouse only; touch generates synthetic mouse events we ignore).
  document.addEventListener('pointerover', function (e) {
    if (e.pointerType !== 'mouse') return;
    var el = target(e);
    if (el && el !== current) show(el, 'hover');
  });
  document.addEventListener('pointerout', function (e) {
    if (e.pointerType !== 'mouse' || !current) return;
    var el = target(e);
    if (el === current && !(e.relatedTarget && current.contains(e.relatedTarget))) hide();
  });

  // Keyboard focus.
  document.addEventListener('focusin', function (e) {
    var el = target(e);
    if (!el) return;
    var visible = true;
    try { visible = el.matches(':focus-visible'); } catch (x) {}
    if (visible) show(el, 'focus');
  });
  document.addEventListener('focusout', function (e) {
    var el = target(e);
    if (el && el === current) hide();
  });

  // Touch: tap to toggle.
  document.addEventListener('click', function (e) {
    if (lastPointer === 'mouse') return;
    var el = target(e);
    if (!el) { hide(); return; }
    if (el.hasAttribute('data-tip-nav')) { hide(); return; }
    if (el.hasAttribute('data-tip-guard')) {
      if (current === el) { hide(); return; }   // second tap: let the link open
      e.preventDefault();
    }
    if (current === el) hide(); else show(el, 'touch');
  });

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
  // Scrolling moves the target: follow it for hover/focus, dismiss a tapped one.
  window.addEventListener('scroll', function () {
    if (!current) return;
    if (mode === 'touch') hide(); else place(current);
  }, { passive: true, capture: true });
  window.addEventListener('resize', hide);
})();
