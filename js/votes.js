(function () {
  const KEY = 'scaries-ballots-2026';
  const managers = window.LEAGUE.managers;
  const questions = [
    { id: 'keepers', label: 'Keepers',
      help: 'Sleeper allows 2. Nothing is posted until this vote.',
      options: ['None this year', '1 keeper', '2 keepers'] },
    { id: 'salary', label: 'Keeper salary (if keepers exist)',
      help: 'Ignore this if you voted none.',
      options: ['No keepers / n/a', 'Prior auction price + $5', 'Prior auction price + $10', 'Flat $20'] },
    { id: 'faab', label: 'Trade FAAB',
      help: 'Sleeper will allow it unless the room bans it.',
      options: ['Allow FAAB in trades', 'Ban trading FAAB'] },
    { id: 'dues', label: 'Dues',
      help: 'Cash, not auction dollars.',
      options: ['$0 this year', '$20', '$50', '$100', 'Decide at the table'] },
    { id: 'last', label: 'Last-place stakes',
      help: 'Sleeper has no loser bracket posted.',
      options: ['None', '4-team toilet bracket, weeks 15–16', 'Last place pays next year\u2019s dues'] },
    { id: 'vice', label: 'Vice commissioner',
      help: 'Rules if Will\u2019s team is in the dispute.',
      options: ['None yet', ...managers.filter((n) => n !== 'Will Maness')] }
  ];

  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
    catch { return {}; }
  };
  const save = (data) => localStorage.setItem(KEY, JSON.stringify(data));

  const form = document.getElementById('ballot');
  const results = document.getElementById('results');
  if (!form || !results) return;

  const nameSel = document.createElement('select');
  nameSel.id = 'voter';
  nameSel.required = true;
  nameSel.innerHTML = '<option value="">Choose your name</option>' +
    managers.map((n) => `<option>${n}</option>`).join('');

  form.appendChild(wrapField('Your name', 'One ballot per manager on this phone. Switch names to vote the next chair.', nameSel));

  questions.forEach((q) => {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'vote';
    fieldset.innerHTML = `<p class="status">Open</p><h2>${q.label}</h2><p>${q.help}</p>`;
    q.options.forEach((opt, i) => {
      const id = q.id + '-' + i;
      const lab = document.createElement('label');
      lab.className = 'choice';
      lab.innerHTML = `<input type="radio" name="${q.id}" value="${opt.replace(/"/g, '&quot;')}" required> <span>${opt}</span>`;
      fieldset.appendChild(lab);
    });
    form.appendChild(fieldset);
  });

  const btn = document.createElement('button');
  btn.type = 'submit';
  btn.className = 'btn btn-gold';
  btn.textContent = 'Cast ballot';
  form.appendChild(btn);

  const note = document.createElement('p');
  note.className = 'note';
  note.textContent = 'Votes live on this phone so you can pass it around the table. Eight names. One ballot each. Change is a new submit under the same name.';
  form.appendChild(note);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const voter = nameSel.value;
    if (!voter) return;
    const ballot = { voter, at: new Date().toISOString() };
    questions.forEach((q) => {
      const picked = form.querySelector(`input[name="${q.id}"]:checked`);
      ballot[q.id] = picked ? picked.value : '';
    });
    const all = load();
    all[voter] = ballot;
    save(all);
    render();
    btn.textContent = 'Saved · ' + voter;
  });

  function wrapField(title, help, el) {
    const box = document.createElement('div');
    box.className = 'vote';
    box.innerHTML = `<p class="status">Required</p><h2>${title}</h2><p>${help}</p>`;
    box.appendChild(el);
    return box;
  }

  function render() {
    const all = load();
    const cast = Object.keys(all);
    let html = `<p class="kicker">Tally</p><h2>${cast.length} of 8 ballots</h2>`;
    html += '<p>' + managers.map((n) => (all[n] ? 'x ' : 'o ') + n).join('<br>') + '</p>';
    questions.forEach((q) => {
      const counts = {};
      cast.forEach((n) => {
        const v = all[n][q.id] || '';
        counts[v] = (counts[v] || 0) + 1;
      });
      html += `<article class="vote"><h3>${q.label}</h3>`;
      const keys = Object.keys(counts).filter(Boolean);
      if (!keys.length) html += '<p>No votes yet.</p>';
      keys.sort((a,b) => counts[b]-counts[a]).forEach((k) => {
        html += `<p><strong>${counts[k]}</strong> — ${k}</p>`;
      });
      html += '</article>';
    });
    results.innerHTML = html;
  }
  render();
})();
