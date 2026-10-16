(function () {
  const L = window.LEAGUE;
  const here = (location.pathname.split('/').pop() || 'index.html');
    // Title, description, canonical, OG and Twitter tags are written statically in each page's <head>.
  const links = [['index.html','Home'],['draft.html','Draft'],['stats.html','Tape'],['teams.html','Teams'],['matchups.html','Matchups'],['standings.html','Standings'],['playoffs.html','Playoffs'],['toilet.html','Toilet'],['schedule.html','SOS'],['rules.html','Rules'],['records.html','Records'],['gazette.html','Gazette']];
  const header = document.getElementById('site-header');
  if (header) {
    header.innerHTML = '<div class="bar"><a class="brand" href="/"><span class="brand-full">Sunday Scaries</span><span class="brand-short">Scaries</span><span class="subbrand">North Texas FFL</span></a><button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav">Menu</button><nav id="nav">'+links.map(([h,l])=>'<a href="/'+h+'"'+(h===here?' aria-current="page"':'')+'>'+l+'</a>').join('')+'</nav></div>';
    const btn = header.querySelector('.nav-toggle');
    const nav = header.querySelector('#nav');
    if (btn && nav) btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('open', !open);
    });
  }
  const foot = document.getElementById('site-footer');
  if (foot) foot.innerHTML = '<div class="wrap"><strong>Sunday Scaries FFL</strong><span>Inaugural season 2026</span></div>';
  if (L && L.sleeper) document.querySelectorAll('[data-sleeper-join]').forEach((el) => { el.href = L.sleeper.inviteUrl; });
  const clock = document.getElementById('countdown');
  if (clock) clock.textContent = 'Auction complete on Sleeper.';
})();
