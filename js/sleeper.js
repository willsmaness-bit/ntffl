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

  const nameOf = (u) => L.handles[u.display_name] || u.display_name;
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
    return { users, rosters, picks, byId, prices, label, nameOf, teamOf };
  };

  const teamsRoot = document.getElementById('teams-live');
  const fieldRoot = document.getElementById('field-live');
  const standRoot = document.getElementById('standings-live');
  if (!teamsRoot && !fieldRoot && !standRoot) return;

  window.SCARIES.load().then((data) => {
    if (fieldRoot) {
      fieldRoot.innerHTML = data.rosters.map((r) => {
        const u = data.byId[r.owner_id] || {};
        const mgr = data.nameOf(u);
        const team = data.teamOf(u);
        const role = mgr === L.commissioner ? '<p class="note">Commissioner</p>' : mgr === L.viceCommissioner ? '<p class="note">Vice commissioner</p>' : '';
        return '<article><h3>' + mgr + '</h3>' + (team ? '<p class="note">' + team + '</p>' : '') + role + '</article>';
      }).join('');
    }
    if (standRoot) {
      const rows = data.rosters.slice().sort((a,b) => {
        const as = a.settings || {}, bs = b.settings || {};
        return (bs.wins||0)-(as.wins||0) || (bs.fpts||0)-(as.fpts||0);
      });
      standRoot.innerHTML = '<aside class="board"><dl>' + rows.map((r) => {
        const u = data.byId[r.owner_id] || {};
        const s = r.settings || {};
        return '<div class="row"><dt>' + data.nameOf(u) + '</dt><dd>' + (s.wins||0) + '-' + (s.losses||0) + '</dd></div>';
      }).join('') + '</dl></aside>';
    }
    if (teamsRoot) {
      teamsRoot.innerHTML = data.rosters.map((r) => {
        const u = data.byId[r.owner_id] || {};
        const mgr = data.nameOf(u);
        const team = data.teamOf(u);
        const spent = data.prices[r.roster_id] || 0;
        const players = (r.players || []).map((pid) => {
          const p = data.label(pid);
          const amt = p.amount ? ' \u00b7 $' + p.amount : '';
          const pos = p.pos ? p.pos + ' \u00b7 ' : '';
          return '<div class="row"><dt>' + pos + p.name + '</dt><dd>' + (p.amount ? '$' + p.amount : '') + '</dd></div>';
        }).join('');
        return '<article class="vote"><p class="status">' + (team || '@' + (u.display_name || '')) + '</p><h2>' + mgr + '</h2><p>' + (r.players||[]).length + ' players \u00b7 $' + spent + ' spent</p><dl>' + players + '</dl></article>';
      }).join('');
    }
  }).catch(() => {
    if (teamsRoot) teamsRoot.innerHTML = '<p class="note">Sleeper did not load. Open the league in the app.</p>';
  });
})();
