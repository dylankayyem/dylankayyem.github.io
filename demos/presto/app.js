/* Presto redesign: a coded version of the screens from the heuristic
   evaluation and UI library (terms prompt, sign-in with inline errors, card
   dashboard, load funds with clear amounts and payment choice, confirmation).
   Not affiliated with Metrolinx; card numbers and balances are sample data. */
(function () {
  'use strict';
  var esc = Proto.esc;
  function ic(d) { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="' + d + '"/></svg>'; }
  var I = { back: 'M15 18l-6-6 6-6', menu: 'M4 7h16M4 12h16M4 17h16', plus: 'M12 5v14M5 12h14', list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01', auto: 'M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4', card: 'M3 6h18v12H3zM3 10h18', check: 'm5 12 4 4L19 6', out: 'M10 4H5v16h5M14 8l4 4-4 4M18 12H9' };
  function money(v) { return '$' + v.toFixed(2); }
  function top(title, left) {
    return '<div class="pr-top">' + (left ? '<button data-to="' + left + '" aria-label="Back">' + ic(I.back) + '</button>' : '') + '<h2>' + esc(title) + '</h2></div>';
  }

  Proto.init({
    name: 'Presto redesign', kind: 'Coded prototype · heuristic evaluation', ratio: 0.5,
    blurb: 'A redesign of the Toronto transit card app after a heuristic evaluation: clearer sign-in errors, an easier way back, and a load-funds flow that shows the amount and payment before you commit.',
    hint: 'This one is coded from the UI library rather than images, so every field and button works.',
    start: 'terms',
    order: ['terms', 'signin', 'home', 'load', 'done'],
    initialState: function () { return { balance: 12.4, amount: 20, method: 'visa', error: false, email: 'commuter@example.com', history: [{ t: 'Fare · TTC Union Station', a: -3.3 }, { t: 'Fare · GO Transit Oakville', a: -6.85 }, { t: 'Loaded · Visa •• 4821', a: 20 }] }; },
    screens: {
      terms: { label: 'Terms', html: function () {
        return '<div class="pr"><div class="pr-tos"><h2>Before you start</h2><div class="pr-card"><h3>Terms of Use and Privacy Policy</h3><p class="pr-note">By continuing you agree to the PRESTO Terms of Use and Privacy Policy. Your card details are only used to load funds and show your trips.</p></div>' +
          '<button class="pr-btn" data-to="signin">Accept and continue</button><button class="pr-btn ghost" data-to="terms" data-toast="You need to accept the terms to use the app">Decline</button></div></div>';
      } },
      signin: { label: 'Sign in', html: function (s) {
        return '<div class="pr">' + top('Sign in', 'terms') + '<div class="pr-body"><div class="pr-card"><h3>Welcome back</h3><p class="pr-note" style="margin-bottom:12px">Use the username or email on your PRESTO account.</p>' +
          '<form data-signin><div class="pr-field"><label for="u">Username or email</label><input id="u" name="u" value="' + esc(s.email) + '"></div>' +
          '<div class="pr-field' + (s.error ? ' err' : '') + '"><label for="pw">Password</label><input id="pw" name="pw" type="password" placeholder="Enter your password">' +
          (s.error ? '<span class="msg">That password doesn\'t match our records. Check it and try again, or reset it below.</span>' : '') + '</div>' +
          '<button class="pr-btn" type="submit">Sign in</button></form></div>' +
          '<p class="pr-note" style="text-align:center">Try signing in with an empty password to see the error state.</p>' +
          '<button class="pr-btn ghost" type="button" data-to="signin" data-toast="A reset link was sent to your email">Forgot password?</button></div></div>';
      }, after: function (root, s) {
        root.querySelector('[data-signin]').addEventListener('submit', function (e) {
          e.preventDefault(); s.email = e.target.u.value;
          if (!e.target.pw.value) { s.error = true; Proto.render(); return; }
          s.error = false; Proto.go('home');
        });
      } },
      home: { label: 'My card', html: function (s) {
        return '<div class="pr">' + top('My PRESTO card') + '<div class="pr-body">' +
          '<div class="pr-presto"><div class="logo">PRESTO</div><div><div class="pr-note" style="color:rgba(255,255,255,0.8)">Balance</div><div class="bal">' + money(s.balance) + '</div></div><div class="num">3125 •••• •••• 8840</div></div>' +
          '<div class="pr-grid">' +
            '<button class="pr-tile" data-to="load">' + ic(I.plus) + '<b>Load funds</b><span>Add money to your card</span></button>' +
            '<button class="pr-tile" data-to="home" data-toast="Autoload tops up your card when it drops below $10">' + ic(I.auto) + '<b>Autoload</b><span>Off</span></button>' +
            '<button class="pr-tile" data-to="home" data-toast="Showing your last 3 trips below">' + ic(I.list) + '<b>Activity</b><span>Recent trips</span></button>' +
            '<button class="pr-tile" data-to="signin">' + ic(I.out) + '<b>Sign out</b><span>' + esc(s.email) + '</span></button>' +
          '</div>' +
          '<div class="pr-card"><h3>Recent activity</h3>' + s.history.slice(0, 4).map(function (h) { return '<div class="pr-row"><span>' + esc(h.t) + '</span><b style="color:' + (h.a < 0 ? '#1d1d1d' : '#2f7d1a') + '">' + (h.a < 0 ? '−' : '+') + money(Math.abs(h.a)) + '</b></div>'; }).join('') + '</div>' +
        '</div></div>';
      } },
      load: { label: 'Load funds', html: function (s) {
        var methods = [['visa', 'Visa •• 4821'], ['mc', 'Mastercard •• 1190'], ['bank', 'Online banking']];
        return '<div class="pr">' + top('Load funds', 'home') + '<div class="pr-body">' +
          '<div class="pr-card"><h3>Amount</h3><div class="pr-chips">' + [10, 20, 50].map(function (a) { return '<button class="pr-chip' + (s.amount === a ? ' on' : '') + '" data-amt="' + a + '">$' + a + '</button>'; }).join('') + '</div></div>' +
          '<div class="pr-card"><h3>Pay with</h3><div style="display:grid;gap:8px">' + methods.map(function (m) { return '<button class="pr-radio' + (s.method === m[0] ? ' on' : '') + '" data-method="' + m[0] + '"><i></i>' + esc(m[1]) + '</button>'; }).join('') + '</div></div>' +
          '<div class="pr-card"><div class="pr-row"><span>Current balance</span><b>' + money(s.balance) + '</b></div><div class="pr-row"><span>Loading</span><b>+' + money(s.amount) + '</b></div><div class="pr-row"><span>New balance</span><b style="color:#2f5d1a">' + money(s.balance + s.amount) + '</b></div></div>' +
          '<button class="pr-btn" data-confirm>Load ' + money(s.amount) + '</button>' +
        '</div></div>';
      }, after: function (root, s) {
        root.querySelectorAll('[data-amt]').forEach(function (b) { b.addEventListener('click', function () { s.amount = +b.dataset.amt; Proto.render(); }); });
        root.querySelectorAll('[data-method]').forEach(function (b) { b.addEventListener('click', function () { s.method = b.dataset.method; Proto.render(); }); });
        root.querySelector('[data-confirm]').addEventListener('click', function () {
          s.balance += s.amount; s.history.unshift({ t: 'Loaded · ' + ({ visa: 'Visa •• 4821', mc: 'Mastercard •• 1190', bank: 'Online banking' })[s.method], a: s.amount }); Proto.go('done');
        });
      } },
      done: { label: 'Confirmation', html: function (s) {
        return '<div class="pr">' + top('Funds loaded') + '<div class="pr-body"><div class="pr-card pr-done"><div class="ok">' + ic(I.check) + '</div><h3 style="font-size:17px">' + money(s.amount) + ' added</h3><p class="pr-note">Your new balance is <b>' + money(s.balance) + '</b>. It can take up to 24 hours to appear on the card reader.</p></div>' +
          '<button class="pr-btn" data-to="home">Back to my card</button></div></div>';
      } }
    }
  });
})();
