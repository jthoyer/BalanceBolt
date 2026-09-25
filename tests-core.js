/* Balance Bolt — executable checks for core.js
   ============================================
   THE TESTS THEMSELVES LIVE HERE. Two runners load this file:

     node run-tests.mjs     headless, exits non-zero on failure — use this in CI
     open tests.html        the same checks, rendered as a pass/fail list

   Both run core.js first and then this file in the same scope, so every core.js
   function is available here by name. Nothing is imported and nothing is exported;
   the result lands on globalThis.__TEST_RESULTS__ for the runner to report.

   WHY THESE FUNCTIONS
   core.js holds the logic that is hardest to check by reading: the four-wave merge
   in groupByPredicted(), the best-four-of-five scoring in seriesStandings(), and the
   rounding in the time helpers. Those are pure, so they are cheap to assert and
   expensive to eyeball.

   ISOLATION — the rule this suite is built on
   Every stateful test calls setDb(...) first, which rebuilds all five races from
   scratch. No test inherits state from the one before it, so the suite gives the
   same answer whatever order it runs in. If you add a test, start it with setDb().

   setDb() mutates db.races IN PLACE rather than rebinding db, because `db` is a
   top-level `let` in core.js and rebinding it across script boundaries is not
   reliable in every runner. Mutating the object it already points at always works.

   ADDING A TEST
     test('what it should do', () => { eq(actual, expected, 'optional label'); });
   eq() deep-compares via JSON. Throwing anything fails the test with the message.
*/

globalThis.__TESTS_DONE__ = (async function () {
  'use strict';

  /* Stop mutations queueing outbound writes to the live Apps Script endpoint.
     core.js declares queue() as a function declaration, so this replaces it.
     The runners also block the network outright — this is the second layer.
     One group at the end deliberately restores real queueing to test sync(). */
  const noopQueue = function () {};
  queue = noopQueue;

  /* ── Tiny harness ──────────────────────────────────────────────────────── */

  const results = [];
  let currentGroup = 'general';
  const group = name => { currentGroup = name; };

  function test(name, fn) {
    try {
      fn();
      results.push({ group: currentGroup, name, ok: true });
    } catch (err) {
      results.push({ group: currentGroup, name, ok: false, err: (err && err.message) || String(err) });
    }
  }

  /* Same as test(), but awaits. The sync path is async, and it is exactly the part
     no synchronous test can reach — which is why a real race condition lived there
     under a green suite until 2026-09-06. Call it with `await atest(...)`. */
  async function atest(name, fn) {
    try {
      await fn();
      results.push({ group: currentGroup, name, ok: true });
    } catch (err) {
      results.push({ group: currentGroup, name, ok: false, err: (err && err.message) || String(err) });
    }
  }

  const show = v => {
    if (v instanceof Map) return 'Map(' + JSON.stringify([...v.entries()]) + ')';
    return JSON.stringify(v);
  };

  function eq(actual, expected, label) {
    const a = show(actual), b = show(expected);
    if (a !== b) throw new Error((label ? label + '\n' : '') + '  expected: ' + b + '\n  actual:   ' + a);
  }

  function ok(value, label) {
    if (!value) throw new Error(label || 'expected a truthy value, got ' + show(value));
  }

  /* ── State helpers ─────────────────────────────────────────────────────── */

  /** Rebuild every race. `races` is { 1: {...}, 2: {...} } — races not named are emptied. */
  function setDb(races) {
    const src = races || {};
    for (let n = 1; n <= RACE_COUNT; n++) db.races[n] = cleanRace(src[n]);
    outbox.length = 0;
  }

  const racer = (id, number, name, predictedSec, extra = {}) =>
    Object.assign({ id, number, name, predictedSec, wave: null, finishAt: null }, extra);

  const T = 1700000000000; // fixed wave-start instant, so nothing depends on the clock

  /* ═══ Time formatting ═══════════════════════════════════════════════════ */

  group('Time formatting');

  test('fmtClock renders m:ss and pads the seconds', () => {
    eq(fmtClock(0), '0:00');
    eq(fmtClock(5000), '0:05');
    eq(fmtClock(65000), '1:05');
    eq(fmtClock(600000), '10:00');
  });

  test('fmtClock always rounds DOWN to the whole second', () => {
    eq(fmtClock(59999), '0:59', 'one ms short of a minute is still 0:59');
    eq(fmtClock(1999), '0:01');
  });

  test('fmtClock floors a negative elapsed time at zero', () => {
    eq(fmtClock(-5000), '0:00', 'a clock started in the future must not show negative time');
  });

  test('fmtClock has no hour field — 60 minutes reads as 60:00', () => {
    eq(fmtClock(3600000), '60:00');
  });

  test('fmtSec converts whole seconds', () => {
    eq(fmtSec(0), '0:00');
    eq(fmtSec(300), '5:00', 'WAVE_SPAN_SEC reads as five minutes');
    eq(fmtSec(3661), '61:01');
  });

  test('fmtGap is absolute and rounds to NEAREST second', () => {
    eq(fmtGap(65400), '1:05', 'rounds down');
    eq(fmtGap(-65600), '1:06', 'rounds up, and the sign is dropped');
    eq(fmtGap(-65400), '1:05');
  });

  test('fmtDelta names the direction', () => {
    eq(fmtDelta(65000), '1:05 over');
    eq(fmtDelta(-65000), '1:05 under');
  });

  test('fmtDelta says "Dead on" only when it rounds to zero', () => {
    eq(fmtDelta(0), 'Dead on');
    eq(fmtDelta(400), 'Dead on', 'under half a second either way counts as dead on');
    eq(fmtDelta(-400), 'Dead on');
    eq(fmtDelta(600), '0:01 over', 'over half a second does not');
  });

  test('sayDelta speaks minutes and seconds, pluralised', () => {
    eq(sayDelta(65000), '1 minute 5 seconds over');
    eq(sayDelta(-125000), '2 minutes 5 seconds under');
    eq(sayDelta(1000), '1 second over');
    eq(sayDelta(-2000), '2 seconds under');
  });

  test('sayDelta drops the empty half of the phrase', () => {
    eq(sayDelta(60000), '1 minute over', 'no "0 seconds" tacked on the end');
    eq(sayDelta(-120000), '2 minutes under');
  });

  test('sayDelta has its own dead-on wording', () => {
    eq(sayDelta(0), 'dead on their call');
    eq(sayDelta(400), 'dead on their call');
  });

  /* ═══ Storage coercion ══════════════════════════════════════════════════ */

  group('cleanRace / cleanDb — junk in, known shape out');

  test('cleanRace turns null, undefined and rubbish into an empty race', () => {
    const expected = { racers: [], waveStarts: {}, waveNudges: {}, wavesLocked: false, prizes: [] };
    eq(cleanRace(null), expected);
    eq(cleanRace(undefined), expected);
    eq(cleanRace('nonsense'), expected);
    eq(cleanRace(42), expected);
  });

  test('cleanRace coerces racer field types', () => {
    const out = cleanRace({ racers: [{ id: 7, number: '3', name: 5, predictedSec: '600' }] });
    eq(out.racers[0].id, '7', 'id becomes a string');
    eq(out.racers[0].number, 3, 'number becomes a number');
    eq(out.racers[0].name, '5', 'name becomes a string');
    eq(out.racers[0].predictedSec, 600);
  });

  test('cleanRace treats a zero wave or zero finish as "not set"', () => {
    const out = cleanRace({ racers: [{ id: 'a', number: 1, name: 'A', predictedSec: 60, wave: 0, finishAt: 0 }] });
    eq(out.racers[0].wave, null);
    eq(out.racers[0].finishAt, null);
  });

  test('cleanRace drops wave starts that could not be real', () => {
    const out = cleanRace({ waveStarts: { 0: 5000, 2: 0, 3: 100 } });
    eq(out.waveStarts, { 3: 100 }, 'wave 0 and a zero timestamp are both discarded');
  });

  test('cleanRace forces wavesLocked to a real boolean', () => {
    eq(cleanRace({ wavesLocked: 'yes' }).wavesLocked, true);
    eq(cleanRace({ wavesLocked: 0 }).wavesLocked, false);
    eq(cleanRace({}).wavesLocked, false);
  });

  test('cleanRace repairs a prize with a missing timestamp', () => {
    const out = cleanRace({ prizes: [{ id: 'p1', label: 'Fastest', racerId: 'r1' }] });
    eq(out.prizes[0].awardedAt, 0, 'a missing awardedAt becomes 0, not NaN');
  });

  test('cleanDb always returns exactly five races', () => {
    const out = cleanDb({ races: { 1: { racers: [] } } });
    eq(Object.keys(out.races).length, 5, 'the series is five races');
    eq(RACE_COUNT, 5, 'and core.js still says so');
    eq(out.races[5], { racers: [], waveStarts: {}, waveNudges: {}, wavesLocked: false, prizes: [] },
       'the races nobody has entered are filled in, not missing');
  });

  test('cleanDb survives a totally malformed payload', () => {
    eq(Object.keys(cleanDb(null).races).length, 5);
    eq(Object.keys(cleanDb({ races: 'broken' }).races).length, 5);
  });

  /* ═══ Wave grouping ═════════════════════════════════════════════════════ */

  group('groupByPredicted — the five-minute rule and the four-wave cap');

  const field = specs => specs.map((sec, i) => racer('r' + i, i + 1, 'Racer ' + (i + 1), sec));
  const shape = groups => groups.map(g => g.map(r => r.predictedSec));

  test('an empty field produces no waves', () => {
    eq(groupByPredicted([]), []);
  });

  test('racers inside five minutes of the wave leader share a wave', () => {
    eq(shape(groupByPredicted(field([600, 700, 800]))), [[600, 700, 800]],
       'the spread is 200s, well inside WAVE_SPAN_SEC');
  });

  test('the span is measured from the wave leader, not the previous racer', () => {
    // 600 -> 900 -> 1200: each step is 300s, but 1200 is 600s off the leader.
    eq(shape(groupByPredicted(field([600, 900, 1200]))), [[1200], [600, 900]],
       'a chain of small steps must not drag one wave arbitrarily wide');
  });

  test('exactly five minutes still counts as together', () => {
    eq(shape(groupByPredicted(field([600, 900]))), [[600, 900]], 'the rule is <=, not <');
    eq(shape(groupByPredicted(field([600, 901]))), [[901], [600]], 'one second past it splits');
  });

  /* Reversed on 2026-09-25: the slowest calls go first so the waves can be timed to come
     home together. Wave 1 was the quickest calls before that. */
  test('wave 1 is the slowest predictions and the last wave the quickest, whatever order they arrive in', () => {
    eq(shape(groupByPredicted(field([2000, 600, 1300]))), [[2000], [1300], [600]]);
  });

  test('reversing the order does not change who shares a wave', () => {
    // 600/800 together, 1300/1500 together, 2000 alone — same groups, numbered slowest first.
    eq(shape(groupByPredicted(field([1500, 600, 2000, 800, 1300]))), [[2000], [1300, 1500], [600, 800]]);
  });

  test('after the four-wave merge wave 1 still holds the slowest call', () => {
    const groups = groupByPredicted(field([600, 1000, 1400, 1800, 2200, 2600, 3000]));
    eq(groups[0].some(r => r.predictedSec === 3000), true, 'the slowest racer is in wave 1');
    eq(groups[3].some(r => r.predictedSec === 600), true, 'the quickest racer is in the last wave');
  });

  /* The 4 below is deliberately a literal, not MAX_WAVES. Asserting a constant
     against itself passes whatever the constant is changed to, which is no test
     at all — the club runs four waves, so four is the fact being pinned. Same
     reasoning for the 5 in the cleanDb tests. */
  test('never more than four groups, however spread the field', () => {
    const groups = groupByPredicted(field([600, 1000, 1400, 1800, 2200, 2600, 3000]));
    eq(groups.length, 4, 'seven natural groups must collapse to four');
    eq(MAX_WAVES, 4, 'and the cap in core.js is still four');
    eq(groups.reduce((n, g) => n + g.length, 0), 7, 'nobody is lost in the merge');
  });

  test('the merge keeps every racer exactly once', () => {
    const groups = groupByPredicted(field([100, 900, 1700, 2500, 3300, 4100]));
    eq(groups.flat().map(r => r.id).sort(), ['r0', 'r1', 'r2', 'r3', 'r4', 'r5']);
  });

  test('equal predicted times are ordered by race number', () => {
    const list = [racer('b', 2, 'Bea', 600), racer('a', 1, 'Ana', 600)];
    eq(groupByPredicted(list)[0].map(r => r.number), [1, 2]);
  });

  /* ═══ Wave assignment ═══════════════════════════════════════════════════ */

  group('nextOpenWave / buildWaveMap');

  test('nextOpenWave finds the first wave still on the line', () => {
    eq(nextOpenWave({
      racers: [racer('a', 1, 'A', 600, { wave: 1 }), racer('b', 2, 'B', 900, { wave: 2 })],
      waveStarts: { 1: T }
    }), 2);
  });

  test('once every wave has gone, late sign-ups join the last one', () => {
    eq(nextOpenWave({ racers: [racer('a', 1, 'A', 600, { wave: 1 })], waveStarts: { 1: T } }), 1);
  });

  test('an empty race opens at wave 1', () => {
    eq(nextOpenWave({ racers: [], waveStarts: {} }), 1);
  });

  test('waves stay fluid until the first gun', () => {
    const list = field([600, 1400]);
    const map = buildWaveMap({ wavesLocked: false, racers: list, waveStarts: {} }, list);
    eq(map.get('r1'), 1, 'the slower call is wave 1');
    eq(map.get('r0'), 2, 'regrouped by predicted time, ignoring any stored wave');
  });

  test('once locked, the stored wave wins even if predictions changed', () => {
    const list = [racer('a', 1, 'A', 600, { wave: 2 }), racer('b', 2, 'B', 610, { wave: 1 })];
    const map = buildWaveMap({ wavesLocked: true, racers: list, waveStarts: { 1: T } }, list);
    eq(map.get('a'), 2, 'grouping would have put these two together — the lock must hold');
    eq(map.get('b'), 1);
  });

  test('a locked race puts a racer with no wave into the next open one', () => {
    const list = [racer('a', 1, 'A', 600, { wave: 1 }), racer('late', 2, 'Late', 600)];
    const map = buildWaveMap({ wavesLocked: true, racers: list, waveStarts: { 1: T } }, list);
    eq(map.get('late'), 1, 'wave 1 has already fired, so it is also the last known wave');
  });

  /* ═══ Wave targets ══════════════════════════════════════════════════════ */

  group('waveTargets — sending each wave off so they come home together');

  /** A race with one wave per entry of `waves` (arrays of calls in seconds), wave 1 first. */
  function wavedb(waves, waveStarts = {}) {
    let n = 0;
    const racers = [];
    waves.forEach((calls, i) => calls.forEach(sec => {
      n += 1;
      racers.push(racer('r' + n, n, 'Racer ' + n, sec, { wave: i + 1 }));
    }));
    setDb({ 1: { racers, waveStarts, wavesLocked: true } });
    return raceView(1);
  }

  test('a wave is steered by its median call', () => {
    eq(waveCallSec([racer('a', 1, 'A', 2000), racer('b', 2, 'B', 1700), racer('c', 3, 'C', 1800)]), 1800, 'odd count: the middle one');
    eq(waveCallSec([racer('a', 1, 'A', 600), racer('b', 2, 'B', 661)]), 631, 'even count: mean of the middle two, rounded');
    eq(waveCallSec([]), null, 'an empty wave has no call');
  });

  test('before the first gun each wave gets a planned gap after wave 1, and no time yet', () => {
    const v = wavedb([[1800], [1200], [600]]);
    const t = waveTargets(v);
    eq(t.has(1), false, 'wave 1 is the anchor, not a target');
    eq(t.get(2), { anchor: 1, offsetMs: 600000, at: null });
    eq(t.get(3), { anchor: 1, offsetMs: 1200000, at: null });
  });

  test('once wave 1 goes, each target is the gun plus the difference in median calls', () => {
    const v = wavedb([[1700, 1800, 2000], [600, 660]], { 1: T });
    eq(waveTargets(v).get(2).at, T + (1800 - 630) * 1000);
  });

  test('every target lands the wave\'s median call on the same finish instant', () => {
    const v = wavedb([[3000, 3100], [2000], [1400, 1500, 1700], [600]], { 1: T });
    const finish1 = T + waveCallSec(racersInWave(v, 1)) * 1000;
    waveTargets(v).forEach((target, wave) => {
      eq(target.at + waveCallSec(racersInWave(v, wave)) * 1000, finish1, 'wave ' + wave);
    });
  });

  test('a late start is not passed down the line — every target stays on the first gun', () => {
    // Wave 2 was due at T+15:00 and went 40s late; wave 3 is still due at T+30:00.
    const v = wavedb([[2400], [1500], [600]], { 1: T, 2: T + 940000 });
    const t = waveTargets(v);
    eq(t.has(2), false, 'a started wave has no target');
    eq(t.get(3).at, T + 1800000);
    eq(t.get(3).anchor, 1);
  });

  test('if a later wave goes first, it becomes the anchor and the others are already due', () => {
    const v = wavedb([[2400], [1500]], { 2: T });
    const t = waveTargets(v).get(1);
    eq(t.anchor, 2);
    eq(t.at, T - 900000, 'wave 1 should have gone 15:00 before wave 2');
    eq(countdownText(t.at, T + 1000), 'Start now');
  });

  test('a race locked quickest-first, before the order flipped, still gets sensible targets', () => {
    // Legacy numbering: wave 1 the quick calls. Wave 2 should go before it, so it is due at once.
    const v = wavedb([[600], [1800]], { 1: T });
    eq(waveTargets(v).get(2).at, T - 1200000);
  });

  test('a nudge moves only its own wave', () => {
    const v = wavedb([[2400], [1500], [600]], { 1: T });
    const t = waveTargets(v, { 2: 30 });
    eq(t.get(2).at, T + 900000 + 30000);
    eq(t.get(3).at, T + 1800000, 'wave 3 ignores wave 2\'s nudge');
    eq(waveTargets(v, { 3: -60 }).get(3).at, T + 1800000 - 60000, 'and nudges go both ways');
  });

  test('a wave with nobody left in it has no target and cannot anchor', () => {
    setDb({ 1: { racers: [racer('a', 1, 'A', 600, { wave: 2 })], waveStarts: { 1: T }, wavesLocked: true } });
    eq(waveTargets(raceView(1)).size, 0, 'wave 1 is empty, so wave 2 anchors itself and has no target');
  });

  test('nudges stack, are kept per race, and Reset clears them', () => {
    wavedb([[2400], [1500]], { 1: T });
    eq(nudgeWave(2, 30), 30);
    eq(nudgeWave(2, 30), 60);
    eq(nudgeWave(2, -90), -30);
    eq(waveNudges(1), { 2: -30 });
    eq(waveNudges(2), {}, 'race 2 is untouched');
    eq(nudgeWave(2, 0), 0);
    eq(waveNudges(1), {}, 'reset leaves nothing behind');
  });

  test('nudges are saved with the race, not the UI state, so a reload keeps them', () => {
    wavedb([[2400], [1500]], { 1: T });
    nudgeWave(2, 30);
    eq(JSON.parse(localStorage.getItem(STORE_KEY)).races[1].waveNudges, { 2: 30 });
    eq(JSON.parse(localStorage.getItem(UI_KEY)).waveNudges, undefined, 'nothing in the UI state');
  });

  test('a nudge is sent to the sheet as the wave\'s whole new value, so a retry cannot double it', () => {
    wavedb([[2400], [1500]], { 1: T });
    const sent = [];
    queue = function (action, payload) { sent.push({ action, payload }); };
    try {
      nudgeWave(2, 30);
      nudgeWave(2, 30);
      nudgeWave(2, 0);
    } finally { queue = noopQueue; }
    eq(sent.map(o => o.action), ['setWaveNudge', 'setWaveNudge', 'setWaveNudge']);
    eq(sent.map(o => o.payload.nudgeSec), [30, 60, 0]);
    eq(sent[0].payload.wave, 2);
    eq(sent[0].payload.race, 1);
  });

  test('a nudge from another phone arrives with the sheet and moves this phone\'s countdown', () => {
    const v = wavedb([[2400], [1500]], { 1: T });
    eq(waveTargets(v, waveNudges(1)).get(2).at, T + 900000);
    // The shape doGet() returns: waveNudges keyed by wave, in seconds.
    db = cleanDb({ races: { 1: { racers: race(1).racers, waveStarts: { 1: T }, waveNudges: { 2: -60 }, wavesLocked: true } } });
    eq(waveNudges(1), { 2: -60 });
    eq(waveTargets(raceView(1), waveNudges(1)).get(2).at, T + 900000 - 60000);
  });

  test('junk nudges off the wire are dropped, not spread into a target', () => {
    const clean = cleanRace({ waveNudges: { 2: 'abc', 3: 1.5, 0: 30, 4: 0, 5: -30 } });
    eq(clean.waveNudges, { 5: -30 });
    eq(cleanRace({}).waveNudges, {}, 'a race saved before nudges existed loads with none');
  });

  test('resetting the clocks clears that race\'s nudges', () => {
    wavedb([[2400], [1500]], { 1: T });
    nudgeWave(2, 30);
    resetTimes();
    eq(waveNudges(1), {});
  });

  test('the countdown rounds up, never shows 0:00, and then says Start now', () => {
    eq(countdownText(T + 252000, T), '4:12');
    eq(countdownText(T + 251001, T), '4:12', 'a part-second still to go counts as a second');
    eq(countdownText(T + 1, T), '0:01');
    eq(countdownText(T, T), 'Start now');
    eq(countdownText(T - 5000, T), 'Start now');
  });

  /* ═══ Results ═══════════════════════════════════════════════════════════ */

  group('result / ranked / raceStoppedAt');

  /** One locked race, everyone in wave 1, started at T. `finishes` is id -> ms after the gun. */
  function racedb(racers, finishes) {
    setDb({ 1: {
      racers: racers.map(r => Object.assign({}, r, {
        wave: 1,
        finishAt: finishes[r.id] == null ? null : T + finishes[r.id]
      })),
      waveStarts: { 1: T },
      wavesLocked: true
    } });
    return raceView(1);
  }

  test('a racer still out on course has no result', () => {
    const v = racedb([racer('a', 1, 'Ana', 600)], {});
    eq(result(racerById(v, 'a'), v), null);
  });

  test('delta is signed — over the call is positive', () => {
    const v = racedb([racer('a', 1, 'Ana', 600)], { a: 605000 });
    const res = result(racerById(v, 'a'), v);
    eq(res.elapsed, 605000);
    eq(res.delta, 5000, 'five seconds slower than the call');
    eq(res.absDelta, 5000);
  });

  test('under the call is negative, and absDelta drops the sign', () => {
    const v = racedb([racer('a', 1, 'Ana', 600)], { a: 592000 });
    const res = result(racerById(v, 'a'), v);
    eq(res.delta, -8000);
    eq(res.absDelta, 8000);
  });

  test('a finish before the gun clamps elapsed at zero rather than going negative', () => {
    const v = racedb([racer('a', 1, 'Ana', 600)], { a: -3000 });
    eq(result(racerById(v, 'a'), v).elapsed, 0);
  });

  test('ranked orders by closeness to the call, not by finish time', () => {
    const v = racedb(
      [racer('a', 1, 'Ana', 600), racer('b', 2, 'Bea', 900), racer('c', 3, 'Cal', 600)],
      { a: 610000, b: 902000, c: 590000 }
    );
    // Bea is slowest on the clock (15:02) and wins: she was 2s off her call.
    // Ana is 10s over and Cal is 10s under — the same absDelta — so the tie
    // falls to the quicker elapsed time, which is Cal's.
    eq(ranked(v).map(r => r.racer.name), ['Bea', 'Cal', 'Ana'],
       'closeness to the call decides, and over/under are treated alike');
  });

  test('ranked leaves out anyone who has not finished', () => {
    const v = racedb([racer('a', 1, 'Ana', 600), racer('b', 2, 'Bea', 600)], { a: 601000 });
    eq(ranked(v).map(r => r.racer.name), ['Ana']);
  });

  test('a tie on delta is broken by the faster elapsed time', () => {
    const v = racedb([racer('a', 1, 'Ana', 600), racer('b', 2, 'Bea', 900)], { a: 605000, b: 905000 });
    eq(ranked(v).map(r => r.racer.name), ['Ana', 'Bea'], 'both 5s over; Ana was quicker');
  });

  test('the race is not over while anyone is still running', () => {
    const v = racedb([racer('a', 1, 'Ana', 600), racer('b', 2, 'Bea', 600)], { a: 601000 });
    eq(raceStoppedAt(v), null);
  });

  test('the race stops at the LAST finish, and clocks freeze there', () => {
    const v = racedb([racer('a', 1, 'Ana', 600), racer('b', 2, 'Bea', 600)], { a: 601000, b: 640000 });
    eq(raceStoppedAt(v), T + 640000);
  });

  test('a race with nobody in it has not stopped', () => {
    setDb({ 1: { racers: [], waveStarts: {}, wavesLocked: false } });
    eq(raceStoppedAt(raceView(1)), null);
  });

  test('a finish recorded with no gun is not a stopped race', () => {
    setDb({ 1: { racers: [racer('a', 1, 'Ana', 600, { wave: 1, finishAt: T })], waveStarts: {}, wavesLocked: true } });
    eq(raceStoppedAt(raceView(1)), null);
  });

  /* ═══ Series ════════════════════════════════════════════════════════════ */

  group('seriesStandings — best four of five');

  /**
   * Build a whole series. `entries` maps name -> { raceNumber: absDeltaSeconds | null }.
   * null means entered but did not finish.
   */
  function series(entries) {
    const races = {};
    for (let n = 1; n <= RACE_COUNT; n++) {
      races[n] = { racers: [], waveStarts: { 1: T }, wavesLocked: true };
    }
    let i = 0;
    Object.entries(entries).forEach(([name, byRace]) => {
      Object.entries(byRace).forEach(([n, deltaSec]) => {
        i += 1;
        races[n].racers.push({
          id: 'r' + i, number: i, name, predictedSec: 600, wave: 1,
          finishAt: deltaSec == null ? null : T + 600000 + deltaSec * 1000
        });
      });
    });
    setDb(races);
    return seriesStandings();
  }

  test('total counts the best four races and drops the worst', () => {
    const ana = series({ Ana: { 1: 10, 2: 20, 3: 30, 4: 40, 5: 50 } })[0];
    eq(ana.total, 100000, '10+20+30+40 seconds in ms — the 50 is dropped');
    eq(ana.allTotal, 150000);
    eq(ana.dropped, [5]);
    eq(ana.counted, [1, 2, 3, 4]);
  });

  test('the dropped race is the worst one, not the last one', () => {
    const ana = series({ Ana: { 1: 90, 2: 10, 3: 20, 4: 30, 5: 40 } })[0];
    eq(ana.dropped, [1], 'race 1 was her worst, so race 1 goes');
    eq(ana.total, 100000);
  });

  test('four finishes make you eligible; three do not', () => {
    const s = series({ Ana: { 1: 10, 2: 10, 3: 10, 4: 10 }, Bea: { 1: 5, 2: 5, 3: 5 } });
    eq(s.find(p => p.name === 'Ana').eligible, true);
    eq(s.find(p => p.name === 'Bea').eligible, false, 'three blinding races is not enough');
  });

  test('an eligible racer outranks a faster ineligible one', () => {
    const s = series({ Slowish: { 1: 60, 2: 60, 3: 60, 4: 60 }, Quick: { 1: 1, 2: 1, 3: 1 } });
    eq(s[0].name, 'Slowish', 'nobody wins on two blinders and three no-shows');
    eq(s[1].name, 'Quick');
  });

  test('entering without finishing counts as entered, not completed', () => {
    const ana = series({ Ana: { 1: 10, 2: null, 3: null, 4: null, 5: null } })[0];
    eq(ana.completed, 1);
    eq(ana.entered.length, 5);
    eq(ana.eligible, false);
  });

  test('the same person across races is matched on name, ignoring case and spacing', () => {
    const s = series({ 'Ana Smith': { 1: 10 }, 'ana  smith': { 2: 20 }, ' ANA SMITH ': { 3: 30 } });
    eq(s.length, 1, 'three spellings, one athlete');
    eq(s[0].completed, 3);
  });

  test('average uses every finish, including the dropped race', () => {
    eq(series({ Ana: { 1: 10, 2: 20, 3: 30, 4: 40, 5: 50 } })[0].average, 30000,
       '150s over five races, not 100s over four');
  });

  test('someone who never finished has a null average rather than NaN', () => {
    const ana = series({ Ana: { 1: null, 2: null } })[0];
    eq(ana.average, null);
    eq(ana.completed, 0);
  });

  group('grandPrizeWinner / mostConsistent');

  test('no grand prize until somebody has four races', () => {
    eq(grandPrizeWinner(series({ Ana: { 1: 10, 2: 10, 3: 10 } })), null);
  });

  test('the grand prize goes to the lowest best-four total', () => {
    const s = series({
      Ana: { 1: 30, 2: 30, 3: 30, 4: 30, 5: 30 },   // best four = 120s
      Bea: { 1: 5, 2: 5, 3: 5, 4: 5, 5: 200 }       // best four = 20s, the 200 is dropped
    });
    eq(grandPrizeWinner(s).name, 'Bea',
       'one disastrous race does not cost you the series — it is the one that gets dropped');
  });

  test('a consistent racer beats one carried by two blinders', () => {
    const s = series({
      Steady: { 1: 10, 2: 10, 3: 10, 4: 10, 5: 10 },  // best four = 40s
      Streaky: { 1: 1, 2: 1, 3: 60, 4: 60, 5: 60 }    // best four = 1+1+60+60 = 122s
    });
    eq(grandPrizeWinner(s).name, 'Steady', 'only ONE bad race is forgiven, not three');
  });

  test('most consistent needs three races and wins on average, not total', () => {
    const s = series({ Steady: { 1: 12, 2: 12, 3: 12 }, Spiky: { 1: 1, 2: 1, 3: 60 } });
    eq(mostConsistent(s).name, 'Steady', '12s average beats a 20.7s average');
  });

  test('nobody is most consistent on two races', () => {
    eq(mostConsistent(series({ Ana: { 1: 5, 2: 5 } })), null);
  });

  /* ═══ Mutations ═════════════════════════════════════════════════════════ */

  group('Mutations — numbering, waves, guard rails');

  test('race numbers start at 1 and increment', () => {
    setDb({ 1: { racers: [] } });
    eq(addRacer('Ana', 600).number, 1);
    eq(addRacer('Bea', 700).number, 2);
  });

  /* ── The two tests below pin CURRENT behaviour around withdrawals. ────────
     addRacer() numbers from max(existing) + 1, so withdrawing the HIGHEST
     numbered racer frees their number for the next sign-up. Withdrawing anyone
     else does not.

     This is not asserted here as a defect — results are keyed on `id`, never on
     `number`, so no data is corrupted either way. It is an operational question
     for race day: if Bea has already been handed bib 2 and then withdraws, Cal
     is given bib 2 as well. If two bibs in the field is unacceptable, number
     from a counter stored on the race instead of from max(). If reusing a
     handed-back bib is the desired behaviour, these tests already lock it in.
     Either way, changing it should break a test rather than pass silently. */

  test('withdrawing the LAST racer frees their number for the next sign-up', () => {
    setDb({ 1: { racers: [] } });
    addRacer('Ana', 600);
    const bea = addRacer('Bea', 700);
    removeRacer(bea.id);
    eq(addRacer('Cal', 800).number, 2, "Cal inherits Bea's number — see the note above");
  });

  test('withdrawing a racer in the middle does NOT free their number', () => {
    setDb({ 1: { racers: [] } });
    addRacer('Ana', 600);
    const bea = addRacer('Bea', 700);
    addRacer('Cal', 800);
    removeRacer(bea.id);
    eq(addRacer('Dee', 900).number, 4, 'numbering continues past the gap, it does not fill it');
  });

  test('a sign-up before the gun has no wave yet', () => {
    setDb({ 1: { racers: [] } });
    eq(addRacer('Ana', 600).wave, null);
  });

  test('a sign-up after the gun lands in the open wave', () => {
    setDb({ 1: { racers: [racer('a', 1, 'Ana', 600, { wave: 1 })], waveStarts: { 1: T }, wavesLocked: true } });
    eq(addRacer('Late', 600).wave, 1);
  });

  test('a predicted time of zero is accepted by core — the form is the only gate', () => {
    setDb({ 1: { racers: [] } });
    eq(addRacer('Ana', 0).predictedSec, 0,
       'documents current behaviour: core.js does not validate, input.js does');
  });

  test('withdrawing a racer also removes their prizes', () => {
    setDb({ 1: {
      racers: [racer('a', 1, 'Ana', 600)],
      prizes: [{ id: 'p1', label: 'Fastest', racerId: 'a', awardedAt: T }]
    } });
    removeRacer('a');
    eq(race(1).prizes.length, 0);
  });

  test('finishing an unknown number is refused', () => {
    setDb({ 1: { racers: [], waveStarts: { 1: T }, wavesLocked: true } });
    eq(finishRacer('nope').ok, false);
  });

  test('a racer cannot finish before their wave has started', () => {
    setDb({ 1: { racers: [racer('a', 1, 'Ana', 600, { wave: 1 })], waveStarts: {}, wavesLocked: true } });
    const out = finishRacer('a');
    eq(out.ok, false);
    ok(/hasn't started/.test(out.error), 'the error should name the cause, got: ' + out.error);
  });

  test('a racer cannot finish twice', () => {
    setDb({ 1: {
      racers: [racer('a', 1, 'Ana', 600, { wave: 1, finishAt: T + 601000 })],
      waveStarts: { 1: T }, wavesLocked: true
    } });
    const out = finishRacer('a');
    eq(out.ok, false);
    ok(/already finished/.test(out.error), 'got: ' + out.error);
  });

  test('a finish returns the result it just recorded', () => {
    setDb({ 1: { racers: [racer('a', 1, 'Ana', 600, { wave: 1 })], waveStarts: { 1: T }, wavesLocked: true } });
    const out = finishRacer('a', T + 604000);
    eq(out.ok, true);
    eq(out.res.delta, 4000);
  });

  test('undoing a finish puts the racer back out on course', () => {
    setDb({ 1: { racers: [racer('a', 1, 'Ana', 600, { wave: 1 })], waveStarts: { 1: T }, wavesLocked: true } });
    finishRacer('a', T + 604000);
    unfinishRacer('a');
    eq(race(1).racers[0].finishAt, null);
    eq(raceStoppedAt(raceView(1)), null, 'the clocks must start again too');
  });

  test('the first gun freezes the wave split', () => {
    setDb({ 1: { racers: field([600, 1400]), waveStarts: {}, wavesLocked: false } });
    startWave(1);
    eq(race(1).wavesLocked, true);
    eq(race(1).racers.map(r => r.wave), [2, 1], 'everyone gets a stored wave, not just wave 1');
  });

  test('firing the same wave twice does not move the start time', () => {
    setDb({ 1: { racers: [racer('a', 1, 'Ana', 600)], waveStarts: {}, wavesLocked: false } });
    startWave(1);
    const first = race(1).waveStarts[1];
    startWave(1);
    eq(race(1).waveStarts[1], first);
  });

  test('resetTimes clears the clocks but keeps the field', () => {
    setDb({ 1: {
      racers: [racer('a', 1, 'Ana', 600, { wave: 1, finishAt: T + 601000 })],
      waveStarts: { 1: T }, wavesLocked: true
    } });
    resetTimes();
    eq(race(1).racers.length, 1, 'the racer stays signed up');
    eq(race(1).racers[0].finishAt, null);
    eq(race(1).racers[0].wave, null);
    eq(race(1).waveStarts, {});
    eq(race(1).wavesLocked, false);
  });

  test('resetRace empties everything', () => {
    setDb({ 1: {
      racers: [racer('a', 1, 'Ana', 600)],
      prizes: [{ id: 'p1', label: 'X', racerId: 'a', awardedAt: T }]
    } });
    resetRace();
    eq(race(1), { racers: [], waveStarts: {}, waveNudges: {}, wavesLocked: false, prizes: [] });
  });

  test('one race is untouched by changes to another', () => {
    setDb({ 1: { racers: [racer('a', 1, 'Ana', 600)] }, 2: { racers: [racer('b', 1, 'Bea', 700)] } });
    resetRace(); // acts on currentRace, which is 1
    eq(race(1).racers.length, 0);
    eq(race(2).racers.length, 1, 'race 2 must survive a reset of race 1');
  });

  /* ═══ Reading a call off a form ═════════════════════════════════════════ */

  group('parsePredictedTime — the rules a call has to obey');

  test('minutes and seconds add up to one predicted time', () => {
    eq(parsePredictedTime('25', '30'), { ok: true, predictedSec: 1530 });
  });

  test('a blank box counts as zero, so a flat 25 minutes is just 25', () => {
    eq(parsePredictedTime('25', ''), { ok: true, predictedSec: 1500 });
    eq(parsePredictedTime('', '45'), { ok: true, predictedSec: 45 });
  });

  test('both boxes blank asks for a time — it does not call it nought', () => {
    const out = parsePredictedTime('', '');
    eq(out.ok, false);
    eq(out.field, 'minutes');
    ok(/even a rough one/.test(out.error), 'got: ' + out.error);
  });

  test('somebody who typed 0 and 0 gets the other message', () => {
    const out = parsePredictedTime('0', '0');
    eq(out.ok, false);
    ok(/Nought is not a time/.test(out.error), 'got: ' + out.error);
  });

  test('minutes are whole and 0–599, and the error points at that box', () => {
    eq(parsePredictedTime('600', '0').field, 'minutes');
    eq(parsePredictedTime('-1', '0').field, 'minutes');
    eq(parsePredictedTime('25.5', '0').field, 'minutes');
    eq(parsePredictedTime('abc', '0').field, 'minutes');
    eq(parsePredictedTime('599', '59'), { ok: true, predictedSec: 35999 }, 'the top of the range is allowed');
  });

  test('seconds are whole and 0–59, and the error points at THAT box', () => {
    eq(parsePredictedTime('25', '60').field, 'seconds');
    eq(parsePredictedTime('25', '-1').field, 'seconds');
    eq(parsePredictedTime('25', '1.5').field, 'seconds');
  });

  test('surrounding spaces do not turn a valid call into a junk one', () => {
    eq(parsePredictedTime(' 25 ', ' 30 '), { ok: true, predictedSec: 1530 });
    eq(parsePredictedTime('  ', '  '), parsePredictedTime('', ''), 'whitespace is still blank');
  });

  /* ═══ Editing a call ════════════════════════════════════════════════════ */

  group('setPredictedTime — correcting a call, and the re-bucketing that follows');

  test('the call is changed and the old one is reported back', () => {
    setDb({ 1: { racers: [racer('a', 1, 'Ana', 600)] } });
    const out = setPredictedTime('a', 900);
    eq(out.ok, true);
    eq(out.was, 600);
    eq(race(1).racers[0].predictedSec, 900);
  });

  test('editing an unknown racer is refused, and nothing else moves', () => {
    setDb({ 1: { racers: [racer('a', 1, 'Ana', 600)] } });
    eq(setPredictedTime('nope', 900).ok, false);
    eq(race(1).racers[0].predictedSec, 600);
  });

  test('a call that is not a whole number of seconds is refused', () => {
    setDb({ 1: { racers: [racer('a', 1, 'Ana', 600)] } });
    eq(setPredictedTime('a', 12.5).ok, false, 'a fraction of a second');
    eq(setPredictedTime('a', -1).ok, false, 'a negative call');
    eq(setPredictedTime('a', Number('x')).ok, false, 'NaN would poison every delta and rank');
    eq(race(1).racers[0].predictedSec, 600, 'the call is untouched by all three');
  });

  test('zero is accepted by core, exactly as addRacer accepts it — the form is the gate', () => {
    setDb({ 1: { racers: [racer('a', 1, 'Ana', 600)] } });
    eq(setPredictedTime('a', 0).ok, true, 'documents current behaviour, and mirrors addRacer');
    eq(parsePredictedTime('0', '0').ok, false, 'and the form is what refuses it');
  });

  test('before the gun an edited call re-buckets the racer into the right wave', () => {
    // 10:00 and 30:00 are 20 minutes apart, so they start in separate waves.
    setDb({ 1: { racers: [racer('a', 1, 'Ana', 600), racer('b', 2, 'Bea', 1800)], wavesLocked: false } });
    eq(raceView(1).map.get('b'), 1, 'Bea, the slower call, starts in her own wave 1');
    eq(raceView(1).map.get('a'), 2);

    const out = setPredictedTime('b', 630); // 10:30 — now within five minutes of Ana
    eq(out.wave, 1, 'the returned wave is the one she has just moved to');
    eq(raceView(1).map.get('a'), 1, 'and Ana with her');
    eq(raceView(1).waves, [1], 'and the wave she left no longer exists');
  });

  test('re-bucketing can take a neighbour with it, because the groups are drawn off the field', () => {
    /* Ana 10:00, Bea 16:00, Cal 22:00 — three groups, nobody within five minutes of
       anybody, numbered slowest first. Pulling Bea down to 10:30 leaves Ana+Bea together
       and Cal on his own, so Ana's wave number changes even though nobody edited Ana. */
    setDb({ 1: { racers: [
      racer('a', 1, 'Ana', 600), racer('b', 2, 'Bea', 960), racer('c', 3, 'Cal', 1320)
    ], wavesLocked: false } });
    eq(raceView(1).map.get('a'), 3, 'Ana, the quickest call, is the last wave');

    setPredictedTime('b', 630);
    const map = raceView(1).map;
    eq([map.get('a'), map.get('b'), map.get('c')], [2, 2, 1],
       'Ana is now wave 2 — an edit is not local to the racer it names');
  });

  test('once waves are locked an edited call does NOT move the racer', () => {
    setDb({ 1: {
      racers: [racer('a', 1, 'Ana', 600, { wave: 1 }), racer('b', 2, 'Bea', 1800, { wave: 2 })],
      waveStarts: { 1: T }, wavesLocked: true
    } });
    const out = setPredictedTime('b', 630); // would have grouped her with Ana before the gun
    eq(out.locked, true);
    eq(out.wave, 2, 'a field that regrouped mid-race would be a different race');
    eq(raceView(1).map.get('b'), 2);
    eq(race(1).racers[1].predictedSec, 630, 'but the call itself is still corrected');
  });

  test('a finished racer is re-measured against the corrected call', () => {
    setDb({ 1: {
      racers: [racer('a', 1, 'Ana', 600, { wave: 1, finishAt: T + 660000 })],
      waveStarts: { 1: T }, wavesLocked: true
    } });
    const before = result(racerById(raceView(1), 'a'), raceView(1));
    eq(before.delta, 60000, 'a minute over a 10:00 call');

    setPredictedTime('a', 660); // she actually called 11:00; the 10:00 was a typo
    const after = result(racerById(raceView(1), 'a'), raceView(1));
    eq(after.delta, 0, 'and now she is dead on it');
  });

  test('correcting a call re-ranks the leaderboard', () => {
    setDb({ 1: {
      racers: [
        racer('a', 1, 'Ana', 600, { wave: 1, finishAt: T + 630000 }),   // 0:30 over
        racer('b', 2, 'Bea', 600, { wave: 1, finishAt: T + 605000 })    // 0:05 over
      ],
      waveStarts: { 1: T }, wavesLocked: true
    } });
    eq(ranked(raceView(1)).map(r => r.racer.id), ['b', 'a'], 'Bea is closest to start with');

    setPredictedTime('b', 540); // Bea really called 9:00, so she is 1:05 out
    eq(ranked(raceView(1)).map(r => r.racer.id), ['a', 'b'], 'the board follows the correction');
  });

  test('an edit in one race leaves the same person in another race alone', () => {
    setDb({
      1: { racers: [racer('a', 1, 'Ana', 600)] },
      2: { racers: [racer('a2', 1, 'Ana', 600)] }
    });
    setPredictedTime('a', 900); // acts on currentRace, which is 1
    eq(race(1).racers[0].predictedSec, 900);
    eq(race(2).racers[0].predictedSec, 600, "race 2's call must survive an edit in race 1");
  });

  /* ═══ Sync — the async path, where a green suite hid a real bug ═════════ */

  group('sync() — pulling without losing local work');

  /* These restore real queueing and stub fetch, so they exercise the actual sync
     path rather than the no-op stub every other test runs under. Each one puts
     both back afterwards, so nothing leaks into a later run.

     `fetch` here never reaches the network: it returns whatever snapshot the test
     hands it. The runners block the real fetch as well, so this is the second layer. */
  async function withStubbedSync(fn) {
    const realFetch = globalThis.fetch;
    queue = function (action, payload) { outbox.push({ action, payload }); };
    try { await fn(); }
    finally {
      globalThis.fetch = realFetch;
      queue = noopQueue;
      outbox.length = 0;
    }
  }

  /** A fetch stub returning `body` as the response, resolving when `gate` does. */
  const fetchReturning = (body, gate) => () => (gate || Promise.resolve()).then(() => ({
    text: async () => JSON.stringify(body),
    json: async () => body
  }));

  await atest('an edited call is queued for the sheet under the action the backend handles', async () => {
    /* The action NAME is the contract. doPost() in apps-script.gs throws "Unknown action"
       on anything it does not recognise, sync() treats that as a refusal rather than a
       dropped signal, and shifts it off the queue for good — so a typo here would leave
       the edit correct on this phone and never written to the sheet, until the next pull
       quietly replaced it with the old call. The matching key is checked against
       apps-script.gs in run-tests.mjs. */
    setDb({ 1: { racers: [racer('a', 1, 'Ana', 600)] } });
    await withStubbedSync(async () => {
      setPredictedTime('a', 900);
      eq(outbox.length, 1);
      eq(outbox[0].action, 'setPredictedTime');
      eq(outbox[0].payload.id, 'a');
      eq(outbox[0].payload.predictedSec, 900);
    });
  });

  await atest('a finish recorded while the pull is in flight is not wiped by the snapshot', async () => {
    setDb({ 1: { racers: [racer('a', 1, 'Ana', 600, { wave: 1 })], waveStarts: { 1: T }, wavesLocked: true } });

    // The sheet still thinks Ana is running — this snapshot predates her finish.
    const stale = { races: { 1: {
      racers: [{ id: 'a', number: 1, name: 'Ana', predictedSec: 600, wave: 1, finishAt: null }],
      waveStarts: { 1: T }, wavesLocked: true, prizes: []
    } } };

    await withStubbedSync(async () => {
      let openGate;
      const gate = new Promise(res => { openGate = res; });
      globalThis.fetch = fetchReturning(stale, gate);

      const inFlight = sync({ pull: true });          // fetch is now hanging on the gate
      finishRacer('a', T + 601000);                   // the timer presses Finish mid-pull
      openGate();                                     // the stale snapshot comes back
      await inFlight;

      eq(race(1).racers[0].finishAt, T + 601000,
         "Ana's finish must survive a snapshot that was taken before it happened");
      ok(outbox.length > 0, 'and the finish must still be queued to send');
    });
  });

  await atest('a finish wiped this way would let a second press overwrite the real time', async () => {
    // The consequence of the bug above, stated as its own check: if the finish is
    // lost, finishRacer's "already finished" guard passes and a later time wins.
    setDb({ 1: { racers: [racer('a', 1, 'Ana', 600, { wave: 1 })], waveStarts: { 1: T }, wavesLocked: true } });
    finishRacer('a', T + 601000);
    const second = finishRacer('a', T + 640000);
    eq(second.ok, false, 'the guard only holds while the first finish is still on the racer');
    eq(race(1).racers[0].finishAt, T + 601000, 'and the real time is the one kept');
  });

  await atest('an unchanged snapshot is not re-applied, so the board is not rebuilt every poll', async () => {
    setDb({ 1: { racers: [racer('a', 1, 'Ana', 600, { wave: 1 })], waveStarts: { 1: T }, wavesLocked: true } });
    const snapshot = { races: { 1: {
      racers: [{ id: 'a', number: 1, name: 'Ana', predictedSec: 600, wave: 1, finishAt: null }],
      waveStarts: { 1: T }, wavesLocked: true, prizes: []
    } } };

    await withStubbedSync(async () => {
      globalThis.fetch = fetchReturning(snapshot);
      let renders = 0;
      const realRender = renderPage;
      renderPage = () => { renders += 1; };
      try {
        await sync({ pull: true });
        eq(renders, 1, 'the first snapshot is new, so it draws once');
        await sync({ pull: true });
        eq(renders, 1, 'the second is identical, so it must not draw again');
      } finally { renderPage = realRender; }
    });
  });

  await atest('a genuinely changed snapshot is still applied', async () => {
    setDb({ 1: { racers: [racer('a', 1, 'Ana', 600, { wave: 1 })], waveStarts: { 1: T }, wavesLocked: true } });

    await withStubbedSync(async () => {
      globalThis.fetch = fetchReturning({ races: { 1: {
        racers: [
          { id: 'a', number: 1, name: 'Ana', predictedSec: 600, wave: 1, finishAt: null },
          { id: 'b', number: 2, name: 'Bea', predictedSec: 700, wave: 1, finishAt: null }
        ],
        waveStarts: { 1: T }, wavesLocked: true, prizes: []
      } } });
      await sync({ pull: true });
      eq(race(1).racers.length, 2, 'a new sign-up from another device must arrive');
      eq(race(1).racers[1].name, 'Bea');
    });
  });

  /* ── Hand the results to whichever runner loaded this file ─────────────── */

  const passed = results.filter(r => r.ok).length;
  globalThis.__TEST_RESULTS__ = {
    passed, failed: results.length - passed, total: results.length, results
  };
})();
