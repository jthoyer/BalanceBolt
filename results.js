/* Balance Tri Club — race control and results page.
   Two jobs on one page, kept apart by three panels: Timing, Results, Series.
   The shared model is in core.js. */

const VIEWS = ['timing', 'board', 'series'];

function currentView() {
  return VIEWS.includes(ui.resultsView) ? ui.resultsView : 'timing';
}

function showView(view, { moveFocus = true } = {}) {
  if (!VIEWS.includes(view)) return;
  ui.resultsView = view;
  save();
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

function announceFinish({ racer, res }) {
  const gap = res ? `, ${sayDelta(res.delta)}` : '';
  announce(`Racer ${racer.number}, ${racer.name}, finished${gap}.`);
}

/* ── Leaderboard ───────────────────────────────────────────────────────── */

function renderBoard(v) {
  const rows = ranked(v);
  const running = v.list.filter(r => !r.finishAt);
  $('#boardEmpty').classList.toggle('hidden', rows.length + running.length > 0);

  const podium = $('#podium');
  podium.innerHTML = '';
  if (rows.length) {
    podium.append(podiumCard('first', 'CLOSEST TO THE CALL', rows[0]));
    if (rows.length > 1) podium.append(podiumCard('last', 'FURTHEST FROM THE CALL', rows[rows.length - 1]));
  }

  const body = $('#boardBody');
  body.innerHTML = '';

  rows.forEach((row, i) => {
    const tr = document.createElement('tr');
    if (i === 0) tr.className = 'is-first';
    else if (i === rows.length - 1 && rows.length > 1) tr.className = 'is-last';
    tr.innerHTML = `
      <td class="col-rank"><span class="rank-badge">${i + 1}</span></td>
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

function podiumCard(kind, eyebrow, row) {
  const card = document.createElement('div');
  card.className = `podium-card ${kind}`;
  card.innerHTML = `
    <p class="eyebrow">${eyebrow}</p>
    <p class="podium-name"></p>
    <p class="podium-delta">${fmtDelta(row.delta)}</p>
    <p class="podium-detail">Called ${fmtSec(row.racer.predictedSec)} · ran ${fmtClock(row.elapsed)}</p>`;
  card.querySelector('.podium-name').textContent = `#${row.racer.number} ${row.racer.name}`;
  return card;
}

/* ── Prizes ────────────────────────────────────────────────────────────── */

/** The fun stuff: automatic awards plus anything the organiser invents on the day. */
function autoPrizes(v) {
  const rows = ranked(v);
  if (!rows.length) return [];
  const prizes = [];
  const who = row => `#${row.racer.number} ${row.racer.name}`;

  const bangOn = rows.filter(r => r.absDelta <= BANG_ON_MS);
  if (bangOn.length) {
    prizes.push({
      title: 'Bang on',
      winner: bangOn.map(who).join(', '),
      detail: `Inside ${BANG_ON_MS / 1000} seconds of their own call`
    });
  }

  const fastest = [...rows].sort((a, b) => a.elapsed - b.elapsed)[0];
  prizes.push({ title: 'Quickest legs', winner: who(fastest), detail: `${fmtClock(fastest.elapsed)} on the day` });

  const rabbit = [...rows].sort((a, b) => a.delta - b.delta)[0];
  if (rabbit.delta < 0) {
    prizes.push({ title: 'Off like a rabbit', winner: who(rabbit), detail: `${fmtDelta(rabbit.delta)} — sandbagged the prediction` });
  }

  const scenic = [...rows].sort((a, b) => b.delta - a.delta)[0];
  if (scenic.delta > 0) {
    prizes.push({ title: 'Took the scenic route', winner: who(scenic), detail: `${fmtDelta(scenic.delta)} — worth every second` });
  }

  if (v.waves.length > 1) {
    v.waves.forEach(wave => {
      const best = rows.find(r => v.map.get(r.racer.id) === wave);
      if (best) prizes.push({ title: `Wave ${wave} winner`, winner: who(best), detail: fmtDelta(best.delta) });
    });
  }
  return prizes;
}

function prizeCard({ title, winner, detail, extra }) {
  const card = document.createElement('article');
  card.className = 'prize-card' + (extra ? ' ' + extra : '');
  card.innerHTML = '<h3></h3><p class="prize-winner"></p><p class="prize-detail"></p>';
  card.querySelector('h3').textContent = title;
  card.querySelector('.prize-winner').textContent = winner;
  card.querySelector('.prize-detail').textContent = detail;
  return card;
}

function renderPrizes(v) {
  const container = $('#prizeList');
  container.innerHTML = '';

  autoPrizes(v).forEach(p => container.append(prizeCard(p)));

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
    container.innerHTML = '<p class="empty-state">Prizes appear as soon as the first racer finishes.</p>';
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
showView(currentView(), { moveFocus: false });
boot();
