// Projections and News pages. Public Sleeper endpoints plus ESPN's public NFL RSS headlines. Read-only.
(function () {
  const L = window.LEAGUE;
  const S = window.SCARIES;
  if (!L || !S || !S.load) return;
  const LID = L.sleeper.leagueId;
  const $ = (id) => document.getElementById(id);
  const roots = { proj: $('proj-live'), trend: $('news-trending'), inj: $('news-injuries'), rss: $('news-headlines') };
  if (!Object.values(roots).some(Boolean)) return;
  const get = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.json(); });
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f2 = (n) => Number(n || 0).toFixed(2);
  const fail = (el, msg) => { if (el) el.innerHTML = '<p class="note">' + (msg || 'Sleeper did not load. Try again in a minute.') + '</p>'; };
  const POS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  const projUrl = (wk) => 'https://api.sleeper.app/projections/nfl/' + L.season + '/' + wk + '?season_type=regular&' + POS.map((p) => 'position[]=' + p).join('&');
  const pname = (p, pid) => {
    const x = (p && p.player) || {};
    if (x.position === 'DEF' || (!x.first_name && p && p.team)) return (x.first_name ? x.first_name + ' ' + (x.last_name || '') : pid + ' DEF').trim();
    return ((x.first_name || '') + ' ' + (x.last_name || '')).trim() || pid;
  };

  Promise.all([S.load(), S.week()]).then(async ([data, week]) => {
    const name = (rid) => data.mgr(rid).name;
    const rosterOf = {};
    data.rosters.forEach((r) => (r.players || []).concat(r.reserve || []).forEach((pid) => { rosterOf[pid] = r.roster_id; }));

    // ---------- Projections ----------
    let projList = null;
    const loadProj = () => projList || (projList = get(projUrl(week)));
    if (roots.proj) {
      try {
        const [league, rows, proj] = await Promise.all([
          get('https://api.sleeper.app/v1/league/' + LID),
          get('https://api.sleeper.app/v1/league/' + LID + '/matchups/' + week),
          loadProj()
        ]);
        const sc = league.scoring_settings || {};
        const by = {};
        proj.forEach((p) => { by[p.player_id] = p; });
        // League scoring applied to Sleeper's projected stat line (same math Sleeper uses for actual points).
        const projPts = (pid) => {
          const st = (by[pid] && by[pid].stats) || null;
          if (!st) return null;
          let t = 0;
          Object.keys(st).forEach((k) => { if (typeof st[k] === 'number' && sc[k]) t += st[k] * sc[k]; });
          return Math.round(t * 100) / 100;
        };
        const pairs = S.pairWeek(rows).filter((p) => p.length === 2);
        if (!pairs.length) { fail(roots.proj, 'No Week ' + week + ' pairings posted yet.'); }
        else {
          const side = (m) => {
            const starters = (m.starters || []).filter((pid) => pid && pid !== '0');
            const lines = starters.map((pid) => {
              const p = by[pid];
              const pos = (p && p.player && p.player.position) || data.label(pid).pos || '';
              const nm = p ? pname(p, pid) : data.label(pid).name;
              const inj = p && p.player && p.player.injury_status;
              return { pid, pos, nm, inj, proj: projPts(pid), act: (m.players_points || {})[pid] };
            });
            const empty = (m.starters || []).filter((pid) => !pid || pid === '0').length;
            const total = lines.reduce((a, x) => a + (x.proj || 0), 0);
            return { rid: m.roster_id, lines, total, empty, live: m.points || 0 };
          };
          const out = pairs.map((p) => {
            const a = side(p[0]), b = side(p[1]);
            const [w, l] = a.total >= b.total ? [a, b] : [b, a];
            return { a, b, w, l, margin: w.total - l.total };
          });
          const table = (s) => '<dl>' + s.lines.map((x) => '<div class="row"><dt>' + esc(x.pos) + ' · ' + esc(x.nm) + (x.inj ? ' <strong style="color:#a33">' + esc(x.inj === 'Questionable' ? 'Q' : x.inj) + '</strong>' : '') + '</dt><dd>' + (x.proj == null ? 'no proj' : f2(x.proj)) + (x.act ? ' · ' + f2(x.act) + ' live' : '') + '</dd></div>').join('') +
            (s.empty ? '<div class="row"><dt>Empty starter slot' + (s.empty > 1 ? 's' : '') + '</dt><dd>' + s.empty + '</dd></div>' : '') +
            '<div class="row"><dt><strong>Projected total</strong></dt><dd>' + f2(s.total) + (s.live ? ' · ' + f2(s.live) + ' live' : '') + '</dd></div></dl>';
          roots.proj.innerHTML = out.map((g) =>
            '<aside class="board" style="margin-top:18px"><h2>' + esc(name(g.a.rid)) + ' ' + f2(g.a.total) + ' vs ' + esc(name(g.b.rid)) + ' ' + f2(g.b.total) + '</h2>' +
            '<p><strong>Projected winner: ' + esc(name(g.w.rid)) + ' by ' + f2(g.margin) + '.</strong></p>' +
            '<div class="managers" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))"><article><h3>' + esc(name(g.a.rid)) + '</h3>' + table(g.a) + '</article><article><h3>' + esc(name(g.b.rid)) + '</h3>' + table(g.b) + '</article></div></aside>'
          ).join('');
        }
      } catch (e) { fail(roots.proj, 'Sleeper projections did not load. Try again in a minute.'); }
    }

    // ---------- News ----------
    const liteDoc = (roots.trend || roots.inj) ? await fetch('data/players-lite.json?v=' + (L.cacheVersion || 1)).then((r) => (r.ok ? r.json() : null)).catch(() => null) : null;
    const lite = (liteDoc && liteDoc.players) || {};
    let projBy = null;
    const needInfo = roots.trend || roots.inj;
    if (needInfo) {
      try { const pl = await loadProj(); projBy = {}; pl.forEach((p) => { projBy[p.player_id] = p; }); } catch (e) { projBy = null; }
    }
    const info = (pid) => {
      const p = projBy && projBy[pid];
      if (p && p.player) return { n: pname(p, pid), pos: p.player.position || '', team: p.team || p.player.team || '', inj: p.player.injury_status || '' };
      const x = lite[pid];
      if (x) return { n: x.n, pos: x.pos, team: x.team, inj: x.inj };
      return { n: data.label(pid).name, pos: data.label(pid).pos || '', team: '', inj: '' };
    };
    const owner = (pid) => (rosterOf[pid] ? name(rosterOf[pid]) : 'Free agent');

    if (roots.trend) {
      try {
        const [adds, drops] = await Promise.all([
          get('https://api.sleeper.app/v1/players/nfl/trending/add?lookback_hours=24&limit=25'),
          get('https://api.sleeper.app/v1/players/nfl/trending/drop?lookback_hours=24&limit=25')
        ]);
        const list = (arr, verb) => '<aside class="board" style="margin-top:18px"><h2>Most ' + verb + ', last 24 hours</h2><dl>' + arr.map((t) => {
          const i = info(t.player_id);
          return '<div class="row"><dt>' + esc(i.n) + (i.pos ? ' · ' + esc(i.pos) : '') + (i.team ? ' · ' + esc(i.team) : '') + '</dt><dd>' + esc(owner(t.player_id)) + ' · ' + Number(t.count).toLocaleString('en-US') + '</dd></div>';
        }).join('') + '</dl></aside>';
        const mine = adds.filter((t) => !rosterOf[t.player_id]).slice(0, 5).map((t) => esc(info(t.player_id).n));
        roots.trend.innerHTML = list(adds, 'added') + (mine.length ? '<p class="note">Still free in this league: ' + mine.join(', ') + '.</p>' : '') + list(drops, 'dropped') +
          '<p class="note">Counts are across all Sleeper leagues. The right column shows who has the player here.</p>';
      } catch (e) { fail(roots.trend); }
    }

    if (roots.inj) {
      const ids = Object.keys(rosterOf);
      const rows = ids.map((pid) => {
        const now = info(pid).inj || '';
        const was = (lite[pid] && lite[pid].inj) || '';
        return { pid, now, was, i: info(pid) };
      });
      const changed = rows.filter((r) => projBy && r.now !== r.was);
      const hurt = rows.filter((r) => r.now).sort((a, b) => owner(a.pid).localeCompare(owner(b.pid)));
      const stamp = String((liteDoc && liteDoc.updated) || '').replace('T', ' ').replace('Z', ' UTC');
      roots.inj.innerHTML =
        '<aside class="board"><h2>Changed since ' + esc(stamp || 'last snapshot') + '</h2><dl>' +
        (changed.length ? changed.map((r) => '<div class="row"><dt>' + esc(r.i.n) + ' · ' + esc(owner(r.pid)) + '</dt><dd>' + esc(r.was || 'Healthy') + ' → ' + esc(r.now || 'Healthy') + '</dd></div>').join('') : '<div class="row"><dt>No changes</dt><dd></dd></div>') +
        '</dl></aside>' +
        '<aside class="board" style="margin-top:18px"><h2>Injury report, rostered players</h2><dl>' +
        (hurt.length ? hurt.map((r) => '<div class="row"><dt>' + esc(r.i.n) + (r.i.pos ? ' · ' + esc(r.i.pos) : '') + '</dt><dd>' + esc(r.now === 'NA' ? 'NA (not active)' : r.now) + ' · ' + esc(owner(r.pid)) + '</dd></div>').join('') : '<div class="row"><dt>Nobody listed</dt><dd></dd></div>') +
        '</dl></aside><p class="note">' + (projBy ? 'Current status from Sleeper.' : 'Sleeper did not load, so this is the snapshot only.') + '</p>';
    }
  }).catch(() => Object.values(roots).forEach((el) => fail(el)));

  if (roots.rss) {
    fetch('https://www.espn.com/espn/rss/nfl/news').then((r) => { if (!r.ok) throw new Error('rss'); return r.text(); }).then((xml) => {
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const items = Array.from(doc.querySelectorAll('item')).slice(0, 12).map((it) => ({
        t: (it.querySelector('title') || {}).textContent || '',
        u: (it.querySelector('link') || {}).textContent || '',
        d: (it.querySelector('pubDate') || {}).textContent || ''
      })).filter((x) => x.t && /^https:\/\//.test(x.u));
      if (!items.length) throw new Error('empty');
      roots.rss.innerHTML = '<aside class="board"><dl>' + items.map((x) => '<div class="row"><dt><a href="' + esc(x.u) + '" target="_blank" rel="noopener">' + esc(x.t) + '</a></dt><dd>' + esc(x.d ? new Date(x.d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Chicago' }) : '') + '</dd></div>').join('') + '</dl></aside><p class="note">Headlines and links from ESPN\'s public NFL feed.</p>';
    }).catch(() => fail(roots.rss, 'Headlines did not load.'));
  }
})();
