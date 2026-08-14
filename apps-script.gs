/**
 * Balance Tri Club — prediction race series backend (5 races).
 *
 * SETUP
 * 1. Open the race spreadsheet:
 *    https://docs.google.com/spreadsheets/d/1exilWhjiLgbO1sGGSXqYvk20W5K5ANy3xRh0n1qCRfQ/edit
 * 2. Extensions → Apps Script. Delete anything in Code.gs and paste this file in.
 * 3. Save, then Deploy → New deployment → type "Web app".
 *      Execute as: Me
 *      Who has access: Anyone
 * 4. Copy the /exec URL it gives you and paste it into API_URL at the top of core.js.
 *
 * The sheets (Racers, Waves, Prizes, Meta) are created automatically on first use.
 * Every row is tagged with a race number, 1 to 5, and every action is scoped to one race.
 * A sheet left over from the single-race version is migrated on first touch: a `race`
 * column is inserted and every existing row is filed under race 1.
 *
 * All times are stored as epoch milliseconds captured on the timing device, so
 * network lag never lands on a racer's result.
 */

var SHEET_ID = '1exilWhjiLgbO1sGGSXqYvk20W5K5ANy3xRh0n1qCRfQ';
var RACE_COUNT = 5;

var SHEETS = {
  Racers: ['race', 'id', 'number', 'name', 'predictedSec', 'wave', 'finishAt'],
  Waves: ['race', 'wave', 'startedAt'],
  Prizes: ['race', 'id', 'label', 'racerId', 'awardedAt'],
  Meta: ['key', 'value']
};

/* Headers written by the single-race version, kept so we can spot and migrate them. */
var LEGACY_HEADERS = {
  Racers: ['id', 'number', 'name', 'predictedSec', 'wave', 'finishAt'],
  Waves: ['wave', 'startedAt'],
  Prizes: ['id', 'label', 'racerId', 'awardedAt']
};

/* ── Sheet plumbing ────────────────────────────────────────────────────── */

function book_() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function sheet_(name) {
  var ss = book_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(SHEETS[name]);
    sh.setFrozenRows(1);
    return sh;
  }
  migrateSheet_(sh, name);
  return sh;
}

/** Single-race sheet → series sheet. Everything already there becomes race 1. */
function migrateSheet_(sh, name) {
  var legacy = LEGACY_HEADERS[name];
  if (!legacy) return;
  if (sh.getLastRow() < 1) { sh.appendRow(SHEETS[name]); sh.setFrozenRows(1); return; }

  var header = sh.getRange(1, 1, 1, legacy.length).getValues()[0];
  for (var i = 0; i < legacy.length; i++) {
    if (String(header[i]) !== legacy[i]) return; // already migrated, or not ours
  }

  sh.insertColumnBefore(1);
  sh.getRange(1, 1).setValue('race');
  var last = sh.getLastRow();
  if (last > 1) {
    var ones = [];
    for (var r = 2; r <= last; r++) ones.push([1]);
    sh.getRange(2, 1, ones.length, 1).setValues(ones);
  }
  sh.setFrozenRows(1);

  // wavesLocked was a single global flag; it belonged to race 1.
  var oldFlag = findRow_('Meta', 'key', 'wavesLocked');
  if (oldFlag) setCell_('Meta', oldFlag, 'key', 'wavesLocked:1');
}

function rows_(name) {
  var sh = sheet_(name);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var head = SHEETS[name];
  var out = [];
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === '') continue;
    var obj = { _row: i + 1 };
    for (var c = 0; c < head.length; c++) obj[head[c]] = values[i][c];
    out.push(obj);
  }
  return out;
}

/** Row index (1-based, including the header) of the first row whose column matches. */
function findRow_(name, column, value) {
  var sh = sheet_(name);
  var col = SHEETS[name].indexOf(column) + 1;
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return 0;
  var values = sh.getRange(2, col, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(value)) return i + 2;
  }
  return 0;
}

/** Row index of the first row matching every key in `match`. */
function findRowWhere_(name, match) {
  var found = rows_(name).filter(function (row) {
    for (var key in match) {
      if (String(row[key]) !== String(match[key])) return false;
    }
    return true;
  });
  return found.length ? found[0]._row : 0;
}

function appendRow_(name, obj) {
  sheet_(name).appendRow(SHEETS[name].map(function (key) {
    return obj[key] === undefined || obj[key] === null ? '' : obj[key];
  }));
}

function setCell_(name, row, column, value) {
  sheet_(name).getRange(row, SHEETS[name].indexOf(column) + 1).setValue(value);
}

function getCell_(name, row, column) {
  return sheet_(name).getRange(row, SHEETS[name].indexOf(column) + 1).getValue();
}

/** Delete every row matching `match`, bottom up so the indices stay valid. */
function deleteRowsWhere_(name, match) {
  var sh = sheet_(name);
  var doomed = rows_(name).filter(function (row) {
    for (var key in match) {
      if (String(row[key]) !== String(match[key])) return false;
    }
    return true;
  }).map(function (row) { return row._row; });

  doomed.sort(function (a, b) { return b - a; });
  doomed.forEach(function (r) { sh.deleteRow(r); });
}

function meta_(key) {
  var row = findRow_('Meta', 'key', key);
  return row ? getCell_('Meta', row, 'value') : '';
}

function setMeta_(key, value) {
  var row = findRow_('Meta', 'key', key);
  if (row) setCell_('Meta', row, 'value', value);
  else appendRow_('Meta', { key: key, value: value });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function raceOf_(body) {
  var n = Number(body.race);
  if (!(n >= 1 && n <= RACE_COUNT)) throw new Error('Bad race number: ' + body.race);
  return n;
}

/* ── Read ──────────────────────────────────────────────────────────────── */

/* Always returns all five races. The results page needs the whole series for the
   standings, and a partial payload would look like an empty race to the client. */
function doGet() {
  try {
    var races = {};
    for (var n = 1; n <= RACE_COUNT; n++) {
      races[n] = { racers: [], waveStarts: {}, wavesLocked: String(meta_('wavesLocked:' + n)) === 'true', prizes: [] };
    }

    rows_('Racers').forEach(function (r) {
      var race = races[Number(r.race)];
      if (!race) return;
      race.racers.push({
        id: String(r.id),
        number: Number(r.number),
        name: String(r.name),
        predictedSec: Number(r.predictedSec),
        wave: r.wave === '' ? null : Number(r.wave),
        finishAt: r.finishAt === '' ? null : Number(r.finishAt)
      });
    });

    rows_('Waves').forEach(function (w) {
      var race = races[Number(w.race)];
      if (race && w.startedAt !== '') race.waveStarts[Number(w.wave)] = Number(w.startedAt);
    });

    rows_('Prizes').forEach(function (p) {
      var race = races[Number(p.race)];
      if (!race) return;
      race.prizes.push({
        id: String(p.id),
        label: String(p.label),
        racerId: String(p.racerId),
        awardedAt: Number(p.awardedAt)
      });
    });

    return json_({ races: races });
  } catch (err) {
    return json_({ error: String(err) });
  }
}

/* ── Write ─────────────────────────────────────────────────────────────── */

/* Posted as text/plain so the browser skips the CORS preflight.
   Every handler is idempotent: a retried queued action must never double-apply. */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var body = JSON.parse(e.postData.contents);
    var handler = ACTIONS[body.action];
    if (!handler) throw new Error('Unknown action: ' + body.action);
    handler(body);
    return json_({ ok: true });
  } catch (err) {
    return json_({ error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

var ACTIONS = {

  register: function (body) {
    var race = raceOf_(body);
    var racer = body.racer;
    if (findRow_('Racers', 'id', racer.id)) return; // already applied — a retry, not a duplicate

    // Race numbers are handed out by the device and are per race, so settle any clash here.
    var taken = rows_('Racers')
      .filter(function (r) { return Number(r.race) === race; })
      .map(function (r) { return Number(r.number); });
    var number = Number(racer.number);
    while (taken.indexOf(number) !== -1) number++;

    appendRow_('Racers', {
      race: race,
      id: racer.id,
      number: number,
      name: racer.name,
      predictedSec: Number(racer.predictedSec),
      wave: racer.wave || '',
      finishAt: ''
    });
  },

  lockWaves: function (body) {
    var race = raceOf_(body);
    (body.assignments || []).forEach(function (a) {
      var row = findRowWhere_('Racers', { race: race, id: a.id });
      if (row) setCell_('Racers', row, 'wave', a.wave);
    });
    setMeta_('wavesLocked:' + race, 'true');
  },

  startWave: function (body) {
    var race = raceOf_(body);
    var row = findRowWhere_('Waves', { race: race, wave: Number(body.wave) });
    if (row) {
      // First start wins — never overwrite a wave that is already running.
      if (String(getCell_('Waves', row, 'startedAt')) === '') {
        setCell_('Waves', row, 'startedAt', Number(body.startedAt));
      }
    } else {
      appendRow_('Waves', { race: race, wave: Number(body.wave), startedAt: Number(body.startedAt) });
    }
  },

  finish: function (body) {
    var race = raceOf_(body);
    var row = findRowWhere_('Racers', { race: race, id: body.id });
    if (!row) throw new Error('No racer ' + body.id + ' in race ' + race);
    if (String(getCell_('Racers', row, 'finishAt')) !== '') return; // first time through wins
    setCell_('Racers', row, 'finishAt', Number(body.finishAt));
  },

  unfinish: function (body) {
    var row = findRowWhere_('Racers', { race: raceOf_(body), id: body.id });
    if (row) setCell_('Racers', row, 'finishAt', '');
  },

  removeRacer: function (body) {
    var race = raceOf_(body);
    deleteRowsWhere_('Racers', { race: race, id: body.id });
    deleteRowsWhere_('Prizes', { race: race, racerId: body.id });
  },

  awardPrize: function (body) {
    var race = raceOf_(body);
    if (findRow_('Prizes', 'id', body.prize.id)) return;
    appendRow_('Prizes', {
      race: race,
      id: body.prize.id,
      label: body.prize.label,
      racerId: body.prize.racerId,
      awardedAt: Number(body.prize.awardedAt)
    });
  },

  removePrize: function (body) {
    deleteRowsWhere_('Prizes', { race: raceOf_(body), id: body.id });
  },

  resetTimes: function (body) {
    var race = raceOf_(body);
    rows_('Racers')
      .filter(function (r) { return Number(r.race) === race; })
      .forEach(function (r) {
        setCell_('Racers', r._row, 'wave', '');
        setCell_('Racers', r._row, 'finishAt', '');
      });
    deleteRowsWhere_('Waves', { race: race });
    setMeta_('wavesLocked:' + race, 'false');
  },

  resetRace: function (body) {
    var race = raceOf_(body);
    deleteRowsWhere_('Racers', { race: race });
    deleteRowsWhere_('Waves', { race: race });
    deleteRowsWhere_('Prizes', { race: race });
    setMeta_('wavesLocked:' + race, 'false');
  }
};
