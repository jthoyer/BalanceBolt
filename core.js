/* Balance Tri Club — prediction race timing, shared core.
   Google Apps Script Web App URL — see apps-script.gs for setup.
   Leave it empty and the app still works, storing everything on this device only. */
const API_URL = 'https://script.google.com/macros/s/AKfycbyav9iA4QOLEb5xXcuolIcTmJNTXwHxNx0Y7EbktzFEtQan3DvhFd4LeJ0T52Hwy33s9w/exec';

/* Shared by index.html (sign-up) and boltresults.html (timing + results).
   Nothing in here touches page-specific markup: pages set `renderPage` and call `boot()`. */

const MAX_WAVES = 4;
/* Racers within five minutes of each other's predicted time share a wave. */
const WAVE_SPAN_SEC = 5 * 60;
const RACE_COUNT = 5;
const POLL_MS = 4000;
const TICK_MS = 200;
const STORE_KEY = 'balance-timing-v2';
const UI_KEY = 'balance-timing-ui-v2';
const LEGACY_STORE_KEY = 'balance-timing-v1';
const BANG_ON_MS = 5000;
const CONSISTENT_MIN_RACES = 3;
/* Grand prize is best four of the five races: finish four to qualify, and if you
   race all five your worst one is dropped. Per-race prizes are unaffected. */
const GRAND_PRIZE_RACES = 4;


const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

/** Pages replace this with their own render function before calling boot(). */
let renderPage = () => {};

/* ── Storage ───────────────────────────────────────────────────────────── */

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) ?? fallback);
  } catch { return fallback; }
}

const emptyRace = () => ({ racers: [], waveStarts: {}, wavesLocked: false, prizes: [] });

function emptyDb() {
  const races = {};
  for (let n = 1; n <= RACE_COUNT; n++) races[n] = emptyRace();
  return { races };
}

const validRace = n => Number.isInteger(n) && n >= 1 && n <= RACE_COUNT;

/** Coerce whatever came off the wire or out of storage into the shape we expect. */
function cleanRace(src) {
  const raw = src && typeof src === 'object' ? src : {};
  const waveStarts = {};
  Object.entries(raw.waveStarts || {}).forEach(([w, t]) => {
    const wave = Number(w);
    const at = Number(t);
    if (wave > 0 && at > 0) waveStarts[wave] = at;
  });
  return {
    racers: (Array.isArray(raw.racers) ? raw.racers : []).map(r => ({
      id: String(r.id),
      number: Number(r.number),
      name: String(r.name),
      predictedSec: Number(r.predictedSec),
      wave: r.wave ? Number(r.wave) : null,
      finishAt: r.finishAt ? Number(r.finishAt) : null
    })),
    waveStarts,
    wavesLocked: !!raw.wavesLocked,
    prizes: (Array.isArray(raw.prizes) ? raw.prizes : []).map(p => ({
      id: String(p.id),
      label: String(p.label),
      racerId: String(p.racerId),
      awardedAt: Number(p.awardedAt) || 0
    }))
  };
}

function cleanDb(src) {
  const out = emptyDb();
  const races = (src && src.races) || {};
  for (let n = 1; n <= RACE_COUNT; n++) out.races[n] = cleanRace(races[n]);
  return out;
}

/** v1 stored a single race at the top level. That race becomes Race 1 rather than being lost. */
function loadDb() {
  const stored = read(STORE_KEY, null);
  if (stored && stored.races) return cleanDb(stored);

  const fresh = emptyDb();
  const legacy = read(LEGACY_STORE_KEY, null);
  if (legacy && Array.isArray(legacy.racers)) {
    fresh.races[1] = cleanRace(legacy);
    // Write straight away so the migration only ever runs once.
    localStorage.setItem(STORE_KEY, JSON.stringify(fresh));
  }
  return fresh;
}

let db = loadDb();
let outbox = read(STORE_KEY + '-outbox', []);
let ui = read(UI_KEY, {});
let syncState = API_URL ? 'idle' : 'local';

/* True once this device has refused to write. Everything still works in memory,
   but a refresh would lose it, so the pill has to say so rather than sit there
   looking healthy while sign-ups quietly evaporate. */
let storageBroken = false;

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(db));
    localStorage.setItem(STORE_KEY + '-outbox', JSON.stringify(outbox));
    localStorage.setItem(UI_KEY, JSON.stringify(ui));
    if (storageBroken) {
      storageBroken = false;
      setSync(syncState);
      announce('Saving on this device again.');
    }
  } catch (err) {
    // Never rethrow: the caller still has to queue the change and redraw the screen.
    if (!storageBroken) {
      storageBroken = true;
      announce('Cannot save on this device — storage is full or blocked. Do not close this tab.');
    }
    setSync(syncState, err.message);
  }
}

const uid = prefix => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ── Which race are we looking at ──────────────────────────────────────── */

function initialRace() {
  const fromUrl = Number(new URLSearchParams(location.search).get('race'));
  if (validRace(fromUrl)) return fromUrl;
  const fromUi = Number(ui.race);
  return validRace(fromUi) ? fromUi : 1;
}

let currentRace = initialRace();

/** The race object currently on screen. */
const race = (n = currentRace) => db.races[n];

function setRace(n) {
  if (!validRace(n) || n === currentRace) return;
  currentRace = n;
  ui.race = n;
  save();
  reflectRaceInUrl();
  renderPage();
}

/** Keep ?race=N in the address bar so a screen can be parked on one race. */
function reflectRaceInUrl() {
  const url = new URL(location.href);
  url.searchParams.set('race', String(currentRace));
  history.replaceState(null, '', url);
}

/* ── Time helpers ──────────────────────────────────────────────────────── */

/** ms → "m:ss", always rounded down to the whole second. */
function fmtClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

const fmtSec = sec => fmtClock(sec * 1000);

/** Absolute gap, rounded to the nearest second: "1:23". */
const fmtGap = ms => fmtClock(Math.round(Math.abs(ms) / 1000) * 1000);

/** Signed gap between actual and predicted, in plain words. */
function fmtDelta(deltaMs) {
  const rounded = Math.round(deltaMs / 1000) * 1000;
  if (rounded === 0) return 'Dead on';
  return `${fmtClock(Math.abs(rounded))} ${rounded > 0 ? 'over' : 'under'}`;
}

/** Spoken form for the announcer — "1 minute 5 seconds over". */
function sayDelta(deltaMs) {
  const rounded = Math.round(Math.abs(deltaMs) / 1000);
  if (rounded === 0) return 'dead on their call';
  const m = Math.floor(rounded / 60);
  const s = rounded % 60;
  const parts = [];
  if (m) parts.push(`${m} minute${m === 1 ? '' : 's'}`);
  if (s) parts.push(`${s} second${s === 1 ? '' : 's'}`);
  return `${parts.join(' ')} ${deltaMs > 0 ? 'over' : 'under'}`;
}

/* ── Derived race data ─────────────────────────────────────────────────── */

/* Everything derived is computed once per render into a "view" and passed around,
   so a 100-racer board never rebuilds the wave map 100 times. */

/** The next wave that hasn't fired yet — where a late sign-up lands. */
function nextOpenWave(data) {
  const known = new Set();
  data.racers.forEach(r => { if (r.wave) known.add(Number(r.wave)); });
  Object.keys(data.waveStarts).forEach(w => known.add(Number(w)));
  const ordered = [...known].sort((a, b) => a - b);
  const waiting = ordered.find(w => data.waveStarts[w] == null);
  return waiting ?? ordered[ordered.length - 1] ?? 1;
}

/**
 * Group racers whose predicted times sit within WAVE_SPAN_SEC of each other, so a wave
 * goes off together and comes home together. Walk the field in predicted-time order and
 * start a new wave the moment someone is more than five minutes off the wave's quickest
 * call. Wave 1 is the quickest predictions.
 *
 * That can produce more than MAX_WAVES groups, and four is a hard cap, so the closest
 * neighbouring groups are merged back together until four remain. Merging the pair with
 * the smallest combined span keeps the five-minute rule true for as many waves as it can.
 */
function groupByPredicted(list) {
  const ordered = [...list].sort((a, b) => a.predictedSec - b.predictedSec || a.number - b.number);
  if (!ordered.length) return [];

  const groups = [];
  ordered.forEach(racer => {
    const current = groups[groups.length - 1];
    if (current && racer.predictedSec - current[0].predictedSec <= WAVE_SPAN_SEC) current.push(racer);
    else groups.push([racer]);
  });

  const span = group => group[group.length - 1].predictedSec - group[0].predictedSec;
  while (groups.length > MAX_WAVES) {
    let bestAt = 0;
    let bestSpan = Infinity;
    for (let i = 0; i < groups.length - 1; i++) {
      const merged = span(groups[i].concat(groups[i + 1]));
      if (merged < bestSpan) { bestSpan = merged; bestAt = i; }
    }
    groups.splice(bestAt, 2, groups[bestAt].concat(groups[bestAt + 1]));
  }
  return groups;
}

/** Waves stay fluid — and grouped by predicted time — until the first gun goes off. */
function buildWaveMap(data, list) {
  const map = new Map();
  if (data.wavesLocked) {
    const fallback = nextOpenWave(data);
    list.forEach(r => map.set(r.id, Number(r.wave) || fallback));
    return map;
  }
  groupByPredicted(list).forEach((group, i) => {
    group.forEach(racer => map.set(racer.id, i + 1));
  });
  return map;
}

function raceView(n = currentRace) {
  const data = race(n);
  const list = [...data.racers].sort((a, b) => a.number - b.number);
  const map = buildWaveMap(data, list);
  const waves = new Set([...map.values()]);
  Object.keys(data.waveStarts).forEach(w => waves.add(Number(w)));
  return { race: n, data, list, map, waves: [...waves].sort((a, b) => a - b) };
}

const waveStart = (v, wave) => v.data.waveStarts[wave] ?? null;
const racersInWave = (v, wave) => v.list.filter(r => v.map.get(r.id) === wave);
const racerById = (v, id) => v.list.find(r => r.id === id);

/** A racer's finish, or null while they're still out on course. */
function result(racer, v) {
  const start = waveStart(v, v.map.get(racer.id));
  if (!start || !racer.finishAt) return null;
  const elapsed = Math.max(0, racer.finishAt - start);
  const delta = elapsed - racer.predictedSec * 1000;
  return { elapsed, delta, absDelta: Math.abs(delta) };
}

/**
 * The instant the last racer stopped their clock, or null while the race is still on.
 * Once this is set every clock freezes here: the race is over, so nothing should still
 * be counting up. Undo a finish and it goes back to null and the clocks resume.
 */
function raceStoppedAt(v) {
  if (!v.list.length) return null;
  if (!Object.keys(v.data.waveStarts).length) return null;
  if (v.list.some(r => !r.finishAt)) return null;
  // Everyone who started has to have started: a racer in a wave still on the line is not home.
  if (v.list.some(r => waveStart(v, v.map.get(r.id)) === null)) return null;
  return v.list.reduce((last, r) => Math.max(last, r.finishAt), 0);
}

/** Everyone who has crossed the line, closest-to-their-call first. */
function ranked(v) {
  return v.list
    .map(r => ({ racer: r, res: result(r, v) }))
    .filter(row => row.res)
    .map(row => ({ racer: row.racer, ...row.res }))
    .sort((a, b) => a.absDelta - b.absDelta || a.elapsed - b.elapsed);
}

/* ── Series ────────────────────────────────────────────────────────────── */

/** People are the same person across races when their name matches, ignoring case and stray spaces. */
const nameKey = name => String(name).trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Series standings — best four of five.
 * Finish four races to be eligible for the grand prize; race all five and your worst
 * result is dropped. Eligible people rank above everyone else, then on the smallest
 * best-four total. Nobody wins the grand prize on two blinding races and three no-shows.
 */
function seriesStandings() {
  const people = new Map();

  for (let n = 1; n <= RACE_COUNT; n++) {
    const v = raceView(n);
    v.list.forEach(racer => {
      const key = nameKey(racer.name);
      if (!people.has(key)) {
        people.set(key, { key, name: racer.name, diffs: {}, entered: [], completed: 0 });
      }
      const person = people.get(key);
      person.entered.push(n);
      const res = result(racer, v);
      person.diffs[n] = res ? res.absDelta : null;
      if (res) person.completed += 1;
    });
  }

  return [...people.values()]
    .map(p => {
      const finished = Object.entries(p.diffs)
        .filter(([, diff]) => diff != null)
        .map(([n, diff]) => ({ race: Number(n), diff }))
        .sort((a, b) => a.diff - b.diff);

      const counted = finished.slice(0, GRAND_PRIZE_RACES);
      const dropped = finished.slice(GRAND_PRIZE_RACES);
      const sum = list => list.reduce((t, r) => t + r.diff, 0);
      const byRace = (a, b) => a - b;

      return {
        ...p,
        counted: counted.map(r => r.race).sort(byRace),
        dropped: dropped.map(r => r.race).sort(byRace),
        total: sum(counted),                                    // the best four only
        allTotal: sum(finished),
        average: p.completed ? sum(finished) / p.completed : null,
        eligible: p.completed >= GRAND_PRIZE_RACES
      };
    })
    .sort((a, b) =>
      Number(b.eligible) - Number(a.eligible) ||
      (a.eligible
        ? a.total - b.total
        : b.completed - a.completed || a.total - b.total) ||
      a.name.localeCompare(b.name));
}

/** Whoever leads the eligible group, or null if nobody has four races yet. */
function grandPrizeWinner(standings = seriesStandings()) {
  return standings.find(p => p.eligible) || null;
}

/** Series-wide prize: lowest average difference across at least three races. */
function mostConsistent(standings = seriesStandings()) {
  const eligible = standings.filter(p => p.completed >= CONSISTENT_MIN_RACES);
  if (!eligible.length) return null;
  return [...eligible].sort((a, b) => a.average - b.average || b.completed - a.completed)[0];
}

/* ── Sync ──────────────────────────────────────────────────────────────── */

async function post(action, payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...payload })
  });
  const data = await res.json();
  if (data.error) {
    // The sheet understood us and said no. Sending it again will just get the same no.
    const rejected = new Error(data.error);
    rejected.rejected = true;
    throw rejected;
  }
  return data;
}

/** Local-first: the change is already saved, this only tries to tell the sheet about it. */
function queue(action, payload) {
  if (!API_URL) return;
  outbox.push({ action, payload: { race: currentRace, ...payload } });
  save();
  sync();
}

let syncing = false;
/* The last snapshot we actually applied, as raw text. Two jobs: skip a redraw when
   the sheet hasn't changed, and give the guard in the pull below something to compare. */
let lastPulledRaw = null;
async function sync({ pull = false } = {}) {
  if (!API_URL || syncing) return;
  syncing = true;
  try {
    while (outbox.length) {
      const op = outbox[0];
      try {
        await post(op.action, op.payload);
      } catch (err) {
        /* Offline is worth waiting out. A refusal is not: leaving it at the head of
           the queue would block every sign-up and finish behind it, for good. */
        if (!err.rejected) throw err;
        outbox.shift();
        save();
        console.warn('Dropped an unsendable change:', op.action, err.message);
        setSync('error', `Dropped an unsendable change: ${err.message}`);
        continue;
      }
      outbox.shift();
      save();
    }
    if (pull) {
      const res = await fetch(API_URL);
      const raw = await res.text();
      const data = JSON.parse(raw);
      if (data.error) throw new Error(data.error);
      /* Two reasons to drop this snapshot rather than apply it.

         The outbox emptied above, but `await fetch` is a second gap, and a finish
         pressed during it queues a change whose own sync() call does nothing —
         `syncing` is still true. This snapshot was taken before that finish existed,
         so applying it would wipe a time that is sitting safely in the outbox waiting
         to send. The timer then sees the racer as still running, presses Finish again,
         and the second, later time overwrites the real one on the sheet. That is a
         corrupted result in an app whose whole job is getting the time right.

         The second reason is cheaper but constant: renderPage() throws the board away
         and rebuilds it, and at a 4 second poll that is a full rebuild every 4 seconds
         for a whole race, on a phone, usually to draw exactly what was already there. */
      if (!outbox.length && raw !== lastPulledRaw) {
        lastPulledRaw = raw;
        db = cleanDb(data);
        save();
        renderPage();
      }
    }
    setSync('ok');
  } catch (err) {
    setSync('error', err.message);
  } finally {
    syncing = false;
  }
}

/* The pill is a plain label, not a live region: at a 4 second poll it would natter
   constantly. Only a genuine change of state is announced, and only once. */
let lastSpokenSync = '';
function setSync(state, detail) {
  syncState = state;
  const pill = $('#syncPill');
  if (!pill) return;
  const pending = outbox.length;

  let label;
  if (storageBroken) label = 'Not saving on this device';
  else if (!API_URL) label = 'Local only';
  else if (state === 'error') label = pending ? `Offline — ${pending} to send` : 'Sheet unreachable';
  else if (pending) label = `Saving ${pending}…`;
  else label = 'Synced';

  pill.classList.toggle('ok', state === 'ok' && !pending && !storageBroken);
  pill.classList.toggle('error', state === 'error' || storageBroken);
  if (pill.textContent !== label) pill.textContent = label;
  pill.title = detail || '';

  if (!API_URL) return;
  const spoken = state === 'error' ? 'offline' : 'online';
  if (spoken !== lastSpokenSync) {
    lastSpokenSync = spoken;
    announce(spoken === 'offline'
      ? 'Sheet unreachable. Times are safe on this device and will send when the signal returns.'
      : 'Synced with the sheet.');
  }
}

/* ── Announcements ─────────────────────────────────────────────────────── */

/* One polite live region per page carries short, deliberate messages.
   Nothing that ticks is ever inside a live region. */
let announceTimer = null;
function announce(message) {
  const el = $('#announcer');
  if (!el) return;
  el.textContent = '';
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => { el.textContent = message; }, 80);
}

/* ── Mutations ─────────────────────────────────────────────────────────── */

function addRacer(name, predictedSec) {
  const data = race();
  const number = data.racers.reduce((max, r) => Math.max(max, r.number), 0) + 1;
  const racer = {
    id: uid('r_'),
    number,
    name,
    predictedSec,
    wave: data.wavesLocked ? nextOpenWave(data) : null,
    finishAt: null
  };
  data.racers.push(racer);
  save();
  queue('register', { racer });
  renderPage();
  return racer;
}

function removeRacer(id) {
  const data = race();
  data.racers = data.racers.filter(r => r.id !== id);
  data.prizes = data.prizes.filter(p => p.racerId !== id);
  save();
  queue('removeRacer', { id });
  renderPage();
}

function startWave(wave) {
  const data = race();
  if (data.waveStarts[wave] != null) return;
  const startedAt = Date.now(); // captured on the button press, before anything else runs

  // First gun of the day freezes the wave split so nobody moves mid-race.
  if (!data.wavesLocked) {
    const v = raceView();
    data.racers.forEach(r => { r.wave = v.map.get(r.id) ?? 1; });
    data.wavesLocked = true;
    queue('lockWaves', { assignments: data.racers.map(r => ({ id: r.id, wave: r.wave })) });
  }

  data.waveStarts[wave] = startedAt;
  save();
  queue('startWave', { wave, startedAt });
  renderPage();
}

function finishRacer(id, finishAt = Date.now()) {
  const v = raceView();
  const racer = racerById(v, id);
  if (!racer) return { ok: false, error: 'No racer with that number.' };
  const wave = v.map.get(racer.id);
  if (waveStart(v, wave) === null) return { ok: false, error: `Wave ${wave} hasn't started yet.` };
  if (racer.finishAt) return { ok: false, error: `${racer.name} already finished.` };

  racer.finishAt = finishAt;
  save();
  queue('finish', { id, finishAt });
  renderPage();

  const res = result(racer, raceView());
  return { ok: true, racer, res };
}

function unfinishRacer(id) {
  const racer = race().racers.find(r => r.id === id);
  if (!racer) return;
  racer.finishAt = null;
  save();
  queue('unfinish', { id });
  renderPage();
}

function awardPrize(label, racerId) {
  const prize = { id: uid('p_'), label, racerId, awardedAt: Date.now() };
  race().prizes.push(prize);
  save();
  queue('awardPrize', { prize });
  renderPage();
}

function removePrize(id) {
  const data = race();
  data.prizes = data.prizes.filter(p => p.id !== id);
  save();
  queue('removePrize', { id });
  renderPage();
}

function resetTimes() {
  const data = race();
  data.racers.forEach(r => { r.finishAt = null; r.wave = null; });
  data.waveStarts = {};
  data.wavesLocked = false;
  save();
  queue('resetTimes', {});
  renderPage();
}

function resetRace() {
  db.races[currentRace] = emptyRace();
  save();
  queue('resetRace', {});
  renderPage();
}

/* ── Shared chrome ─────────────────────────────────────────────────────── */

/** Race 1–5 picker. Native radios, so arrow keys and screen readers work for free. */
function wireRacePicker() {
  const group = $('#racePicker');
  if (!group) return;
  group.addEventListener('change', e => {
    const n = Number(e.target.value);
    if (validRace(n)) {
      setRace(n);
      announce(`Showing race ${n}.`);
    }
  });
}

function renderRacePicker() {
  $$('#racePicker input[type="radio"]').forEach(input => {
    input.checked = Number(input.value) === currentRace;
  });
  $$('[data-race-number]').forEach(el => { el.textContent = String(currentRace); });
}

/** Tabs follow the ARIA authoring practice: roving tabindex plus arrow keys. */
function wireTabs(onChange) {
  const tabs = $$('[role="tab"]');
  if (!tabs.length) return;

  const select = (tab, moveFocus) => {
    onChange(tab.dataset.view);
    if (moveFocus) tab.focus();
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab, false));
    tab.addEventListener('keydown', e => {
      const keys = { ArrowRight: 1, ArrowLeft: -1 };
      let next = null;
      if (e.key in keys) next = tabs[(i + keys[e.key] + tabs.length) % tabs.length];
      else if (e.key === 'Home') next = tabs[0];
      else if (e.key === 'End') next = tabs[tabs.length - 1];
      if (!next) return;
      e.preventDefault();
      select(next, true);
    });
  });
}

function renderTabs(activeView) {
  $$('[role="tab"]').forEach(tab => {
    const active = tab.dataset.view === activeView;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    const panel = $('#view-' + tab.dataset.view);
    if (panel) panel.classList.toggle('hidden', !active);
  });
}

/* Rendering throws the old DOM away, which would drop keyboard focus on the floor
   every time somebody presses Finish. Buttons that survive a render under a new
   name carry a data-focus-key, and focus follows the key across the rebuild. */
function keepFocus(rerender) {
  const active = document.activeElement;
  const key = active && active.dataset ? active.dataset.focusKey : null;
  rerender();
  if (!key) return;
  const next = document.querySelector(`[data-focus-key="${CSS.escape(key)}"]`);
  if (next && next !== document.activeElement) next.focus();
}

/* The bib + name + call cluster. The start list and the timing board both show it,
   so it lives here — a change to the markup or the hidden "Racer " prefix should
   never need making twice. The start list already states each wave's call spectrum
   in its header, so it skips the per-racer call time to avoid repeating it. */
function rosterWho(r, { showPred = true } = {}) {
  const span = document.createElement('span');
  span.className = 'roster-who';
  span.innerHTML = `
    <span class="bib"><span class="visually-hidden">Racer </span><span class="bib-number"></span></span>
    <span class="roster-name"></span>
    <span class="roster-pred"></span>`;
  span.querySelector('.bib-number').textContent = String(r.number);
  span.querySelector('.roster-name').textContent = r.name;
  if (showPred) {
    span.querySelector('.roster-pred').textContent = `called ${fmtSec(r.predictedSec)}`;
  } else {
    span.querySelector('.roster-pred').remove();
  }
  return span;
}

/** Show an error against the field that caused it, and say it out loud once. */
function showFieldError(errorEl, message, field) {
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
  if (field) {
    // Keyboard and screen-reader users should land on the box they have to fix.
    field.focus();
    field.setAttribute('aria-invalid', 'true');
    const described = (field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    if (!described.includes(errorEl.id)) {
      field.setAttribute('aria-describedby', [...described, errorEl.id].join(' '));
    }
  }
}

function clearFieldErrors(errorEl, fields = []) {
  errorEl.textContent = '';
  errorEl.classList.add('hidden');
  fields.forEach(field => {
    if (!field) return;
    field.removeAttribute('aria-invalid');
    const described = (field.getAttribute('aria-describedby') || '')
      .split(/\s+/).filter(id => id && id !== errorEl.id);
    if (described.length) field.setAttribute('aria-describedby', described.join(' '));
    else field.removeAttribute('aria-describedby');
  });
}

/* Clocks tick on their own so typing in a form is never interrupted by a re-render.
   Only whole seconds are on show, so skip the write when the text hasn't changed.
   None of these elements sits inside a live region — a clock that speaks five times
   a second is unusable. */
function tick() {
  const now = Date.now();
  $$('[data-live-from]').forEach(el => {
    const next = fmtClock(now - Number(el.dataset.liveFrom));
    if (el.textContent !== next) el.textContent = next;
  });
}

/* ── Boot ──────────────────────────────────────────────────────────────── */

function boot() {
  wireRacePicker();
  const refresh = $('#refreshButton');
  if (refresh) refresh.addEventListener('click', () => sync({ pull: true }));

  // API_URL never changes at runtime, so this is decided once, not on every render.
  const notice = $('#storageNotice');
  if (notice) notice.classList.toggle('hidden', !!API_URL);

  reflectRaceInUrl();
  renderPage();
  setInterval(tick, TICK_MS);
  if (API_URL) {
    sync({ pull: true });
    setInterval(() => sync({ pull: true }), POLL_MS);
  }
}
