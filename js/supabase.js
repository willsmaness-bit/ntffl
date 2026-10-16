// Read-only Supabase helper (plain fetch, no SDK). Publishable key: SELECT-only under RLS.
// Every read rejects on HTTP error or an empty result so callers can fall back to Sleeper.
(function () {
  const URL = 'https://uqlsncuangpcdldckdqn.supabase.co/rest/v1/';
  const KEY = 'sb_publishable_7F-Kfe539z9to-wvVDNjyw_ubPrwSeC';
  const cache = {};
  window.SB = {
    leagueId: 1, // Sunday Scaries in the leagues table
    select(table, query) {
      const url = URL + table + '?' + (query || 'select=*');
      if (!cache[url]) {
        cache[url] = fetch(url, { headers: { apikey: KEY, Accept: 'application/json' } })
          .then((r) => { if (!r.ok) throw new Error('supabase ' + table + ' ' + r.status); return r.json(); })
          .then((rows) => { if (!Array.isArray(rows) || !rows.length) throw new Error('supabase ' + table + ' empty'); return rows; });
      }
      return cache[url];
    },
    inList(ids) { return 'in.(' + ids.map((x) => '"' + String(x).replace(/"/g, '') + '"').join(',') + ')'; }
  };
})();
