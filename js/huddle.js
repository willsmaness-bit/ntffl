// Live league pages: Tape, SOS, Playoffs, Toilet Bowl, Waivers.
// Everything here is computed in the browser from the public Sleeper API, read-only.
(function () {
  const L = window.LEAGUE;
  const S = window.SCARIES;
  if (!L || !S || !S.load) return;
  const api = 'https://api.sleeper.app/v1';
  const LID = L.sleeper.leagueId;
  const get = (p) => fetch(api + p).then((r) => { if (!r.ok) throw new Error(p); return r.json(); });
  const $ = (id) => document.getElementById(id);
  const roots = {
    tapeStand: $('tape-standings'), tapeWeek: $('tape-lastweek'), allplay: $('tape-allplay'), left: $('tape-left'),
    low: $('tape-low'), faab: $('tape-faab'), ir: $('tape-ir'), inj: $('tape-injured'),
    sosOpp: $('sos-opp'), sosOwn: $('sos-own'),
    seeds: $('po-seeds'), race: $('po-race'), poByes: $('po-byes'),
    toilet: $('tb-seeds'), tbByes: $('tb-byes'),
    wvFaab: $('wv-faab'), wvTx: $('wv-tx'), wvIr: $('wv-ir')
  };
  if (!Object.values(roots).some(Boolean)) return;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f2 = (n) => Number(n || 0).toFixed(2);
  const pts = (s, k) => (s[k] || 0) + (s[k + '_decimal'] || 0) / 100;
  const board = (title, rows, note) => '<aside class="board">' + (title ? '<h2>' + title + '</h2>' : '') + '<dl>' +
    rows.map(([a, b]) => '<div class="row"><dt>' + a + '</dt><dd>' + b + '</dd></div>').join('') + '</dl></aside>' + (note ? '<p class="note">' + note + '</p>' : '');
  const budget = (L.format && L.format.faab) || 100;
  const lastReg = (L.format && L.format.regularSeasonThrough) || 15;

  const lite = fetch('data/players-lite.json?v=' + (L.cacheVersion || 1)).then((r) => (r.ok ? r.json() : null)).catch(() => null);

  Promise.all([S.load(), S.week(), lite]).then(async ([data, week, liteDoc]) => {
    const P = (liteDoc && liteDoc.players) || {};
    // Players added after the players-lite snapshot: fill name and NFL team from Supabase player_teams (read-only).
    const missing = Array.from(new Set(data.rosters.flatMap((r) => (r.players || []).concat(r.reserve || [])))).filter((pid) => !P[pid]);
    if (missing.length && window.SB) {
      try {
        const rows = await window.SB.select('player_teams', 'select=player_id,player_name,position,nfl_team&platform=eq.sleeper&player_id=' + window.SB.inList(missing));
        rows.forEach((r) => { P[r.player_id] = { n: r.player_name || r.player_id, pos: r.position || '', team: r.nfl_team || '', inj: '' }; });
      } catch (e) { /* keep ids */ }
    }
    const byes = L.byes || {};
    const name = (pid) => {
      const d = data.label(pid);
      if (d.name && d.name !== pid) return d.name;
      return (P[pid] && P[pid].n) || pid;
    };
    const price = (pid) => data.label(pid).amount || 0;
    const teamOf = (pid) => (P[pid] && P[pid].team) || (byes[pid] ? pid : '');
    const mgrName = (rid) => data.mgr(rid).name;
    const rosterBy = Object.fromEntries(data.rosters.map((r) => [r.roster_id, r]));
    const sorted = data.rosters.slice().sort((a, b) => ((b.settings.wins || 0) - (a.settings.wins || 0)) || (pts(b.settings, 'fpts') - pts(a.settings, 'fpts')));
    const rec = (r) => (r.settings.wins || 0) + '-' + (r.settings.losses || 0) + (r.settings.ties ? '-' + r.settings.ties : '');

    // Remaining regular-season pairings from Sleeper (current week through lastReg).
    const futureWeeks = [];
    for (let w = week; w <= lastReg; w++) futureWeeks.push(w);
    const needFuture = roots.sosOpp || roots.sosOwn || roots.race || roots.poByes || roots.tbByes;
    const future = needFuture ? await Promise.all(futureWeeks.map((w) => get('/league/' + LID + '/matchups/' + w).then((rows) => ({ w, pairs: S.pairWeek(rows).filter((p) => p.length === 2) })).catch(() => ({ w, pairs: [] })))) : [];
    const oppOf = (w, rid) => {
      const f = future.find((x) => x.w === w);
      const p = f && f.pairs.find((pr) => pr.some((x) => x.roster_id === rid));
      return p ? p.find((x) => x.roster_id !== rid).roster_id : null;
    };
    // Bye hole for a roster in an NFL week: current roster players whose team is off.
    const hole = (rid, w) => {
      const r = rosterBy[rid] || {};
      const ps = (r.players || []).filter((pid) => byes[teamOf(pid)] === w);
      return { ps, dollars: ps.reduce((a, pid) => a + price(pid), 0) };
    };
    const holeText = (h) => h.ps.length + ' player' + (h.ps.length === 1 ? '' : 's') + ' · $' + h.dollars + ' · ' + h.ps.slice().sort((a, b) => price(b) - price(a)).map((pid) => esc(name(pid)) + (price(pid) ? ' $' + price(pid) : '')).join(', ');
    const byeRows = (rids) => {
      const out = [];
      future.forEach(({ w }) => rids.forEach((rid) => {
        const h = hole(rid, w);
        if (h.ps.length) out.push({ w, rid, h, opp: oppOf(w, rid) });
      }));
      return out.sort((a, b) => (b.h.dollars - a.h.dollars) || (b.h.ps.length - a.h.ps.length));
    };

    // ---- Tape ----
    if (roots.tapeStand) roots.tapeStand.innerHTML = board('', sorted.map((r, i) => [(i + 1) + '. ' + esc(mgrName(r.roster_id)), rec(r) + ' · ' + f2(pts(r.settings, 'fpts')) + ' PF']));
    if (roots.faab || roots.wvFaab) {
      const rows = data.rosters.slice().sort((a, b) => (budget - (a.settings.waiver_budget_used || 0)) - (budget - (b.settings.waiver_budget_used || 0))).reverse()
        .map((r) => [esc(mgrName(r.roster_id)), '$' + (r.settings.waiver_budget_used || 0) + ' used · $' + (budget - (r.settings.waiver_budget_used || 0)) + ' left']);
      const html = board('', rows, 'Live from Sleeper. $' + budget + ' FAAB for the season.');
      if (roots.faab) roots.faab.innerHTML = html;
      if (roots.wvFaab) roots.wvFaab.innerHTML = html;
    }
    if (roots.ir || roots.wvIr) {
      const rows = data.rosters.map((r) => [esc(mgrName(r.roster_id)), (r.reserve || []).length ? (r.reserve || []).map((pid) => esc(name(pid)) + (price(pid) ? ' $' + price(pid) : '') + (P[pid] && P[pid].inj ? ' (' + esc(P[pid].inj) + ')' : '')).join(', ') : 'Empty']);
      const html = board('', rows, 'The Sleeper IR slot, live. One per team.');
      if (roots.ir) roots.ir.innerHTML = html;
      if (roots.wvIr) roots.wvIr.innerHTML = html;
    }
    if (roots.inj) {
      const rows = data.rosters.map((r) => {
        const out = (r.players || []).filter((pid) => P[pid] && /^(Out|IR|PUP|Sus|Doubtful)/i.test(P[pid].inj || ''));
        const $out = out.reduce((a, pid) => a + price(pid), 0);
        return { r, out, $out };
      }).sort((a, b) => b.$out - a.$out).map((x) => [esc(mgrName(x.r.roster_id)), '$' + x.$out + (x.out.length ? ' · ' + x.out.map((pid) => esc(name(pid)) + ' ' + esc(P[pid].inj) + (price(pid) ? ' $' + price(pid) : '')).join(', ') : '')]);
      roots.inj.innerHTML = board('', rows, 'Out, IR, Doubtful or suspended players on current rosters. Dollars are auction price; adds count $0. Injury tags as of ' + esc(String((liteDoc && liteDoc.updated) || 'unknown').replace('T', ' ').replace('Z', ' UTC')) + '.');
    }
    if (roots.left) {
      const rows = data.rosters.map((r) => ({ r, act: pts(r.settings, 'fpts'), pot: pts(r.settings, 'ppts') }))
        .sort((a, b) => (b.pot - b.act) - (a.pot - a.act)).map((x) => [esc(mgrName(x.r.roster_id)), f2(x.pot - x.act) + ' left · ' + f2(x.act) + ' of ' + f2(x.pot)]);
      roots.left.innerHTML = board('', rows, 'Sleeper max points minus actual, season to date. Lineup misses only.');
    }
    if (roots.tapeWeek || roots.allplay || roots.low) {
      S.finals().then((weeks) => {
        if (!weeks.length) return;
        const last = weeks[weeks.length - 1];
        if (roots.tapeWeek) {
          roots.tapeWeek.innerHTML = '<h2>Week ' + last.wk + ' results</h2>' + board('', last.games.map((g) => [esc(mgrName(g.w.roster_id)) + ' ' + f2(g.w.points), esc(mgrName(g.l.roster_id)) + ' ' + f2(g.l.points)]));
        }
        if (roots.low) {
          const rows = weeks.map((x) => { const lo = x.scores.slice().sort((a, b) => a.pts - b.pts)[0]; return ['Week ' + x.wk, esc(mgrName(lo.roster_id)) + ' · ' + f2(lo.pts)]; });
          const count = {};
          weeks.forEach((x) => { const lo = x.scores.slice().sort((a, b) => a.pts - b.pts)[0]; count[lo.roster_id] = (count[lo.roster_id] || 0) + 1; });
          const tally = Object.entries(count).sort((a, b) => b[1] - a[1]).map(([rid, n]) => esc(mgrName(Number(rid))) + ' ' + n).join(', ');
          roots.low.innerHTML = board('', rows, 'Lowest score each final week shotguns a beer. Tally: ' + tally + '.');
        }
        if (roots.allplay) {
          const ap = {};
          weeks.forEach((x) => x.scores.forEach((s) => {
            const a = ap[s.roster_id] = ap[s.roster_id] || { w: 0, l: 0, t: 0 };
            x.scores.forEach((o) => { if (o.roster_id === s.roster_id) return; if (s.pts > o.pts) a.w++; else if (s.pts < o.pts) a.l++; else a.t++; });
          }));
          const rows = Object.entries(ap).sort((a, b) => (b[1].w - a[1].w)).map(([rid, a]) => {
            const r = rosterBy[rid];
            return [esc(mgrName(Number(rid))), a.w + '-' + a.l + (a.t ? '-' + a.t : '') + ' all-play · ' + rec(r) + ' real'];
          });
          roots.allplay.innerHTML = board('', rows, 'Every team against every other team each week, weeks 1 to ' + last.wk + '.');
        }
      }).catch(() => {});
    }

    // ---- SOS ----
    if (roots.sosOpp) {
      const tot = data.rosters.map((r) => {
        let d = 0, n = 0;
        future.forEach(({ w }) => { const o = oppOf(w, r.roster_id); if (o) { const h = hole(o, w); d += h.dollars; n += h.ps.length; } });
        return { r, d, n };
      }).sort((a, b) => (b.d - a.d) || (b.n - a.n));
      roots.sosOpp.innerHTML = board('', tot.map((x) => [esc(mgrName(x.r.roster_id)), '$' + x.d + ' · ' + x.n + ' players']),
        'Weeks ' + week + ' to ' + lastReg + '. Auction dollars (and bodies) your opponents lose to NFL byes, from current rosters.');
    }
    if (roots.sosOwn) {
      const rows = byeRows(data.rosters.map((r) => r.roster_id)).slice(0, 12)
        .map((x) => ['W' + x.w + ' ' + esc(mgrName(x.rid)) + (x.opp ? ' vs ' + esc(mgrName(x.opp)) : ''), holeText(x.h)]);
      roots.sosOwn.innerHTML = rows.length ? board('', rows) : '<p class="note">No bye holes left.</p>';
    }

    // ---- Playoffs / Toilet ----
    const n4 = sorted[3];
    const gb = (r) => {
      const d = ((n4.settings.wins || 0) - (r.settings.wins || 0)) + ((r.settings.losses || 0) - (n4.settings.losses || 0));
      return d / 2;
    };
    const left = Math.max(0, lastReg - week + 1);
    if (roots.seeds) {
      roots.seeds.innerHTML = board('If the season ended today', sorted.slice(0, 4).map((r, i) => ['#' + (i + 1) + ' ' + esc(mgrName(r.roster_id)), rec(r) + ' · ' + f2(pts(r.settings, 'fpts')) + ' PF']),
        'Week 16: #1 vs #4, #2 vs #3. Winners meet Week 17.');
    }
    if (roots.race) {
      const rows = sorted.map((r, i) => {
        const g = i < 4 ? (i === 3 ? '4th' : 'in') : (gb(r) ? gb(r) + ' GB' : 'tied, PF ' + f2(pts(n4.settings, 'fpts') - pts(r.settings, 'fpts')) + ' back');
        const opps = futureWeeks.map((w) => oppOf(w, r.roster_id)).filter(Boolean).map((o) => esc(mgrName(o).split(' ')[0])).join(', ');
        return [(i + 1) + '. ' + esc(mgrName(r.roster_id)) + ' · ' + rec(r), g + ' · ' + f2(pts(r.settings, 'fpts')) + ' PF' + (opps ? ' · left: ' + opps : '')];
      });
      roots.race.innerHTML = board('', rows, left + ' regular-season week' + (left === 1 ? '' : 's') + ' left, counting Week ' + week + '. GB is games behind the 4th seed. Points for breaks ties.');
    }
    if (roots.toilet) {
      const b = sorted.slice(4);
      roots.toilet.innerHTML = board('If the season ended today', b.map((r, i) => ['#' + (i + 5) + ' ' + esc(mgrName(r.roster_id)), rec(r) + ' · ' + f2(pts(r.settings, 'fpts')) + ' PF']),
        b.length === 4 ? 'Week 16: ' + esc(mgrName(b[0].roster_id)) + ' vs ' + esc(mgrName(b[3].roster_id)) + ', ' + esc(mgrName(b[1].roster_id)) + ' vs ' + esc(mgrName(b[2].roster_id)) + '. The two losers play Week 17.' : '');
    }
    const byeBoard = (rids, el) => {
      const rows = byeRows(rids).slice(0, 8).map((x) => ['W' + x.w + ' ' + esc(mgrName(x.rid)) + (x.opp ? ' vs ' + esc(mgrName(x.opp)) : ''), holeText(x.h)]);
      el.innerHTML = rows.length ? board('', rows, 'Current rosters. Biggest holes first.') : '<p class="note">No bye holes left.</p>';
    };
    if (roots.poByes) byeBoard(sorted.slice(0, 6).map((r) => r.roster_id), roots.poByes);
    if (roots.tbByes) byeBoard(sorted.slice(3).map((r) => r.roster_id), roots.tbByes);

    // ---- Waivers ----
    if (roots.wvTx) {
      const wks = [];
      for (let w = week; w >= Math.max(1, week - 2); w--) wks.push(w);
      const txs = (await Promise.all(wks.map((w) => get('/league/' + LID + '/transactions/' + w).catch(() => [])))).flat()
        .filter((t) => t.status === 'complete' && (t.type === 'waiver' || t.type === 'free_agent' || t.type === 'trade'))
        .sort((a, b) => (b.status_updated || b.created) - (a.status_updated || a.created));
      const unknown = new Set();
      txs.forEach((t) => Object.keys(Object.assign({}, t.adds, t.drops)).forEach((pid) => { if (name(pid) === pid && !byes[pid]) unknown.add(pid); }));
      const extra = {};
      if (unknown.size && window.SB) {
        try {
          const rows = await window.SB.select('player_teams', 'select=player_id,player_name&platform=eq.sleeper&player_id=' + window.SB.inList(Array.from(unknown)));
          rows.forEach((r) => { extra[r.player_id] = r.player_name; });
        } catch (e) { /* names stay as ids */ }
      }
      const nm = (pid) => extra[pid] || (byes[pid] ? pid + ' DEF' : name(pid));
      const when = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Chicago' });
      const rows = txs.slice(0, 40).map((t) => {
        const who = (t.roster_ids || []).map((rid) => esc(mgrName(rid))).join(' / ');
        const adds = Object.keys(t.adds || {}).map(nm).map(esc);
        const drops = Object.keys(t.drops || {}).map(nm).map(esc);
        const bid = t.type === 'waiver' ? ' · $' + ((t.settings && t.settings.waiver_bid) || 0) : '';
        const kind = t.type === 'waiver' ? 'Claim' : t.type === 'trade' ? 'Trade' : 'Free agent';
        return [when(t.status_updated || t.created) + ' · ' + who, kind + bid + (adds.length ? ' · +' + adds.join(', +') : '') + (drops.length ? ' · −' + drops.join(', −') : '')];
      });
      roots.wvTx.innerHTML = rows.length ? board('', rows, 'Completed moves, weeks ' + wks[wks.length - 1] + ' to ' + week + ', newest first. Failed claims are left out.') : '<p class="note">No completed moves in the last three weeks.</p>';
    }
  }).catch(() => {
    Object.values(roots).forEach((el) => { if (el) el.innerHTML = '<p class="note">Sleeper did not load. Open the league in the app.</p>'; });
  });
})();
