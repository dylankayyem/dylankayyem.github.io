/* Blood Bank Management demo, on the project's own sample data: 64 Colorado
   county hospitals with stock by blood type, donors, patients, donations,
   transfusions, transfers and complication reports. Includes the donor/
   patient compatibility matcher and recording donations and transfusions,
   which update inventory in memory. */
(function () {
  'use strict';
  var D = window.Demo, esc = D.esc, badge = D.badge, src = window.BLOODBANK_DATA;
  var TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  var COL = { 'A+': 'A_Positive_Units', 'A-': 'A_Negative_Units', 'B+': 'B_Positive_Units', 'B-': 'B_Negative_Units', 'AB+': 'AB_Positive_Units', 'AB-': 'AB_Negative_Units', 'O+': 'O_Positive_Units', 'O-': 'O_Negative_Units' };
  // Red cell compatibility: recipient -> donor types they can receive.
  var CAN_RECEIVE = { 'O-': ['O-'], 'O+': ['O+', 'O-'], 'A-': ['A-', 'O-'], 'A+': ['A+', 'A-', 'O+', 'O-'], 'B-': ['B-', 'O-'], 'B+': ['B+', 'B-', 'O+', 'O-'], 'AB-': ['AB-', 'A-', 'B-', 'O-'], 'AB+': TYPES.slice() };

  var hospitals = src.bloodbanks.map(function (b) {
    var stock = {}; TYPES.forEach(function (t) { stock[t] = +b[COL[t]]; });
    return { id: +b.Institution_ID, name: b.Name + ' Hospital', county: b.Name, city: b.City, state: b.State, stock: stock };
  });
  var hById = {}; hospitals.forEach(function (h) { hById[h.id] = h; });
  var donors = src.donors.map(function (d) { return { id: +d.Donor_ID, name: d.Name, type: d.Blood_Type }; });
  var patients = src.patients.map(function (p) { return { id: +p.Patient_ID, name: p.Name, type: p.Blood_Type }; });
  var dById = {}; donors.forEach(function (d) { dById[d.id] = d; });
  var pById = {}; patients.forEach(function (p) { pById[p.id] = p; });
  function dt(s) { var m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{1,2}):(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : new Date(s); }
  var donations = src.donations.map(function (x) { return { id: +x.Donation_ID, at: dt(x.Date_Time), donor: dById[+x.Donor_ID], pro: x.Medical_Professional, hospital: hById[+x.Hospital_ID], amount: +x.Amount }; });
  var doById = {}; donations.forEach(function (d) { doById[d.id] = d; });
  var transfusions = src.transfusions.map(function (x) { return { id: +x.Transfusion_ID, at: dt(x.Date_Time), donation: doById[+x.Donation_ID], patient: pById[+x.Patient_ID], pro: x.Medical_Professional, hospital: hById[+x.Hospital_ID], amount: +x.Amount }; });
  var tById = {}; transfusions.forEach(function (t) { tById[t.id] = t; });
  var transfers = src.transfers.map(function (x) { return { id: +x.Transfer_ID, at: dt(x.Date_Time), donation: doById[+x.Donation_ID], to: hById[+x.Receiving_Hospital_ID], from: hById[+x.Sending_Hospital_ID] }; });
  var complications = src.complications.map(function (x) { return { id: +x.Complication_ID, transfusion: tById[+x.Transfusion_ID], comments: x.Comments }; });

  function totals() { var t = {}; TYPES.forEach(function (k) { t[k] = hospitals.reduce(function (s, h) { return s + h.stock[k]; }, 0); }); return t; }
  function avg(type) { return totals()[type] / hospitals.length; }
  function level(h, type) { var r = h.stock[type] / avg(type); return r < 0.2 ? 'bad' : r < 0.45 ? 'warn' : 'ok'; }
  function lowStock() {
    var out = [];
    hospitals.forEach(function (h) { TYPES.forEach(function (t) { if (level(h, t) === 'bad') out.push({ h: h, type: t, units: h.stock[t], pct: Math.round(h.stock[t] / avg(t) * 100) }); }); });
    return out.sort(function (a, b) { return a.pct - b.pct; });
  }
  function n(v) { return v.toLocaleString(); }
  function dstr(d) { return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
  function typeBadge(t) { return '<span class="badge ' + (t.indexOf('-') > 0 ? 'info' : 'bad') + '" style="font-family:var(--mono)">' + esc(t) + '</span>'; }
  function hLink(h) { return '<span data-go="inventory/' + h.id + '" style="color:var(--brand);font-weight:500">' + esc(h.name) + '</span>'; }

  // ---- views -----------------------------------------------------------------
  function dashboard() {
    var tot = totals(), all = TYPES.reduce(function (s, t) { return s + tot[t]; }, 0), low = lowStock();
    var recent = donations.slice().sort(function (a, b) { return b.at - a.at; }).slice(0, 6);
    var tones = TYPES.map(function (t) { return tot[t] / all < 0.03 ? 'bad' : tot[t] / all < 0.06 ? 'warn' : ''; });
    return {
      title: 'Dashboard', crumbs: 'Colorado statewide network · ' + hospitals.length + ' hospitals',
      actions: '<button class="btn primary sm" data-go="match">' + D.icon('match') + 'Find a match</button>',
      html:
        '<div class="grid stats">' +
          D.stat({ label: 'Units on hand', value: n(all), delta: 'Across all blood types' }) +
          D.stat({ label: 'Registered donors', value: donors.length, delta: donations.length + ' donations recorded' }) +
          D.stat({ label: 'Transfusions', value: transfusions.length, delta: complications.length + ' complication reported', tone: complications.length ? 'down' : '' }) +
          D.stat({ label: 'Low-stock alerts', value: low.length, delta: 'Below 20% of state average', tone: low.length ? 'down' : 'up' }) +
        '</div>' +
        '<div class="grid two">' +
          D.card('Inventory by blood type', D.bars(TYPES.map(function (t) { return tot[t]; }), TYPES, tones) +
            '<div class="note" style="margin-top:10px">O− is the universal red-cell donor; AB+ can receive any type.</div>', { sub: 'Units across every hospital' }) +
          D.card('Low-stock alerts', low.length ? low.slice(0, 6).map(function (l) {
            return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--line)" data-go="inventory/' + l.h.id + '"><span><b style="font-weight:600">' + esc(l.h.county) + '</b><div class="note">' + esc(l.h.city) + '</div></span><span style="display:flex;gap:8px;align-items:center">' + typeBadge(l.type) + '<span class="note">' + n(l.units) + ' · ' + l.pct + '%</span></span></div>';
          }).join('') : '<div class="empty">Every hospital is above threshold.</div>', { sub: low.length + ' hospital / type pairs' }) +
        '</div>' +
        D.card('Recent donations', D.table({ columns: [
          { label: 'Date', render: function (d) { return esc(dstr(d.at)); } },
          { label: 'Donor', render: function (d) { return '<b>' + esc(d.donor.name) + '</b>'; } },
          { label: 'Type', render: function (d) { return typeBadge(d.donor.type); } },
          { label: 'Hospital', render: function (d) { return hLink(d.hospital); } },
          { label: 'Professional', key: 'pro' },
          { label: 'Units', num: true, key: 'amount' }
        ], rows: recent }), { flush: true, actions: '<button class="btn sm" data-go="donations">Record donation</button>' })
    };
  }

  var invQ = '', invType = 'all';
  function inventory(param) {
    if (param && hById[+param]) return hospitalDetail(hById[+param]);
    var rows = hospitals.filter(function (h) { return !invQ || (h.name + ' ' + h.city).toLowerCase().indexOf(invQ) >= 0; });
    var cols = [{ label: 'Hospital', render: function (h) { return '<b>' + esc(h.county) + '</b><div class="note">' + esc(h.city) + ', ' + h.state + '</div>'; } }];
    (invType === 'all' ? TYPES : [invType]).forEach(function (t) { cols.push({ label: t, num: true, render: function (h) { var l = level(h, t); return '<span style="color:var(--' + (l === 'ok' ? 'text' : l) + ');font-weight:' + (l === 'ok' ? 400 : 600) + '">' + n(h.stock[t]) + '</span>'; } }); });
    if (invType !== 'all') rows = rows.slice().sort(function (a, b) { return a.stock[invType] - b.stock[invType]; });
    return {
      title: 'Inventory', crumbs: 'Bloodbanks_and_Hospitals · units by blood type',
      html: '<div class="toolbar"><input class="grow" type="search" placeholder="Search hospital or city" value="' + esc(invQ) + '" data-inv-q>' +
        '<select data-inv-t><option value="all">All types</option>' + TYPES.map(function (t) { return '<option ' + (invType === t ? 'selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div>' +
        D.card('Hospitals', D.table({ columns: cols, rows: rows, rowAttr: function (h) { return 'data-go="inventory/' + h.id + '"'; }, empty: 'No hospitals match' }), { flush: true, sub: 'Amber and red mark stock below 45% and 20% of the state average' + (invType !== 'all' ? ' · sorted by lowest ' + invType : '') }),
      after: function (root) {
        var q = root.querySelector('[data-inv-q]'); q.addEventListener('input', function () { invQ = q.value.trim().toLowerCase(); var pos = q.selectionStart; D.render(); var nq = document.querySelector('[data-inv-q]'); nq.focus(); nq.setSelectionRange(pos, pos); });
        root.querySelector('[data-inv-t]').addEventListener('change', function (e) { invType = e.target.value; D.render(); });
      }
    };
  }

  function hospitalDetail(h) {
    var max = Math.max.apply(null, TYPES.map(function (t) { return h.stock[t]; }));
    var meters = TYPES.map(function (t) { var l = level(h, t); return '<div style="display:grid;grid-template-columns:44px 1fr 90px;gap:10px;align-items:center;margin-bottom:10px">' + typeBadge(t) + '<div class="meter"><i class="' + l + '" style="width:' + Math.max(2, Math.round(h.stock[t] / max * 100)) + '%"></i></div><span class="note" style="text-align:right">' + n(h.stock[t]) + '</span></div>'; }).join('');
    var dons = donations.filter(function (d) { return d.hospital === h; }), trs = transfers.filter(function (t) { return t.to === h || t.from === h; });
    return {
      title: h.name, crumbs: '<span data-go="inventory">Inventory</span> / <b>' + esc(h.county) + '</b>',
      html: '<div class="grid two">' +
        D.card('Stock by blood type', meters, { sub: h.city + ', ' + h.state + ' · Institution ' + h.id }) +
        '<div class="grid" style="align-content:start">' +
          D.card('Donations here', dons.length ? D.table({ columns: [{ label: 'Date', render: function (d) { return esc(dstr(d.at)); } }, { label: 'Donor', render: function (d) { return esc(d.donor.name); } }, { label: 'Type', render: function (d) { return typeBadge(d.donor.type); } }], rows: dons }) : '<div class="empty">No donations recorded</div>', { flush: true }) +
          D.card('Transfers', trs.length ? D.table({ columns: [{ label: 'Date', render: function (t) { return esc(dstr(t.at)); } }, { label: 'Direction', render: function (t) { return t.to === h ? badge('In from ' + t.from.county, 'ok') : badge('Out to ' + t.to.county, 'warn'); } }], rows: trs }) : '<div class="empty">No transfers</div>', { flush: true }) +
        '</div></div>'
    };
  }

  var matchPatient = patients[2].id, matchHospital = 'any';
  function match() {
    var p = pById[matchPatient], types = CAN_RECEIVE[p.type];
    var candidates = hospitals.filter(function (h) { return matchHospital === 'any' || h.id === +matchHospital; }).map(function (h) {
      var best = types.slice().sort(function (a, b) { return h.stock[b] - h.stock[a]; })[0];
      var units = types.reduce(function (s, t) { return s + h.stock[t]; }, 0);
      return { h: h, best: best, units: units, exact: h.stock[p.type] };
    }).sort(function (a, b) { return b.exact - a.exact || b.units - a.units; }).slice(0, 8);
    var donorsOk = donors.filter(function (d) { return types.indexOf(d.type) >= 0; });
    return {
      title: 'Patient–donor matching', crumbs: 'Compatible red-cell types and where they are in stock',
      html:
        '<div class="card"><div class="body"><div class="toolbar">' +
          '<label class="note" for="mp">Patient</label><select id="mp" data-mp>' + patients.map(function (x) { return '<option value="' + x.id + '" ' + (x.id === matchPatient ? 'selected' : '') + '>' + esc(x.name) + ' (' + x.type + ')</option>'; }).join('') + '</select>' +
          '<label class="note" for="mh">Hospital</label><select id="mh" data-mh><option value="any">Any hospital</option>' + hospitals.map(function (h) { return '<option value="' + h.id + '" ' + (String(h.id) === String(matchHospital) ? 'selected' : '') + '>' + esc(h.county) + '</option>'; }).join('') + '</select>' +
        '</div></div></div>' +
        '<div class="alert ok">' + D.icon('check') + '<div class="txt"><b>' + esc(p.name) + ' is ' + p.type + '</b> and can receive ' + types.map(function (t) { return '<b>' + t + '</b>'; }).join(', ') + '. ' + donorsOk.length + ' registered donors are compatible.</div></div>' +
        '<div class="grid two">' +
          D.card('Best stocked hospitals', D.table({ columns: [
            { label: 'Hospital', render: function (c) { return hLink(c.h) + '<div class="note">' + esc(c.h.city) + '</div>'; } },
            { label: 'Exact ' + p.type, num: true, render: function (c) { return n(c.exact); } },
            { label: 'Compatible', num: true, render: function (c) { return n(c.units); } },
            { label: '', render: function (c) { return '<button class="btn sm primary" data-transfuse="' + c.h.id + '">Transfuse</button>'; } }
          ], rows: candidates }), { flush: true, sub: 'Sorted by exact-type stock' }) +
          D.card('Compatible donors', D.table({ columns: [
            { label: 'Donor', render: function (d) { return '<b>' + esc(d.name) + '</b>'; } },
            { label: 'Type', render: function (d) { return typeBadge(d.type); } },
            { label: 'Donations', num: true, render: function (d) { return donations.filter(function (x) { return x.donor === d; }).length; } }
          ], rows: donorsOk }), { flush: true }) +
        '</div>',
      after: function (root) {
        root.querySelector('[data-mp]').addEventListener('change', function (e) { matchPatient = +e.target.value; D.render(); });
        root.querySelector('[data-mh]').addEventListener('change', function (e) { matchHospital = e.target.value; D.render(); });
      }
    };
  }

  function donationsView() {
    var rows = donations.slice().sort(function (a, b) { return b.at - a.at; });
    return {
      title: 'Donations', crumbs: 'Record a donation · stock updates immediately',
      html:
        D.card('Record donation', '<form data-donate class="toolbar">' +
          '<select name="donor">' + donors.map(function (d) { return '<option value="' + d.id + '">' + esc(d.name) + ' (' + d.type + ')</option>'; }).join('') + '</select>' +
          '<select name="hospital">' + hospitals.map(function (h) { return '<option value="' + h.id + '">' + esc(h.county) + '</option>'; }).join('') + '</select>' +
          '<input name="pro" placeholder="Medical professional" value="Dr. Diana Prince" class="grow">' +
          '<input name="amount" type="number" min="1" max="4" value="1" style="width:80px" aria-label="Units">' +
          '<button class="btn primary" type="submit">' + D.icon('plus') + 'Record</button></form>') +
        D.card('All donations', D.table({ columns: [
          { label: 'ID', render: function (d) { return '<span class="mono">#' + d.id + '</span>'; } },
          { label: 'Date', render: function (d) { return esc(dstr(d.at)); } },
          { label: 'Donor', render: function (d) { return '<b>' + esc(d.donor.name) + '</b>'; } },
          { label: 'Type', render: function (d) { return typeBadge(d.donor.type); } },
          { label: 'Hospital', render: function (d) { return hLink(d.hospital); } },
          { label: 'Units', num: true, key: 'amount' }
        ], rows: rows }), { flush: true, sub: rows.length + ' donations' }),
      after: function (root) {
        root.querySelector('[data-donate]').addEventListener('submit', function (e) {
          e.preventDefault(); var f = e.target, d = dById[+f.donor.value], h = hById[+f.hospital.value], amt = Math.max(1, Math.min(4, +f.amount.value || 1));
          var rec = { id: donations.length + 1, at: new Date(), donor: d, pro: f.pro.value || 'Staff', hospital: h, amount: amt };
          donations.push(rec); doById[rec.id] = rec; h.stock[d.type] += amt;
          D.toast('Donation #' + rec.id + ' recorded · ' + h.county + ' ' + d.type + ' now ' + n(h.stock[d.type])); D.render();
        });
      }
    };
  }

  function reports() {
    return {
      title: 'Transfusions & reports', crumbs: transfusions.length + ' transfusions · ' + transfers.length + ' transfers · ' + complications.length + ' complication',
      html:
        (complications.length ? D.card('Complication reports', complications.map(function (c) {
          var t = c.transfusion;
          return '<div class="alert warn">' + D.icon('alert') + '<div class="txt"><b>Transfusion #' + t.id + ' · ' + esc(t.patient.name) + '</b> received ' + esc(t.donation.donor.type) + ' from ' + esc(t.donation.donor.name) + ' at ' + esc(t.hospital.county) + ' on ' + esc(dstr(t.at)) + '.<div style="margin-top:4px">“' + esc(c.comments) + '”</div></div></div>';
        }).join('')) : '') +
        D.card('Transfusions', D.table({ columns: [
          { label: 'Date', render: function (t) { return esc(dstr(t.at)); } },
          { label: 'Patient', render: function (t) { return '<b>' + esc(t.patient.name) + '</b>'; } },
          { label: 'Patient type', render: function (t) { return typeBadge(t.patient.type); } },
          { label: 'Donor type', render: function (t) { var ok = CAN_RECEIVE[t.patient.type].indexOf(t.donation.donor.type) >= 0; return typeBadge(t.donation.donor.type) + (ok ? '' : ' ' + badge('Incompatible', 'bad')); } },
          { label: 'Hospital', render: function (t) { return hLink(t.hospital); } },
          { label: 'Professional', key: 'pro' }
        ], rows: transfusions.slice().sort(function (a, b) { return b.at - a.at; }) }), { flush: true, sub: 'Compatibility is checked against the donation’s blood type' }) +
        D.card('Transfers between hospitals', D.table({ columns: [
          { label: 'Date', render: function (t) { return esc(dstr(t.at)); } },
          { label: 'From', render: function (t) { return hLink(t.from); } },
          { label: 'To', render: function (t) { return hLink(t.to); } },
          { label: 'Donation', render: function (t) { return '#' + t.donation.id + ' · ' + typeBadge(t.donation.donor.type); } }
        ], rows: transfers }), { flush: true })
    };
  }

  function people() {
    return {
      title: 'Donors & patients', crumbs: donors.length + ' donors · ' + patients.length + ' patients',
      html: '<div class="grid halves">' +
        D.card('Donors', D.table({ columns: [{ label: 'Name', render: function (d) { return '<b>' + esc(d.name) + '</b>'; } }, { label: 'Type', render: function (d) { return typeBadge(d.type); } }, { label: 'Donations', num: true, render: function (d) { return donations.filter(function (x) { return x.donor === d; }).length; } }], rows: donors }), { flush: true }) +
        D.card('Patients', D.table({ columns: [{ label: 'Name', render: function (p) { return '<b>' + esc(p.name) + '</b>'; } }, { label: 'Type', render: function (p) { return typeBadge(p.type); } }, { label: 'Transfusions', num: true, render: function (p) { return transfusions.filter(function (x) { return x.patient === p; }).length; } }], rows: patients, rowAttr: function (p) { return 'data-match-patient="' + p.id + '"'; } }), { flush: true, sub: 'Click a patient to find a match' }) +
        '</div>'
    };
  }

  document.addEventListener('click', function (e) {
    var el;
    if ((el = e.target.closest('[data-match-patient]'))) { matchPatient = +el.dataset.matchPatient; matchHospital = 'any'; D.go('match'); return; }
    if ((el = e.target.closest('[data-transfuse]'))) {
      var h = hById[+el.dataset.transfuse], p = pById[matchPatient], types = CAN_RECEIVE[p.type];
      var use = h.stock[p.type] > 0 ? p.type : types.find(function (t) { return h.stock[t] > 0; });
      if (!use) { D.toast('No compatible units at ' + h.county); return; }
      h.stock[use] -= 1;
      var donor = donors.find(function (d) { return d.type === use; }) || donors[0];
      var don = { id: donations.length + 1, at: new Date(Date.now() - 86400000), donor: donor, pro: 'Dr. Bruce Banner', hospital: h, amount: 1 };
      donations.push(don); doById[don.id] = don;
      transfusions.push({ id: transfusions.length + 1, at: new Date(), donation: don, patient: p, pro: 'Dr. Bruce Banner', hospital: h, amount: 1 });
      D.toast('Transfused 1 unit of ' + use + ' to ' + p.name + ' at ' + h.county); D.render();
    }
  });

  D.init({
    id: 'bloodbank', name: 'Blood Bank', icon: 'drop', defaultView: 'dashboard', navLabel: 'Space Monkeys',
    user: { name: 'Dylan Kayyem', initials: 'DK', org: 'Blood bank staff' },
    login: { heading: 'Blood bank sign in', sub: 'Inventory, donor–patient matching and transfusion records across Colorado hospitals.', email: 'staff@bloodbank.example', foot: 'Flask · SQLite · PostgreSQL. Uses the project’s own sample data.' },
    nav: [
      { id: 'dashboard', label: 'Dashboard', icon: 'home' },
      { id: 'inventory', label: 'Inventory', icon: 'box' },
      { id: 'match', label: 'Matching', icon: 'match' },
      { id: 'donations', label: 'Donations', icon: 'drop' },
      { id: 'reports', label: 'Transfusions', icon: 'inbox' },
      { id: 'people', label: 'Donors & patients', icon: 'users' }
    ],
    views: { dashboard: dashboard, inventory: inventory, match: match, donations: donationsView, reports: reports, people: people }
  });
})();
