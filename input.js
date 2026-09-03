/* Balance Tri Club — sign-up page.
   Everything that puts a name and a prediction into a race. Timing and results
   live on boltresults.html; the shared model is in core.js. */

const signupFields = () => [$('#nameInput'), $('#minutesInput'), $('#secondsInput')];

/* "YOU'RE IN" is about one sign-up that just happened. Switch race or remove the
   racer and it is answering a question nobody is asking any more.
   Hiding it belongs here and not in render(): the sheet poll re-renders every few
   seconds, which would snatch the card away mid-read. */
function showConfirm(line, detail) {
  $('#confirmLine').textContent = line;
  $('#confirmDetail').textContent = detail;
  $('#signupConfirm').classList.remove('hidden');
}

const hideConfirm = () => $('#signupConfirm').classList.add('hidden');

/* A second listener on the picker, alongside the one core.js wires for the race
   itself — this is a page concern, and core.js also serves the results page. */
$('#racePicker').addEventListener('change', hideConfirm);

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
      li.innerHTML = '<button type="button" class="quiet-button">Remove</button>';
      li.prepend(rosterWho(r));

      const btn = li.querySelector('.quiet-button');
      btn.dataset.focusKey = `remove:${r.id}`;
      btn.setAttribute('aria-label', `Remove ${r.name} from race ${currentRace}`);
      btn.addEventListener('click', () => {
        if (!confirm(`Remove ${r.name} from race ${currentRace}?`)) return;
        // Their Remove button is about to vanish, so decide where focus lands first.
        const slot = $$('#startList .quiet-button').indexOf(btn);
        removeRacer(r.id);
        hideConfirm();
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
  /* A blank box means zero. Somebody calling a flat 25 minutes types 25 and stops —
     making them type a 0 in Seconds to be allowed in is a trap, not a rule. */
  const partSec = input => (input.value.trim() === '' ? 0 : Number(input.value));
  const minutes = partSec(minutesInput);
  const seconds = partSec(secondsInput);

  const fail = (msg, field) => showFieldError(err, msg, field);

  if (!name) return fail('Pop your name in first.', nameInput);
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 599) {
    return fail('Minutes needs to be a whole number between 0 and 599.', minutesInput);
  }
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 59) {
    return fail('Seconds needs to be a whole number between 0 and 59.', secondsInput);
  }

  const predictedSec = minutes * 60 + seconds;
  /* Both rejections are "zero", but the people are different. One forgot to type;
     the other typed 0 and meant it. Telling them both to enter a time is useless
     to the second one, who believes they just did. */
  const bothBlank = minutesInput.value.trim() === '' && secondsInput.value.trim() === '';
  if (predictedSec <= 0) {
    return fail(bothBlank
      ? 'Give us a predicted time — even a rough one.'
      : 'Nought is not a time. What are you chasing?', minutesInput);
  }

  const clash = race().racers.some(r => nameKey(r.name) === nameKey(name));
  if (clash) {
    return fail(`${name} is already on the start list for race ${currentRace}. Add a surname or nickname to tell you apart.`, nameInput);
  }

  const racer = addRacer(name, predictedSec);
  const wave = raceView().map.get(racer.id);

  e.target.reset();
  nameInput.focus();

  /* Waves regroup on every sign-up until the first gun, so stating one as settled
     is a promise the app cannot keep. */
  const settled = race().wavesLocked;
  const waveWord = settled ? `wave ${wave}` : `wave ${wave} for now`;

  showConfirm(
    `${racer.name} — racer #${racer.number}, ${waveWord}.`,
    settled
      ? `Called ${fmtSec(predictedSec)} in race ${currentRace}. Nothing to do now but run it.`
      : `Called ${fmtSec(predictedSec)} in race ${currentRace}. Waves settle when the first gun goes.`
  );

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
