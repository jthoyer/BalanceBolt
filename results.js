/* Balance Tri Club — race control and results page.
   Two jobs on one page, kept apart by three panels: Timing, Results, Series.
   The shared model is in core.js. */

const VIEWS = ['timing', 'board', 'series'];

function currentView() {
  return VIEWS.includes(ui.resultsView) ? ui.resultsView : 'timing';
}

/** ?view=series on the URL picks the starting tab, same idea as ?race=N in core.js —
    lets another page (the club calendar) deep-link straight past Timing. */
function initialView() {
  const fromUrl = new URLSearchParams(location.search).get('view');
  return VIEWS.includes(fromUrl) ? fromUrl : currentView();
}

/** Keep ?view= in the address bar so a screen can be parked on one tab, same as ?race=. */
function reflectViewInUrl(view) {
  const url = new URL(location.href);
  url.searchParams.set('view', view);
  history.replaceState(null, '', url);
}

function showView(view, { moveFocus = true } = {}) {
  if (!VIEWS.includes(view)) return;
  ui.resultsView = view;
  save();
  reflectViewInUrl(view);
  renderTabs(view);
  if (moveFocus) $('#view-' + view).focus();
}

function render() {
  keepFocus(() => {
    setSync(syncState);
    renderRacePicker();
    renderTabs(currentView());
    const v = raceView();
    renderControl(v);
    renderBoard(v);
    renderPrizes(v);
    renderSeries();
    tick();
  });
}

/* ── Race control ──────────────────────────────────────────────────────── */

/* Wave clocks freeze on the same instant as the global one — when the last racer in the
   race stopped their clock. Nothing on the page should still be counting up after that. */
const waveClockClass = (start, stopped) =>
  !start ? 'waiting' : stopped ? 'stopped' : '';

const waveClockText = (start, stopped) =>
  !start ? 'On the line' : stopped ? fmtClock(stopped - start) : '';

function renderControl(v) {
  const hasRacers = v.list.length > 0;
  $('#controlEmpty').classList.toggle('hidden', hasRacers);

  const first = Object.values(v.data.waveStarts).sort((a, b) => a - b)[0];
  const stopped = raceStoppedAt(v);
  const clock = $('#globalClock');
  clock.classList.toggle('stopped', !!stopped);

  if (stopped) {
    // Last racer is home: freeze on their time rather than let the clock run on.
    delete clock.dataset.liveFrom;
    clock.textContent = fmtClock(stopped - first);
  } else if (first) {
    clock.dataset.liveFrom = String(first);
  } else {
    delete clock.dataset.liveFrom;
    clock.textContent = '0:00';
  }

  const outstanding = v.list.filter(r => !r.finishAt).length;
  $('#clockSub').textContent =
    !hasRacers ? 'Nobody on the start list yet.'
      : !first ? `Waiting on wave 1. ${v.list.length} ready to go.`
        : outstanding ? `${outstanding} still out on course.`
          : stopped ? `Race done — clocks stopped on ${fmtClock(stopped - first)}. Head to Results.`
            : 'Everyone is home. Head to Results.';

  const container = $('#waveControls');
  container.innerHTML = '';

  v.waves.forEach(wave => {
    const members = racersInWave(v, wave);
    if (!members.length) return;

    const start = waveStart(v, wave);
    const home = members.filter(r => r.finishAt).length;
    const done = start && home === members.length;

    const block = document.createElement('section');
    block.className = 'wave-block';
    block.innerHTML = `
      <div class="wave-bar ${start ? (done ? 'done' : 'running') : 'pending'}">
        <div class="wave-bar-main">
          <h3>Wave ${wave}</h3>
          <p class="wave-meta">${home} of ${members.length} home</p>
        </div>
        <p class="wave-clock ${waveClockClass(start, stopped)}"${start && !stopped ? ` data-live-from="${start}"` : ''}>${waveClockText(start, stopped)}</p>
      </div>
      <div class="wave-body"></div>`;

    if (!start) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'start-button';
      btn.textContent = `Start wave ${wave}`;
      btn.addEventListener('click', () => {
        if (!confirm(`Start wave ${wave} of race ${currentRace} now? The clock begins immediately.`)) return;
        const first = members[0];
        startWave(wave);
        announce(`Wave ${wave} started.`);
        // The Start button is gone now; land on the first racer's Finish button instead.
        const next = first && document.querySelector(`[data-focus-key="racer:${CSS.escape(first.id)}"]`);
        if (next) next.focus();
      });
      block.querySelector('.wave-bar').append(btn);
    }

    const body = block.querySelector('.wave-body');
    members.forEach(r => body.append(timingRow(r, v, start)));
    container.append(block);
  });
}

function timingRow(r, v, start) {
  const row = document.createElement('div');
  row.className = 'timing-row';
  row.innerHTML = '<span class="timing-result"></span>';
  row.prepend(rosterWho(r));

  row.insertBefore(editCallButton(r), row.querySelector('.timing-result'));
  if (callEdit && callEdit.id === r.id) row.append(callEditForm(r, v));

  const cell = row.querySelector('.timing-result');
  const res = result(r, v);

  if (res) {
    const elapsed = document.createElement('span');
    elapsed.className = 'timing-elapsed';
    elapsed.textContent = fmtClock(res.elapsed);

    const delta = document.createElement('span');
    delta.className = `timing-delta ${res.absDelta <= BANG_ON_MS ? 'delta-good' : 'delta-off'}`;
    delta.textContent = fmtDelta(res.delta);

    const undo = document.createElement('button');
    undo.type = 'button';
    undo.className = 'quiet-button';
    undo.dataset.focusKey = `racer:${r.id}`;
    undo.textContent = 'Undo';
    undo.setAttribute('aria-label', `Undo the finish time for ${r.name}`);
    undo.addEventListener('click', () => {
      unfinishRacer(r.id);
      announce(`${r.name} put back out on course.`);
    });

    cell.append(elapsed, delta, undo);
  } else if (start) {
    const elapsed = document.createElement('span');
    elapsed.className = 'timing-elapsed';
    elapsed.dataset.liveFrom = String(start);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'finish-button';
    btn.dataset.focusKey = `racer:${r.id}`;
    btn.textContent = 'Finish';
    btn.setAttribute('aria-label', `Stop the clock for ${r.name}`);
    btn.addEventListener('click', () => {
      const outcome = finishRacer(r.id);
      if (outcome.ok) announceFinish(outcome);
    });

    cell.append(elapsed, btn);
  } else {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'finish-button';
    btn.disabled = true;
    btn.textContent = 'Finish';
    btn.setAttribute('aria-label', `Finish ${r.name} — wave not started yet`);
    cell.append(btn);
  }
  return row;
}

/* ── Correcting a call ─────────────────────────────────────────────────── */

/* One row at a time is open for editing, and the open editor is state, not DOM.
   It has to be: renderControl() throws the whole wave list away and rebuilds it, and
   the sheet poll calls render() every few seconds, so a form that existed only in the
   DOM would be snatched away mid-correction — the same trap the confirmation card on
   the sign-up page is written around. Keeping what has been typed here means the
   rebuild puts the form back exactly as it was, and data-focus-key on the two boxes
   lets keepFocus() drop the caret back into the one that had it.

   Shape: { id, minutes, seconds, error: { message, field } | null }. */
let callEdit = null;

/** The trigger on a racer's row. Sits with the call it changes — see below. */
function editCallButton(r) {
  const open = !!callEdit && callEdit.id === r.id;
  const btn = document.createElement('button');
  btn.type = 'button';
  /* .neutral because this is not a reversal and not a removal: the plain .quiet-button
     hover goes red, which on Edit call would promise something the button does not do. */
  btn.className = 'quiet-button neutral';
  btn.dataset.focusKey = `call:${r.id}`;
  btn.textContent = 'Edit call';
  btn.setAttribute('aria-label', `Edit the predicted time for ${r.name}, currently ${fmtSec(r.predictedSec)}`);
  btn.setAttribute('aria-expanded', String(open));
  if (open) btn.setAttribute('aria-controls', callEditIds(r).form);
  btn.addEventListener('click', () => (open ? closeCallEdit(r.id) : openCallEdit(r)));
  return btn;
}

/* Ids are built off the race NUMBER, not the id: `number` is coerced through Number()
   in cleanRace(), so it cannot carry anything that would break out of an attribute.
   `id` is a string off the sheet and only ever goes into dataset or a CSS.escape(). */
const callEditIds = r => ({
  form: `callEdit-${r.number}`,
  minutes: `callMinutes-${r.number}`,
  seconds: `callSeconds-${r.number}`,
  help: `callHelp-${r.number}`,
  error: `callError-${r.number}`
});

function openCallEdit(r) {
  callEdit = {
    id: r.id,
    minutes: String(Math.floor(r.predictedSec / 60)),
    seconds: String(r.predictedSec % 60),
    error: null
  };
  render();
  focusCallBox(r.id, 'minutes');
}

/* Focus is moved AFTER render(), never during it. renderControl() builds each row and
   its editor detached and appends the finished wave block afterwards, and .focus() on a
   node that is not in the document yet does nothing at all — silently. That cost the
   error path its "land on the box you have to fix" behaviour until a browser check caught
   it; reading the code did not, because the focus call was plainly there. */
function focusCallBox(id, field) {
  focusByKey(`${field === 'seconds' ? 'call-sec' : 'call-min'}:${id}`);
}

/** Back to the Edit call button that opened the editor — the one place focus can go. */
const focusCallTrigger = id => focusByKey(`call:${id}`);

function focusByKey(key) {
  const el = document.querySelector(`[data-focus-key="${CSS.escape(key)}"]`);
  if (el) el.focus();
}

/** The form is about to disappear, so this decides where focus lands: back on the trigger. */
function closeCallEdit(id) {
  callEdit = null;
  render();
  focusCallTrigger(id);
}

function failCallEdit(message, field) {
  callEdit.error = { message, field };
  const id = callEdit.id;
  render();
  focusCallBox(id, field);
}

function saveCallEdit(r) {
  const state = callEdit;
  const parsed = parsePredictedTime(state.minutes, state.seconds);
  if (!parsed.ok) return failCallEdit(parsed.error, parsed.field);

  /* Closed before the mutation, so setPredictedTime's own render draws the tidied row
     and there is no second rebuild to undo the first. */
  callEdit = null;
  const outcome = setPredictedTime(r.id, parsed.predictedSec);
  if (!outcome.ok) {
    callEdit = state;
    return failCallEdit(outcome.error, 'minutes');
  }

  focusCallTrigger(r.id);

  /* Before the first gun the wave is still fluid, so it is hedged the same way the
     sign-up confirmation hedges it. Stating a fluid wave as settled is a promise the
     app cannot keep. */
  announce(`${outcome.racer.name}'s call is now ${fmtSec(parsed.predictedSec)}. `
    + (outcome.locked ? `Wave ${outcome.wave}, unchanged.` : `Wave ${outcome.wave} for now.`));
}

function callEditForm(r, v) {
  const state = callEdit;
  const id = callEditIds(r);
  const form = document.createElement('form');
  form.className = 'timing-edit';
  form.id = id.form;
  form.noValidate = true;
  form.innerHTML = `
    <fieldset class="time-field">
      <legend></legend>
      <div class="two-columns">
        <span class="field">
          <label for="${id.minutes}">Minutes</label>
          <input id="${id.minutes}" name="minutes" type="number" inputmode="numeric" min="0" max="599" step="1" placeholder="0" aria-describedby="${id.help}" />
        </span>
        <span class="field">
          <label for="${id.seconds}">Seconds</label>
          <input id="${id.seconds}" name="seconds" type="number" inputmode="numeric" min="0" max="59" step="1" placeholder="00" aria-describedby="${id.help}" />
        </span>
      </div>
      <p class="helper-text" id="${id.help}"></p>
    </fieldset>
    <p class="form-error hidden" id="${id.error}" role="alert"></p>
    <div class="dialog-footer">
      <button type="button" class="secondary-button">Cancel</button>
      <button type="submit" class="save-button">Save the call</button>
    </div>`;

  /* Racer names come off a sheet anybody with the sign-up link can write to, so they go
     in as text, never as markup — same rule the roster and the board follow. */
  form.querySelector('legend').textContent = `New predicted time for ${r.name}`;
  form.querySelector('.helper-text').textContent = callEditHelp(r, v);

  const minutes = form.querySelector('input[name="minutes"]');
  const seconds = form.querySelector('input[name="seconds"]');
  const err = form.querySelector('.form-error');

  minutes.value = state.minutes;
  seconds.value = state.seconds;
  minutes.dataset.focusKey = `call-min:${r.id}`;
  seconds.dataset.focusKey = `call-sec:${r.id}`;

  [minutes, seconds].forEach(box => {
    box.addEventListener('input', () => {
      if (callEdit !== state) return; // a poll rebuilt the form; this one is a ghost
      state.minutes = minutes.value;
      state.seconds = seconds.value;
      if (box.getAttribute('aria-invalid') === 'true') {
        state.error = null;
        clearFieldErrors(err, [minutes, seconds]);
      }
    });
  });

  /* Wires the ARIA and shows the message, but never moves the caret: this runs on every
     render, including the four-second sheet poll, and nothing should yank focus out of the
     box someone is mid-way through correcting. failCallEdit() does the one focus move
     there is, after the row is in the document. */
  if (state.error) {
    const target = state.error.field === 'seconds' ? seconds : minutes;
    showFieldError(err, state.error.message, target, { moveFocus: false });
  }

  form.addEventListener('submit', e => { e.preventDefault(); saveCallEdit(r); });
  form.querySelector('.secondary-button').addEventListener('click', () => closeCallEdit(r.id));
  /* Opened the wrong row is the common mistake, so the common escape hatch works. Not a
     dialog and nothing is trapped here — this is a convenience, not the only way out. */
  form.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    closeCallEdit(r.id);
  });
  return form;
}

/** What changing this call is about to do — stated before it is pressed, not after. */
function callEditHelp(r, v) {
  return [
    'Leave a box empty and we count it as zero.',
    v.data.wavesLocked
      ? `Waves are locked in, so wave ${v.map.get(r.id)} stays wave ${v.map.get(r.id)}.`
      : 'Waves have not locked yet, so this can move them — and whoever is closest to them — into a different wave.',
    r.finishAt ? 'They are already home, so their result on the board changes too.' : ''
  ].filter(Boolean).join(' ');
}

function announceFinish({ racer, res }) {
  const gap = res ? `, ${sayDelta(res.delta)}` : '';
  announce(`Racer ${racer.number}, ${racer.name}, finished${gap}.`);
}

/* ── Leaderboard and its automatic prizes ──────────────────────────────── */

/* The three automatic prizes are the top three places, so they are drawn once — as
   medal cards over the table they rank. The prize list further down the page holds
   only what the organiser makes up on the day. */
const MEDALS = [
  { kind: 'gold', place: 1, eyebrow: 'CLOSEST TO THE CALL' },
  { kind: 'silver', place: 2, eyebrow: '2ND CLOSEST TO THE CALL' },
  { kind: 'bronze', place: 3, eyebrow: '3RD CLOSEST TO THE CALL' }
];

const OUTLIER = { kind: 'outlier', eyebrow: 'FURTHEST FROM THE CALL' };

function renderBoard(v) {
  const rows = ranked(v);
  const running = v.list.filter(r => !r.finishAt);
  $('#boardEmpty').classList.toggle('hidden', rows.length + running.length > 0);

  const podium = $('#podium');
  podium.innerHTML = '';
  MEDALS.slice(0, rows.length).forEach((medal, i) => podium.append(podiumCard(medal, rows[i])));

  /* Only hand out a wooden spoon when someone finished outside the medals. With three
     or fewer finishers the furthest racer is already wearing bronze, and naming them
     twice is the duplication this section was merged to get rid of. */
  if (rows.length > MEDALS.length) podium.append(podiumCard(OUTLIER, rows[rows.length - 1]));

  const body = $('#boardBody');
  body.innerHTML = '';

  rows.forEach((row, i) => {
    const medal = MEDALS[i];
    const tr = document.createElement('tr');
    if (i === 0) tr.className = 'is-first';
    else if (!medal && i === rows.length - 1) tr.className = 'is-last';
    tr.innerHTML = `
      <td class="col-rank"><span class="rank-badge${medal ? ` medal ${medal.kind}` : ''}">${i + 1}</span></td>
      <th scope="row" class="col-who">
        <span class="racer-cell">
          <span class="bib"><span class="visually-hidden">Racer </span><span class="bib-number"></span></span>
          <span class="roster-name"></span>
        </span>
        <span class="racer-sub">called ${fmtSec(row.racer.predictedSec)} · ran ${fmtClock(row.elapsed)}</span>
      </th>
      <td class="num col-wide">${fmtSec(row.racer.predictedSec)}</td>
      <td class="num col-wide">${fmtClock(row.elapsed)}</td>
      <td class="num ${row.absDelta <= BANG_ON_MS ? 'delta-good' : ''}"><strong>${fmtDelta(row.delta)}</strong></td>`;
    tr.querySelector('.bib-number').textContent = String(row.racer.number);
    tr.querySelector('.roster-name').textContent = row.racer.name;
    body.append(tr);
  });

  running.forEach(r => {
    const start = waveStart(v, v.map.get(r.id));
    const live = start ? `<span data-live-from="${start}"></span>` : '—';
    const tr = document.createElement('tr');
    tr.className = 'is-running';
    tr.innerHTML = `
      <td class="col-rank">—</td>
      <th scope="row" class="col-who">
        <span class="racer-cell">
          <span class="bib"><span class="visually-hidden">Racer </span><span class="bib-number"></span></span>
          <span class="roster-name"></span>
        </span>
        <span class="racer-sub">called ${fmtSec(r.predictedSec)} · running ${live}</span>
      </th>
      <td class="num col-wide">${fmtSec(r.predictedSec)}</td>
      <td class="num col-wide">${live}</td>
      <td class="num"><span class="status-tag">${start ? 'On course' : 'Waiting'}</span></td>`;
    tr.querySelector('.bib-number').textContent = String(r.number);
    tr.querySelector('.roster-name').textContent = r.name;
    body.append(tr);
  });
}

/* The place number is `aria-hidden` because the eyebrow beside it already says
   "2nd closest to the call", and the table below repeats the rank in its own column. */
function podiumCard({ kind, place, eyebrow }, row) {
  const card = document.createElement('div');
  card.className = `podium-card ${kind}`;
  card.innerHTML = `
    ${place ? `<span class="medal-chip" aria-hidden="true">${place}</span>` : ''}
    <p class="eyebrow">${eyebrow}</p>
    <p class="podium-name"></p>
    <p class="podium-delta">${fmtDelta(row.delta)}</p>
    <p class="podium-detail">Called ${fmtSec(row.racer.predictedSec)} · ran ${fmtClock(row.elapsed)}</p>`;
  card.querySelector('.podium-name').textContent = `#${row.racer.number} ${row.racer.name}`;
  return card;
}

/* ── Prizes ────────────────────────────────────────────────────────────── */

function prizeCard({ title, winner, detail, extra }) {
  const card = document.createElement('article');
  card.className = 'prize-card' + (extra ? ' ' + extra : '');
  card.innerHTML = '<h3></h3><p class="prize-winner"></p><p class="prize-detail"></p>';
  card.querySelector('h3').textContent = title;
  card.querySelector('.prize-winner').textContent = winner;
  card.querySelector('.prize-detail').textContent = detail;
  return card;
}

/** Only the made-up ones live here — the automatic three are the medal cards above. */
function renderPrizes(v) {
  const container = $('#prizeList');
  container.innerHTML = '';

  v.data.prizes.forEach(p => {
    const racer = racerById(v, p.racerId);
    if (!racer) return;
    const res = result(racer, v);
    const card = prizeCard({
      title: p.label,
      winner: `#${racer.number} ${racer.name}`,
      detail: res ? fmtDelta(res.delta) : 'Still out on course',
      extra: 'adhoc'
    });
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'quiet-button';
    btn.textContent = 'Take it back';
    btn.setAttribute('aria-label', `Take the ${p.label} prize back from ${racer.name}`);
    btn.addEventListener('click', () => {
      removePrize(p.id);
      announce(`${p.label} prize removed.`);
      $('#prizeLabel').focus(); // the card it lived on no longer exists
    });
    card.append(btn);
    container.append(card);
  });

  if (!container.children.length) {
    container.innerHTML = '<p class="empty-state">Nothing made up yet. The medals above are handed out automatically.</p>';
  }

  const select = $('#prizeRacer');
  const previous = select.value;
  select.innerHTML = '';
  if (!v.list.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Nobody in this race yet';
    select.append(opt);
  }
  v.list.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = `#${r.number} ${r.name}`;
    select.append(opt);
  });
  if (previous && v.list.some(r => r.id === previous)) select.value = previous;
}

/* ── Series ────────────────────────────────────────────────────────────── */

function renderSeries() {
  const standings = seriesStandings();
  const body = $('#seriesBody');
  body.innerHTML = '';
  $('#seriesEmpty').classList.toggle('hidden', standings.length > 0);

  standings.forEach((person, i) => {
    const tr = document.createElement('tr');
    if (i === 0 && person.eligible) tr.className = 'is-first';
    if (!person.eligible) tr.classList.add('not-eligible');

    // "—" never started this race, "TBC" on the start list but not home yet.
    const perRace = [];
    for (let n = 1; n <= RACE_COUNT; n++) {
      const diff = person.diffs[n];
      perRace.push({
        n,
        text: diff != null ? fmtGap(diff) : (n in person.diffs ? 'TBC' : '—'),
        dropped: person.dropped.includes(n)
      });
    }

    /* A dropped race still shows — people want to see the one that got binned. */
    const cells = perRace.map(cell => cell.dropped
      ? `<td class="num col-wide is-dropped"><s>${cell.text}</s><span class="visually-hidden"> (dropped)</span></td>`
      : `<td class="num col-wide">${cell.text}</td>`).join('');

    const status = person.eligible
      ? `${person.completed} of ${RACE_COUNT} races · in the running`
      : `${person.completed} of ${RACE_COUNT} races · needs ${GRAND_PRIZE_RACES - person.completed} more to qualify`;

    const sub = [status]
      .concat(perRace.map(c => `R${c.n}&nbsp;${c.text}${c.dropped ? '&nbsp;(dropped)' : ''}`))
      .join(' · ');

    tr.innerHTML = `
      <td class="col-rank"><span class="rank-badge">${person.eligible ? i + 1 : '—'}</span></td>
      <th scope="row" class="col-who">
        <span class="roster-name"></span>
        <span class="racer-sub">${sub}</span>
      </th>
      ${cells}
      <td class="num col-wide">${person.completed}<span class="visually-hidden"> of ${RACE_COUNT}</span></td>
      <td class="num"><strong>${person.completed ? fmtGap(person.total) : '—'}</strong></td>`;
    tr.querySelector('.roster-name').textContent = person.name;
    body.append(tr);
  });

  const container = $('#seriesPrizes');
  container.innerHTML = '';

  const grand = grandPrizeWinner(standings);
  if (grand) {
    const droppedNote = grand.dropped.length
      ? `, worst race (R${grand.dropped.join(', R')}) dropped`
      : '';
    container.append(prizeCard({
      title: 'Grand prize',
      winner: grand.name,
      detail: `${fmtGap(grand.total)} over their best ${GRAND_PRIZE_RACES}${droppedNote}`,
      extra: 'series'
    }));
  }

  const best = mostConsistent(standings);
  if (best) {
    container.append(prizeCard({
      title: 'Most consistent',
      winner: best.name,
      detail: `${fmtGap(best.average)} average across ${best.completed} races`,
      extra: 'series'
    }));
  }

  if (!container.children.length) {
    container.innerHTML = `<p class="empty-state">The grand prize needs someone with ${GRAND_PRIZE_RACES} finished races. Nobody's there yet.</p>`;
  }
}

/* ── Events ────────────────────────────────────────────────────────────── */

wireTabs(showView);

$('#quickFinishForm').addEventListener('submit', e => {
  e.preventDefault();
  const finishAt = Date.now(); // captured before any lookup, so nothing costs the racer time
  const err = $('#quickFinishError');
  const input = $('#quickFinishInput');
  clearFieldErrors(err, [input]);

  const number = Number(input.value.trim());
  const fail = msg => showFieldError(err, msg, input);

  if (!Number.isInteger(number) || number <= 0) return fail('Type a race number.');
  const racer = race().racers.find(r => r.number === number);
  if (!racer) return fail(`No racer with number ${number} in race ${currentRace}.`);

  const outcome = finishRacer(racer.id, finishAt);
  if (!outcome.ok) return fail(outcome.error);

  input.value = '';
  input.focus();
  announceFinish(outcome);
});

$('#quickFinishInput').addEventListener('input', () => {
  const input = $('#quickFinishInput');
  if (input.getAttribute('aria-invalid') === 'true') clearFieldErrors($('#quickFinishError'), [input]);
});

$('#adhocForm').addEventListener('submit', e => {
  e.preventDefault();
  const err = $('#prizeError');
  const labelInput = $('#prizeLabel');
  const select = $('#prizeRacer');
  clearFieldErrors(err, [labelInput, select]);

  const label = labelInput.value.trim();
  if (!label) return showFieldError(err, 'Name the prize first.', labelInput);
  if (!select.value) return showFieldError(err, 'Pick someone to give it to.', select);

  awardPrize(label, select.value);
  labelInput.value = '';
  announce(`${label} awarded.`);
});

$('#resetTimesButton').addEventListener('click', () => {
  if (!confirm(`Clear every start and finish time in race ${currentRace}? The start list stays as it is.`)) return;
  resetTimes();
  announce(`Race ${currentRace} times cleared.`);
});

$('#resetRaceButton').addEventListener('click', () => {
  if (!confirm(`Wipe race ${currentRace} — racers, times and prizes? This cannot be undone.`)) return;
  resetRace();
  announce(`Race ${currentRace} wiped.`);
});

renderPage = render;
showView(initialView(), { moveFocus: false });
boot();
