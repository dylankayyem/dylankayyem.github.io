/* FlowProof demo: the monitoring lifecycle from the real product, on sample
   data. Flows -> traces (event timelines) -> assertions -> incidents, plus
   API keys and a "Send test event" button that runs a trace through the
   same lifecycle and raises an incident when an assertion fails. */
(function () {
  'use strict';
  var D = window.Demo, esc = D.esc, badge = D.badge;
  var rand = D.rng(42);
  var now = Date.now();
  var MIN = 60000;

  var FLOWS = [
    { id: 'flow_build_price', name: 'Build & Price submission', source: 'make', env: 'production',
      steps: ['form.received', 'client.created', 'vehicle.created', 'sales_order.created', 'vehicle.linked', 'confirmation.sent'],
      assertions: [
        { id: 'ast_vehicle_link', label: 'Vehicle Link is not empty', op: 'IS_NOT_EMPTY', target: 'sales_order.created → data.vehicleLink' },
        { id: 'ast_confirm_2m', label: 'Confirmation sent within 2 minutes', op: 'WITHIN_TIME_LIMIT', target: 'form.received → confirmation.sent ≤ 2m' }
      ] },
    { id: 'flow_contact_crm', name: 'Contact form → CRM', source: 'webhook', env: 'production',
      steps: ['form.received', 'contact.created', 'email.sent'],
      assertions: [
        { id: 'ast_contact_created', label: 'Contact record created', op: 'EVENT_OCCURRED', target: 'contact.created' },
        { id: 'ast_ack_email', label: 'Acknowledgement email sent', op: 'EVENT_OCCURRED', target: 'email.sent' }
      ] },
    { id: 'flow_shopify_order', name: 'Shopify order → Airtable', source: 'shopify', env: 'production',
      steps: ['order.created', 'record.created', 'production.scheduled'],
      assertions: [
        { id: 'ast_record_status', label: 'Record status equals "Queued"', op: 'EQUALS', target: 'record.created → data.status = Queued' },
        { id: 'ast_scheduled', label: 'Production scheduled within 10 minutes', op: 'WITHIN_TIME_LIMIT', target: 'order.created → production.scheduled ≤ 10m' }
      ] },
    { id: 'flow_appointment', name: 'Appointment scheduling', source: 'api', env: 'production',
      steps: ['appointment.requested', 'calendar.booked', 'sms.sent'],
      assertions: [
        { id: 'ast_sms', label: 'Reminder SMS sent', op: 'EVENT_OCCURRED', target: 'sms.sent' }
      ] }
  ];
  var flowById = {}; FLOWS.forEach(function (f) { flowById[f.id] = f; });

  // ---- sample traces -------------------------------------------------------
  var traces = [], incidents = [], seq = 1000;
  function id(prefix) { seq += 1; return prefix + '_' + seq.toString(36) + Math.floor(rand() * 1e6).toString(36); }

  function makeTrace(flow, startedAt, failure) {
    var events = [], t = startedAt;
    flow.steps.forEach(function (step, i) {
      if (failure && failure.missingStep === step) return;
      t += (i === 0 ? 0 : 400 + Math.floor(rand() * 2400));
      var data = {};
      if (step === 'sales_order.created') data = { recordId: 'rec' + Math.floor(rand() * 1e8).toString(36).toUpperCase(), vehicleLink: failure && failure.emptyField ? null : 'rec' + Math.floor(rand() * 1e8).toString(36).toUpperCase() };
      if (step === 'record.created') data = { status: failure && failure.wrongStatus ? 'Draft' : 'Queued' };
      events.push({ id: id('evt'), type: step, source: flow.source, at: new Date(t), data: data });
    });
    var results = flow.assertions.map(function (a) {
      var pass = true, expected = '', actual = '';
      if (a.op === 'IS_NOT_EMPTY') { pass = !(failure && failure.emptyField); expected = 'non-empty record ID'; actual = pass ? 'rec…' : 'null'; }
      if (a.op === 'EQUALS') { pass = !(failure && failure.wrongStatus); expected = '"Queued"'; actual = pass ? '"Queued"' : '"Draft"'; }
      if (a.op === 'EVENT_OCCURRED') { var ev = a.target; pass = !(failure && failure.missingStep === ev); expected = ev + ' occurs'; actual = pass ? 'occurred' : 'not received'; }
      if (a.op === 'WITHIN_TIME_LIMIT') { pass = !(failure && failure.slow); expected = a.target.split('≤ ')[1]; actual = pass ? Math.round((events[events.length - 1].at - events[0].at) / 1000) + 's' : '4m 12s'; }
      return { assertion: a, pass: pass, expected: expected, actual: actual };
    });
    var failed = results.some(function (r) { return !r.pass; });
    var tr = { id: 'tr_' + Math.floor(rand() * 1e9).toString(36), external: (flow.id.split('_')[1] || 'run') + '-' + (100000 + Math.floor(rand() * 900000)),
      flow: flow, events: events, results: results, status: failed ? 'FAILED' : 'HEALTHY', startedAt: new Date(startedAt), lastAt: events[events.length - 1].at };
    traces.push(tr);
    if (failed) raise(tr);
    return tr;
  }

  function describe(r, tr) {
    var a = r.assertion;
    if (a.op === 'IS_NOT_EMPTY') return 'Vehicle Link was expected to contain a record ID but was empty after sales_order.created.';
    if (a.op === 'EQUALS') return 'Record status was expected to be "Queued" but was "Draft" after record.created.';
    if (a.op === 'EVENT_OCCURRED') return a.target + ' was expected for this trace but was never received.';
    if (a.op === 'WITHIN_TIME_LIMIT') return 'confirmation.sent arrived 4m 12s after form.received; the limit is 2 minutes.';
    return a.label + ' failed on trace ' + tr.id + '.';
  }

  function raise(tr) {
    tr.results.filter(function (r) { return !r.pass; }).forEach(function (r) {
      var existing = incidents.find(function (i) { return i.assertion.id === r.assertion.id && i.status !== 'RESOLVED'; });
      if (existing) { existing.traces.push(tr); existing.lastAt = tr.lastAt; return; }
      incidents.push({ id: 'inc_' + Math.floor(rand() * 1e9).toString(36), flow: tr.flow, assertion: r.assertion, result: r, traces: [tr],
        summary: describe(r, tr), severity: r.assertion.op === 'WITHIN_TIME_LIMIT' ? 'WARNING' : 'ERROR', status: 'OPEN',
        openedAt: tr.lastAt, lastAt: tr.lastAt, notified: 'Email sent to ops@example.com', history: [{ at: tr.lastAt, text: 'Opened from failing check' }, { at: new Date(tr.lastAt.getTime() + 2000), text: 'Notification emailed to ops@example.com' }] });
    });
  }

  // 24 hours of history
  for (var h = 23; h >= 0; h--) {
    FLOWS.forEach(function (f, fi) {
      var n = [6, 4, 3, 2][fi] + Math.floor(rand() * 4);
      for (var k = 0; k < n; k++) {
        var start = now - h * 60 * MIN - Math.floor(rand() * 55) * MIN;
        var fail = null, roll = rand();
        if (f.id === 'flow_build_price' && roll < 0.06) fail = { emptyField: true };
        else if (f.id === 'flow_build_price' && roll < 0.08) fail = { slow: true };
        else if (f.id === 'flow_contact_crm' && roll < 0.03) fail = { missingStep: 'email.sent' };
        else if (f.id === 'flow_shopify_order' && roll < 0.04) fail = { wrongStatus: true };
        makeTrace(f, start, fail);
      }
    });
  }
  traces.sort(function (a, b) { return b.startedAt - a.startedAt; });
  // a resolved incident for history
  if (incidents.length > 2) { var r0 = incidents[incidents.length - 1]; r0.status = 'RESOLVED'; r0.history.push({ at: new Date(r0.lastAt.getTime() + 25 * MIN), text: 'Resolved by Dylan Kayyem' }); }

  var keys = [
    { id: 'key_live1', name: 'Make — production', prefix: 'fp_live_7Qk2', created: new Date(now - 9 * 86400000), used: new Date(now - 3 * MIN), revoked: false },
    { id: 'key_live2', name: 'Website forms', prefix: 'fp_live_R4zd', created: new Date(now - 6 * 86400000), used: new Date(now - 11 * MIN), revoked: false },
    { id: 'key_test1', name: 'Local testing', prefix: 'fp_test_m81P', created: new Date(now - 2 * 86400000), used: new Date(now - 26 * 3600000), revoked: false }
  ];

  // ---- helpers -------------------------------------------------------------
  function statusBadge(s) {
    return badge(s.charAt(0) + s.slice(1).toLowerCase(), { HEALTHY: 'ok', FAILED: 'bad', WARNING: 'warn', OPEN: 'bad', ACKNOWLEDGED: 'warn', RESOLVED: 'ok', ERROR: 'bad', CRITICAL: 'bad', INFO: 'info' }[s] || 'neutral');
  }
  function flowStats(f) {
    var ts = traces.filter(function (t) { return t.flow === f; });
    var bad = ts.filter(function (t) { return t.status === 'FAILED'; }).length;
    return { total: ts.length, failed: bad, health: ts.length ? Math.round((ts.length - bad) / ts.length * 1000) / 10 : 100, last: ts[0] };
  }
  function openIncidents() { return incidents.filter(function (i) { return i.status !== 'RESOLVED'; }); }
  function dur(tr) { var s = Math.round((tr.lastAt - tr.startedAt) / 1000); return s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + (s % 60) + 's'; }

  var sendBtn = '<button class="btn primary sm" data-send-event>' + D.icon('bolt') + 'Send test event</button>';

  // ---- views -----------------------------------------------------------------
  function overview() {
    var total = traces.length, failed = traces.filter(function (t) { return t.status === 'FAILED'; }).length;
    var health = Math.round((total - failed) / total * 1000) / 10;
    var hours = [], labels = [], tones = [];
    for (var h = 11; h >= 0; h--) {
      var from = now - (h + 1) * 3600000, to = now - h * 3600000;
      var inHour = traces.filter(function (t) { return t.startedAt >= from && t.startedAt < to; });
      hours.push(inHour.length);
      labels.push(new Date(to).getHours() + ':00');
      tones.push(inHour.some(function (t) { return t.status === 'FAILED'; }) ? 'bad' : '');
    }
    var open = openIncidents();
    var incHtml = open.length ? D.table({
      columns: [
        { label: 'Incident', render: function (i) { return '<b>' + esc(i.assertion.label) + '</b><div class="note">' + esc(i.flow.name) + '</div>'; } },
        { label: 'Severity', render: function (i) { return statusBadge(i.severity); } },
        { label: 'Traces', num: true, render: function (i) { return i.traces.length; } },
        { label: 'Last seen', render: function (i) { return esc(D.ago(i.lastAt)); } }
      ], rows: open.slice(0, 5), rowAttr: function (i) { return 'data-go="incidents/' + i.id + '"'; }
    }) : '<div class="empty">No open incidents. Every monitored flow is healthy.</div>';
    var flowsHtml = FLOWS.map(function (f) {
      var s = flowStats(f);
      return '<div style="display:grid;gap:6px;padding:10px 0;border-bottom:1px solid var(--line)" data-go="flows/' + f.id + '" class="row-click">' +
        '<div style="display:flex;justify-content:space-between;gap:8px"><b style="font-weight:600">' + esc(f.name) + '</b><span class="note">' + s.health + '%</span></div>' +
        '<div class="meter"><i class="' + (s.health >= 98 ? 'ok' : s.health >= 94 ? 'warn' : 'bad') + '" style="width:' + s.health + '%"></i></div></div>';
    }).join('');
    return {
      title: 'Overview', crumbs: 'Acme Vans · Production', actions: sendBtn,
      html:
        '<div class="grid stats">' +
          D.stat({ label: 'Traces (24h)', value: total.toLocaleString(), delta: '+8% vs previous day', tone: 'up' }) +
          D.stat({ label: 'Healthy', value: (total - failed).toLocaleString(), delta: health + '% of traces' }) +
          D.stat({ label: 'Failed', value: failed, delta: failed ? 'Business outcome incorrect' : '—', tone: failed ? 'down' : '' }) +
          D.stat({ label: 'Active incidents', value: open.length, delta: open.length ? 'Needs attention' : 'All clear', tone: open.length ? 'down' : 'up' }) +
        '</div>' +
        (open.length ? '<div class="alert bad">' + D.icon('alert') + '<div class="txt"><b>' + open.length + ' incident' + (open.length > 1 ? 's' : '') + ' need attention.</b> The automations reported success, but the expected business outcome did not happen.</div></div>' : '') +
        '<div class="grid two">' +
          D.card('Trace volume', D.bars(hours, labels, tones), { sub: 'Last 12 hours · red bars include a failed trace' }) +
          D.card('Flow health', flowsHtml, { sub: 'Share of traces passing every assertion' }) +
        '</div>' +
        D.card('Open incidents', incHtml, { flush: true, actions: '<button class="btn sm" data-go="incidents">View all</button>' })
    };
  }

  function flowsView(param) {
    if (param && flowById[param]) {
      var f = flowById[param], s = flowStats(f);
      var recent = traces.filter(function (t) { return t.flow === f; }).slice(0, 8);
      return {
        title: f.name, crumbs: '<span data-go="flows" style="cursor:pointer">Flows</span> / <b>' + esc(f.name) + '</b>', actions: sendBtn,
        html:
          '<div class="grid stats">' + D.stat({ label: 'Health', value: s.health + '%' }) + D.stat({ label: 'Traces (24h)', value: s.total }) + D.stat({ label: 'Failed', value: s.failed, tone: s.failed ? 'down' : '' }) + D.stat({ label: 'Source', value: f.source }) + '</div>' +
          '<div class="grid two">' +
            D.card('Assertions', D.table({ columns: [
              { label: 'Check', render: function (a) { return '<b>' + esc(a.label) + '</b><div class="note mono">' + esc(a.target) + '</div>'; } },
              { label: 'Operator', render: function (a) { return '<code class="inline">' + esc(a.op) + '</code>'; } }
            ], rows: f.assertions }), { flush: true, sub: 'What should be true for every run' }) +
            D.card('Expected events', '<div class="timeline">' + f.steps.map(function (st, i) { return '<div class="ev"><div class="t">' + (i + 1) + '</div><div class="n"><i class="muted"></i></div><div class="c"><b>' + esc(st) + '</b></div></div>'; }).join('') + '</div>', { sub: 'noun.action naming, correlated by trace ID' }) +
          '</div>' +
          D.card('Recent traces', traceTable(recent), { flush: true })
      };
    }
    return {
      title: 'Flows', crumbs: FLOWS.length + ' monitored business processes', actions: '<button class="btn sm" data-new-flow>' + D.icon('plus') + 'New flow</button>',
      html: D.card('Flows', D.table({ columns: [
        { label: 'Flow', render: function (f) { return '<b>' + esc(f.name) + '</b><div class="note mono">' + esc(f.id) + '</div>'; } },
        { label: 'Source', render: function (f) { return badge(f.source, 'info'); } },
        { label: 'Assertions', num: true, render: function (f) { return f.assertions.length; } },
        { label: 'Traces (24h)', num: true, render: function (f) { return flowStats(f).total; } },
        { label: 'Health', num: true, render: function (f) { var s = flowStats(f); return '<b style="color:var(--' + (s.health >= 98 ? 'ok' : s.health >= 94 ? 'warn' : 'bad') + ')">' + s.health + '%</b>'; } }
      ], rows: FLOWS, rowAttr: function (f) { return 'data-go="flows/' + f.id + '"'; } }), { flush: true })
    };
  }

  function traceTable(rows) {
    return D.table({ columns: [
      { label: 'Trace', render: function (t) { return '<span class="mono">' + esc(t.id) + '</span><div class="note">' + esc(t.external) + '</div>'; } },
      { label: 'Flow', render: function (t) { return esc(t.flow.name); } },
      { label: 'Status', render: function (t) { return statusBadge(t.status); } },
      { label: 'Events', num: true, render: function (t) { return t.events.length; } },
      { label: 'Duration', num: true, render: dur },
      { label: 'Started', render: function (t) { return esc(D.ago(t.startedAt)); } }
    ], rows: rows, rowAttr: function (t) { return 'data-go="traces/' + t.id + '"'; }, empty: 'No traces match' });
  }

  var traceFilter = 'all', traceQuery = '';
  function tracesView(param) {
    if (param) {
      var t = traces.find(function (x) { return x.id === param; });
      if (t) return traceDetail(t);
    }
    var rows = traces.filter(function (t) {
      return (traceFilter === 'all' || t.status === traceFilter) && (!traceQuery || (t.id + ' ' + t.external + ' ' + t.flow.name).toLowerCase().indexOf(traceQuery) >= 0);
    }).slice(0, 40);
    return {
      title: 'Trace explorer', crumbs: traces.length + ' traces in the last 24 hours', actions: sendBtn,
      html: '<div class="toolbar"><input class="grow" type="search" placeholder="Search trace ID, external ID or flow" value="' + esc(traceQuery) + '" data-trace-q>' +
        '<div class="pills">' + ['all', 'HEALTHY', 'FAILED'].map(function (k) { return '<button class="pill ' + (traceFilter === k ? 'on' : '') + '" data-trace-f="' + k + '">' + (k === 'all' ? 'All' : k.charAt(0) + k.slice(1).toLowerCase()) + '</button>'; }).join('') + '</div></div>' +
        D.card('Traces', traceTable(rows), { flush: true, sub: 'Showing the 40 most recent matches' }),
      after: function (root) {
        var q = root.querySelector('[data-trace-q]');
        q.addEventListener('input', function () { traceQuery = q.value.trim().toLowerCase(); var pos = q.selectionStart; D.render(); var nq = document.querySelector('[data-trace-q]'); nq.focus(); nq.setSelectionRange(pos, pos); });
      }
    };
  }

  function traceDetail(t) {
    var failedTypes = {};
    t.results.forEach(function (r) { if (!r.pass && r.assertion.op === 'IS_NOT_EMPTY') failedTypes['sales_order.created'] = true; if (!r.pass && r.assertion.op === 'EQUALS') failedTypes['record.created'] = true; });
    var expectedMissing = t.flow.steps.filter(function (s) { return !t.events.some(function (e) { return e.type === s; }); });
    var tl = t.events.map(function (e) {
      return '<div class="ev"><div class="t">' + D.fmtTime(e.at) + '</div><div class="n"><i class="' + (failedTypes[e.type] ? 'bad' : '') + '"></i></div><div class="c"><b>' + esc(e.type) + '</b><span>' + esc(e.source) + (Object.keys(e.data).length ? ' · ' + esc(JSON.stringify(e.data)) : '') + '</span></div></div>';
    }).join('') + expectedMissing.map(function (s) { return '<div class="ev"><div class="t">—</div><div class="n"><i class="bad"></i></div><div class="c"><b>' + esc(s) + '</b><span style="color:var(--bad)">Expected but never received</span></div></div>'; }).join('');
    var inc = incidents.filter(function (i) { return i.traces.indexOf(t) >= 0; });
    return {
      title: 'Trace ' + t.id, crumbs: '<span data-go="traces" style="cursor:pointer">Traces</span> / <b>' + esc(t.id) + '</b>',
      html:
        (t.status === 'FAILED' ? '<div class="alert bad">' + D.icon('alert') + '<div class="txt"><b>The automation reported success, but this trace failed.</b> ' + esc(inc[0] ? inc[0].summary : '') + '</div></div>' : '<div class="alert ok">' + D.icon('check') + '<div class="txt"><b>Healthy.</b> Every assertion passed for this run.</div></div>') +
        '<div class="grid two">' +
          D.card('Event timeline', '<div class="timeline">' + tl + '</div>', { sub: t.events.length + ' events · chronological' }) +
          '<div class="grid" style="align-content:start">' +
            D.card('Trace', D.kv([['Flow', '<span data-go="flows/' + t.flow.id + '" style="cursor:pointer;color:var(--brand)">' + esc(t.flow.name) + '</span>', true], ['Status', statusBadge(t.status), true], ['External ID', '<code>' + esc(t.external) + '</code>', true], ['Started', t.startedAt.toLocaleString()], ['Duration', dur(t)]])) +
            D.card('Assertion results', D.table({ columns: [
              { label: 'Check', render: function (r) { return esc(r.assertion.label); } },
              { label: 'Expected', render: function (r) { return '<span class="mono">' + esc(r.expected) + '</span>'; } },
              { label: 'Actual', render: function (r) { return '<span class="mono" style="color:var(--' + (r.pass ? 'ok' : 'bad') + ')">' + esc(r.actual) + '</span>'; } },
              { label: '', render: function (r) { return badge(r.pass ? 'Pass' : 'Fail', r.pass ? 'ok' : 'bad'); } }
            ], rows: t.results }), { flush: true }) +
            (inc.length ? D.card('Related incidents', inc.map(function (i) { return '<div data-go="incidents/' + i.id + '" style="cursor:pointer;display:flex;justify-content:space-between;gap:8px;align-items:center"><span>' + esc(i.assertion.label) + '</span>' + statusBadge(i.status) + '</div>'; }).join('')) : '') +
          '</div>' +
        '</div>'
    };
  }

  var incFilter = 'open';
  function incidentsView(param) {
    if (param) {
      var i = incidents.find(function (x) { return x.id === param; });
      if (i) return incidentDetail(i);
    }
    var rows = incidents.filter(function (i) { return incFilter === 'all' || (incFilter === 'open' ? i.status !== 'RESOLVED' : i.status === 'RESOLVED'); })
      .sort(function (a, b) { return b.lastAt - a.lastAt; });
    return {
      title: 'Incidents', crumbs: openIncidents().length + ' open', actions: sendBtn,
      html: '<div class="pills">' + [['open', 'Open'], ['resolved', 'Resolved'], ['all', 'All']].map(function (p) { return '<button class="pill ' + (incFilter === p[0] ? 'on' : '') + '" data-inc-f="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div>' +
        D.card('Incidents', D.table({ columns: [
          { label: 'What failed', render: function (i) { return '<b>' + esc(i.assertion.label) + '</b><div class="note">' + esc(i.flow.name) + '</div>'; } },
          { label: 'Status', render: function (i) { return statusBadge(i.status); } },
          { label: 'Severity', render: function (i) { return statusBadge(i.severity); } },
          { label: 'Traces', num: true, render: function (i) { return i.traces.length; } },
          { label: 'Opened', render: function (i) { return esc(D.ago(i.openedAt)); } }
        ], rows: rows, rowAttr: function (i) { return 'data-go="incidents/' + i.id + '"'; }, empty: 'Nothing here. Flows are healthy.' }), { flush: true, sub: 'One incident per failing check; repeat failures are grouped' })
    };
  }

  function incidentDetail(i) {
    var acts = i.status === 'RESOLVED' ? '' :
      (i.status === 'OPEN' ? '<button class="btn sm" data-inc-act="ack" data-id="' + i.id + '">Acknowledge</button>' : '') +
      '<button class="btn primary sm" data-inc-act="resolve" data-id="' + i.id + '">' + D.icon('check') + 'Resolve</button>';
    return {
      title: i.assertion.label, crumbs: '<span data-go="incidents" style="cursor:pointer">Incidents</span> / <b>' + esc(i.id) + '</b>', actions: acts,
      html:
        '<div class="alert ' + (i.status === 'RESOLVED' ? 'ok' : 'bad') + '">' + D.icon(i.status === 'RESOLVED' ? 'check' : 'alert') + '<div class="txt"><b>' + esc(i.summary) + '</b></div></div>' +
        '<div class="grid two">' +
          D.card('What happened', D.kv([
            ['Status', statusBadge(i.status), true], ['Severity', statusBadge(i.severity), true],
            ['Flow', '<span data-go="flows/' + i.flow.id + '" style="cursor:pointer;color:var(--brand)">' + esc(i.flow.name) + '</span>', true],
            ['Failed check', '<code>' + esc(i.assertion.op) + '</code> ' + esc(i.assertion.target), true],
            ['Expected', esc(i.result.expected), true], ['Actual', '<b style="color:var(--bad)">' + esc(i.result.actual) + '</b>', true],
            ['Detected', i.openedAt.toLocaleString()], ['Notification', i.notified],
            ['Investigate', 'Check the step that should write this value in the ' + i.flow.source + ' scenario, then open an affected trace below.']
          ])) +
          D.card('Activity', '<div class="timeline">' + i.history.map(function (h) { return '<div class="ev"><div class="t">' + D.fmtTime(h.at) + '</div><div class="n"><i class="' + (/Resolved/.test(h.text) ? '' : /Acknowledged/.test(h.text) ? 'warn' : 'muted') + '"></i></div><div class="c"><span style="color:var(--text)">' + esc(h.text) + '</span></div></div>'; }).join('') + '</div>') +
        '</div>' +
        D.card('Affected traces', traceTable(i.traces.slice().reverse()), { flush: true, sub: i.traces.length + ' trace' + (i.traces.length > 1 ? 's' : '') + ' grouped into this incident' })
    };
  }

  function keysView() {
    return {
      title: 'API keys', crumbs: 'Authenticate POST /api/v1/events', actions: '<button class="btn primary sm" data-new-key>' + D.icon('plus') + 'Create key</button>',
      html: '<div id="new-key-slot"></div>' +
        D.card('Keys', D.table({ columns: [
          { label: 'Name', render: function (k) { return '<b>' + esc(k.name) + '</b>'; } },
          { label: 'Key', render: function (k) { return '<span class="mono">' + esc(k.prefix) + '••••••••••••</span>'; } },
          { label: 'Created', render: function (k) { return esc(D.ago(k.created)); } },
          { label: 'Last used', render: function (k) { return k.used ? esc(D.ago(k.used)) : '—'; } },
          { label: '', render: function (k) { return k.revoked ? badge('Revoked', 'neutral') : '<button class="btn sm danger" data-revoke="' + k.id + '">Revoke</button>'; } }
        ], rows: keys }), { flush: true, sub: 'Only a hash of each key is stored' }) +
        D.card('Send an event', '<pre class="code">curl https://app.flowproof.dev/api/v1/events \\\n  -H "Authorization: Bearer fp_live_…" \\\n  -H "Idempotency-Key: make_exec_123_mod_45" \\\n  -H "Content-Type: application/json" \\\n  -d \'{\n    "flowId": "flow_build_price",\n    "traceId": "build-123456",\n    "type": "sales_order.created",\n    "source": "make",\n    "data": { "recordId": "recABC123", "vehicleLink": null }\n  }\'</pre><p class="note" style="margin-top:10px">Events are validated, de-duplicated by idempotency key, persisted with a processing job in one transaction, and evaluated by the worker.</p>', { sub: 'Example request' })
    };
  }

  // ---- interactions ------------------------------------------------------------
  function sendTestEvent() {
    var f = FLOWS[0];
    var tr = makeTrace(f, Date.now() - 6000, { emptyField: true });
    traces.sort(function (a, b) { return b.startedAt - a.startedAt; });
    D.toast('Trace ' + tr.id + ' received 6 events · Vehicle Link check failed · incident raised');
    D.go('traces', tr.id);
  }

  document.addEventListener('click', function (e) {
    var el;
    if (e.target.closest('[data-send-event]')) { sendTestEvent(); D.action('test_event'); return; }
    if ((el = e.target.closest('[data-trace-f]'))) { traceFilter = el.dataset.traceF; D.render(); return; }
    if ((el = e.target.closest('[data-inc-f]'))) { incFilter = el.dataset.incF; D.render(); return; }
    if ((el = e.target.closest('[data-inc-act]'))) {
      var inc = incidents.find(function (x) { return x.id === el.dataset.id; });
      if (el.dataset.incAct === 'ack') { inc.status = 'ACKNOWLEDGED'; inc.history.push({ at: new Date(), text: 'Acknowledged by Dylan Kayyem' }); D.toast('Incident acknowledged'); D.action('incident_ack'); }
      else { inc.status = 'RESOLVED'; inc.history.push({ at: new Date(), text: 'Resolved by Dylan Kayyem' }); D.toast('Incident resolved'); D.action('incident_resolve'); }
      D.render(); return;
    }
    if ((el = e.target.closest('[data-revoke]'))) { keys.find(function (k) { return k.id === el.dataset.revoke; }).revoked = true; D.toast('Key revoked. Requests using it now get 401.'); D.action('key_revoke'); D.render(); return; }
    if (e.target.closest('[data-new-key]')) {
      var raw = 'fp_live_' + Array.from({ length: 28 }, function () { return 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 56)]; }).join('');
      keys.unshift({ id: 'key_' + Date.now(), name: 'New key', prefix: raw.slice(0, 12), created: new Date(), used: null, revoked: false });
      D.action('key_create');
      D.render();
      document.getElementById('new-key-slot').innerHTML = '<div class="alert ok">' + D.icon('check') + '<div class="txt"><b>Copy this key now; it won\'t be shown again.</b><div class="mono" style="margin-top:6px;word-break:break-all">' + raw + '</div></div></div>';
      return;
    }
    if (e.target.closest('[data-new-flow]')) { D.toast('Creating flows is available in the full app.'); }
  });

  D.init({
    id: 'flowproof', name: 'FlowProof', icon: 'traces', defaultView: 'overview', navLabel: 'Monitoring',
    goals: ['test_event'],
    user: { name: 'Dylan Kayyem', initials: 'DK', org: 'Acme Vans' },
    login: { heading: 'Sign in to FlowProof', sub: 'Monitor whether your automations actually did their job.', email: 'demo@flowproof.dev', foot: 'Authentication in the real app is handled by Clerk organizations.' },
    nav: [
      { id: 'overview', label: 'Overview', icon: 'home' },
      { id: 'flows', label: 'Flows', icon: 'flows' },
      { id: 'traces', label: 'Traces', icon: 'traces' },
      { id: 'incidents', label: 'Incidents', icon: 'incidents' },
      { id: 'keys', label: 'API keys', icon: 'keys' }
    ],
    counts: function () { return { incidents: openIncidents().length }; },
    views: { overview: overview, flows: flowsView, traces: tracesView, incidents: incidentsView, keys: keysView }
  });
})();
