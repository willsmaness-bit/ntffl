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
    records: document.getElementById('records-live')
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
        return '<div class="row"><dt>' + data.mgr(r.roster_id).name + '</dt><dd>' + (s.wins||0) + '-' + (s.losses||0) + (s.ties ? '-' + s.ties : '') + '</dd></div>';
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
      roots.teams.innerHTML = data.rosters.map((r) => {
        const u = data.byId[r.owner_id] || {};
        const players = (r.players||[]).slice().sort((a,b)=>(data.label(b).amount||0)-(data.label(a).amount||0)).map((pid) => {
          const p = data.label(pid);
          return '<div class="row"><dt>' + (p.pos ? p.pos + ' · ' : '') + p.name + '</dt><dd>' + (p.amount ? '$'+p.amount : '') + '</dd></div>';
        }).join('');
        return '<article class="vote"><p class="status">' + (data.teamOf(u) || '@' + (u.display_name||'')) + '</p><h2>' + data.nameOf(u) + '</h2><p>' + (r.players||[]).length + ' players · $' + (data.prices[r.roster_id]||0) + ' spent</p><dl>' + players + '</dl></article>';
      }).join('');
    }
    if (roots.records) {
      const priced = (data.picks||[]).map((p) => {
        const md = p.metadata || {};
        return { name: ((md.first_name||'')+' '+(md.last_name||'')).trim() || p.player_id, pos: md.position||'', amount: Number(md.amount||0), owner: data.mgr(p.roster_id).name };
      }).sort((a,b)=>b.amount-a.amount);
      const byPos = {};
      priced.forEach((p) => { if (!byPos[p.pos] || p.amount > byPos[p.pos].amount) byPos[p.pos] = p; });
      const rows = [['Highest overall', priced[0]]].concat(Object.keys(byPos).sort().map((pos) => [pos + ' high', byPos[pos]]));
      roots.records.innerHTML = '<aside class="board"><h2>Auction records</h2><dl>' + rows.filter(([,p])=>p).map(([lab,p]) => '<div class="row"><dt>' + lab + '</dt><dd>$' + p.amount + ' · ' + p.name + ' · ' + p.owner + '</dd></div>').join('') + '</dl></aside><p class="note">Season records stay empty until Week 1 is scored.</p>';
    }

    const paintWeek = (title, rows, target) => {
      const pairs = window.SCARIES.pairWeek(rows);
      if (!pairs.length) { target.innerHTML = '<p class="note">No pairings posted yet.</p>'; return; }
      target.innerHTML = '<aside class="board"><h2>' + title + '</h2>' + pairs.map((pair) => {
        const a = pair[0] || {}, b = pair[1] || {};
        const A = data.mgr(a.roster_id), B = data.mgr(b.roster_id);
        const left = A.name + (a.points ? ' · ' + a.points : '');
        const right = B.name + (b.points ? ' · ' + b.points : '');
        return '<div class="row"><dt>' + left + '</dt><dd>' + right + '</dd></div>';
      }).join('') + '</aside>';
    };

    if (roots.week) {
      get('/league/' + L.sleeper.leagueId + '/matchups/1').then((rows) => paintWeek('Week 1', rows, roots.week)).catch(() => fail(roots.week));
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
