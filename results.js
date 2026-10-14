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

  const outstanding = v.list.filter(r => !r.finishAt && !isOut(r)).length;
  $('#clockSub').textContent =
    !hasRacers ? 'Nobody on the start list yet.'
      : !first ? `Waiting on wave 1. ${v.list.length} ready to go.`
        : outstanding ? `${outstanding} still out on course.`
          : stopped ? `Race done — clocks stopped on ${fmtClock(stopped - first)}. Head to Results.`
            : 'Everyone is home. Head to Results.';

  const container = $('#waveControls');
  container.innerHTML = '';
  const nudges = waveNudges();
  const targets = waveTargets(v, nudges);

  v.waves.forEach(wave => {
    const members = racersInWave(v, wave);
    if (!members.length) return;

    const start = waveStart(v, wave);
    // Anyone taken out of the race (DNS, DNF) is neither home nor still to come.
    const active = members.filter(r => !isOut(r));
    const outCount = members.length - active.length;
    const home = active.filter(r => r.finishAt).length;
    const done = start && home === active.length;

    const block = document.createElement('section');
    block.className = 'wave-block';
    block.innerHTML = `
      <div class="wave-bar ${start ? (done ? 'done' : 'running') : 'pending'}">
        <div class="wave-bar-main">
          <h3>Wave ${wave}</h3>
          <p class="wave-meta">${home} of ${active.length} home${outCount ? ` · ${outCount} out` : ''}</p>
        </div>
        <p class="wave-clock ${waveClockClass(start, stopped)}"${start && !stopped ? ` data-live-from="${start}"` : ''}>${waveClockText(start, stopped)}</p>
      </div>
      <div class="wave-body"></div>`;

    const target = !start ? targets.get(wave) : null;
    if (target) waveCountdown(block.querySelector('.wave-bar'), wave, target);

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
    // After Start in the DOM, so the tab order matches the page: title, countdown, Start, nudges.
    if (target) block.querySelector('.wave-bar').append(nudgeControls(wave, nudges[wave] || 0));

    const body = block.querySelector('.wave-body');
    members.forEach(r => body.append(timingRow(r, v, start)));
    container.append(block);
  });
}

/* ── Wave countdown ────────────────────────────────────────────────────── */

/* A wave still on the line gets a target start (see waveTargets() in core.js) so the waves
   come home together. Before the first gun it states the plan — "Goes 9:30 after wave 1";
   after it, a countdown that turns into "Start now". It never starts anything: the Start
   button is still the only way a wave goes, early or late. */
function waveCountdown(bar, wave, target) {
  const clock = bar.querySelector('.wave-clock');
  if (target.at === null) {
    clock.textContent = planText(target);
  } else {
    const due = target.at <= Date.now();
    bar.classList.toggle('due', due);
    clock.className = 'wave-clock countdown';
    clock.innerHTML = '<span class="wave-count-label">Start in</span> <span class="wave-count"></span>';
    const count = clock.querySelector('.wave-count');
    count.dataset.countTo = String(target.at);
    count.dataset.dueKey = `${currentRace}:${wave}:${target.at}`;
    count.dataset.dueMessage = `Wave ${wave}: start now.`;
    count.textContent = countdownText(target.at);
  }
}

/** The plan before the first gun: "Goes 10:30 after wave 1". One wording, used on screen and aloud. */
const planText = target => target.offsetMs === 0 ? `Goes with wave ${target.anchor}`
  : `Goes ${fmtGap(target.offsetMs)} ${target.offsetMs > 0 ? 'after' : 'before'} wave ${target.anchor}`;

function nudgeControls(wave, nudge) {
  const row = document.createElement('div');
  row.className = 'wave-nudge';
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', `Adjust wave ${wave}'s target start`);

  const step = (label, delta, key, words) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nudge-button';
    btn.dataset.focusKey = `nudge:${wave}:${key}`;
    btn.textContent = label;
    btn.setAttribute('aria-label', words);
    btn.addEventListener('click', () => {
      nudgeWave(wave, delta);
      announce(nudgeMessage(wave));
      if (delta === 0) {
        // Reset disappears with the nudge it cleared; keep the keyboard in the same group.
        const back = document.querySelector(`[data-focus-key="nudge:${wave}:later"]`);
        if (back) back.focus();
      }
    });
    return btn;
  };

  row.append(
    step(`−${NUDGE_STEP_SEC}s`, -NUDGE_STEP_SEC, 'earlier', `Start wave ${wave} ${NUDGE_STEP_SEC} seconds earlier`),
    step(`+${NUDGE_STEP_SEC}s`, NUDGE_STEP_SEC, 'later', `Start wave ${wave} ${NUDGE_STEP_SEC} seconds later`)
  );

  const note = document.createElement('span');
  note.className = 'wave-nudge-note';
  note.textContent = nudge ? `Nudged ${fmtNudge(nudge)}` : 'On plan';
  row.append(note);
  if (nudge) row.append(step('Reset', 0, 'reset', `Put wave ${wave} back on plan`));
  return row;
}

/** What a nudge did, in one sentence, read from the freshly rendered state. */
function nudgeMessage(wave) {
  const nudge = waveNudges()[wave] || 0;
  const target = waveTargets(raceView(), waveNudges()).get(wave);
  const moved = nudge ? `Wave ${wave} nudged ${fmtNudge(nudge).replace('−', 'minus ')}.` : `Wave ${wave} back on plan.`;
  if (!target) return moved;
  if (target.at === null) return `${moved} ${planText(target)}.`;
  return `${moved} ${target.at <= Date.now() ? 'Start now.' : `Start in ${countdownText(target.at)}.`}`;
}

function timingRow(r, v, start) {
  const out = isOut(r);
  const row = document.createElement('div');
  row.className = 'timing-row' + (out ? ' is-out' : '');
  row.innerHTML = '<span class="timing-result"></span>';
  row.prepend(rosterWho(r));

  /* The editor sits with the name and the tags, away from Finish. Nothing else is ever
     parked beside Finish — it is the one control that must not be pressed by accident. */
  const actions = document.createElement('span');
  actions.className = 'timing-actions';
  if (out) {
    const tag = document.createElement('span');
    tag.className = 'status-tag out';
    tag.textContent = `${r.status.toUpperCase()} · ${OUT_WORDS[r.status]}`;
    actions.append(tag);
    if (r.statusNote) {
      const why = document.createElement('span');
      why.className = 'status-tag';
      why.textContent = `Reason: ${r.statusNote}`;
      actions.append(why);
    }
  } else {
    actions.append(editRacerButton(r));
    if (r.waveOverride) {
      const tag = document.createElement('span');
      tag.className = 'status-tag';
      tag.textContent = 'Wave set by hand';
      actions.append(tag);
    }
  }
  row.insertBefore(actions, row.querySelector('.timing-result'));
  if (racerEdit && racerEdit.id === r.id && !out) row.append(racerEditPanel(r, v));

  const cell = row.querySelector('.timing-result');
  const res = result(r, v);

  if (out) {
    /* Put back takes the place Finish had. It reverses the status, so it carries the quiet
       reversal look (red hover) the app already uses for Undo. */
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'quiet-button';
    btn.dataset.focusKey = `putback:${r.id}`;
    btn.textContent = 'Put back';
    btn.setAttribute('aria-label', `Put ${r.name} back in the race (was ${r.status.toUpperCase()})`);
    btn.addEventListener('click', () => putBack(r));
    cell.append(btn);
  } else if (res) {
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

/* ── Editing one racer ─────────────────────────────────────────────────── */

/* One button, one panel: the predicted time and the wave under one Save, and a separate
   "Take out of the race" zone for DNS and DNF.

   One row at a time is open, and the open panel is state, not DOM. It has to be:
   renderControl() throws the whole wave list away and rebuilds it, and the sheet poll calls
   render() every few seconds, so a form that existed only in the DOM would be snatched away
   mid-correction. Keeping what has been typed here means the rebuild puts the panel back
   exactly as it was, and data-focus-key on the boxes lets keepFocus() drop the caret back
   into the one that had it.

   Shape: { id, minutes, seconds, choice, note, review, error: { message, field } | null }.
   `choice` is the wave select's value — '' for auto, '1'–'6' for a wave. `review` is null,
   'dns' or 'dnf': which outcome's red review card is showing. `field` is 'minutes',
   'seconds', 'wave', 'none' (nothing to save) or 'review' (the card's own message). */
let racerEdit = null;

const NOTHING_TO_SAVE = 'Nothing to save yet. Change the time or the wave, or Cancel.';

/* Ids are built off the race NUMBER, not the id: `number` is coerced through Number()
   in cleanRace(), so it cannot carry anything that would break out of an attribute.
   `id` is a string off the sheet and only ever goes into dataset or a CSS.escape(). */
const racerEditIds = r => ({
  panel: `racerEdit-${r.number}`,
  title: `racerEditTitle-${r.number}`,
  minutes: `racerMinutes-${r.number}`,
  seconds: `racerSeconds-${r.number}`,
  wave: `racerWave-${r.number}`,
  help: `racerHelp-${r.number}`,
  error: `racerError-${r.number}`,
  zone: `racerZone-${r.number}`,
  why: `racerWhy-${r.number}`,
  note: `racerNote-${r.number}`,
  reviewError: `racerReviewError-${r.number}`
});

/** The one trigger on a racer's row. */
function editRacerButton(r) {
  const open = !!racerEdit && racerEdit.id === r.id;
  const btn = document.createElement('button');
  btn.type = 'button';
  /* .neutral because this is not a reversal and not a removal: the plain .quiet-button
     hover goes red, which on a button that only opens a panel would be a lie. */
  btn.className = 'quiet-button neutral';
  btn.dataset.focusKey = `edit:${r.id}`;
  btn.textContent = 'Edit racer';
  btn.setAttribute('aria-label', `Edit racer ${r.name}: call time, wave, DNS or DNF`);
  btn.setAttribute('aria-expanded', String(open));
  if (open) btn.setAttribute('aria-controls', racerEditIds(r).panel);
  btn.addEventListener('click', () => (open ? closeRacerEdit(r.id) : openRacerEdit(r)));
  return btn;
}

function openRacerEdit(r) {
  racerEdit = {
    id: r.id,
    minutes: String(Math.floor(r.predictedSec / 60)),
    seconds: String(r.predictedSec % 60),
    choice: r.waveOverride ? String(r.waveOverride) : '',
    note: '',
    review: null,
    error: null
  };
  render();
  focusByKey(`racer-min:${r.id}`);
}

/* Focus is moved AFTER render(), never during it. renderControl() builds each row and
   its panel detached and appends the finished wave block afterwards, and .focus() on a
   node that is not in the document yet does nothing at all — silently. */
function focusByKey(key) {
  const el = document.querySelector(`[data-focus-key="${CSS.escape(key)}"]`);
  if (el) el.focus();
}

/** The panel is about to disappear, so this decides where focus lands: back on Edit racer. */
function closeRacerEdit(id) {
  racerEdit = null;
  render();
  focusByKey(`edit:${id}`);
}

function failRacerEdit(message, field) {
  racerEdit.error = { message, field };
  const id = racerEdit.id;
  render();
  focusByKey(field === 'seconds' ? `racer-sec:${id}` : field === 'wave' ? `racer-wave:${id}` : `racer-min:${id}`);
}

/** One Save for the time and the wave. Reuses the same two mutations the old buttons did. */
function saveRacerEdit(r) {
  const state = racerEdit;
  const parsed = parsePredictedTime(state.minutes, state.seconds);
  if (!parsed.ok) return failRacerEdit(parsed.error, parsed.field);

  const timeChanged = parsed.predictedSec !== r.predictedSec;
  const waveChanged = state.choice !== (r.waveOverride ? String(r.waveOverride) : '');
  if (!timeChanged && !waveChanged) return failRacerEdit(NOTHING_TO_SAVE, 'none');

  /* Closed before the mutations, so their own renders draw the tidied row and there is no
     second rebuild to undo the first. The wave goes first because it is the one that can be
     refused, and a refusal must leave the call untouched. */
  racerEdit = null;
  if (waveChanged) {
    const outcome = setRacerWave(r.id, state.choice === '' ? null : Number(state.choice));
    if (!outcome.ok) {
      racerEdit = state;
      return failRacerEdit(outcome.error, 'wave');
    }
  }
  if (timeChanged) {
    const outcome = setPredictedTime(r.id, parsed.predictedSec);
    if (!outcome.ok) {
      racerEdit = state;
      return failRacerEdit(outcome.error, 'minutes');
    }
  }

  focusByKey(`edit:${r.id}`);
  const now = racerById(raceView(), r.id);
  const parts = [];
  if (timeChanged) parts.push(`call is now ${fmtSec(parsed.predictedSec)}`);
  if (waveChanged) parts.push(now.waveOverride ? `wave is ${now.waveOverride}, set by hand` : 'wave is back on auto');
  announce(`Saved. ${r.name}'s ${parts.join(' and ')}.`);
}

/** Open the red review card for one outcome. Nothing is saved until its own button is pressed. */
function reviewOut(r, kind) {
  racerEdit.review = kind;
  racerEdit.note = '';
  racerEdit.error = null;
  render();
  focusByKey(`out-head:${r.id}`);
}

function confirmOut(r) {
  const state = racerEdit;
  const kind = state.review;
  racerEdit = null;
  const outcome = setRacerStatus(r.id, kind, state.note);
  if (!outcome.ok) {
    racerEdit = state;
    state.error = { message: outcome.error, field: 'review' };
    render();
    focusByKey(`out-head:${r.id}`);
    return;
  }
  focusByKey(`putback:${r.id}`);
  const reason = outcome.racer.statusNote;
  announce(`${r.name} is marked ${kind.toUpperCase()}.${reason ? ` Reason: ${reason}.` : ''}`);
}

function putBack(r) {
  const was = r.status.toUpperCase();
  const outcome = setRacerStatus(r.id, '');
  if (!outcome.ok) return announce(outcome.error);
  focusByKey(`edit:${r.id}`);
  announce(`${r.name} is back in the race (was ${was}).`);
}

function racerEditPanel(r, v) {
  const state = racerEdit;
  const id = racerEditIds(r);
  const open = outOptions(v, r);
  /* The race can move on under an open review card (another phone fires the gun), so a
     review for an outcome that has just closed is dropped rather than left to fail at Save. */
  if (state.review && !open[state.review]) state.review = null;

  const panel = document.createElement('div');
  panel.className = 'timing-edit';
  panel.id = id.panel;
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-labelledby', id.title);
  panel.innerHTML = `
    <h4 class="timing-edit-title" id="${id.title}"></h4>
    <form class="edit-form" novalidate>
      <fieldset class="time-field">
        <legend class="visually-hidden"></legend>
        <div class="edit-fields">
          <span class="field">
            <label for="${id.minutes}">Minutes</label>
            <input id="${id.minutes}" name="minutes" type="number" inputmode="numeric" min="0" max="599" step="1" placeholder="0" aria-describedby="${id.help}" />
          </span>
          <span class="field">
            <label for="${id.seconds}">Seconds</label>
            <input id="${id.seconds}" name="seconds" type="number" inputmode="numeric" min="0" max="59" step="1" placeholder="00" aria-describedby="${id.help}" />
          </span>
          <span class="field wide">
            <label for="${id.wave}">Wave</label>
            <select id="${id.wave}" name="wave"></select>
          </span>
        </div>
      </fieldset>
      <p class="helper-text" id="${id.help}">Leave a box empty and we count it as zero.</p>
      <p class="form-error hidden" id="${id.error}" role="alert"></p>
      <div class="dialog-footer">
        <button type="button" class="secondary-button">Cancel</button>
        <button type="submit" class="save-button">Save changes</button>
      </div>
    </form>
    <section class="take-out" id="${id.zone}" aria-labelledby="${id.zone}-h">
      <h4 id="${id.zone}-h">Take out of the race</h4>
    </section>`;

  /* Racer names come off a sheet anybody with the sign-up link can write to, so they go
     in as text, never as markup — same rule the roster and the board follow. */
  panel.querySelector('.timing-edit-title').textContent = `Edit ${r.name}`;
  panel.querySelector('legend').textContent = `Predicted time and wave for ${r.name}`;

  const form = panel.querySelector('.edit-form');
  const minutes = form.querySelector('input[name="minutes"]');
  const seconds = form.querySelector('input[name="seconds"]');
  const select = form.querySelector('select');
  const err = form.querySelector('.form-error');

  const current = v.map.get(r.id);
  const auto = document.createElement('option');
  auto.value = '';
  auto.textContent = 'Auto (let the app group them)';
  select.append(auto);
  for (let w = 1; w <= MAX_WAVES; w++) {
    const opt = document.createElement('option');
    opt.value = String(w);
    opt.textContent = `Wave ${w}` + (w === current ? ' (current)' : '');
    select.append(opt);
  }

  minutes.value = state.minutes;
  seconds.value = state.seconds;
  select.value = state.choice;
  minutes.dataset.focusKey = `racer-min:${r.id}`;
  seconds.dataset.focusKey = `racer-sec:${r.id}`;
  select.dataset.focusKey = `racer-wave:${r.id}`;

  const fields = [minutes, seconds, select];
  const clearError = () => {
    if (!state.error || state.error.field === 'review') return;
    state.error = null;
    clearFieldErrors(err, fields);
  };
  [minutes, seconds].forEach(box => {
    box.addEventListener('input', () => {
      if (racerEdit !== state) return; // a poll rebuilt the panel; this one is a ghost
      state.minutes = minutes.value;
      state.seconds = seconds.value;
      clearError();
    });
  });
  select.addEventListener('change', () => {
    if (racerEdit !== state) return;
    state.choice = select.value;
    clearError();
  });

  /* Wires the ARIA and shows the message, but never moves the caret: this runs on every
     render, including the four-second sheet poll, and nothing should yank focus out of the
     box someone is mid-way through correcting. failRacerEdit() does the one focus move
     there is, after the row is in the document. 'none' has no bad field to mark. */
  if (state.error && state.error.field !== 'review') {
    const target = { minutes, seconds, wave: select }[state.error.field] || null;
    showFieldError(err, state.error.message, target, { moveFocus: false });
  }

  form.addEventListener('submit', e => { e.preventDefault(); saveRacerEdit(r); });
  form.querySelector('.secondary-button').addEventListener('click', () => closeRacerEdit(r.id));

  racerTakeOutZone(panel.querySelector('.take-out'), r, open, id);

  /* Opened the wrong row is the common mistake, so the common escape hatch works. Not a
     dialog and nothing is trapped here — this is a convenience, not the only way out. */
  panel.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    closeRacerEdit(r.id);
  });
  return panel;
}

/** The dashed red zone: DNS and DNF, or the review card for the one that was tapped. */
function racerTakeOutZone(zone, r, open, id) {
  const state = racerEdit;

  if (!state.review) {
    const buttons = document.createElement('div');
    buttons.className = 'take-out-buttons';
    [['dns', 'Did not start (DNS)'], ['dnf', 'Did not finish (DNF)']].forEach(([kind, label]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'secondary-button danger';
      btn.dataset.focusKey = `out-${kind}:${r.id}`;
      btn.textContent = label;
      if (open[kind]) btn.addEventListener('click', () => reviewOut(r, kind));
      else {
        /* aria-disabled rather than disabled, so a screen-reader user can still land on it
           and hear why — the sentence below is its description. */
        btn.setAttribute('aria-disabled', 'true');
        btn.setAttribute('aria-describedby', id.why);
        btn.classList.add('is-closed');
        btn.addEventListener('click', e => e.preventDefault());
      }
      buttons.append(btn);
    });
    const why = document.createElement('p');
    why.className = 'helper-text';
    why.id = id.why;
    why.textContent = open.why;
    zone.append(buttons);
    if (!open.dns || !open.dnf) zone.append(why);
    return;
  }

  const kind = state.review;
  const dnf = kind === 'dnf';
  const form = document.createElement('form');
  form.className = 'review-form';
  form.noValidate = true;
  form.innerHTML = `
    <div class="review-card">
      <h5 class="review-title" tabindex="-1"></h5>
      <ul>
        <li>They get no result in this race.</li>
        <li>${dnf ? 'Their clock stops.' : 'They will not start.'}</li>
        <li>You can put them back from the row.</li>
      </ul>
      ${dnf ? `<span class="field">
        <label for="${id.note}">Reason (optional)</label>
        <input id="${id.note}" type="text" maxlength="${STATUS_NOTE_MAX}" placeholder="For example: injured, mechanical" autocomplete="off" />
      </span>` : ''}
    </div>
    <p class="form-error hidden" id="${id.reviewError}" role="alert"></p>
    <div class="dialog-footer">
      <button type="button" class="secondary-button">Back</button>
      <button type="submit" class="secondary-button danger">Mark as ${kind.toUpperCase()}</button>
    </div>`;
  const head = form.querySelector('.review-title');
  head.textContent = `Mark ${r.name} as ${kind.toUpperCase()}?`;
  head.dataset.focusKey = `out-head:${r.id}`;

  if (dnf) {
    const note = form.querySelector('input');
    note.value = state.note;
    note.dataset.focusKey = `out-note:${r.id}`;
    note.addEventListener('input', () => { if (racerEdit === state) state.note = note.value; });
    /* Enter here must never mark anyone DNS or DNF by accident: it is a text box inside a
       form, and a form submits on Enter. The only way to confirm is the button. */
    note.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
  }

  if (state.error && state.error.field === 'review') {
    showFieldError(form.querySelector('.form-error'), state.error.message, null, { moveFocus: false });
  }

  form.addEventListener('submit', e => { e.preventDefault(); confirmOut(r); });
  form.querySelector('.secondary-button').addEventListener('click', () => {
    state.review = null;
    state.error = null;
    render();
    focusByKey(`out-${kind}:${r.id}`);
  });
  zone.append(form);
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
  const running = v.list.filter(r => !r.finishAt && !isOut(r));
  const outRacers = v.list.filter(isOut);
  $('#boardEmpty').classList.toggle('hidden', rows.length + running.length + outRacers.length > 0);

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

  /* Out of the race: listed so nobody wonders where they went, with the words and not just a
     tint. No rank, and no result to score. */
  outRacers.forEach(r => {
    const tr = document.createElement('tr');
    tr.className = 'is-running';
    tr.innerHTML = `
      <td class="col-rank">—</td>
      <th scope="row" class="col-who">
        <span class="racer-cell">
          <span class="bib"><span class="visually-hidden">Racer </span><span class="bib-number"></span></span>
          <span class="roster-name"></span>
        </span>
        <span class="racer-sub">called ${fmtSec(r.predictedSec)} · ${OUT_WORDS[r.status].toLowerCase()}</span>
      </th>
      <td class="num col-wide">${fmtSec(r.predictedSec)}</td>
      <td class="num col-wide">—</td>
      <td class="num"><span class="status-tag out">${r.status.toUpperCase()} · ${OUT_WORDS[r.status]}</span></td>`;
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
        text: diff != null ? fmtGap(diff) : person.outs[n] ? person.outs[n].toUpperCase() : (n in person.diffs ? 'TBC' : '—'),
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

  const typed = input.value.trim();
  const query = nameKey(typed);
  const fail = msg => showFieldError(err, msg, input);

  if (!query) return fail('Type a racer name.');
  // An exact name wins. Otherwise a start-of-name match works if it points to one racer.
  const racers = race().racers;
  const exact = racers.filter(r => nameKey(r.name) === query);
  const matches = exact.length ? exact : racers.filter(r => nameKey(r.name).startsWith(query));
  if (!matches.length) return fail(`No racer called "${typed}" in race ${currentRace}.`);
  if (matches.length > 1) {
    return fail(`More than one racer fits "${typed}": ${matches.map(r => r.name).join(', ')}. Type more of the name.`);
  }
  const racer = matches[0];

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
