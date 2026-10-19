/* Network Uptime Monitor demo: the self-hosted outage monitor on sample data.
   A home network with 34 days of history, plus a simulator that runs the
   product's real rules on compressed time: checks every 30 s, 3 failures
   open a monitor incident, 2 successes close it, related incidents
   correlate into one network outage, and agents that lose the internet
   queue their results and upload them on reconnection, where they are
   replayed by check time. */
(function () {
  'use strict';
  var D = window.Demo, esc = D.esc, badge = D.badge;
  var rand = D.rng(7);
  var SEC = 1000, MIN = 60000, HOUR = 3600000, DAY = 86400000;
  var T0 = Date.now();
  var TZ = (window.Intl && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'local time';
  var THRESH = { fail: 3, recover: 2, window: 90 };
  var PATH = ['GATEWAY', 'EXTERNAL_IP', 'DNS_RESOLVER'];
  var ROLE = { GATEWAY: 'Router (gateway)', EXTERNAL_IP: 'Internet (external IP)', DNS_RESOLVER: 'DNS resolver', REMOTE_SERVICE: 'Website or service', LOCAL_DEVICE: 'Local device' };

  // ---- formatting ------------------------------------------------------------
  function fmtDur(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return s + ' s';
    var m = Math.floor(s / 60);
    if (m < 10 && s % 60) return m + ' min ' + (s % 60) + ' s';
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60);
    if (h < 24) return h + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '');
    var d = Math.floor(h / 24);
    return d + ' d' + (h % 24 ? ' ' + (h % 24) + ' h' : '');
  }
  function fmtAge(ms) { return ms < 1500 ? 'just now' : fmtDur(ms) + ' ago'; }
  function fmtWhen(t) { return new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }); }
  function fmtClock(t) { return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); }
  function fmtSec(t) { return D.fmtTime(new Date(t)); }
  function pct(v) { return v == null ? '—' : (v >= 99.995 ? '100%' : v.toFixed(2) + '%'); }
  function lc(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
  function cap(s) { return s.charAt(0) + s.slice(1).toLowerCase(); }
  function names(list) { return list.length < 2 ? list.join('') : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1]; }
  function rid(prefix) { return prefix + '_' + Math.floor(rand() * 1e9).toString(36); }
  function randomCode(n) { var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = ''; for (var i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }

  // ---- sample network --------------------------------------------------------
  var CUT = { start: T0 - 15 * HOUR - 18 * MIN, end: T0 - 14 * HOUR - 56 * MIN, reason: 'Power cut: no agent was reporting' };
  var unknowns = [
    { start: T0 - 20 * DAY - 3 * HOUR, end: T0 - 20 * DAY - 3 * HOUR + 71 * MIN, reason: 'office-pc restarting for Windows updates (the only agent at the time)' },
    CUT
  ];

  var agents = [
    { id: 'agt_office', name: 'office-pc', host: 'OFFICE-PC', os: 'Windows 11 Pro', version: '0.1.0', runAs: 'Windows service', enrolled: T0 - 34 * DAY, started: CUT.end + 40 * SEC, hb: T0 - 8 * SEC, drift: '+0.2 s', token: 'nma_4Hq', revoked: false },
    { id: 'agt_pi', name: 'pi-garage', host: 'pi-garage', os: 'Raspberry Pi OS (Debian 12)', version: '0.1.0', runAs: 'systemd service', enrolled: T0 - 12 * DAY, started: CUT.end + 25 * SEC, hb: T0 - 21 * SEC, drift: '−0.1 s', token: 'nma_9tZ', revoked: false }
  ];
  var agentById = {}; agents.forEach(function (a) { agentById[a.id] = a; });
  var MONITORING_SINCE = agents[0].enrolled;

  var monitors = [
    { id: 'mon_router', name: 'Router', type: 'GATEWAY', role: 'GATEWAY', target: '192.168.1.1 (discovered)', agent: 'agt_office', base: 2 },
    { id: 'mon_internet', name: 'Internet', type: 'PING', role: 'EXTERNAL_IP', target: '1.1.1.1', agent: 'agt_office', base: 12 },
    { id: 'mon_dns', name: 'DNS', type: 'DNS', role: 'DNS_RESOLVER', target: 'example.com via 1.1.1.1', agent: 'agt_office', base: 17 },
    { id: 'mon_web', name: 'Web check', type: 'HTTP', role: 'REMOTE_SERVICE', target: 'https://www.example.com', agent: 'agt_office', base: 64 },
    { id: 'mon_github', name: 'GitHub', type: 'HTTP', role: 'REMOTE_SERVICE', target: 'https://github.com', agent: 'agt_office', base: 91 },
    { id: 'mon_nas', name: 'NAS file share', type: 'TCP', role: 'LOCAL_DEVICE', target: '192.168.1.20:445', agent: 'agt_pi', base: 1 }
  ];
  var monById = {};
  monitors.forEach(function (m) {
    monById[m.id] = m;
    m.status = 'ONLINE'; m.enabled = true; m.fails = 0; m.oks = 0; m.failStart = null; m.incident = null;
    m.recent = []; for (var i = 0; i < 28; i++) m.recent.push(true);
    m.lastAt = T0 - Math.floor(rand() * 25) * SEC; m.lastMs = m.base;
  });
  monById.mon_internet.recent[9] = false; monById.mon_dns.recent[9] = false; monById.mon_dns.recent[10] = false;

  // ---- diagnosis: the product's deterministic rules (rule version 1) ---------
  var CAUSE = {
    ROUTER: { short: 'Router or local network', summary: 'Likely router or local network problem',
      high: 'The router stopped responding and internet connectivity failed at the same time. This pattern usually means the router or the local network failed, rather than the internet provider.',
      medium: 'The router stopped responding. This appears to be a router or local network problem, though there is not enough evidence about the rest of the connection to be certain.',
      check: 'Check whether the router restarted or lost power. Its admin page usually shows uptime and a log.' },
    ISP_OR_MODEM: { short: 'Internet provider or modem', summary: 'Likely internet provider or modem problem',
      high: 'The router stayed reachable while the connection to the internet failed. This usually points to the modem or the internet provider, not equipment inside the network.',
      check: 'Check the modem lights and the provider\'s outage page for your area.' },
    DNS: { short: 'DNS', summary: 'Likely DNS problem',
      high: 'The internet connection itself stayed up, but name lookups failed. Websites become unreachable by name during a DNS problem even though the connection works.',
      check: 'Try a different DNS resolver in the router settings, for example 1.1.1.1 or 9.9.9.9.' },
    REMOTE_SERVICE: { short: 'Individual service', summary: 'Individual service problem',
      low: 'Only individual external services failed while the network path stayed healthy. This appears to be a problem with those services, not with this network.',
      check: 'Check the service\'s status page. Nothing on this network needs fixing.' }
  };
  function classify(roles) {
    function has(r) { return roles.indexOf(r) >= 0; }
    if (has('GATEWAY')) return { cls: 'ROUTER', conf: has('EXTERNAL_IP') ? 'HIGH' : 'MEDIUM' };
    if (has('EXTERNAL_IP')) return { cls: 'ISP_OR_MODEM', conf: 'HIGH' };
    if (has('DNS_RESOLVER')) return { cls: 'DNS', conf: 'HIGH' };
    return { cls: 'REMOTE_SERVICE', conf: 'LOW' };
  }
  function reclass(o) {
    var roles = [];
    o.incidents.forEach(function (i) { if (roles.indexOf(i.monitor.role) < 0) roles.push(i.monitor.role); });
    var c = classify(roles); o.cls = c.cls; o.conf = c.conf; o.roles = roles;
  }
  function explanation(o) { var c = CAUSE[o.cls]; return o.conf === 'MEDIUM' && c.medium ? c.medium : c.high || c.low; }

  // ---- history ---------------------------------------------------------------
  var outages = [], briefs = [], serviceIncidents = [];
  var AFFECTS = {
    ROUTER: ['mon_router', 'mon_internet', 'mon_dns', 'mon_web', 'mon_github', 'mon_nas'],
    ISP_OR_MODEM: ['mon_internet', 'mon_dns', 'mon_web', 'mon_github'],
    DNS: ['mon_dns', 'mon_web', 'mon_github']
  };
  function pastOutage(hoursAgo, minutes, cls, note) {
    var start = Math.round((T0 - hoursAgo * HOUR) / (30 * SEC)) * 30 * SEC, dur = minutes * MIN;
    var incs = AFFECTS[cls].map(function (id, i) {
      var s = start + (i === 0 ? 0 : Math.floor(rand() * 2) * 30 * SEC);
      return { monitor: monById[id], start: s, confirmed: s + 60 * SEC, end: start + dur + (i === 0 ? 0 : Math.floor(rand() * 2) * 30 * SEC) };
    });
    var o = { id: rid('out'), start: start, confirmed: start + 60 * SEC, status: 'RESOLVED', incidents: incs, note: note || '' };
    incs.forEach(function (i) { i.outage = o; });
    o.end = Math.max.apply(null, incs.filter(function (i) { return PATH.indexOf(i.monitor.role) >= 0; }).map(function (i) { return i.end; }));
    reclass(o);
    outages.push(o);
  }
  pastOutage(701, 14, 'ISP_OR_MODEM');
  pastOutage(628, 3.5, 'ISP_OR_MODEM');
  pastOutage(531, 41, 'ISP_OR_MODEM', 'The provider confirmed planned maintenance in the area.');
  pastOutage(452, 6, 'ROUTER');
  pastOutage(357, 2.5, 'DNS');
  pastOutage(270, 18, 'ISP_OR_MODEM');
  pastOutage(139, 4, 'ROUTER', 'Router firmware update restarted it.');
  pastOutage(75, 9, 'ISP_OR_MODEM');
  pastOutage(7.4, 6, 'ISP_OR_MODEM');
  outages.sort(function (a, b) { return a.start - b.start; });
  outages.forEach(function (o, i) { o.num = i + 1; });

  function covered(t) {
    return outages.some(function (o) { return t >= o.start - 10 * MIN && t <= o.end + 10 * MIN; }) ||
      unknowns.some(function (u) { return t >= u.start && t <= u.end; });
  }
  for (var b = 0; b < 17; b++) {
    var bs = Math.round((T0 - Math.floor(rand() * 29.5 * DAY) - HOUR) / (30 * SEC)) * 30 * SEC;
    if (covered(bs)) continue;
    var failed = rand() < 0.6 ? 1 : 2;
    briefs.push({ monitor: rand() < 0.65 ? monById.mon_internet : monById.mon_dns, start: bs, end: bs + failed * 30 * SEC, failed: failed });
  }
  briefs.sort(function (a, b) { return b.start - a.start; });
  serviceIncidents.push(
    { monitor: monById.mon_github, start: T0 - 9 * DAY - 5 * HOUR, end: T0 - 9 * DAY - 5 * HOUR + 12 * MIN, code: 'HTTP_STATUS_ERROR · 503', service: true },
    { monitor: monById.mon_web, start: T0 - 23 * DAY - 2 * HOUR, end: T0 - 23 * DAY - 2 * HOUR + 4 * MIN, code: 'HTTP_TIMEOUT', service: true }
  );

  // Latency is generated per minute on demand and cached, so the history
  // stays stable as the page re-renders and grows as time passes.
  var LAT_START = T0 - 24 * HOUR, latCache = {};
  function latencyAt(t) {
    var i = Math.floor((t - LAT_START) / MIN);
    if (latCache[i] == null) {
      var h = new Date(LAT_START + i * MIN).getHours();
      var evening = h >= 19 && h <= 22 ? 5 + 4 * rand() : 0;
      var spike = rand() < 0.015 ? 14 + rand() * 24 : 0;
      latCache[i] = Math.round((10.4 + rand() * 3.2 + evening + spike) * 10) / 10;
    }
    return latCache[i];
  }

  var speedTests = [
    { at: T0 - 2 * DAY - 3 * HOUR, down: 912, up: 887, idle: 9, loaded: 14, mb: 186, trigger: 'Manual' },
    { at: T0 - 9 * DAY - 6 * HOUR, down: 897, up: 874, idle: 10, loaded: 31, mb: 192, trigger: 'Manual' },
    { at: T0 - 17 * DAY - 1 * HOUR, down: 641, up: 862, idle: 11, loaded: 48, mb: 171, trigger: 'Manual' }
  ];
  var budget = { gb: 20, usedMb: 3140 };
  var util = { down: 4.2, up: 0.6 };
  function grade(t) { var d = t.loaded - t.idle; return d < 10 ? 'A' : d < 30 ? 'B' : d < 60 ? 'C' : 'D'; }

  // ---- derived state ---------------------------------------------------------
  function activeOutage() { return outages.find(function (o) { return o.status === 'ACTIVE'; }); }
  function stateAt(t) {
    for (var i = 0; i < outages.length; i++) {
      var o = outages[i];
      if (o.status !== 'DISMISSED' && t >= o.start && t < (o.end || Date.now())) return { state: 'down', outage: o };
    }
    for (var j = 0; j < unknowns.length; j++) if (t >= unknowns[j].start && t < unknowns[j].end) return { state: 'unknown' };
    return { state: 'up' };
  }
  function agentState(a) {
    var age = sim && sim.lostAt != null ? sim.time - sim.lostAt : Date.now() - a.hb;
    var status = age <= 60 * SEC ? 'ONLINE' : age <= 120 * SEC ? 'STALE' : 'UNKNOWN';
    return { status: status, age: age };
  }
  function agentBadge(a) {
    if (a.revoked) return badge('Revoked', 'neutral');
    var s = agentState(a).status;
    return s === 'ONLINE' ? badge('Online', 'ok') : s === 'STALE' ? badge('Stale', 'warn') : badge('Unknown — not reporting', 'neutral');
  }
  function networkState() {
    if (activeOutage()) return 'outage';
    if (agents.every(function (a) { return a.revoked || agentState(a).status === 'UNKNOWN'; })) return 'unknown';
    return 'online';
  }
  var MON_STATUS = { ONLINE: ['Online', 'ok'], DEGRADED: ['Degraded', 'warn'], CONFIRMING_OUTAGE: ['Confirming failure', 'warn'], OFFLINE: ['Offline', 'bad'], CONFIRMING_RECOVERY: ['Confirming recovery', 'warn'], PAUSED: ['Paused', 'neutral'], PENDING: ['Waiting for first check', 'neutral'] };
  function monBadge(m) { var p = MON_STATUS[m.status] || ['Unknown — no data', 'neutral']; return badge(p[0], p[1]); }
  function outageBadge(o) { return badge(cap(o.status), { ACTIVE: 'bad', RESOLVED: 'ok', DISMISSED: 'neutral' }[o.status]); }
  function confBadge(c) { return badge(cap(c), { HIGH: 'info', MEDIUM: 'warn', LOW: 'neutral' }[c]); }

  function merge(list) {
    list = list.filter(function (x) { return x[1] > x[0]; }).sort(function (a, b) { return a[0] - b[0]; });
    var out = [];
    list.forEach(function (x) { var last = out[out.length - 1]; if (last && x[0] <= last[1]) last[1] = Math.max(last[1], x[1]); else out.push([x[0], x[1]]); });
    return out.reduce(function (s, x) { return s + x[1] - x[0]; }, 0);
  }
  // Availability = (eligible - confirmed downtime) / eligible. Overlapping
  // outages are merged before summing; unknown time is reported separately
  // and is never downtime.
  function summary(s, e) {
    var now = Date.now();
    s = Math.max(s, MONITORING_SINCE);
    var counted = outages.filter(function (o) { return o.status !== 'DISMISSED' && o.start < e && (o.end || now) > s; });
    var downtime = merge(counted.map(function (o) { return [Math.max(o.start, s), Math.min(o.end || now, e)]; }));
    var durations = counted.map(function (o) { return (o.end || now) - o.start; });
    var ends = outages.filter(function (o) { return o.status === 'RESOLVED'; }).map(function (o) { return o.end; });
    var eligible = e - s;
    return {
      count: counted.length, downtime: downtime,
      availability: eligible > 0 ? (eligible - downtime) / eligible * 100 : null,
      longest: durations.length ? Math.max.apply(null, durations) : 0,
      average: durations.length ? durations.reduce(function (a, b) { return a + b; }, 0) / durations.length : 0,
      brief: briefs.filter(function (x) { return x.start >= s && x.start < e; }).length,
      unknown: merge(unknowns.map(function (u) { return [Math.max(u.start, s), Math.min(u.end, e)]; })),
      uptime: activeOutage() ? 0 : now - Math.max(MONITORING_SINCE, ends.length ? Math.max.apply(null, ends) : 0)
    };
  }
  var PERIODS = [['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['30d', 'Last 30 days']];
  var period = '30d';
  function periodRange(p) {
    var n = Date.now(), d = new Date(n); d.setHours(0, 0, 0, 0);
    if (p === 'today') return [d.getTime(), n];
    if (p === 'week') { d.setDate(d.getDate() - (d.getDay() + 6) % 7); return [d.getTime(), n]; }
    if (p === 'month') { d.setDate(1); return [d.getTime(), n]; }
    return [n - 30 * DAY, n];
  }

  // ---- simulator ---------------------------------------------------------------
  var SCEN = {
    isp: { title: 'Internet provider drops', desc: 'The router stays up; everything past it fails for 3 minutes.', icon: 'network', ticks: 6,
      fail: { EXTERNAL_IP: 'PING_TIMEOUT', DNS_RESOLVER: 'DNS_TIMEOUT', REMOTE_SERVICE: 'HTTP_TIMEOUT' } },
    router: { title: 'Router restarts', desc: 'Every check fails, the router and the NAS included.', icon: 'agent', ticks: 5,
      fail: { GATEWAY: 'PING_TIMEOUT', EXTERNAL_IP: 'PING_UNREACHABLE', DNS_RESOLVER: 'DNS_TIMEOUT', REMOTE_SERVICE: 'HTTP_CONNECTION_ERROR', LOCAL_DEVICE: 'TCP_TIMEOUT' } },
    dns: { title: 'DNS stops answering', desc: 'The connection works, but names don\'t resolve.', icon: 'query', ticks: 5,
      fail: { DNS_RESOLVER: 'DNS_TIMEOUT', REMOTE_SERVICE: 'HTTP_CONNECTION_ERROR' } },
    site: { title: 'One website goes down', desc: 'GitHub returns errors while the network is fine.', icon: 'monitor', ticks: 5,
      failIds: { mon_github: 'HTTP_STATUS_ERROR · 503' } },
    blip: { title: 'A brief blip', desc: 'The internet drops for one minute and comes back.', icon: 'bolt', ticks: 2,
      fail: { EXTERNAL_IP: 'PING_TIMEOUT', DNS_RESOLVER: 'DNS_TIMEOUT', REMOTE_SERVICE: 'HTTP_TIMEOUT' } }
  };
  var PRE = 1, POST = 3, STEP_MS = 750;
  var sim = null;

  function failCode(sc, m) { return sc.failIds ? sc.failIds[m.id] || null : sc.fail[m.role] || null; }
  function cutsOff(sc) { return !!sc.fail && PATH.some(function (r) { return sc.fail[r]; }); }
  function say(t, tone, text) { sim.log.push({ t: t, tone: tone, text: text }); }
  function ev(type, m, at, data) { sim.pending.push({ type: type, m: m, at: at, data: data }); }

  function startSim(key) {
    if (sim && !sim.done) return;
    var sc = SCEN[key], total = PRE + sc.ticks + POST;
    sim = { key: key, sc: sc, step: 0, total: total, t0: Date.now() - total * 30 * SEC, time: Date.now(), queue: [], log: [], pending: [], results: {}, lostAt: null, newOutage: null, briefsBefore: briefs.length, done: false };
    monitors.forEach(function (m) { if (m.enabled) { m.status = 'ONLINE'; m.fails = 0; m.oks = 0; m.failStart = null; m.incident = null; } });
    say(sim.t0, 'muted', 'Simulating: ' + sc.title.toLowerCase() + '. Each step is one 30-second check cycle.');
    D.action('simulate_' + key);
    refresh();
    sim.timer = setInterval(stepSim, STEP_MS);
  }

  function stepSim() {
    var k = sim.step, sc = sim.sc, t = sim.t0 + (k + 1) * 30 * SEC;
    sim.time = t;
    var failing = k >= PRE && k < PRE + sc.ticks;
    var results = monitors.filter(function (m) { return m.enabled; }).map(function (m, i) {
      var code = failing ? failCode(sc, m) : null;
      return { m: m, at: t + i * 150, ok: !code, code: code, ms: code ? null : Math.max(1, Math.round(m.base * (0.85 + rand() * 0.4))) };
    });
    results.forEach(function (r) { sim.results[r.m.id] = r; r.m.recent.push(r.ok); r.m.recent.shift(); r.m.lastAt = Date.now(); if (r.ok) r.m.lastMs = r.ms; });

    if (failing && cutsOff(sc)) {
      if (sim.lostAt == null) {
        sim.lostAt = t - 30 * SEC;
        say(t, 'warn', 'The agents can\'t reach the server, which is hosted outside this network. Each result is committed to the agent\'s SQLite queue instead.');
      }
      sim.queue = sim.queue.concat(results);
      var age = t - sim.lostAt;
      if (age > 60 * SEC && !sim.staleSaid) { sim.staleSaid = true; say(t, 'warn', 'Heartbeats overdue: agents marked Stale.'); }
      if (age > 120 * SEC && !sim.unknownSaid) { sim.unknownSaid = true; say(t, 'muted', 'No heartbeat for 2 minutes: agents Unknown. The server records this as unknown time, not downtime. Silence alone never proves an outage.'); }
    } else {
      if (sim.queue.length) {
        var q = sim.queue; sim.queue = [];
        say(t, 'ok', 'Connection back. The agents uploaded ' + q.length + ' queued results in one batch (0 duplicates); the server replays them by check time, not arrival time.');
        q.forEach(apply);
        flushGroups();
        if (sim.staleSaid) say(t, 'ok', 'Heartbeats received: agents Online.');
      }
      sim.lostAt = null;
      results.forEach(apply);
    }
    flushGroups();
    sim.step++;
    if (sim.step >= sim.total) finishSim();
    refresh();
  }

  // Per-monitor state machine, as on the server.
  function apply(r) {
    var m = r.m, inc;
    if (r.ok) {
      if (m.status === 'CONFIRMING_OUTAGE') {
        var bi = { monitor: m, start: m.failStart, end: r.at, failed: m.fails };
        briefs.unshift(bi); ev('brief', m, r.at, bi);
        m.status = 'ONLINE'; m.fails = 0; m.failStart = null;
      } else if (m.status === 'OFFLINE') {
        m.status = 'CONFIRMING_RECOVERY'; m.oks = 1; m.recoverStart = r.at; ev('recovering', m, r.at);
      } else if (m.status === 'CONFIRMING_RECOVERY') {
        m.oks++;
        if (m.oks >= THRESH.recover) {
          inc = m.incident; inc.end = m.recoverStart; m.incident = null; m.status = 'ONLINE'; m.oks = 0;
          ev('recovered', m, r.at, inc); afterRecovery(inc, r.at);
        }
      } else m.status = 'ONLINE';
    } else if (m.status === 'ONLINE' || m.status === 'PENDING') {
      m.status = 'CONFIRMING_OUTAGE'; m.fails = 1; m.failStart = r.at; ev('failing', m, r.at, r.code);
    } else if (m.status === 'CONFIRMING_OUTAGE') {
      m.fails++;
      if (m.fails >= THRESH.fail) {
        m.status = 'OFFLINE';
        inc = { monitor: m, start: m.failStart, confirmed: r.at, end: null, code: r.code };
        m.incident = inc; ev('incident', m, r.at, inc); correlate(inc, r.at);
      }
    } else if (m.status === 'CONFIRMING_RECOVERY') { m.status = 'OFFLINE'; m.oks = 0; }
  }

  function correlate(inc, at) {
    var a = activeOutage();
    var related = PATH.indexOf(inc.monitor.role) >= 0 || (a && inc.start - a.start <= THRESH.window * SEC);
    if (!related) { inc.service = true; serviceIncidents.unshift(inc); ev('service', inc.monitor, at, inc); return; }
    if (a) {
      var before = a.cls + a.conf;
      a.incidents.push(inc); inc.outage = a; reclass(a);
      ev('attach', inc.monitor, at, a);
      if (a.cls + a.conf !== before) ev('reclass', null, at, a);
      return;
    }
    var o = { id: rid('out'), num: outages.length + 1, start: inc.start, confirmed: inc.confirmed, end: null, status: 'ACTIVE', incidents: [inc], note: '', simulated: true };
    inc.outage = o; reclass(o); outages.push(o); sim.newOutage = o;
    ev('outage_open', null, at, o);
  }

  function afterRecovery(inc, at) {
    if (inc.service) { ev('service_resolved', inc.monitor, at, inc); return; }
    var o = inc.outage;
    if (!o || o.status !== 'ACTIVE') return;
    var path = o.incidents.filter(function (i) { return PATH.indexOf(i.monitor.role) >= 0; });
    if (path.some(function (i) { return i.end == null; })) return;
    o.end = Math.max.apply(null, path.map(function (i) { return i.end; }));
    o.status = 'RESOLVED';
    ev('outage_resolved', null, at, o);
  }

  // Events from one processing pass are grouped by kind, so five monitors
  // failing together read as one line, the way the product counts them.
  var TEXT = {
    failing: function (g, n) { return ['warn', n + ' failed (' + g[0].data + (g.length > 1 ? ', …' : '') + '): 1 of 3 failures needed before anything opens.']; },
    incident: function (g, n) { return ['bad', n + ': 3 failures in a row, so ' + (g.length > 1 ? g.length + ' monitor incidents open' : 'a monitor incident opens') + ', dated from the first failed check (' + fmtSec(g[0].data.start) + ').']; },
    outage_open: function (g) { var o = g[0].data; return ['bad', 'Network outage #' + o.num + ' opened: ' + lc(CAUSE[o.cls].summary) + ' (' + o.conf.toLowerCase() + ' confidence).']; },
    attach: function (g, n) { var o = g[0].data; return ['muted', n + ' attached to outage #' + o.num + ': one network outage, not ' + o.incidents.length + '.']; },
    reclass: function (g) { var o = g[g.length - 1].data; return ['muted', 'Outage #' + o.num + ' reclassified with the new evidence: ' + lc(CAUSE[o.cls].summary) + ' (' + o.conf.toLowerCase() + ' confidence).']; },
    service: function (g, n) { return ['warn', n + ' failed while the router, internet and DNS stayed healthy: a service incident, not a network outage.']; },
    brief: function (g, n) { var f = g[0].data.failed; return ['ok', n + ' recovered after ' + f + ' failed check' + (f > 1 ? 's' : '') + ', before the 3-failure threshold: logged as brief interruption' + (g.length > 1 ? 's' : '') + ', not an outage.']; },
    recovering: function (g, n) { return ['muted', n + ' responding again: 1 of 2 successes needed to recover.']; },
    recovered: function (g, n) { return ['ok', n + ': 2 successes in a row, so ' + (g.length > 1 ? 'their incidents close' : 'its incident closes') + '.']; },
    outage_resolved: function (g) { var o = g[0].data; return ['ok', 'Outage #' + o.num + ' resolved after ' + fmtDur(o.end - o.start) + '. Downtime counts once, not once per monitor.']; },
    service_resolved: function (g, n) { return ['ok', n + ' recovered and the service incident closed. The network outage count did not change.']; }
  };
  function flushGroups() {
    var order = [], groups = {};
    sim.pending.forEach(function (e) { if (!groups[e.type]) { groups[e.type] = []; order.push(e.type); } groups[e.type].push(e); });
    sim.pending = [];
    order.forEach(function (type) {
      var g = groups[type], out = TEXT[type](g, names(g.map(function (e) { return e.m ? e.m.name : ''; })));
      say(g[0].at, out[0], out[1]);
    });
  }

  function finishSim() {
    clearInterval(sim.timer);
    sim.done = true; sim.lostAt = null;
    agents.forEach(function (a) { if (!a.revoked) a.hb = Date.now(); });
    var o = sim.newOutage;
    if (o) sim.outcome = { tone: 'ok', go: 'outages/' + o.id, button: 'View outage #' + o.num,
      text: o.incidents.length + ' monitor incidents became one network outage, #' + o.num + ': ' + lc(CAUSE[o.cls].summary) + '. ' +
        (cutsOff(sim.sc) ? 'The agents were cut off the whole time, yet the outage starts at the first failed check, because their queued results were replayed by check time.' : '') };
    else if (sim.key === 'site') sim.outcome = { tone: 'ok', go: 'outages', button: 'Open Outages',
      text: 'The network outage count did not change. A single website failing is that website\'s problem, so it is listed separately as a service incident.' };
    else sim.outcome = { tone: 'ok', go: 'outages', button: 'See brief interruptions',
      text: 'No incident and no outage. ' + (briefs.length - sim.briefsBefore) + ' brief interruptions were logged instead. They are reported beside outages, never in the count.' };
  }

  // Re-render the current view without losing the scroll position; skipped
  // while someone is typing in a search box.
  function refresh() {
    var a = document.activeElement;
    if (a && a.matches && a.matches('input[type=search]')) return;
    var y = window.scrollY; D.render(); window.scrollTo(0, y);
  }

  // ---- live ticks: heartbeat ages, countdowns, link utilisation ---------------------
  setInterval(function () {
    var n = Date.now();
    agents.forEach(function (a) { if (!a.revoked && !(sim && sim.lostAt != null) && n - a.hb >= 30 * SEC) a.hb += 30 * SEC * Math.floor((n - a.hb) / (30 * SEC)); });
    document.querySelectorAll('[data-hb]').forEach(function (el) { el.textContent = fmtAge(agentState(agentById[el.dataset.hb]).age); });
    document.querySelectorAll('[data-hb-badge]').forEach(function (el) { el.innerHTML = agentBadge(agentById[el.dataset.hbBadge]); });
    document.querySelectorAll('[data-age]').forEach(function (el) { el.textContent = fmtAge(n - Number(el.dataset.age)); });
    document.querySelectorAll('[data-countdown]').forEach(function (el) {
      var left = Number(el.dataset.countdown) - n;
      el.textContent = left > 0 ? Math.floor(left / 60000) + ':' + ('0' + Math.floor(left / 1000) % 60).slice(-2) : 'expired';
    });
  }, 1000);
  setInterval(function () {
    util.down = Math.max(0.4, Math.min(60, util.down * (0.75 + rand() * 0.5) + (rand() < 0.08 ? 20 * rand() : 0)));
    util.up = Math.max(0.1, Math.min(12, util.up * (0.75 + rand() * 0.5)));
    document.querySelectorAll('[data-util]').forEach(function (el) { el.innerHTML = utilHtml(); });
  }, 2000);

  // ---- views ---------------------------------------------------------------------
  var HEADLINES = { online: ['Network is ', 'online', 'ok'], outage: ['Network outage ', 'in progress', 'bad'], unknown: ['Monitoring data is ', 'not arriving', 'unknown'] };
  var simulateBtn = '<button class="btn primary sm" data-sim-jump>' + D.icon('play') + 'Simulate a failure</button>';
  var jumpToSim = false;

  function historyHtml() {
    var end = Date.now(), start = Math.max(end - 24 * HOUR, MONITORING_SINCE), n = Math.round((end - start) / MIN);
    var W = 1440, top = 4, bottom = 72, maxMs = 50;
    var paths = [], seg = '', runs = [], cur = null;
    for (var i = 0; i < n; i++) {
      var t = start + i * MIN, s = stateAt(t), x = (i / n * W).toFixed(1);
      if (!cur || cur.state !== s.state || cur.outage !== s.outage) { cur = { state: s.state, outage: s.outage, from: i, to: i + 1 }; runs.push(cur); } else cur.to = i + 1;
      if (s.state === 'up') { var y = bottom - Math.min(latencyAt(t), maxMs) / maxMs * (bottom - top); seg += (seg ? 'L' : 'M') + x + ' ' + y.toFixed(1); }
      else if (seg) { paths.push(seg); seg = ''; }
    }
    if (seg) paths.push(seg);
    var band = runs.map(function (r) {
      var x = r.from / n * W, w = Math.max(2, (r.to - r.from) / n * W);
      if (r.state === 'up') return '<rect x="' + x.toFixed(1) + '" y="84" width="' + w.toFixed(1) + '" height="14" style="fill:var(--ok);opacity:.85"/>';
      if (r.state === 'down') return '<rect x="' + x.toFixed(1) + '" y="80" width="' + w.toFixed(1) + '" height="22" rx="2" style="fill:var(--bad)" data-go="outages/' + r.outage.id + '"><title>Outage #' + r.outage.num + '</title></rect>';
      return '<rect x="' + x.toFixed(1) + '" y="84" width="' + w.toFixed(1) + '" height="14" style="fill:url(#nm-hatch)"><title>No agent reporting</title></rect>';
    }).join('');
    var axis = '';
    var h = new Date(start); h.setMinutes(0, 0, 0);
    for (var ht = h.getTime() + HOUR; ht < end; ht += HOUR) {
      var hr = new Date(ht).getHours(), left = (ht - start) / (end - start) * 100;
      if (hr % 3 === 0 && left > 4 && left < 96) axis += '<span style="left:' + left.toFixed(2) + '%">' + fmtClock(ht) + '</span>';
    }
    return '<div class="pulse" data-start="' + start + '" data-end="' + end + '">' +
      '<svg viewBox="0 0 ' + W + ' 104" preserveAspectRatio="none" role="img" aria-label="Network history for the last 24 hours: latency above a status band">' +
        '<defs><pattern id="nm-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" style="fill:var(--panel-2)"/><rect width="3" height="8" style="fill:var(--faint)"/></pattern></defs>' +
        '<line x1="0" x2="' + W + '" y1="' + bottom + '" y2="' + bottom + '" style="stroke:var(--line)" vector-effect="non-scaling-stroke"/>' +
        paths.map(function (p) { return '<path d="' + p + '" fill="none" style="stroke:var(--ok)" stroke-width="1.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>'; }).join('') +
        '<g class="band">' + band + '</g>' +
      '</svg><div class="cursor"></div><div class="readout"></div><div class="axis">' + axis + '</div></div>' +
      '<div class="legend"><span><i class="up"></i>Up · latency 0–50 ms</span><span><i class="down"></i>Confirmed outage (click to open)</span><span><i class="unknown"></i>No agent reporting</span></div>';
  }
  function bindHistory(root) {
    var box = root.querySelector('.pulse'); if (!box) return;
    var start = Number(box.dataset.start), end = Number(box.dataset.end);
    var cursor = box.querySelector('.cursor'), readout = box.querySelector('.readout');
    box.addEventListener('pointermove', function (e) {
      var r = box.getBoundingClientRect(), f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      var t = start + f * (end - start), s = stateAt(t);
      readout.textContent = fmtClock(t) + ' · ' + (s.state === 'up' ? latencyAt(t) + ' ms · up' : s.state === 'down' ? 'outage #' + s.outage.num : 'no agent reporting');
      var x = f * r.width;
      cursor.style.display = readout.style.display = 'block';
      cursor.style.left = x + 'px';
      readout.style.left = Math.min(r.width - readout.offsetWidth / 2, Math.max(readout.offsetWidth / 2, x)) + 'px';
    });
    box.addEventListener('pointerleave', function () { cursor.style.display = readout.style.display = 'none'; });
  }

  function stackHtml() {
    var st = networkState(), router = monById.mon_router, internet = monById.mon_internet;
    function wire(m) { return st === 'unknown' ? 'unknown' : m.status === 'OFFLINE' || m.status === 'CONFIRMING_RECOVERY' ? 'bad' : ''; }
    function nodeBadge(m) { return st === 'unknown' ? badge('Unknown', 'neutral') : monBadge(m); }
    return '<div class="stack">' +
      '<div class="node"><b>Internet</b><span>Front Range Fiber · fiber</span>' + nodeBadge(internet) + '</div>' +
      '<div class="wire ' + wire(internet) + '"></div>' +
      '<div class="node"><b>Router</b><span>TP-Link Archer AX55 · from the gateway\'s MAC vendor</span>' + nodeBadge(router) + '</div>' +
      '<div class="wire ' + wire(router) + '"></div>' +
      '<div class="agents">' + agents.map(function (a) {
        return '<div class="node"><b>' + esc(a.name) + '</b><span>' + esc(a.os) + '</span><span data-hb-badge="' + a.id + '">' + agentBadge(a) + '</span></div>';
      }).join('') + '</div></div>';
  }

  function simCard() {
    var running = sim && !sim.done;
    var buttons = '<div class="scenarios">' + Object.keys(SCEN).map(function (k) {
      var sc = SCEN[k];
      return '<button class="scenario" data-sim="' + k + '"' + (running ? ' disabled' : '') + '><b>' + D.icon(sc.icon) + esc(sc.title) + '</b><span>' + esc(sc.desc) + '</span></button>';
    }).join('') + '</div>';
    return D.card('Simulate a failure', buttons + simPanel(), { sub: 'Runs the product\'s outage rules on compressed time. Each step is one 30-second check cycle: 3 failures open an incident, 2 successes close it.' });
  }
  function simPanel() {
    if (!sim) return '';
    var checks = monitors.filter(function (m) { return m.enabled; }).map(function (m) {
      var r = sim.results[m.id];
      return '<div><span>' + esc(m.name) + ' <span class="note">' + esc(agentById[m.agent].name) + '</span></span>' +
        (!r ? '<span class="r">…</span>' : r.ok ? '<span class="r ok">✓ ' + r.ms + ' ms</span>' : '<span class="r bad">✕ ' + esc(r.code) + '</span>') + '</div>';
    }).join('');
    var log = sim.log.map(function (l) { return '<div><time>' + fmtSec(l.t) + '</time><span class="' + l.tone + '">' + esc(l.text) + '</span></div>'; }).join('');
    var foot = sim.done
      ? '<div class="sim-done"><div class="alert ' + sim.outcome.tone + '" style="flex:1 1 320px">' + D.icon('check') + '<div class="txt">' + esc(sim.outcome.text) + '</div></div><button class="btn primary sm" data-go="' + sim.outcome.go + '">' + esc(sim.outcome.button) + D.icon('arrow') + '</button></div>'
      : '<p class="note" style="margin-top:10px">Check cycle ' + Math.min(sim.step + 1, sim.total) + ' of ' + sim.total + '…</p>';
    return '<div class="sim" id="sim-panel"><div class="pane"><h4>Agents · inside the network</h4><div class="checks">' + checks + '</div>' +
      '<div class="queue">Server reachable: <b>' + (sim.lostAt == null ? 'yes' : 'no') + '</b> · queued in SQLite: <b>' + sim.queue.length + '</b> results</div></div>' +
      '<div class="pane"><h4>Server · outage engine</h4><div class="log" id="sim-log">' + log + '</div></div></div>' + foot;
  }

  function overview() {
    var st = networkState(), H = HEADLINES[st];
    var range = periodRange(period), s = summary(range[0], range[1]);
    var act = activeOutage();
    var latest = act || outages.filter(function (o) { return o.status !== 'DISMISSED'; }).sort(function (a, b) { return b.start - a.start; })[0];
    var lastTest = speedTests[0];

    var hero = '<div class="card"><div class="body">' +
      '<div class="headline"><h1>' + H[0] + '<b class="' + H[2] + '">' + H[1] + '</b></h1><span class="note">as of ' + fmtSec(Date.now()) + ' (' + esc(TZ) + ')</span></div>' +
      (st === 'unknown' ? '<p class="note" style="margin-top:6px">The monitoring agents stopped reporting, so the network state cannot be confirmed. This is not the same as a confirmed outage.</p>' : '') +
      '<p class="isp">Internet provider <b>Front Range Fiber</b><span class="chip">Fiber</span></p>' +
      historyHtml() +
      '<div class="agents-line">' + agents.map(function (a) {
        return '<div><span class="note">' + esc(a.name) + ':</span><span data-hb-badge="' + a.id + '">' + agentBadge(a) + '</span><span class="note">heartbeat <span data-hb="' + a.id + '">' + fmtAge(agentState(a).age) + '</span> · reporting for ' + fmtDur(Date.now() - CUT.end) + '</span></div>';
      }).join('') + '</div></div></div>';

    var conn = '<div class="grid stats">' +
      D.stat({ label: 'Latency (median, 15 min)', value: '12 ms', delta: 'Jitter 1.8 ms' }) +
      '<div class="card stat"><div class="label">In use right now</div><div class="value" data-util>' + utilHtml() + '</div><div class="delta">Whole network · router byte counters</div></div>' +
      D.stat({ label: 'Capacity (last speed test)', value: lastTest.down + ' / ' + lastTest.up, delta: 'Mbps down / up · ' + fmtAge(Date.now() - lastTest.at) + ' · an estimate' }) +
      '</div>';

    var cards = [
      ['Confirmed outages', String(s.count)], ['Total downtime', s.downtime ? fmtDur(s.downtime) : 'none'], ['Availability', pct(s.availability)],
      ['Current uninterrupted uptime', act ? '0 — outage in progress' : fmtDur(s.uptime)], ['Brief interruptions', String(s.brief)], ['Unknown monitoring time', s.unknown ? fmtDur(s.unknown) : 'none']
    ];
    var latestHtml = !latest ? '<div class="empty">No outages recorded yet.</div>' :
      '<p><b>#' + latest.num + ' — ' + esc(CAUSE[latest.cls].summary) + '</b> <span class="note">(' + latest.conf.toLowerCase() + ' confidence)</span></p>' +
      '<p class="explain" style="margin-top:6px">' + esc(explanation(latest)) + '</p>' +
      '<p class="note" style="margin-top:6px">' + fmtWhen(latest.start) + ' → ' + (latest.end ? fmtWhen(latest.end) + ' · ' + fmtDur(latest.end - latest.start) : 'ongoing') + '</p>' +
      '<p style="margin-top:8px"><button class="btn sm" data-go="outages/' + latest.id + '">View details and technical evidence</button></p>';

    var days = [];
    for (var d = 6; d >= 0; d--) {
      var ds = new Date(); ds.setHours(0, 0, 0, 0); ds.setDate(ds.getDate() - d);
      var de = Math.min(ds.getTime() + DAY, Date.now()), sd = summary(ds.getTime(), de);
      days.push({ label: ds.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }), s: sd });
    }
    var trend = D.table({ columns: [
      { label: 'Day', render: function (r) { return esc(r.label); } },
      { label: 'Status', render: function (r) { return r.s.count ? badge('Had outages', 'bad') : r.s.unknown ? badge('Monitoring gaps', 'neutral') : badge('Healthy', 'ok'); } },
      { label: 'Outages', num: true, render: function (r) { return r.s.count; } },
      { label: 'Downtime', num: true, render: function (r) { return r.s.downtime ? fmtDur(r.s.downtime) : 'none'; } },
      { label: 'Availability', num: true, render: function (r) { return pct(r.s.availability); } },
      { label: 'Brief blips', num: true, render: function (r) { return r.s.brief; } },
      { label: 'Unknown time', num: true, render: function (r) { return r.s.unknown ? fmtDur(r.s.unknown) : 'none'; } }
    ], rows: days.reverse() });

    return {
      title: 'Overview', crumbs: 'Home · ' + agents.length + ' agents · ' + monitors.length + ' monitors', actions: simulateBtn,
      html: hero + simCard() + conn +
        D.card('Network stack', stackHtml(), { sub: 'Internet → router → the machines running agents' }) +
        '<div class="pills">' + PERIODS.map(function (p) { return '<button class="pill ' + (period === p[0] ? 'on' : '') + '" data-period="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div>' +
        '<div class="grid six">' + cards.map(function (c) { return D.stat({ label: c[0], value: c[1] }); }).join('') + '</div>' +
        '<div class="grid two">' + D.card(act ? 'Active outage' : 'Latest outage', latestHtml) +
          D.card('How outages are counted', '<p class="explain">A failed check is not an outage. Three failures in a row open a <b>monitor incident</b>; related incidents across the router, internet and DNS become <b>one network outage</b>, and only those count as downtime. A failure that recovers sooner is a <b>brief interruption</b>, and time with no agent reporting is <b>unknown</b>, never down.</p>') + '</div>' +
        D.card('Last 7 days', trend, { flush: true, sub: 'Only confirmed network outages count as downtime. Brief blips recovered before the failure threshold; unknown time is when no agent was reporting.' }),
      after: function (root) {
        bindHistory(root);
        var log = root.querySelector('#sim-log'); if (log) log.scrollTop = log.scrollHeight;
        if (jumpToSim) { jumpToSim = false; var c = root.querySelector('.scenarios'); if (c) setTimeout(function () { c.closest('.card').scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 0); }
      }
    };
  }

  // ---- outages ---------------------------------------------------------------------
  var outFilter = 'all', outQuery = '';
  function outagesView(param) {
    if (param) { var o = outages.find(function (x) { return x.id === param; }); if (o) return outageDetail(o); }
    var rows = outages.slice().sort(function (a, b) { return b.start - a.start; }).filter(function (o) {
      return (outFilter === 'all' || o.status === outFilter) && (!outQuery || ('#' + o.num + ' ' + CAUSE[o.cls].short + ' ' + o.note).toLowerCase().indexOf(outQuery) >= 0);
    });
    var s = summary(Date.now() - 30 * DAY, Date.now());
    return {
      title: 'Outages', crumbs: s.count + ' confirmed in the last 30 days · ' + fmtDur(s.downtime) + ' downtime', actions: simulateBtn,
      html: '<div class="toolbar"><input class="grow" type="search" placeholder="Search by number, cause or note" value="' + esc(outQuery) + '" data-out-q>' +
        '<div class="pills">' + [['all', 'All'], ['ACTIVE', 'Active'], ['RESOLVED', 'Resolved'], ['DISMISSED', 'Dismissed']].map(function (p) { return '<button class="pill ' + (outFilter === p[0] ? 'on' : '') + '" data-out-f="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div></div>' +
        D.card('Network outages', D.table({ columns: [
          { label: '#', render: function (o) { return '<b>#' + o.num + '</b>'; } },
          { label: 'Started', render: function (o) { return esc(fmtWhen(o.start)); } },
          { label: 'Duration', num: true, render: function (o) { return fmtDur((o.end || Date.now()) - o.start); } },
          { label: 'Likely cause', render: function (o) { return esc(CAUSE[o.cls].short) + (o.note ? '<div class="note">' + esc(o.note) + '</div>' : ''); } },
          { label: 'Confidence', render: function (o) { return confBadge(o.conf); } },
          { label: 'Monitors', num: true, render: function (o) { return o.incidents.length; } },
          { label: 'Status', render: outageBadge }
        ], rows: rows, rowAttr: function (o) { return 'data-go="outages/' + o.id + '"'; }, empty: 'No outages match' }), { flush: true, sub: 'Each row is one correlated event, however many monitors it affected' }) +
        '<div class="grid halves">' +
          D.card('Recent brief interruptions', D.table({ columns: [
            { label: 'Monitor', render: function (b) { return esc(b.monitor.name); } },
            { label: 'Started', render: function (b) { return esc(fmtWhen(b.start)); } },
            { label: 'Duration', num: true, render: function (b) { return fmtDur(b.end - b.start); } },
            { label: 'Failed checks', num: true, render: function (b) { return b.failed; } }
          ], rows: briefs.slice(0, 10) }), { flush: true, sub: 'Recovered before the 3-failure threshold. Never in the outage count.' }) +
          D.card('Service incidents', D.table({ columns: [
            { label: 'Service', render: function (i) { return esc(i.monitor.name); } },
            { label: 'Started', render: function (i) { return esc(fmtWhen(i.start)); } },
            { label: 'Duration', num: true, render: function (i) { return i.end ? fmtDur(i.end - i.start) : 'ongoing'; } },
            { label: 'Failure', render: function (i) { return '<span class="mono">' + esc(i.code) + '</span>'; } }
          ], rows: serviceIncidents }), { flush: true, sub: 'One website failed while the network path stayed healthy. Not a network outage.' }) +
        '</div>',
      after: function (root) {
        var q = root.querySelector('[data-out-q]');
        q.addEventListener('input', function () { outQuery = q.value.trim().toLowerCase(); var pos = q.selectionStart; D.render(); var nq = document.querySelector('[data-out-q]'); nq.focus(); nq.setSelectionRange(pos, pos); });
      }
    };
  }

  function outageDetail(o) {
    var now = Date.now(), c = CAUSE[o.cls], dur = (o.end || now) - o.start;
    var monitored = [];
    monitors.forEach(function (m) { if (m.enabled && monitored.indexOf(m.role) < 0) monitored.push(m.role); });
    var evidence = {
      ruleVersion: 1, classification: o.cls, confidence: o.conf,
      affectedRoles: o.roles, healthyRoles: monitored.filter(function (r) { return o.roles.indexOf(r) < 0; }),
      unmonitoredRoles: Object.keys(ROLE).filter(function (r) { return monitored.indexOf(r) < 0; }),
      affectedMonitors: o.incidents.map(function (i) { return i.monitor.name; }), incidentCount: o.incidents.length
    };
    var tl = [{ at: o.start, text: 'First failed check (' + o.incidents[0].monitor.name + ')', tone: 'bad' }, { at: o.confirmed, text: 'Third failure in a row: monitor incident confirmed, network outage opened', tone: 'bad' }];
    o.incidents.slice(1).forEach(function (i) { tl.push({ at: i.confirmed, text: i.monitor.name + ' incident attached', tone: 'muted' }); });
    if (o.end) tl.push({ at: o.end, text: 'Network path recovered (2 successes in a row): outage resolved', tone: '' });
    if (o.status === 'DISMISSED') tl.push({ at: o.dismissedAt || now, text: 'Dismissed: kept and numbered, no longer counted', tone: 'muted' });
    tl.sort(function (a, b) { return a.at - b.at; });
    var acts = o.status === 'RESOLVED' ? '<button class="btn sm" data-dismiss="' + o.id + '">Dismiss</button>' : o.status === 'DISMISSED' ? '<button class="btn sm" data-restore="' + o.id + '">Count it again</button>' : '';
    return {
      title: 'Outage #' + o.num, crumbs: '<span data-go="outages" style="cursor:pointer">Outages</span> / <b>#' + o.num + '</b>', actions: acts,
      html:
        '<div class="alert ' + (o.status === 'ACTIVE' ? 'bad' : 'warn') + '">' + D.icon('alert') + '<div class="txt"><b>' + esc(c.summary) + '</b> (' + o.conf.toLowerCase() + ' confidence)' + (o.status === 'DISMISSED' ? ' · dismissed, so it no longer counts toward outages, downtime or availability' : '') + '</div></div>' +
        '<div class="grid two">' +
          D.card('Explanation', '<p class="explain">' + esc(explanation(o)) + '</p><p class="note" style="margin-top:10px"><b>What to check:</b> ' + esc(c.check) + '</p>' + (o.note ? '<p class="note" style="margin-top:6px"><b>Note:</b> ' + esc(o.note) + '</p>' : '')) +
          D.card('What happened', D.kv([
            ['Status', outageBadge(o), true], ['Started', fmtWhen(o.start) + ' (first failed check)'], ['Confirmed', fmtSec(o.confirmed)],
            ['Ended', o.end ? fmtWhen(o.end) : 'ongoing'], ['Duration', fmtDur(dur)], ['Likely cause', c.short], ['Confidence', confBadge(o.conf), true]
          ])) +
        '</div>' +
        D.card('Affected monitors', D.table({ columns: [
          { label: 'Monitor', render: function (i) { return '<b>' + esc(i.monitor.name) + '</b><div class="note mono">' + esc(i.monitor.target) + '</div>'; } },
          { label: 'Diagnostic role', render: function (i) { return esc(ROLE[i.monitor.role]); } },
          { label: 'Failed from', render: function (i) { return esc(fmtSec(i.start)); } },
          { label: 'Recovered', render: function (i) { return i.end ? esc(fmtSec(i.end)) : '—'; } },
          { label: 'Duration', num: true, render: function (i) { return fmtDur((i.end || now) - i.start); } }
        ], rows: o.incidents }), { flush: true, sub: o.incidents.length + ' monitor incidents, one outage. Overlapping durations are never added together.' }) +
        '<div class="grid halves">' +
          D.card('Timeline', '<div class="timeline">' + tl.map(function (e) { return '<div class="ev"><div class="t">' + fmtSec(e.at).slice(0, 5) + '</div><div class="n"><i class="' + e.tone + '"></i></div><div class="c"><span style="color:var(--text)">' + esc(e.text) + '</span></div></div>'; }).join('') + '</div>') +
          D.card('Technical evidence', '<details class="evidence"><summary>Show the evidence this diagnosis rests on</summary><pre class="code">' + esc(JSON.stringify(evidence, null, 2)) + '</pre></details><p class="note" style="margin-top:10px">The same evidence and rule version always produce the same classification.</p>') +
        '</div>'
    };
  }

  // ---- analytics ---------------------------------------------------------------------
  var chartMode = 'chart';
  function analyticsView() {
    var now = Date.now(), from = now - 30 * DAY, s = summary(from, now);
    var counted = outages.filter(function (o) { return o.status !== 'DISMISSED' && o.start >= from; });
    var perDay = [], downDay = [], labels = [], tones = [];
    for (var d = 29; d >= 0; d--) {
      var ds = new Date(); ds.setHours(0, 0, 0, 0); ds.setDate(ds.getDate() - d);
      var a = ds.getTime(), e = a + DAY;
      var inDay = counted.filter(function (o) { return o.start >= a && o.start < e; });
      perDay.push(inDay.length);
      downDay.push(Math.round(inDay.reduce(function (sum, o) { return sum + ((o.end || now) - o.start); }, 0) / MIN));
      labels.push(d % 5 === 0 ? String(ds.getDate()) : '');
      tones.push('bad');
    }
    var causes = {};
    counted.forEach(function (o) { causes[o.cls] = (causes[o.cls] || 0) + 1; });
    var causeHtml = Object.keys(causes).sort(function (a, b) { return causes[b] - causes[a]; }).map(function (k) {
      var share = Math.round(causes[k] / counted.length * 100);
      return '<div style="display:grid;gap:6px;padding:8px 0"><div style="display:flex;justify-content:space-between;gap:8px"><span>' + esc(CAUSE[k].short) + '</span><span class="note">' + causes[k] + ' · ' + share + '%</span></div><div class="meter"><i class="bad" style="width:' + share + '%"></i></div></div>';
    }).join('') || '<div class="empty">No outages in this period</div>';
    var buckets = [['< 5 min', 0, 5], ['5–15 min', 5, 15], ['15–60 min', 15, 60], ['> 1 h', 60, 1e9]];
    var dist = buckets.map(function (b) { return counted.filter(function (o) { var m = ((o.end || now) - o.start) / MIN; return m >= b[1] && m < b[2]; }).length; });
    var weeks = [];
    for (var w = 3; w >= 0; w--) {
      var we = now - w * 7 * DAY, wsStart = we - 7 * DAY, sw = summary(wsStart, we);
      weeks.push({ label: new Date(wsStart).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' – ' + new Date(we).toLocaleDateString([], { month: 'short', day: 'numeric' }), s: sw });
    }
    var hourly = [], hLabels = [];
    for (var h = 23; h >= 0; h--) {
      var hs = now - (h + 1) * HOUR, vals = [];
      for (var t = hs; t < hs + HOUR; t += 5 * MIN) if (stateAt(t).state === 'up') vals.push(latencyAt(t));
      vals.sort(function (x, y) { return x - y; });
      hourly.push(vals.length ? vals[Math.floor(vals.length / 2)] : 0);
      hLabels.push(h % 4 === 0 ? fmtClock(hs + HOUR).slice(0, 2) : '');
    }
    var perDayBody = chartMode === 'chart' ? D.bars(perDay, labels, tones) : D.table({ columns: [
      { label: 'Day', render: function (r) { return esc(r.day); } }, { label: 'Outages', num: true, key: 'n' }, { label: 'Downtime', num: true, render: function (r) { return r.m ? r.m + ' min' : 'none'; } }
    ], rows: perDay.map(function (n, i) { var dd = new Date(); dd.setDate(dd.getDate() - (29 - i)); return { day: dd.toLocaleDateString([], { month: 'short', day: 'numeric' }), n: n, m: downDay[i] }; }).filter(function (r) { return r.n; }).reverse(), empty: 'No outages' });
    return {
      title: 'Analytics', crumbs: 'Last 30 days · ' + esc(TZ),
      html:
        '<div class="grid six">' +
          D.stat({ label: 'Confirmed outages', value: s.count }) + D.stat({ label: 'Total downtime', value: fmtDur(s.downtime) }) +
          D.stat({ label: 'Availability', value: pct(s.availability) }) + D.stat({ label: 'Longest outage', value: fmtDur(s.longest) }) +
          D.stat({ label: 'Average outage', value: fmtDur(s.average) }) + D.stat({ label: 'Brief interruptions', value: s.brief }) +
        '</div>' +
        '<div class="grid halves">' +
          D.card('Outages per day', perDayBody, { flush: chartMode === 'table', actions: '<div class="pills">' + ['chart', 'table'].map(function (m) { return '<button class="pill ' + (chartMode === m ? 'on' : '') + '" data-chart="' + m + '">' + cap(m) + '</button>'; }).join('') + '</div>' }) +
          D.card('Downtime per day', D.bars(downDay, labels, tones), { sub: 'Minutes of confirmed downtime' }) +
          D.card('Likely causes', causeHtml, { sub: 'By outage count' }) +
          D.card('Outage duration', D.bars(dist, buckets.map(function (b) { return b[0]; })), { sub: 'How long outages lasted' }) +
          D.card('Latency, last 24 hours', D.bars(hourly, hLabels), { sub: 'Hourly median to 1.1.1.1, in ms. The evening rise is household streaming.' }) +
          D.card('Brief interruptions vs confirmed outages', D.table({ columns: [
            { label: 'Week', render: function (r) { return esc(r.label); } },
            { label: 'Brief', num: true, render: function (r) { return r.s.brief; } },
            { label: 'Confirmed', num: true, render: function (r) { return r.s.count; } }
          ], rows: weeks.reverse() }), { flush: true }) +
        '</div>' +
        D.card('Unknown monitoring time', D.table({ columns: [
          { label: 'When', render: function (u) { return esc(fmtWhen(u.start)); } },
          { label: 'Duration', num: true, render: function (u) { return fmtDur(u.end - u.start); } },
          { label: 'Why', render: function (u) { return esc(u.reason); } }
        ], rows: unknowns.slice().reverse() }), { flush: true, sub: 'Shown separately and never counted as downtime' })
    };
  }

  // ---- speed ---------------------------------------------------------------------
  var speedRun = null;
  function utilHtml() { return util.down.toFixed(1) + ' <small style="font-size:13px;font-weight:500;color:var(--muted)">/ ' + util.up.toFixed(1) + ' Mbps</small>'; }
  function speedLiveHtml() {
    var r = speedRun;
    var label = { LATENCY: 'Measuring idle latency', DOWNLOAD: 'Download', UPLOAD: 'Upload' }[r.phase];
    var value = r.phase === 'LATENCY' ? r.idle + '<small>ms</small>' : Math.round(r.phase === 'DOWNLOAD' ? r.down : r.up) + '<small>Mbps</small>';
    return '<div class="gauge"><div class="note">' + label + '</div><div class="big">' + value + '</div><div class="meter"><i style="width:' + Math.round(r.progress * 100) + '%"></i></div>' +
      '<div class="note">' + (r.phase === 'LATENCY' ? 'Next: 8 parallel streams down, then up' : 'Latency under load: ' + Math.round(r.loaded) + ' ms') + '</div></div>';
  }
  function runSpeed() {
    if (speedRun) return;
    var worst = 250, left = budget.gb * 1000 - budget.usedMb;
    D.toast('Budget check passed: worst case ' + worst + ' MB, ' + (left / 1000).toFixed(1) + ' GB left this month');
    D.action('speed_test');
    var targetDown = 880 + rand() * 45, targetUp = 858 + rand() * 32, idle = 8 + Math.round(rand() * 3), tick = 0;
    speedRun = { phase: 'LATENCY', idle: idle, down: 0, up: 0, loaded: idle, progress: 0 };
    refresh();
    var timer = setInterval(function () {
      tick++;
      var r = speedRun;
      if (tick <= 10) { r.phase = 'LATENCY'; r.idle = idle + Math.round(rand() * 2); }
      else if (tick <= 40) { r.phase = 'DOWNLOAD'; r.down = targetDown * (1 - Math.exp(-(tick - 10) / 5)) * (0.97 + rand() * 0.05); r.loaded = idle + 3 + rand() * 5; }
      else if (tick <= 70) { r.phase = 'UPLOAD'; r.up = targetUp * (1 - Math.exp(-(tick - 40) / 5)) * (0.97 + rand() * 0.05); r.loaded = idle + 4 + rand() * 6; }
      else {
        clearInterval(timer);
        var mb = 170 + Math.round(rand() * 30);
        speedTests.unshift({ at: Date.now(), down: Math.round(targetDown), up: Math.round(targetUp), idle: idle, loaded: Math.round(r.loaded), mb: mb, trigger: 'Manual' });
        budget.usedMb += mb; speedRun = null;
        D.toast('Speed test complete · ' + Math.round(targetDown) + ' / ' + Math.round(targetUp) + ' Mbps · ' + mb + ' MB used');
        refresh();
        return;
      }
      r.progress = tick / 70;
      var el = document.getElementById('speed-live'); if (el) el.innerHTML = speedLiveHtml();
    }, 100);
  }
  function speedView() {
    var t = speedTests[0], used = budget.usedMb / 1000;
    return {
      title: 'Speed', crumbs: 'Capacity is measured occasionally; utilisation is live',
      actions: '<button class="btn primary sm" data-speed' + (speedRun ? ' disabled' : '') + '>' + D.icon('gauge') + (speedRun ? 'Testing…' : 'Run speed test') + '</button>',
      html:
        (speedRun ? D.card('Speed test in progress', '<div id="speed-live">' + speedLiveHtml() + '</div>', { sub: 'Monitoring checks are held while the link is saturated, so the test can\'t create false failures. The gap changes no monitor state.' }) : '') +
        '<div class="grid two">' +
          D.card('Capacity', '<div class="speed-row">' +
            '<div class="gauge"><div class="note">Download</div><div class="big">' + t.down + '<small>Mbps</small></div></div>' +
            '<div class="gauge"><div class="note">Upload</div><div class="big">' + t.up + '<small>Mbps</small></div></div>' +
            '<div class="gauge"><div class="note">Idle / loaded latency</div><div class="big">' + t.idle + '<small>/ ' + t.loaded + ' ms</small></div></div>' +
            '<div class="gauge"><div class="note">Bufferbloat</div><div class="big">' + grade(t) + '</div></div>' +
          '</div>', { sub: 'Measured ' + fmtAge(Date.now() - t.at) + ' by office-pc. A single test is an estimate.' }) +
          D.card('In use right now', '<div class="gauge"><div class="big" data-util>' + utilHtml() + '</div><div class="note">Down / up across the whole network, read from the router\'s byte counters every 10 s. Uses no internet data.</div></div>') +
        '</div>' +
        '<div class="grid two">' +
          D.card('History', D.table({ columns: [
            { label: 'When', render: function (x) { return esc(fmtWhen(x.at)); } },
            { label: 'Down', num: true, render: function (x) { return x.down + ' Mbps'; } },
            { label: 'Up', num: true, render: function (x) { return x.up + ' Mbps'; } },
            { label: 'Loaded latency', num: true, render: function (x) { return x.loaded + ' ms'; } },
            { label: 'Grade', render: function (x) { var g = grade(x); return badge(g, g === 'A' ? 'ok' : g === 'B' ? 'info' : 'warn'); } },
            { label: 'Data', num: true, render: function (x) { return x.mb + ' MB'; } }
          ], rows: speedTests }), { flush: true }) +
          D.card('Bandwidth policy · Home', D.kv([
            ['Speed tests', 'On, when you press the button'], ['Automatic interval', 'None'], ['Depth', 'Quick sample (≤ 250 MB)'],
            ['Monthly budget', used.toFixed(1) + ' of ' + budget.gb + ' GB used<div class="meter" style="margin-top:6px"><i style="width:' + Math.min(100, used / budget.gb * 100).toFixed(1) + '%"></i></div>', true],
            ['On this machine', 'Allowed. Set NETWORK_MONITOR_SPEED_TEST="false" on a metered agent.']
          ]), { sub: 'The server can ask for a bounded test; the agent decides and clamps it' }) +
        '</div>',
      after: function () { var el = document.getElementById('speed-live'); if (el && speedRun) el.innerHTML = speedLiveHtml(); }
    };
  }

  // ---- monitors ----------------------------------------------------------------------
  function monitorsView() {
    return {
      title: 'Monitors', crumbs: 'Every 30 s · 5 s timeout · 3 failures open an incident · 2 successes close it',
      actions: '<button class="btn sm" data-add-mon>' + D.icon('plus') + 'Add a monitor</button>',
      html: D.card('Monitors', D.table({ columns: [
          { label: 'Monitor', render: function (m) { return '<b>' + esc(m.name) + '</b><div class="note mono">' + esc(m.target) + '</div>'; } },
          { label: 'Type', render: function (m) { return badge(m.type, 'info'); } },
          { label: 'Diagnostic role', render: function (m) { return esc(ROLE[m.role]); } },
          { label: 'Agent', render: function (m) { return esc(agentById[m.agent].name); } },
          { label: 'Status', render: monBadge },
          { label: 'Recent checks', render: function (m) { return '<div class="strip" title="Last ' + m.recent.length + ' checks, oldest first">' + m.recent.map(function (ok) { return '<i class="' + (!m.enabled ? 'off' : ok ? '' : 'bad') + '"></i>'; }).join('') + '</div>'; } },
          { label: 'Last check', render: function (m) { return m.enabled ? '<span data-age="' + m.lastAt + '">' + fmtAge(Date.now() - m.lastAt) + '</span><div class="note">' + (m.lastMs != null ? m.lastMs + ' ms' : '') + '</div>' : '—'; } },
          { label: '', render: function (m) { return m.enabled ? '<button class="btn sm" data-pause="' + m.id + '">Pause</button>' : '<button class="btn sm" data-resume="' + m.id + '">Resume</button>'; } }
        ], rows: monitors }), { flush: true, sub: 'The diagnostic role, not the check type, is what the diagnosis reasons about' }) +
        D.card('Removing a monitor', '<p class="explain">Removing a monitor deletes its checks, incidents and brief interruptions, but never an outage. Each outage it took part in is recomputed from the evidence that survives; one left with no evidence is dismissed, so it stays numbered and traceable but stops counting. Pause instead to keep the history.</p>')
    };
  }

  // ---- agents ------------------------------------------------------------------------
  var enrollment = null, shownToken = null;
  function agentsView() {
    var slot = '';
    if (enrollment) slot = '<div class="alert ok">' + D.icon('check') + '<div class="txt"><b>One-time enrollment code: <span class="mono">' + enrollment.code + '</span></b> · expires in <span data-countdown="' + enrollment.expires + '">15:00</span>. Single use, bound to Home, and stored on the server only as a keyed digest.' +
      '<pre class="code" style="margin-top:10px;color:var(--text)">NETWORK_MONITOR_SERVER_URL="https://monitor.example.net"\nNETWORK_MONITOR_AGENT_NAME="living-room-mini"\nNETWORK_MONITOR_ENROLLMENT_CODE="' + enrollment.code + '"</pre></div></div>';
    return {
      title: 'Agents', crumbs: 'Outbound-only: the server never connects into this network',
      actions: '<button class="btn primary sm" data-enroll>' + D.icon('plus') + 'Generate enrollment code</button>',
      html: slot + '<div class="grid halves">' + agents.map(function (a) {
        var assigned = monitors.filter(function (m) { return m.agent === a.id; }).map(function (m) { return m.name; });
        return D.card(a.name, (shownToken && shownToken.agent === a.id ? '<div class="alert ok" style="margin-bottom:12px">' + D.icon('check') + '<div class="txt"><b>New token, shown once.</b> The old one stopped working immediately.<div class="mono" style="margin-top:6px;word-break:break-all">' + shownToken.token + '</div></div></div>' : '') +
          D.kv([
            ['Status', '<span data-hb-badge="' + a.id + '">' + agentBadge(a) + '</span>', true],
            ['Last heartbeat', '<span data-hb="' + a.id + '">' + fmtAge(agentState(a).age) + '</span>', true],
            ['Reporting without a gap', 'for ' + fmtDur(Date.now() - CUT.end)],
            ['Hostname', a.host], ['Operating system', a.os + ' · ' + a.runAs], ['Agent version', a.version],
            ['Process started', fmtWhen(a.started)], ['Clock drift', a.drift], ['Queued uploads', '0'],
            ['Monitors', assigned.join(', ') || 'none'], ['Token', '<span class="mono">' + esc(a.token) + '••••••••</span> (only a keyed digest is stored)', true]
          ]), { sub: 'Enrolled ' + fmtWhen(a.enrolled), actions: '<div style="display:flex;gap:6px"><button class="btn sm" data-rotate="' + a.id + '">Rotate token</button>' + (a.revoked ? '' : '<button class="btn sm danger" data-revoke="' + a.id + '">Revoke</button>') + '</div>' });
      }).join('') + '</div>' +
      D.card('What the states mean', D.kv([
        ['Online', 'A heartbeat arrived within the last 60 seconds.'],
        ['Stale', 'The last heartbeat is 60 seconds to 2 minutes old.'],
        ['Unknown', 'No heartbeat for over 2 minutes. That time is recorded as unknown, never as an outage, because silence alone doesn\'t prove the network is down.'],
        ['Revoked', 'The token is rejected. Rotating issues a new one and is the only way back in.']
      ]))
    };
  }

  // ---- interactions ------------------------------------------------------------------
  document.addEventListener('click', function (e) {
    var el;
    if ((el = e.target.closest('[data-sim]'))) { startSim(el.dataset.sim); return; }
    if (e.target.closest('[data-sim-jump]')) { jumpToSim = true; if ((location.hash.replace(/^#\/?/, '') || 'overview') === 'overview') D.render(); else D.go('overview'); return; }
    if ((el = e.target.closest('[data-period]'))) { period = el.dataset.period; refresh(); return; }
    if ((el = e.target.closest('[data-out-f]'))) { outFilter = el.dataset.outF; D.render(); return; }
    if ((el = e.target.closest('[data-chart]'))) { chartMode = el.dataset.chart; refresh(); return; }
    if ((el = e.target.closest('[data-dismiss]'))) {
      var od = outages.find(function (o) { return o.id === el.dataset.dismiss; });
      od.status = 'DISMISSED'; od.dismissedAt = Date.now();
      D.toast('Outage #' + od.num + ' dismissed. It keeps its number but no longer counts.'); D.action('outage_dismiss'); D.render(); return;
    }
    if ((el = e.target.closest('[data-restore]'))) {
      var orr = outages.find(function (o) { return o.id === el.dataset.restore; });
      orr.status = 'RESOLVED'; delete orr.dismissedAt; D.toast('Outage #' + orr.num + ' counts again.'); D.render(); return;
    }
    if (e.target.closest('[data-speed]')) { runSpeed(); return; }
    if ((el = e.target.closest('[data-pause]'))) { var mp = monById[el.dataset.pause]; mp.enabled = false; mp.status = 'PAUSED'; D.toast(mp.name + ' paused. No new checks are scheduled; its history stays.'); D.action('monitor_pause'); refresh(); return; }
    if ((el = e.target.closest('[data-resume]'))) { var mr = monById[el.dataset.resume]; mr.enabled = true; mr.status = 'PENDING'; D.toast(mr.name + ' resumed. It waits for its first check.'); D.action('monitor_resume'); refresh(); setTimeout(function () { if (mr.enabled && mr.status === 'PENDING') { mr.status = 'ONLINE'; mr.lastAt = Date.now(); refresh(); } }, 2500); return; }
    if (e.target.closest('[data-enroll]')) { enrollment = { code: randomCode(4) + '-' + randomCode(4) + '-' + randomCode(4), expires: Date.now() + 15 * MIN }; D.action('enroll_code'); refresh(); return; }
    if ((el = e.target.closest('[data-rotate]'))) {
      var ar = agentById[el.dataset.rotate], tok = 'nma_' + randomCode(32);
      ar.token = tok.slice(0, 7); ar.revoked = false; ar.hb = Date.now();
      shownToken = { agent: ar.id, token: tok }; D.action('token_rotate'); refresh(); return;
    }
    if ((el = e.target.closest('[data-revoke]'))) {
      var av = agentById[el.dataset.revoke]; av.revoked = true; if (shownToken && shownToken.agent === av.id) shownToken = null;
      D.toast(av.name + ' revoked. Its requests now get 401; rotate the token to re-enable it.'); D.action('token_revoke'); refresh(); return;
    }
    if (e.target.closest('[data-add-mon]')) { D.toast('Adding monitors is available in the full app. Try pausing one here.'); }
  });

  D.init({
    id: 'netmon', name: 'Network Monitor', icon: 'network', defaultView: 'overview', navLabel: 'Home network',
    goals: ['simulate_isp', 'simulate_router', 'simulate_dns', 'simulate_site', 'simulate_blip'],
    user: { name: 'Dylan Kayyem', initials: 'DK', org: 'Administrator · Home' },
    login: { heading: 'Sign in to Network Monitor', sub: 'Counts real outages and explains likely causes in plain language.', email: 'admin@home.example', foot: 'The real app is self-hosted, with one administrator account and a local agent on each network.' },
    nav: [
      { id: 'overview', label: 'Overview', icon: 'home' },
      { id: 'outages', label: 'Outages', icon: 'alert' },
      { id: 'analytics', label: 'Analytics', icon: 'chart' },
      { id: 'speed', label: 'Speed', icon: 'gauge' },
      { id: 'monitors', label: 'Monitors', icon: 'monitor' },
      { id: 'agents', label: 'Agents', icon: 'agent' }
    ],
    counts: function () { return { outages: activeOutage() ? 1 : 0 }; },
    views: { overview: overview, outages: outagesView, analytics: analyticsView, speed: speedView, monitors: monitorsView, agents: agentsView }
  });
})();
