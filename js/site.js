(function () {
  const L = window.LEAGUE;
  const here = (location.pathname.split('/').pop() || 'index.html');
  const links = [['index.html','Home'],['draft.html','Draft HQ'],['votes.html','Votes'],['teams.html','Teams'],['standings.html','Standings'],['matchups.html','Matchups'],['rules.html','Rules'],['gazette.html','Gazette'],['records.html','Records']];
  const header = document.getElementById('site-header');
  if (header) {
    header.innerHTML = '<div class="bar"><a class="brand" href="index.html"><span><span class="brand-full">'+L.shortName+'</span><span class="brand-short">NTFFL</span><span class="subbrand">'+L.sleeperName+'</span></span></a><button class="nav-toggle" type="button" aria-expanded="false">Menu</button><nav id="nav">'+links.map(([h,l])=>'<a href="'+h+'"'+(h===here?' aria-current="page"':'')+'>'+l+'</a>').join('')+'</nav></div>';
    const btn = header.querySelector('.nav-toggle');
    const nav = header.querySelector('#nav');
    if (btn && nav) btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('open', !open);
    });
  }
  const foot = document.getElementById('site-footer');
  if (foot) foot.innerHTML = '<div class="wrap"><strong>'+L.name+'</strong><span>'+L.seasonLabel+'</span></div>';
  document.querySelectorAll('[data-sleeper-join]').forEach((el) => { el.href = L.sleeper.inviteUrl; });
})();
