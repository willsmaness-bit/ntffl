(function () {
  const L = window.LEAGUE;
  const here = (location.pathname.split('/').pop() || 'index.html');
  const origin = 'https://sundayscariesffl.com';
  const titles = {
    'index.html': 'Sunday Scaries FFL',
    'draft.html': 'Results · Sunday Scaries',
    'teams.html': 'Teams · Sunday Scaries',
    'standings.html': 'Standings · Sunday Scaries',
    'matchups.html': 'Matchups · Sunday Scaries',
    'rules.html': 'Rules · Sunday Scaries',
    'gazette.html': 'Gazette · Sunday Scaries',
    'records.html': 'Records · Sunday Scaries'
  };
  const title = titles[here] || 'Sunday Scaries FFL';
  const desc = 'Sunday Scaries FFL. Auction complete. Rosters and matchups live from Sleeper.';
  document.title = title;
  const head = document.head;
  const ensure = (sel, tag, attrs) => {
    let el = head.querySelector(sel);
    if (!el) { el = document.createElement(tag); head.appendChild(el); }
    Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k,v));
    return el;
  };
  ensure('meta[name="description"]', 'meta', {name:'description', content:desc});
  ensure('link[rel="canonical"]', 'link', {rel:'canonical', href: origin + (here === 'index.html' ? '/' : '/' + here)});
  ensure('meta[property="og:title"]', 'meta', {property:'og:title', content:title});
  ensure('meta[property="og:description"]', 'meta', {property:'og:description', content:desc});
  ensure('meta[property="og:url"]', 'meta', {property:'og:url', content: origin + (here === 'index.html' ? '/' : '/' + here)});
  ensure('meta[property="og:type"]', 'meta', {property:'og:type', content:'website'});
  ensure('meta[name="twitter:card"]', 'meta', {name:'twitter:card', content:'summary'});
  ensure('link[rel="icon"]', 'link', {rel:'icon', href:'favicon.svg', type:'image/svg+xml'});

  const links = [['index.html','Home'],['draft.html','Results'],['teams.html','Teams'],['matchups.html','Matchups'],['standings.html','Standings'],['records.html','Records'],['rules.html','Rules'],['gazette.html','Gazette']];
  const header = document.getElementById('site-header');
  if (header) {
    header.innerHTML = '<div class="bar"><a class="brand" href="index.html"><span class="brand-full">Sunday Scaries</span><span class="brand-short">Scaries</span><span class="subbrand">North Texas FFL</span></a><button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav">Menu</button><nav id="nav">'+links.map(([h,l])=>'<a href="'+h+'"'+(h===here?' aria-current="page"':'')+'>'+l+'</a>').join('')+'</nav></div>';
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
