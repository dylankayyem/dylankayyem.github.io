// Shared navigation bar for the case-study pages (PawPrints, Presto, It's a Start, About).
// Mirrors the homepage nav so moving between pages feels consistent.
function loadNavigationBar() {
  var here = window.location.pathname.split('/').pop() || 'index.html';
  var links = [
    { href: 'index.html', label: 'Home' },
    { href: 'index.html#projects', label: 'Projects' },
    { href: 'files/Dylan_Kayyem.pdf', label: 'Resume', download: true, hideOnMobile: true },
    { href: 'index.html#contact', label: 'Contact', cta: true }
  ];
  var items = links.map(function (l) {
    var classes = [];
    if (l.cta) classes.push('topnav__cta');
    if (!l.cta && here === l.href) classes.push('active');
    if (l.hideOnMobile) classes.push('topnav__hide-sm');
    var cls = classes.length ? ' class="' + classes.join(' ') + '"' : '';
    var extra = l.download ? ' download' : '';
    return '<a href="' + l.href + '"' + cls + extra + '>' + l.label + '</a>';
  }).join('');
  document.getElementById('nav-placeholder').innerHTML =
    '<nav class="topnav" id="myTopnav" aria-label="Site">' +
      '<a class="topnav__brand" href="index.html">Dylan<span class="topnav__brand-last"> Kayyem</span></a>' +
      '<div class="topnav__links">' + items + '</div>' +
    '</nav>';
}
