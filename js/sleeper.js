(function () {
  const L = window.LEAGUE;
  const api = 'https://api.sleeper.app/v1';
  const extra = {
    '11792': { name: 'Will Reichard', pos: 'K' },
    '9758': { name: 'C.J. Stroud', pos: 'QB' },
    '12533': { name: 'Jacory Croskey-Merritt', pos: 'RB' },
    JAX: { name: 'Jaguars', pos: 'DEF' },
    DEN: { name: 'Broncos', pos: 'DEF' },
    LAR: { name: 'Rams', pos: 'DEF' },
    DAL: { name: 'Cowboys', pos: 'DEF' },
    SEA: { name: 'Seahawks', pos: 'DEF' },
    HOU: { name: 'Texans', pos: 'DEF' }
  };
  const get = (path) => fetch(api + path).then((r) => {
    if (!r.ok) throw new Error(path);
    return r.json();
  });
  const nameOf = (u) => (L.handles && L.handles[u.display_name]) || u.display_name || 'Open chair';
  const teamOf = (u) => ((u.metadata || {}).team_name || '').trim();

  window.SCARIES = window.SCARIES || {};
  window.SCARIES.load = async function () {
    const [users, rosters, picks] = await Promise.all([
      get('/league/' + L.sleeper.leagueId + '/users'),
      get('/league/' + L.sleeper.leagueId + '/rosters'),
      get('/draft/' + L.sleeper.draftId + '/picks')
    ]);
    const byId = Object.fromEntries(users.map((u) => [u.user_id, u]));
    const prices = {};
    const meta = {};
    (picks || []).forEach((p) => {
      const md = p.metadata || {};
      const nm = ((md.first_name || '') + ' ' + (md.last_name || '')).trim();
      if (p.player_id) {
        meta[p.player_id] = { name: nm || p.player_id, pos: md.position || '', amount: Number(md.amount || 0) };
        prices[p.roster_id] = (prices[p.roster_id] || 0) + Number(md.amount || 0);
      }
    });
    const label = (pid) => {
      if (meta[pid] && meta[pid].name) return meta[pid];
      if (extra[pid]) return { name: extra[pid].name, pos: extra[pid].pos, amount: (meta[pid] || {}).amount || 0 };
      return { name: pid, pos: '', amount: 0 };
    };
    const mgr = (rosterId) => {
      const r = rosters.find((x) => x.roster_id === rosterId) || {};
      const u = byId[r.owner_id] || {};
      return { u, name: nameOf(u), team: teamOf(u), roster: r };
    };
    return { users, rosters, picks, byId, prices, label, nameOf, teamOf, mgr };
  };

  // Current NFL week from Sleeper. Falls back to the last week with posted matchups, then Week 1.
  window.SCARIES.week = function () {
    if (window.SCARIES._week) return window.SCARIES._week;
    window.SCARIES._week = get('/state/nfl').then((st) => {
      const w = Number(st.display_week || st.week);
      if (!w || w < 1) throw new Error('no week');
      return Math.min(w, (L.format && L.format.championshipWeek) || 17);
    }).catch(() => 1);
    return window.SCARIES._week;
  };
  window.SCARIES.week().then((w) => {
    document.querySelectorAll('[data-week-label]').forEach((el) => { el.textContent = 'Week ' + w; });
  });


  // Final weeks = every regular-season week before the current one.
  window.SCARIES.finals = function () {
    if (window.SCARIES._finals) return window.SCARIES._finals;
    window.SCARIES._finals = window.SCARIES.week().then((w) => {
      const last = Math.min(w - 1, (L.format && L.format.regularSeasonThrough) || 15);
      const weeks = Array.from({length: Math.max(0, last)}, (_, i) => i + 1);
      return Promise.all(weeks.map((wk) => get('/league/' + L.sleeper.leagueId + '/matchups/' + wk).then((rows) => ({ wk, rows })).catch(() => ({ wk, rows: [] }))));
    }).then((all) => all.filter((x) => x.rows && x.rows.length).map((x) => {
      const games = window.SCARIES.pairWeek(x.rows).filter((p) => p.length === 2).map((p) => {
        const [a, b] = p.slice().sort((m, n) => (n.points || 0) - (m.points || 0));
        return { w: a, l: b, margin: (a.points || 0) - (b.points || 0) };
      });
      const scores = x.rows.map((r) => ({ roster_id: r.roster_id, pts: r.points || 0 }));
      return { wk: x.wk, games, scores };
    }).filter((x) => x.scores.some((s) => s.pts > 0)));
    return window.SCARIES._finals;
  };

  window.SCARIES.pairWeek = function (rows) {
    const by = {};
    (rows || []).forEach((row) => {
      const id = row.matchup_id;
      if (!id) return;
      (by[id] = by[id] || []).push(row);
    });
    return Object.keys(by).sort((a,b)=>a-b).map((id) => by[id]);
  };

  const roots = {
    teams: document.getElementById('teams-live'),
    field: document.getElementById('field-live'),
    stand: document.getElementById('standings-live'),
    spend: document.getElementById('spend-live'),
    picks: document.getElementById('picks-live'),
    week: document.getElementById('week-live'),
    match: document.getElementById('matchups-live'),
    records: document.getElementById('records-live'),
    season: document.getElementById('season-records-live'),
    recap: document.getElementById('recap-live')
  };
  if (!Object.values(roots).some(Boolean)) return;

  const fail = (el) => { if (el) el.innerHTML = '<p class="note">Sleeper did not load. Open the league in the app.</p>'; };

  window.SCARIES.load().then(async (data) => {
    if (roots.field) {
      roots.field.innerHTML = data.rosters.map((r) => {
        const u = data.byId[r.owner_id] || {};
        const role = data.nameOf(u) === L.commissioner ? '<p class="note">Commissioner</p>' : data.nameOf(u) === L.viceCommissioner ? '<p class="note">Vice commissioner</p>' : '';
        return '<article><h3>' + data.nameOf(u) + '</h3>' + (data.teamOf(u) ? '<p class="note">' + data.teamOf(u) + '</p>' : '') + '<p class="note">$' + (data.prices[r.roster_id]||0) + ' spent</p>' + role + '</article>';
      }).join('');
    }
    if (roots.stand) {
      const rows = data.rosters.slice().sort((a,b) => ((b.settings||{}).wins||0)-((a.settings||{}).wins||0) || ((b.settings||{}).fpts||0)-((a.settings||{}).fpts||0));
      roots.stand.innerHTML = '<aside class="board"><dl>' + rows.map((r) => {
        const s = r.settings || {};
        return '<div class="row"><dt>' + data.mgr(r.roster_id).name + '</dt><dd>' + (s.wins||0) + '-' + (s.losses||0) + (s.ties ? '-' + s.ties : '') + ' · ' + ((s.fpts||0) + (s.fpts_decimal||0)/100).toFixed(1) + ' PF</dd></div>';
      }).join('') + '</dl></aside>';
    }
    if (roots.spend) {
      const rows = data.rosters.slice().sort((a,b) => (data.prices[b.roster_id]||0)-(data.prices[a.roster_id]||0));
      roots.spend.innerHTML = '<aside class="board"><h2>Auction spend</h2><dl>' + rows.map((r) => '<div class="row"><dt>' + data.mgr(r.roster_id).name + '</dt><dd>$' + (data.prices[r.roster_id]||0) + '</dd></div>').join('') + '</dl></aside>';
    }
    if (roots.picks) {
      const top = (data.picks||[]).slice().sort((a,b)=>Number((b.metadata||{}).amount||0)-Number((a.metadata||{}).amount||0)).slice(0,20);
      roots.picks.innerHTML = '<aside class="board"><h2>Highest prices</h2><dl>' + top.map((p) => {
        const md = p.metadata || {};
        const nm = ((md.first_name||'')+' '+(md.last_name||'')).trim() || p.player_id;
        return '<div class="row"><dt>' + nm + (md.position ? ' · ' + md.position : '') + '</dt><dd>$' + (md.amount||0) + ' · ' + data.mgr(p.roster_id).name + '</dd></div>';
      }).join('') + '</dl></aside>';
    }
    if (roots.teams) {
      const paintTeams = (lite, wk) => {
        const P = (lite && lite.players) || {};
        roots.teams.innerHTML = (lite ? '<p class="note">Injury tags from Sleeper as of ' + lite.updated.replace('T', ' ').replace('Z', ' UTC') + '. BYE means that NFL team is off in Week ' + wk + '.</p>' : '') + data.rosters.map((r) => {
          const u = data.byId[r.owner_id] || {};
          const players = (r.players||[]).slice().sort((a,b)=>(data.label(b).amount||0)-(data.label(a).amount||0)).map((pid) => {
            let p = data.label(pid);
            const x = P[pid];
            if (x && p.name === pid) p = { name: x.n, pos: x.pos, amount: 0 };
            const flags = [];
            if (x && x.inj) flags.push(x.inj === 'Questionable' ? 'Q' : x.inj);
            if (x && x.team && L.byes && L.byes[x.team] === wk) flags.push('BYE');
            const tag = flags.length ? ' <strong style="color:#a33">' + flags.join(' · ') + '</strong>' : '';
            return '<div class="row"><dt>' + (p.pos ? p.pos + ' · ' : '') + p.name + tag + '</dt><dd>' + (p.amount ? '$'+p.amount : '') + '</dd></div>';
          }).join('');
          return '<article class="vote"><p class="status">' + (data.teamOf(u) || '@' + (u.display_name||'')) + '</p><h2>' + data.nameOf(u) + '</h2><p>' + (r.players||[]).length + ' players · $' + (data.prices[r.roster_id]||0) + ' spent</p><dl>' + players + '</dl></article>';
        }).join('');
      };
      const liteUrl = 'data/players-lite.json?v=' + (L.cacheVersion || 1);
      Promise.all([fetch(liteUrl).then((r) => r.ok ? r.json() : null).catch(() => null), window.SCARIES.week()])
        .then(([lite, wk]) => paintTeams(lite, wk));
    }

    const f1 = (n) => Number(n || 0).toFixed(2);
    if (roots.recap || roots.season) {
      window.SCARIES.finals().then((weeks) => {
        const nm = (id) => data.mgr(id).name;
        if (roots.recap) {
          if (!weeks.length) { roots.recap.innerHTML = '<p class="note">No final weeks yet.</p>'; }
          else {
            const rec = {};
            const tracker = weeks.map((x) => {
              x.games.forEach((g) => {
                const W = rec[g.w.roster_id] = rec[g.w.roster_id] || { w: 0, l: 0, pf: 0 };
                const Lr = rec[g.l.roster_id] = rec[g.l.roster_id] || { w: 0, l: 0, pf: 0 };
                if (g.margin > 0) { W.w++; Lr.l++; }
                W.pf += g.w.points || 0; Lr.pf += g.l.points || 0;
              });
              const last = Object.entries(rec).sort((a, b) => (a[1].w - b[1].w) || (a[1].pf - b[1].pf))[0];
              return { wk: x.wk, id: Number(last[0]), r: Object.assign({}, last[1]) };
            });
            roots.recap.innerHTML = weeks.slice().reverse().map((x) => {
              const s = x.scores.slice().sort((a, b) => b.pts - a.pts);
              const hi = s[0], lo = s[s.length - 1];
              const g = x.games.slice().sort((a, b) => b.margin - a.margin);
              const blow = g[0], close = g[g.length - 1];
              const t = tracker.find((y) => y.wk === x.wk);
              return '<aside class="board" style="margin-top:18px"><h2>Week ' + x.wk + '</h2><dl>' +
                '<div class="row"><dt>High</dt><dd>' + nm(hi.roster_id) + ' · ' + f1(hi.pts) + '</dd></div>' +
                '<div class="row"><dt>Low (shotgun)</dt><dd>' + nm(lo.roster_id) + ' · ' + f1(lo.pts) + '</dd></div>' +
                '<div class="row"><dt>Blowout</dt><dd>' + nm(blow.w.roster_id) + ' over ' + nm(blow.l.roster_id) + ' by ' + f1(blow.margin) + '</dd></div>' +
                '<div class="row"><dt>Closest</dt><dd>' + nm(close.w.roster_id) + ' over ' + nm(close.l.roster_id) + ' by ' + f1(close.margin) + '</dd></div>' +
                '<div class="row"><dt>In last</dt><dd>' + nm(t.id) + ' · ' + t.r.w + '-' + t.r.l + ' · ' + f1(t.r.pf) + ' PF</dd></div>' +
                '</dl></aside>';
            }).join('');
          }
        }
        if (roots.season) {
          const all = [];
          weeks.forEach((x) => x.scores.forEach((s) => all.push(Object.assign({ wk: x.wk }, s))));
          const games = [];
          weeks.forEach((x) => x.games.forEach((g) => games.push(Object.assign({ wk: x.wk }, g))));
          if (!all.length) { roots.season.innerHTML = '<p class="note">No final weeks yet.</p>'; return; }
          all.sort((a, b) => b.pts - a.pts);
          games.sort((a, b) => b.margin - a.margin);
          const pf = {};
          all.forEach((s) => { pf[s.roster_id] = (pf[s.roster_id] || 0) + s.pts; });
          const top = Object.entries(pf).sort((a, b) => b[1] - a[1])[0];
          const hi = all[0], lo = all[all.length - 1], big = games[0], tight = games[games.length - 1];
          roots.season.innerHTML = '<aside class="board"><h2>Season records</h2><dl>' +
            '<div class="row"><dt>High score</dt><dd>' + f1(hi.pts) + ' · ' + nm(hi.roster_id) + ' · Week ' + hi.wk + '</dd></div>' +
            '<div class="row"><dt>Low score</dt><dd>' + f1(lo.pts) + ' · ' + nm(lo.roster_id) + ' · Week ' + lo.wk + '</dd></div>' +
            '<div class="row"><dt>Biggest margin</dt><dd>' + f1(big.margin) + ' · ' + nm(big.w.roster_id) + ' over ' + nm(big.l.roster_id) + ' · Week ' + big.wk + '</dd></div>' +
            '<div class="row"><dt>Closest game</dt><dd>' + f1(tight.margin) + ' · ' + nm(tight.w.roster_id) + ' over ' + nm(tight.l.roster_id) + ' · Week ' + tight.wk + '</dd></div>' +
            '<div class="row"><dt>Most points for</dt><dd>' + f1(top[1]) + ' · ' + nm(Number(top[0])) + '</dd></div>' +
            '</dl></aside><p class="note">Final weeks only: 1 through ' + weeks[weeks.length - 1].wk + '. The live week counts once it goes final.</p>';
        }
      }).catch(() => { fail(roots.recap); fail(roots.season); });
    }
    if (roots.records) {
      const priced = (data.picks||[]).map((p) => {
        const md = p.metadata || {};
        return { name: ((md.first_name||'')+' '+(md.last_name||'')).trim() || p.player_id, pos: md.position||'', amount: Number(md.amount||0), owner: data.mgr(p.roster_id).name };
      }).sort((a,b)=>b.amount-a.amount);
      const byPos = {};
      priced.forEach((p) => { if (!byPos[p.pos] || p.amount > byPos[p.pos].amount) byPos[p.pos] = p; });
      const rows = [['Highest overall', priced[0]]].concat(Object.keys(byPos).sort().map((pos) => [pos + ' high', byPos[pos]]));
      roots.records.innerHTML = '<aside class="board"><h2>Auction records</h2><dl>' + rows.filter(([,p])=>p).map(([lab,p]) => '<div class="row"><dt>' + lab + '</dt><dd>$' + p.amount + ' · ' + p.name + ' · ' + p.owner + '</dd></div>').join('') + '</dl></aside>';
    }

    const paintWeek = (title, rows, target) => {
      const pairs = window.SCARIES.pairWeek(rows);
      if (!pairs.length) { target.innerHTML = '<p class="note">No pairings posted yet.</p>'; return; }
      target.innerHTML = '<aside class="board"><h2>' + title + '</h2>' + pairs.map((pair) => {
        const a = pair[0] || {}, b = pair[1] || {};
        const A = data.mgr(a.roster_id), B = data.mgr(b.roster_id);
        const left = A.name + (a.points ? ' · ' + Number(a.points).toFixed(1) : '');
        const right = (b.points ? Number(b.points).toFixed(1) + ' · ' : '') + B.name;
        return '<div class="row"><dt>' + left + '</dt><dd>' + right + '</dd></div>';
      }).join('') + '</aside>';
    };

    if (roots.week) {
      window.SCARIES.week().then((w) => get('/league/' + L.sleeper.leagueId + '/matchups/' + w).then((rows) => paintWeek('Week ' + w, rows, roots.week))).catch(() => fail(roots.week));
    }
    if (roots.match) {
      const weeks = Array.from({length: 15}, (_,i) => i+1);
      Promise.all(weeks.map((w) => get('/league/' + L.sleeper.leagueId + '/matchups/' + w).then((rows) => ({w, rows})).catch(() => ({w, rows: []})))).then((all) => {
        roots.match.innerHTML = all.filter((x) => x.rows && x.rows.length).map((x) => {
          const id = 'w'+x.w;
          const box = document.createElement('div');
          box.id = id;
          const hold = document.createElement('div');
          paintWeek('Week ' + x.w, x.rows, hold);
          return hold.innerHTML;
        }).join('');
      }).catch(() => fail(roots.match));
    }
  }).catch(() => Object.values(roots).forEach(fail));
})();
