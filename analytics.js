/* Site analytics: page views, section views, link clicks and the project demo
   funnel (open → sign in → key action → close). See ANALYTICS.md for the
   event list and how to read the reports.

   Provider: Umami (cookieless, no personal data, no consent banner needed).
   Nothing is sent until WEBSITE_ID is set, and only from the production
   hosts below, so local previews never pollute the numbers.

   Visitor controls (stick in this browser):
     ?analytics=off    stop counting this browser (use it on your own devices)
     ?analytics=debug  log every event to the console instead of hiding them
     ?analytics=on     back to normal

   Demo pages load this file too. Inside the portfolio's demo overlay they
   forward events to the parent page, so one visit stays one visit. */
(function () {
  'use strict';
  var CONFIG = {
    websiteId: '',                                 // Umami → Settings → Websites → Website ID
    src: 'https://cloud.umami.is/script.js',
    hosts: ['dylankayyem.com', 'www.dylankayyem.com', 'dylankayyem.github.io'],
    honorDoNotTrack: true
  };
  var KEY = 'dk-analytics';

  // ---- inside the demo overlay: hand everything to the portfolio page ------
  var parentApi = null;
  try { if (window.parent !== window && window.parent.DKAnalytics) parentApi = window.parent.DKAnalytics; } catch (e) { parentApi = null; }
  if (parentApi) {
    window.DKAnalytics = { track: function (name, props) { parentApi.track(name, props); }, framed: true };
    return;
  }

  // ---- mode -----------------------------------------------------------------
  var mode = 'on';
  try {
    var asked = new URLSearchParams(location.search).get('analytics');
    if (asked === 'off' || asked === 'debug') localStorage.setItem(KEY, asked);
    else if (asked === 'on') localStorage.removeItem(KEY);
    mode = localStorage.getItem(KEY) || 'on';
  } catch (e) { mode = 'on'; }
  var debug = mode === 'debug';
  var dnt = CONFIG.honorDoNotTrack && (navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true);
  var live = !!CONFIG.websiteId && mode !== 'off' && !dnt && CONFIG.hosts.indexOf(location.hostname) >= 0;

  var queue = [], events = [];
  function flush() {
    if (!window.umami) return;
    while (queue.length) {
      var e = queue.shift();
      // The function form lets every hit carry the clean URL instead of the
      // raw address bar (which can hold #demo=… or ?analytics=debug).
      try { window.umami.track(withUrl(e)); }
      catch (err) { if (debug) console.warn('[analytics] send failed', err); }
    }
  }
  function withUrl(e) {
    return function (payload) {
      var o = {};
      for (var k in payload) o[k] = payload[k];
      o.url = e.url;
      if (e.name) { o.name = e.name; o.data = e.props; }
      return o;
    };
  }
  function send(item) {
    if (!live) return;
    if (queue.length < 100) queue.push(item);
    flush();
  }

  if (live) {
    var s = document.createElement('script');
    s.defer = true;
    s.src = CONFIG.src;
    s.setAttribute('data-website-id', CONFIG.websiteId);
    s.setAttribute('data-auto-track', 'false'); // page views are sent below with a clean URL
    s.addEventListener('load', flush);
    document.head.appendChild(s);
  }

  // ---- page names and URLs ----------------------------------------------------
  function pageName() {
    var p = location.pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
    var m = p.match(/\/demos\/([a-z]+)\/?$/);
    if (m) return 'demo:' + m[1];
    p = p.replace(/^\/+|\/+$/g, '');
    return p || 'home';
  }
  // Keep campaign tags (utm_*, ref) so shared links can be told apart; drop
  // the hash, demo parameters and our own switches.
  function cleanUrl() {
    var path = location.pathname.replace(/\/index\.html$/, '/');
    var keep = new URLSearchParams();
    new URLSearchParams(location.search).forEach(function (v, k) { if (/^utm_|^ref$/.test(k)) keep.set(k, v); });
    var q = keep.toString();
    return location.origin + path + (q ? '?' + q : '');
  }
  var PAGE = pageName();

  // ---- public API ---------------------------------------------------------------
  function track(name, props) {
    var data = {};
    if (props) Object.keys(props).forEach(function (k) { if (props[k] != null && props[k] !== '') data[k] = typeof props[k] === 'number' ? props[k] : String(props[k]).slice(0, 120); });
    if (!data.page) data.page = PAGE;
    events.push({ name: name, props: data, at: Date.now() });
    if (debug) console.info('[analytics]', name, data);
    send({ name: name, props: data, url: cleanUrl() });
  }
  function pageview() {
    var url = cleanUrl();
    events.push({ name: 'pageview', props: { url: url }, at: Date.now() });
    if (debug) console.info('[analytics] pageview', url);
    send({ url: url });
  }
  window.DKAnalytics = { track: track, mode: mode, live: live, events: events };
  if (debug) console.info('[analytics] debug mode · sending: ' + (live ? 'yes' : 'no (' + (!CONFIG.websiteId ? 'no website ID' : mode === 'off' ? 'opted out' : dnt ? 'Do Not Track' : 'not a production host') + ')'));
  if (mode === 'off') console.info('[analytics] this browser is excluded from site stats · ?analytics=on to undo');

  pageview();

  // ---- link clicks ----------------------------------------------------------------
  function slug(s) { return String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); }
  function projectOf(el) {
    var card = el.closest('.project-item');
    var t = card && card.querySelector('.title');
    return t ? slug(t.textContent) : null;
  }
  function linkKind(url) {
    if (/\.pdf$/i.test(url.pathname)) return 'pdf';
    if (url.host === 'github.com') return 'github';
    if (/loom\.com|youtube\.com|youtu\.be|vimeo\.com/.test(url.host) || /\.(mp4|mov|webm)$/i.test(url.pathname)) return 'video';
    if (url.origin === location.origin) return 'case-study';
    return 'site';
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) {
      var t = e.target.closest && e.target.closest('.theme-toggle');
      if (t) setTimeout(function () { track('theme_toggle', { theme: document.documentElement.getAttribute('data-theme') }); }, 0);
      return;
    }
    if (a.hasAttribute('data-demo') || a.closest('.demo-overlay')) return; // demo.js reports these
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#') return;
    if (/^mailto:/i.test(href)) { track('contact_click', { method: 'email' }); return; }
    var url;
    try { url = new URL(href, location.href); } catch (x) { return; }
    if (/\.pdf$/i.test(url.pathname) && /resume|dylan_kayyem/i.test(url.pathname)) { track('resume_click', { action: a.hasAttribute('download') ? 'download' : 'open' }); return; }
    var project = projectOf(a);
    if (project) { track('project_link', { project: project, link: linkKind(url), host: url.host }); return; }
    if (/linkedin\.com$/.test(url.host)) { track('contact_click', { method: 'linkedin' }); return; }
    if (url.origin !== location.origin) track('outbound_click', { host: url.host, path: url.pathname.slice(0, 60) });
  }, true);

  // ---- section views (once per page view) -------------------------------------------
  function watchSections() {
    if (!('IntersectionObserver' in window)) return;
    var seen = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting || seen[en.target.id]) return;
        seen[en.target.id] = true;
        io.unobserve(en.target);
        track('section_view', { section: en.target.id });
      });
    }, { rootMargin: '-40% 0px -40% 0px', threshold: 0 });
    document.querySelectorAll('section[id]').forEach(function (s) { io.observe(s); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchSections);
  else watchSections();
})();
