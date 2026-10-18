/* Shared runtime for the project demos: theme sync, a sign-in gate, a hash
   router over named views, and small DOM helpers. Each demo calls
   Demo.init({...}) with its brand, nav and view renderers. All state lives
   in memory and sessionStorage, so a demo is safe to poke at and resets
   with the "Restart" button on the portfolio overlay. */
(function () {
  'use strict';
  var ICONS = {
    home: 'M3.5 11 12 3.8l8.5 7.2M5.5 9.8V20h4.8v-5.4h3.4V20h4.8V9.8',
    flows: 'M4 6h6v6H4zM14 12h6v6h-6zM10 9h4M12 9v3h2',
    traces: 'M4 12h4l2-6 4 12 2-6h4',
    incidents: 'M12 3 2.5 20h19L12 3zM12 10v4M12 17v.5',
    keys: 'M14.5 4.5a5 5 0 1 1-3.3 8.8L4 20.5v-3h3v-3h3l1.2-1.2',
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.3 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.4 2.5a7 7 0 0 0-1.7 1l-2.3-1-2 3.5 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.3-1a7 7 0 0 0 1.7 1l.4 2.5h5l.4-2.5a7 7 0 0 0 1.7-1l2.3 1 2-3.5-2-1.5c.1-.3.1-.7.1-1z',
    users: 'M16 19a4 4 0 0 0-8 0M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 19a3 3 0 0 0-3-3M5 19a3 3 0 0 1 3-3M18 9a2.5 2.5 0 1 0 0-5M6 9a2.5 2.5 0 1 1 0-5',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0',
    db: 'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
    query: 'M4 5h16M4 10h10M4 15h7M15 15l4 4M14 19l5-5',
    schema: 'M5 4h6v5H5zM13 4h6v5h-6zM9 15h6v5H9zM8 9v3h8V9M12 12v3',
    calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
    drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
    box: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
    match: 'M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM16 20a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM10.8 9.2l2.4 2.4',
    inbox: 'M4 4h16v16H4zM4 14h4l2 3h4l2-3h4',
    logout: 'M10 4H5v16h5M14 8l4 4-4 4M18 12H9',
    plus: 'M12 5v14M5 12h14',
    check: 'm5 12 4 4L19 6',
    x: 'M6 6l12 12M18 6 6 18',
    bolt: 'M13 2 4 14h7l-1 8 9-12h-7l1-8z',
    search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM20 20l-4.5-4.5',
    alert: 'M12 3 2.5 20h19L12 3zM12 10v4M12 17v.5',
    arrow: 'M5 12h14M13 6l6 6-6 6',
    back: 'M19 12H5M11 18l-6-6 6-6'
  };

  function icon(name) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="' + (ICONS[name] || ICONS.home) + '"/></svg>';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  function qs(sel, root) { return (root || document).querySelector(sel); }

  // ---- theme ------------------------------------------------------------
  var params = new URLSearchParams(location.search);
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
  }
  applyTheme(params.get('theme') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  // Escape inside the demo closes the portfolio overlay around it.
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && window.parent !== window) window.parent.postMessage({ type: 'demo-close' }, '*'); });
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'theme') applyTheme(e.data.theme);
  });

  // ---- deterministic pseudo-random for stable sample data ----------------
  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  // ---- helpers ------------------------------------------------------------
  function stat(o) {
    return '<div class="card stat"><div class="label">' + esc(o.label) + '</div><div class="value">' + esc(o.value) + '</div>' +
      (o.delta ? '<div class="delta ' + (o.tone || '') + '">' + esc(o.delta) + '</div>' : '') + '</div>';
  }
  function badge(text, tone) { return '<span class="badge ' + (tone || 'neutral') + '">' + esc(text) + '</span>'; }
  function table(o) {
    var head = '<tr>' + o.columns.map(function (c) { return '<th class="' + (c.num ? 'num' : '') + '">' + esc(c.label) + '</th>'; }).join('') + '</tr>';
    var rows = o.rows.length ? o.rows.map(function (r) {
      return '<tr class="' + (o.rowAttr ? 'row' : '') + '"' + (o.rowAttr ? ' ' + o.rowAttr(r) : '') + '>' +
        o.columns.map(function (c) { var v = c.render ? c.render(r) : esc(r[c.key]); return '<td class="' + (c.num ? 'num ' : '') + (c.cls || '') + '">' + v + '</td>'; }).join('') + '</tr>';
    }).join('') : '<tr><td colspan="' + o.columns.length + '" class="empty">' + esc(o.empty || 'Nothing here yet') + '</td></tr>';
    return '<div class="tbl-wrap"><table class="tbl"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div>';
  }
  function bars(values, labels, tones) {
    var max = Math.max.apply(null, values.concat([1]));
    return '<div class="bars">' + values.map(function (v, i) {
      return '<div class="bar"><i class="' + ((tones && tones[i]) || '') + '" style="height:' + Math.max(3, Math.round(v / max * 100)) + '%" title="' + esc(v) + '"></i><span>' + esc(labels[i]) + '</span></div>';
    }).join('') + '</div>';
  }
  function card(title, body, opts) {
    opts = opts || {};
    return '<div class="card"><div class="head"><div><h3>' + esc(title) + '</h3>' + (opts.sub ? '<div class="sub">' + esc(opts.sub) + '</div>' : '') + '</div>' +
      (opts.actions || '') + '</div><div class="body' + (opts.flush ? ' flush' : '') + '">' + body + '</div></div>';
  }
  function kv(pairs) {
    return '<dl class="kv">' + pairs.map(function (p) { return '<dt>' + esc(p[0]) + '</dt><dd>' + (p[2] ? p[1] : esc(p[1])) + '</dd>'; }).join('') + '</dl>';
  }
  var toastTimer;
  function toast(msg) {
    var t = qs('.toast') || document.body.appendChild(Object.assign(document.createElement('div'), { className: 'toast' }));
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  function fmtTime(d) { return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); }
  function ago(d) {
    var s = Math.max(0, (Date.now() - d.getTime()) / 1000);
    if (s < 60) return Math.round(s) + 's ago';
    if (s < 3600) return Math.round(s / 60) + 'm ago';
    if (s < 86400) return Math.round(s / 3600) + 'h ago';
    return Math.round(s / 86400) + 'd ago';
  }

  // ---- app ----------------------------------------------------------------
  var app = null;
  function authKey() { return 'demo:' + app.id + ':auth'; }
  function isAuthed() { try { return sessionStorage.getItem(authKey()) === '1'; } catch (e) { return window.__demoAuthed === true; } }
  function setAuthed(v) { try { v ? sessionStorage.setItem(authKey(), '1') : sessionStorage.removeItem(authKey()); } catch (e) {} window.__demoAuthed = v; }

  function route() {
    var h = location.hash.replace(/^#\/?/, '');
    var parts = h.split('/');
    return { view: parts[0] || app.defaultView, param: parts.slice(1).join('/') || null };
  }
  function go(view, param) { location.hash = '/' + view + (param ? '/' + param : ''); }

  function renderLogin() {
    var l = app.login;
    document.body.innerHTML =
      '<div class="login"><form class="login-card" id="login-form" autocomplete="off">' +
        '<div class="login-brand"><span class="mark">' + icon(app.icon) + '</span>' + esc(app.name) + '</div>' +
        '<h1>' + esc(l.heading) + '</h1><p class="sub">' + esc(l.sub) + '</p>' +
        '<div class="field"><label for="email">Email</label><input id="email" type="email" value="' + esc(l.email) + '" required></div>' +
        '<div class="field"><label for="password">Password</label><input id="password" type="password" value="demo-password" required></div>' +
        (l.extra || '') +
        '<button class="btn primary block" type="submit">' + esc(l.button || 'Sign in') + '</button>' +
        '<div class="hint"><strong>Demo mode.</strong> ' + esc(l.hint || 'Any email and password work. Data is sample data and resets when you restart.') + '</div>' +
        '<div class="foot">' + esc(l.foot || '') + '</div>' +
      '</form></div><div class="demo-ribbon">Demo · sample data</div>';
    qs('#login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = qs('button[type=submit]', e.target); btn.disabled = true; btn.textContent = 'Signing in…';
      setTimeout(function () { setAuthed(true); go(app.defaultView); }, 450);
    });
  }

  function renderShell() {
    var nav = app.nav.map(function (n) {
      return '<button class="navlink" data-view="' + n.id + '">' + icon(n.icon) + '<span class="txt">' + esc(n.label) + '</span><span class="count hidden" data-count="' + n.id + '"></span></button>';
    }).join('');
    document.body.innerHTML =
      '<div class="app"><aside class="side">' +
        '<div class="brand"><span class="mark">' + icon(app.icon) + '</span><span class="txt">' + esc(app.name) + '</span><span class="tag">Demo</span></div>' +
        '<div class="section">' + esc(app.navLabel || 'Workspace') + '</div>' + nav +
        '<div class="spacer"></div>' +
        '<div class="user"><span class="avatar">' + esc(app.user.initials) + '</span><div class="who"><b>' + esc(app.user.name) + '</b><span>' + esc(app.user.org) + '</span></div>' +
        '<button type="button" title="Sign out" aria-label="Sign out" data-signout>' + icon('logout') + '</button></div>' +
      '</aside><div class="main"><header class="topbar"><div><h2 id="page-title"></h2><div class="crumbs" id="crumbs"></div></div><div class="actions" id="page-actions"></div></header>' +
      '<div class="content" id="content"></div></div></div>';
    document.body.addEventListener('click', function (e) {
      var nl = e.target.closest('.navlink[data-view]'); if (nl) { go(nl.dataset.view); return; }
      if (e.target.closest('[data-signout]')) { setAuthed(false); location.hash = ''; renderLogin(); return; }
      var g = e.target.closest('[data-go]'); if (g) { var p = g.dataset.go.split('/'); go(p[0], p.slice(1).join('/') || null); return; }
    });
  }

  function renderView() {
    if (!isAuthed()) { renderLogin(); return; }
    if (!qs('.app')) renderShell();
    var r = route();
    var view = app.views[r.view] || app.views[app.defaultView];
    document.querySelectorAll('.navlink').forEach(function (b) { b.classList.toggle('active', b.dataset.view === (app.views[r.view] ? r.view : app.defaultView)); });
    var out = view(r.param) || {};
    qs('#page-title').textContent = out.title || '';
    qs('#crumbs').innerHTML = out.crumbs || '';
    qs('#page-actions').innerHTML = out.actions || '';
    qs('#content').innerHTML = out.html || '';
    if (app.counts) {
      var c = app.counts();
      document.querySelectorAll('[data-count]').forEach(function (el) { var n = c[el.dataset.count]; el.textContent = n || ''; el.classList.toggle('hidden', !n); });
    }
    if (out.after) out.after(qs('#content'));
    window.scrollTo(0, 0);
  }

  function init(config) {
    app = config;
    if (params.get('restart') === '1') { setAuthed(false); location.hash = ''; }
    window.addEventListener('hashchange', renderView);
    renderView();
  }

  window.Demo = { init: init, go: go, icon: icon, esc: esc, stat: stat, badge: badge, table: table, bars: bars, card: card, kv: kv, toast: toast, rng: rng, fmtTime: fmtTime, ago: ago, render: function () { renderView(); } };
})();
