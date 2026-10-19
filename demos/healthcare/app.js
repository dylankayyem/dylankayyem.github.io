/* Healthcare Organization Database demo. Mirrors the project's schema
   (patient, doctor, care_provider, room, appointment, payment, call_record,
   care_assignment, diagnosis_change_log) on generated sample data, with the
   staff dashboard, record views and the saved-query explorer the Vercel
   rebuild exposed. */
(function () {
  'use strict';
  var D = window.Demo, esc = D.esc, badge = D.badge;
  var R = D.rng(7);
  function pick(a) { return a[Math.floor(R() * a.length)]; }
  var DAY = 86400000, today = new Date(); today.setHours(0, 0, 0, 0);

  var FIRST = ['Avery', 'Jordan', 'Maya', 'Liam', 'Sofia', 'Noah', 'Priya', 'Ethan', 'Grace', 'Mateo', 'Hana', 'Owen', 'Zara', 'Lucas', 'Elena', 'Caleb', 'Nora', 'Isaac', 'Leah', 'Miles', 'Aria', 'Wyatt', 'Chloe', 'Diego', 'Ruby', 'Felix', 'Ivy', 'Jonah'];
  var LAST = ['Reyes', 'Patel', 'Nguyen', 'Okafor', 'Larsen', 'Kim', 'Moreau', 'Silva', 'Brooks', 'Haddad', 'Novak', 'Turner', 'Ibrahim', 'Castillo', 'Weber', 'Sato', 'Bennett', 'Ortiz'];
  var STREETS = ['Pearl St', 'Baseline Rd', 'Arapahoe Ave', 'Broadway', 'Folsom St', 'Canyon Blvd', 'Iris Ave', 'Table Mesa Dr'];
  var DISEASES = [['Type 2 diabetes', 'Metformin 500mg'], ['Hypertension', 'Lisinopril 10mg'], ['Asthma', 'Albuterol inhaler'], ['Migraine', 'Sumatriptan 50mg'], ['Hypothyroidism', 'Levothyroxine 75mcg'], ['Seasonal allergies', 'Cetirizine 10mg'], ['Anxiety disorder', 'Sertraline 50mg'], ['Osteoarthritis', 'Naproxen 250mg'], ['Pneumonia', 'Amoxicillin 875mg']];
  var SPECS = ['Cardiology', 'Endocrinology', 'Family Medicine', 'Neurology', 'Pulmonology', 'Orthopedics', 'Psychiatry'];
  var REASONS = ['Follow-up visit', 'Annual physical', 'Lab review', 'Medication review', 'New symptoms', 'Post-op check', 'Consultation'];

  function person() { return pick(FIRST) + ' ' + pick(LAST); }
  function phone() { return '(303) 555-' + String(1000 + Math.floor(R() * 8999)); }
  function email(n) { return n.toLowerCase().replace(' ', '.') + '@example.com'; }

  var doctors = SPECS.concat(['Family Medicine', 'Cardiology']).map(function (s, i) {
    var n = 'Dr. ' + person();
    return { id: 'D' + (101 + i), name: n, spec: s, phone: phone(), email: email(n.replace('Dr. ', '')), avail: pick(['Mon–Thu', 'Tue–Fri', 'Mon, Wed, Fri', 'Mon–Fri']) };
  });
  var providers = [];
  for (var i = 0; i < 14; i++) { var pn = person(); providers.push({ id: 'C' + (201 + i), name: pn, type: pick(['Registered Nurse', 'Nurse Practitioner', 'Physician Assistant', 'Physical Therapist']), doctor: pick(doctors), phone: phone() }); }

  var patients = [];
  for (i = 0; i < 64; i++) {
    var n2 = person(), d = pick(DISEASES);
    patients.push({ id: 'P' + (1001 + i), name: n2, address: (100 + Math.floor(R() * 3800)) + ' ' + pick(STREETS) + ', Boulder, CO', phone: phone(), email: email(n2), reg: new Date(today - Math.floor(R() * 900) * DAY), disease: d[0], rx: d[1] });
  }
  var appts = [];
  for (i = 0; i < 160; i++) {
    var off = Math.floor(R() * 40) - 25, t = new Date(today.getTime() + off * DAY + (8 + Math.floor(R() * 9)) * 3600000 + (R() < 0.5 ? 0 : 1800000));
    var pa = pick(patients), doc = doctors.find(function (x) { return x.spec === (/diabetes|thyroid/i.test(pa.disease) ? 'Endocrinology' : /Hypertension/.test(pa.disease) ? 'Cardiology' : /Asthma|Pneumonia/.test(pa.disease) ? 'Pulmonology' : /Migraine/.test(pa.disease) ? 'Neurology' : /Anxiety/.test(pa.disease) ? 'Psychiatry' : /arthritis/.test(pa.disease) ? 'Orthopedics' : 'Family Medicine'); }) || pick(doctors);
    appts.push({ id: 'A' + (5001 + i), patient: pa, doctor: doc, at: t, reason: pick(REASONS) });
  }
  appts.sort(function (a, b) { return a.at - b.at; });
  var payments = [];
  for (i = 0; i < 120; i++) payments.push({ id: 'Y' + (7001 + i), patient: pick(patients), amount: Math.round((40 + R() * 460) * 100) / 100, at: new Date(today - Math.floor(R() * 60) * DAY), method: pick(['Insurance', 'Credit card', 'Insurance', 'HSA', 'Cash']) });
  var rooms = [];
  ['ICU', 'General', 'General', 'General', 'Maternity', 'Pediatric', 'Surgical', 'General'].forEach(function (type, k) {
    for (var j = 1; j <= 4; j++) { var occ = R() < 0.62; rooms.push({ number: (k + 1) * 100 + j, type: type, patient: occ ? pick(patients) : null, since: new Date(today - Math.floor(R() * 6) * DAY) }); }
  });
  var calls = [];
  for (i = 0; i < 40; i++) calls.push({ id: 'K' + (9001 + i), patient: pick(patients), at: new Date(Date.now() - Math.floor(R() * 14 * 24) * 3600000), purpose: pick(['Appointment', 'Prescription refill', 'Billing question', 'Test results', 'Referral']) });
  var assignments = patients.slice(0, 30).map(function (p, k) { return { id: 'G' + (3001 + k), provider: pick(providers), patient: p, start: new Date(p.reg.getTime() + 7 * DAY), end: R() < 0.4 ? null : new Date(today.getTime() + Math.floor(R() * 60) * DAY) }; });
  var diagLog = patients.slice(5, 14).map(function (p, k) { var others = DISEASES.filter(function (x) { return x[0] !== p.disease; }); return { id: 'L' + (401 + k), patient: p, from: pick(others)[0], to: p.disease, at: new Date(today - Math.floor(R() * 120) * DAY) }; });

  function money(v) { return '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function dateStr(d) { return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
  function timeStr(d) { return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
  function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  function link(view, id, label) { return '<span data-go="' + view + '/' + id + '" style="color:var(--brand);font-weight:500">' + esc(label) + '</span>'; }

  // ---- views -----------------------------------------------------------------
  function dashboard() {
    var todays = appts.filter(function (a) { return sameDay(a.at, new Date()); });
    var upcoming = appts.filter(function (a) { return a.at >= new Date(); }).slice(0, 8);
    var occupied = rooms.filter(function (r) { return r.patient; }).length;
    var month = payments.filter(function (p) { return p.at > new Date(today - 30 * DAY); }).reduce(function (s, p) { return s + p.amount; }, 0);
    var bySpec = SPECS.map(function (s) { return appts.filter(function (a) { return a.doctor.spec === s; }).length; });
    var roomTypes = ['ICU', 'General', 'Maternity', 'Pediatric', 'Surgical'];
    var occHtml = roomTypes.map(function (t) {
      var rs = rooms.filter(function (r) { return r.type === t; }), o = rs.filter(function (r) { return r.patient; }).length, pct = Math.round(o / rs.length * 100);
      return '<div style="display:grid;gap:6px;margin-bottom:12px"><div style="display:flex;justify-content:space-between"><b style="font-weight:600">' + t + '</b><span class="note">' + o + ' / ' + rs.length + ' beds</span></div><div class="meter"><i class="' + (pct > 85 ? 'bad' : pct > 65 ? 'warn' : 'ok') + '" style="width:' + pct + '%"></i></div></div>';
    }).join('');
    return {
      title: 'Dashboard', crumbs: 'Demo General Hospital · ' + new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
      actions: '<button class="btn primary sm" data-go="queries">' + D.icon('query') + 'Run a query</button>',
      html:
        '<div class="grid stats">' +
          D.stat({ label: 'Registered patients', value: patients.length, delta: '+6 this month', tone: 'up' }) +
          D.stat({ label: 'Appointments today', value: todays.length, delta: upcoming.length + ' upcoming' }) +
          D.stat({ label: 'Bed occupancy', value: Math.round(occupied / rooms.length * 100) + '%', delta: occupied + ' of ' + rooms.length + ' rooms' }) +
          D.stat({ label: 'Payments (30d)', value: money(Math.round(month)), delta: '+4.2% vs prior 30d', tone: 'up' }) +
        '</div>' +
        '<div class="grid two">' +
          D.card('Appointments by specialization', D.bars(bySpec, SPECS.map(function (s) { return s.split(' ')[0].slice(0, 9); })), { sub: 'All scheduled appointments' }) +
          D.card('Room occupancy', occHtml, { sub: 'room_table · current status' }) +
        '</div>' +
        D.card('Upcoming appointments', D.table({ columns: [
          { label: 'When', render: function (a) { return '<b>' + esc(dateStr(a.at)) + '</b><div class="note">' + esc(timeStr(a.at)) + '</div>'; } },
          { label: 'Patient', render: function (a) { return link('patients', a.patient.id, a.patient.name); } },
          { label: 'Doctor', render: function (a) { return esc(a.doctor.name) + '<div class="note">' + esc(a.doctor.spec) + '</div>'; } },
          { label: 'Reason', key: 'reason' }
        ], rows: upcoming }), { flush: true, actions: '<button class="btn sm" data-go="appointments">View all</button>' })
    };
  }

  var pq = '';
  function patientsView(param) {
    if (param) { var p = patients.find(function (x) { return x.id === param; }); if (p) return patientDetail(p); }
    var rows = patients.filter(function (p) { return !pq || (p.id + ' ' + p.name + ' ' + p.disease + ' ' + p.email).toLowerCase().indexOf(pq) >= 0; });
    return {
      title: 'Patients', crumbs: patients.length + ' records · patient_table', actions: '<button class="btn primary sm" data-add-patient>' + D.icon('plus') + 'Register patient</button>',
      html: '<div class="toolbar"><input class="grow" type="search" placeholder="Search by name, ID, diagnosis or email" value="' + esc(pq) + '" data-pq></div>' +
        D.card('Patients', D.table({ columns: [
          { label: 'ID', render: function (p) { return '<span class="mono">' + p.id + '</span>'; } },
          { label: 'Name', render: function (p) { return '<b>' + esc(p.name) + '</b><div class="note">' + esc(p.email) + '</div>'; } },
          { label: 'Diagnosis', key: 'disease' },
          { label: 'Prescription', key: 'rx' },
          { label: 'Registered', render: function (p) { return esc(dateStr(p.reg)); } }
        ], rows: rows, rowAttr: function (p) { return 'data-go="patients/' + p.id + '"'; }, empty: 'No patients match' }), { flush: true }),
      after: function (root) { var q = root.querySelector('[data-pq]'); q.addEventListener('input', function () { pq = q.value.trim().toLowerCase(); var pos = q.selectionStart; D.render(); var n = document.querySelector('[data-pq]'); n.focus(); n.setSelectionRange(pos, pos); }); }
    };
  }

  function patientDetail(p) {
    var pa = appts.filter(function (a) { return a.patient === p; }), pay = payments.filter(function (x) { return x.patient === p; });
    var room = rooms.find(function (r) { return r.patient === p; }), care = assignments.filter(function (a) { return a.patient === p; });
    return {
      title: p.name, crumbs: '<span data-go="patients">Patients</span> / <b>' + p.id + '</b>', actions: '<button class="btn sm" data-book="' + p.id + '">' + D.icon('calendar') + 'Book appointment</button>',
      html:
        '<div class="grid two">' +
          D.card('Patient record', D.kv([['Patient ID', '<code>' + p.id + '</code>', true], ['Address', p.address], ['Phone', p.phone], ['Email', p.email], ['Registered', dateStr(p.reg)], ['Diagnosis', p.disease], ['Prescription', p.rx], ['Room', room ? 'Room ' + room.number + ' · ' + room.type : 'Outpatient']])) +
          '<div class="grid" style="align-content:start">' +
            D.card('Care team', care.length ? care.map(function (c) { return '<div style="display:flex;justify-content:space-between;gap:8px;padding:4px 0"><span><b style="font-weight:600">' + esc(c.provider.name) + '</b><div class="note">' + esc(c.provider.type) + ' · reports to ' + esc(c.provider.doctor.name) + '</div></span>' + badge(c.end ? 'Until ' + dateStr(c.end) : 'Ongoing', c.end ? 'neutral' : 'ok') + '</div>'; }).join('') : '<div class="note">No care provider assigned.</div>', { sub: 'care_assignment_table' }) +
            D.card('Payments', pay.length ? D.table({ columns: [{ label: 'Date', render: function (x) { return esc(dateStr(x.at)); } }, { label: 'Method', key: 'method' }, { label: 'Amount', num: true, render: function (x) { return money(x.amount); } }], rows: pay }) : '<div class="empty">No payments recorded</div>', { flush: true }) +
          '</div>' +
        '</div>' +
        D.card('Appointments', D.table({ columns: [
          { label: 'Date', render: function (a) { return esc(dateStr(a.at)) + ' · ' + esc(timeStr(a.at)); } },
          { label: 'Doctor', render: function (a) { return esc(a.doctor.name); } },
          { label: 'Reason', key: 'reason' },
          { label: '', render: function (a) { return badge(a.at < new Date() ? 'Completed' : 'Scheduled', a.at < new Date() ? 'neutral' : 'info'); } }
        ], rows: pa, empty: 'No appointments' }), { flush: true })
    };
  }

  function doctorsView() {
    return {
      title: 'Doctors & care providers', crumbs: doctors.length + ' doctors · ' + providers.length + ' care providers',
      html:
        D.card('Doctors', D.table({ columns: [
          { label: 'Name', render: function (d) { return '<b>' + esc(d.name) + '</b><div class="note">' + esc(d.email) + '</div>'; } },
          { label: 'Specialization', render: function (d) { return badge(d.spec, 'info'); } },
          { label: 'Availability', key: 'avail' },
          { label: 'Upcoming', num: true, render: function (d) { return appts.filter(function (a) { return a.doctor === d && a.at >= new Date(); }).length; } }
        ], rows: doctors }), { flush: true, sub: 'doctor_table' }) +
        D.card('Care providers', D.table({ columns: [
          { label: 'Name', render: function (c) { return '<b>' + esc(c.name) + '</b>'; } },
          { label: 'Type', key: 'type' },
          { label: 'Supervising doctor', render: function (c) { return esc(c.doctor.name); } },
          { label: 'Patients', num: true, render: function (c) { return assignments.filter(function (a) { return a.provider === c; }).length; } }
        ], rows: providers }), { flush: true, sub: 'care_provider_table → doctor_table' })
    };
  }

  var apptDay = 'upcoming';
  function appointmentsView() {
    var now = new Date();
    var rows = appts.filter(function (a) { return apptDay === 'today' ? sameDay(a.at, now) : apptDay === 'past' ? a.at < now : a.at >= now; });
    if (apptDay === 'past') rows = rows.slice().reverse();
    return {
      title: 'Appointments', crumbs: 'appointment_table',
      html: '<div class="pills">' + [['today', 'Today'], ['upcoming', 'Upcoming'], ['past', 'Past']].map(function (p) { return '<button class="pill ' + (apptDay === p[0] ? 'on' : '') + '" data-appt="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div>' +
        D.card('Appointments', D.table({ columns: [
          { label: 'When', render: function (a) { return '<b>' + esc(dateStr(a.at)) + '</b><div class="note">' + esc(timeStr(a.at)) + '</div>'; } },
          { label: 'Patient', render: function (a) { return link('patients', a.patient.id, a.patient.name); } },
          { label: 'Doctor', render: function (a) { return esc(a.doctor.name); } },
          { label: 'Specialization', render: function (a) { return esc(a.doctor.spec); } },
          { label: 'Reason', key: 'reason' }
        ], rows: rows.slice(0, 40), empty: 'No appointments' }), { flush: true, sub: rows.length + ' appointments' })
    };
  }

  // Saved queries: the SQL from the project, run against the sample data.
  var QUERIES = [
    { id: 'q1', name: 'Patients with their assigned doctor', sql: 'SELECT p.Name AS patient, d.Name AS doctor, d.Specialization\nFROM patient_table p\nJOIN appointment_table a ON a.Patient_ID = p.Patient_ID\nJOIN doctor_table d ON d.Doctor_ID = a.Doctor_ID\nGROUP BY p.Patient_ID, d.Doctor_ID\nORDER BY p.Name\nLIMIT 15;',
      run: function () { var seen = {}, out = []; appts.forEach(function (a) { var k = a.patient.id + a.doctor.id; if (!seen[k]) { seen[k] = 1; out.push({ patient: a.patient.name, doctor: a.doctor.name, specialization: a.doctor.spec }); } }); return out.sort(function (x, y) { return x.patient < y.patient ? -1 : 1; }).slice(0, 15); } },
    { id: 'q2', name: 'Revenue by payment method (last 30 days)', sql: "SELECT Payment_Method, COUNT(*) AS payments, SUM(Amount) AS total\nFROM payment_table\nWHERE Date_Of_Payment >= CURRENT_DATE - INTERVAL '30 days'\nGROUP BY Payment_Method\nORDER BY total DESC;",
      run: function () { var m = {}; payments.filter(function (p) { return p.at > new Date(today - 30 * DAY); }).forEach(function (p) { m[p.method] = m[p.method] || { payment_method: p.method, payments: 0, total: 0 }; m[p.method].payments++; m[p.method].total += p.amount; }); return Object.values(m).sort(function (a, b) { return b.total - a.total; }).map(function (r) { r.total = money(r.total); return r; }); } },
    { id: 'q3', name: 'Doctor workload this week', sql: "SELECT d.Name, d.Specialization, COUNT(a.Appointment_ID) AS appointments\nFROM doctor_table d\nLEFT JOIN appointment_table a ON a.Doctor_ID = d.Doctor_ID\n  AND a.Appointment_DateTime BETWEEN CURRENT_DATE AND CURRENT_DATE + 7\nGROUP BY d.Doctor_ID\nORDER BY appointments DESC;",
      run: function () { var end = new Date(today.getTime() + 7 * DAY); return doctors.map(function (d) { return { name: d.name, specialization: d.spec, appointments: appts.filter(function (a) { return a.doctor === d && a.at >= today && a.at < end; }).length }; }).sort(function (a, b) { return b.appointments - a.appointments; }); } },
    { id: 'q4', name: 'Occupied rooms and their patients', sql: 'SELECT r.Room_Number, r.Type, p.Name, r.Date_Of_Status\nFROM room_table r\nJOIN patient_table p ON p.Patient_ID = r.Patient_ID\nORDER BY r.Room_Number;',
      run: function () { return rooms.filter(function (r) { return r.patient; }).map(function (r) { return { room_number: r.number, type: r.type, patient: r.patient.name, since: dateStr(r.since) }; }); } },
    { id: 'q5', name: 'Diagnosis changes (trigger audit log)', sql: 'SELECT l.Log_ID, p.Name, l.Old_Diagnosis, l.New_Diagnosis, l.Change_Date\nFROM diagnosis_change_log l\nJOIN patient_table p ON p.Patient_ID = l.Patient_ID\nORDER BY l.Change_Date DESC;',
      run: function () { return diagLog.slice().sort(function (a, b) { return b.at - a.at; }).map(function (l) { return { log_id: l.id, patient: l.patient.name, old_diagnosis: l.from, new_diagnosis: l.to, changed: dateStr(l.at) }; }); } },
    { id: 'q6', name: 'Recent calls by purpose', sql: "SELECT Purpose, COUNT(*) AS calls\nFROM call_record_table\nWHERE Date_Time_Of_Call >= NOW() - INTERVAL '14 days'\nGROUP BY Purpose\nORDER BY calls DESC;",
      run: function () { var m = {}; calls.forEach(function (c) { m[c.purpose] = (m[c.purpose] || 0) + 1; }); return Object.keys(m).map(function (k) { return { purpose: k, calls: m[k] }; }).sort(function (a, b) { return b.calls - a.calls; }); } }
  ];
  var activeQ = 'q1';
  function queriesView() {
    var q = QUERIES.find(function (x) { return x.id === activeQ; }), t0 = performance.now(), rows = q.run(), ms = Math.max(1, Math.round(performance.now() - t0 + 3));
    var cols = rows.length ? Object.keys(rows[0]).map(function (k) { return { label: k.replace(/_/g, ' '), key: k, num: typeof rows[0][k] === 'number' }; }) : [{ label: 'result', key: 'x' }];
    return {
      title: 'Query explorer', crumbs: 'Saved SQL against the PostgreSQL schema',
      html: '<div class="grid split">' +
        D.card('Saved queries', QUERIES.map(function (x) { return '<button class="navlink qlink ' + (x.id === activeQ ? 'active' : '') + '" data-q="' + x.id + '">' + D.icon('query') + '<span>' + esc(x.name) + '</span></button>'; }).join(''), { sub: 'Click one to run it' }) +
        '<div class="grid" style="align-content:start">' +
          D.card(q.name, '<pre class="code">' + esc(q.sql) + '</pre>', { actions: '<button class="btn primary sm" data-q="' + q.id + '">' + D.icon('bolt') + 'Run</button>' }) +
          D.card('Result', D.table({ columns: cols, rows: rows }), { flush: true, sub: rows.length + ' rows · ' + ms + ' ms' }) +
        '</div></div>'
    };
  }

  document.addEventListener('click', function (e) {
    var el;
    if ((el = e.target.closest('[data-q]'))) { activeQ = el.dataset.q; D.action('query_run'); D.render(); return; }
    if ((el = e.target.closest('[data-appt]'))) { apptDay = el.dataset.appt; D.render(); return; }
    if ((el = e.target.closest('[data-book]'))) {
      var p = patients.find(function (x) { return x.id === el.dataset.book; }), when = new Date(today.getTime() + 3 * DAY + 10 * 3600000);
      appts.push({ id: 'A' + (6000 + appts.length), patient: p, doctor: pick(doctors), at: when, reason: 'Follow-up visit' });
      appts.sort(function (a, b) { return a.at - b.at; });
      D.toast('Appointment booked for ' + dateStr(when) + ' at ' + timeStr(when)); D.action('appointment_booked'); D.render(); return;
    }
    if (e.target.closest('[data-add-patient]')) {
      var n = person(), d = pick(DISEASES), np = { id: 'P' + (1001 + patients.length), name: n, address: '1300 Pearl St, Boulder, CO', phone: phone(), email: email(n), reg: new Date(), disease: d[0], rx: d[1] };
      patients.unshift(np); D.toast('Registered ' + n + ' as ' + np.id); D.action('patient_registered'); D.go('patients', np.id);
    }
  });

  D.init({
    id: 'healthcare', name: 'Demo General Hospital', icon: 'db', defaultView: 'dashboard', navLabel: 'Hospital records',
    goals: ['query_run', 'appointment_booked', 'patient_registered'],
    user: { name: 'Dylan Kayyem', initials: 'DK', org: 'Administrator' },
    login: { heading: 'Staff sign in', sub: 'Healthcare organization database: patients, staff, rooms, appointments and billing.', email: 'admin@demo-hospital.example', foot: 'Next.js · PostgreSQL · seeded sample data. No real patient information.' },
    nav: [
      { id: 'dashboard', label: 'Dashboard', icon: 'home' },
      { id: 'patients', label: 'Patients', icon: 'user' },
      { id: 'doctors', label: 'Doctors', icon: 'users' },
      { id: 'appointments', label: 'Appointments', icon: 'calendar' },
      { id: 'queries', label: 'Query explorer', icon: 'query' }
    ],
    views: { dashboard: dashboard, patients: patientsView, doctors: doctorsView, appointments: appointmentsView, queries: queriesView }
  });
})();
