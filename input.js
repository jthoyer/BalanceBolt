/* Balance Tri Club — sign-up page.
   Everything that puts a name and a prediction into a race. Timing and results
   live on boltresults.html; the shared model is in core.js. */

const signupFields = () => [$('#nameInput'), $('#minutesInput'), $('#secondsInput')];

function render() {
  keepFocus(() => {
    setSync(syncState);
    renderRacePicker();
    renderStartList();
  });
}

function renderStartList() {
  const v = raceView();
  $('#racerCount').textContent = String(v.list.length);
  $('#waveCount').textContent = String(v.list.length ? v.waves.length : 0);
  $('#startListEmpty').classList.toggle('hidden', v.list.length > 0);
  $('#waveNote').textContent = v.data.wavesLocked
    ? 'Waves are locked in. Late sign-ups join the next wave still waiting on the line.'
    : 'Waves group everyone within five minutes of each other’s call, and lock in the moment the first wave starts.';

  const container = $('#startList');
  container.innerHTML = '';

  v.waves.forEach(wave => {
    // Ordered by call, not by bib, so the reason these people share a wave is obvious.
    const members = racersInWave(v, wave)
      .slice()
      .sort((a, b) => a.predictedSec - b.predictedSec || a.number - b.number);
    if (!members.length) return;

    /* The band of calls this wave covers — otherwise "why am I in wave 3?" has no answer. */
    const calls = members.map(r => r.predictedSec).sort((a, b) => a - b);
    const band = calls[0] === calls[calls.length - 1]
      ? `all called ${fmtSec(calls[0])}`
      : `calls ${fmtSec(calls[0])}–${fmtSec(calls[calls.length - 1])}`;

    const card = document.createElement('section');
    card.className = 'wave-card';
    card.innerHTML = `
      <div class="wave-card-head">
        <div class="wave-card-title">
          <h3>Wave ${wave}</h3>
          <span class="wave-band">${band}</span>
        </div>
        <span class="wave-size">${members.length} ${members.length === 1 ? 'racer' : 'racers'}</span>
      </div>
      <ul></ul>`;

    const ul = card.querySelector('ul');
    members.forEach(r => {
      const li = document.createElement('li');
      li.className = 'roster-entry';
      li.innerHTML = `
        <span class="roster-who">
          <span class="bib"><span class="visually-hidden">Racer </span><span class="bib-number"></span></span>
          <span class="roster-name"></span>
          <span class="roster-pred"></span>
        </span>
        <button type="button" class="quiet-button">Remove</button>`;
      li.querySelector('.bib-number').textContent = String(r.number);
      li.querySelector('.roster-name').textContent = r.name;
      li.querySelector('.roster-pred').textContent = `called ${fmtSec(r.predictedSec)}`;

      const btn = li.querySelector('.quiet-button');
      btn.dataset.focusKey = `remove:${r.id}`;
      btn.setAttribute('aria-label', `Remove ${r.name} from race ${currentRace}`);
      btn.addEventListener('click', () => {
        if (!confirm(`Remove ${r.name} from race ${currentRace}?`)) return;
        // Their Remove button is about to vanish, so decide where focus lands first.
        const slot = $$('#startList .quiet-button').indexOf(btn);
        removeRacer(r.id);
        announce(`${r.name} removed from race ${currentRace}.`);
        const left = $$('#startList .quiet-button');
        (left[slot] || left[left.length - 1] || $('#startListHeading')).focus();
      });
      ul.append(li);
    });
    container.append(card);
  });
}

/* ── Sign-up form ──────────────────────────────────────────────────────── */

$('#signupForm').addEventListener('submit', e => {
  e.preventDefault();
  const err = $('#signupError');
  const nameInput = $('#nameInput');
  const minutesInput = $('#minutesInput');
  const secondsInput = $('#secondsInput');

  clearFieldErrors(err, signupFields());

  const name = nameInput.value.trim();
  const minutes = minutesInput.value.trim() === '' ? NaN : Number(minutesInput.value);
  const seconds = secondsInput.value.trim() === '' ? NaN : Number(secondsInput.value);

  const fail = (msg, field) => showFieldError(err, msg, field);

  if (!name) return fail('Pop your name in first.', nameInput);
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 599) {
    return fail('Minutes needs to be a whole number between 0 and 599.', minutesInput);
  }
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 59) {
    return fail('Seconds needs to be a whole number between 0 and 59.', secondsInput);
  }

  const predictedSec = minutes * 60 + seconds;
  if (predictedSec <= 0) return fail('Predict a time longer than zero — nobody is that quick.', minutesInput);

  const clash = race().racers.some(r => nameKey(r.name) === nameKey(name));
  if (clash) {
    return fail(`${name} is already on the start list for race ${currentRace}. Add a surname or nickname to tell you apart.`, nameInput);
  }

  const racer = addRacer(name, predictedSec);
  const wave = raceView().map.get(racer.id);

  e.target.reset();
  nameInput.focus();

  const confirmCard = $('#signupConfirm');
  confirmCard.classList.remove('hidden');
  $('#confirmLine').textContent = `${racer.name} — racer #${racer.number}, wave ${wave}.`;
  $('#confirmDetail').textContent = `Called ${fmtSec(predictedSec)} in race ${currentRace}. Nothing to do now but run it.`;

  announce(`${racer.name} added to race ${currentRace} as racer ${racer.number}, wave ${wave}, predicted ${fmtSec(predictedSec)}.`);
});

/* Clearing the flag as soon as someone starts fixing the field keeps the form honest. */
signupFields().forEach(field => {
  field.addEventListener('input', () => {
    if (field.getAttribute('aria-invalid') === 'true') clearFieldErrors($('#signupError'), [field]);
  });
});

renderPage = render;
boot();
