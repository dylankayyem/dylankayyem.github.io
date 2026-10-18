// Shared site chrome for the case-study pages (PawPrints, Presto, It's a Start).
// Builds the same floating glass navbar, mobile tab bar and footer the
// portfolio pages use, so moving between pages feels like one site.
(function () {
  'use strict';
  var ICONS = {
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3.5 11 12 3.8l8.5 7.2M5.5 9.8V20h4.8v-5.4h3.4V20h4.8V9.8"/></svg>',
    projects: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m8 8-4.5 4L8 16M16 8l4.5 4L16 16M13.5 5l-3 14"/></svg>',
    about: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0"/></svg>',
    contact: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m3.5 7.5 8.5 6 8.5-6"/></svg>'
  };
  var LINKS = [
    { href: 'index.html', label: 'Home', icon: 'home', tip: 'Back to the portfolio' },
    { href: 'index.html#projects', label: 'Projects', icon: 'projects', tip: 'Selected work', active: true },
    { href: 'about.html', label: 'About', icon: 'about', tip: 'Background and resume' },
    { href: 'index.html#contact', label: 'Contact', icon: 'contact', tip: 'Send me a message' }
  ];

  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  function build() {
    if (document.querySelector('body > nav')) return; // already built

    var navLinks = LINKS.map(function (l) {
      return '<a href="' + l.href + '" aria-label="' + l.label + '" data-tip="' + l.label + '" data-tip-sub="' + l.tip + '" data-tip-nav>' +
        ICONS[l.icon] + '<span>' + l.label + '</span></a>';
    }).join('');
    var nav = el(
      '<nav>' +
        '<div class="left"><a href="index.html">Dylan Kayyem</a></div>' +
        '<div class="right">' + navLinks + '</div>' +
      '</nav>');
    var placeholder = document.getElementById('nav-placeholder');
    if (placeholder) placeholder.replaceWith(nav); else document.body.insertBefore(nav, document.body.firstChild);

    var year = new Date().getFullYear();
    var footer = el(
      '<footer class="site-footer">' +
        '<p>&copy; ' + year + ' Dylan Kayyem &middot; Broomfield, CO</p>' +
        '<div class="footer-links">' +
          '<a href="index.html">Home</a>' +
          '<a href="about.html">About</a>' +
          '<a href="https://github.com/dylankayyem" target="_blank" rel="noopener noreferrer">GitHub</a>' +
          '<a href="https://www.linkedin.com/in/dylankayyem/" target="_blank" rel="noopener noreferrer">LinkedIn</a>' +
          '<a href="files/Dylan_Kayyem.pdf" download>Resume</a>' +
        '</div>' +
      '</footer>');
    document.body.appendChild(footer);

    var tabs = LINKS.map(function (l) {
      return '<a href="' + l.href + '"' + (l.active ? ' class="active"' : '') + '>' + ICONS[l.icon] + '<span>' + l.label + '</span></a>';
    }).join('');
    document.body.appendChild(el('<nav class="tabbar" aria-label="Sections">' + tabs + '</nav>'));
  }

  window.loadNavigationBar = build;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
