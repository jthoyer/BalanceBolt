/* Balance Bolt — headless test runner
   ===================================
       node run-tests.mjs

   Exits 0 when everything passes and 1 when anything fails, so CI and the
   mc-verifier agent can both use it. No npm install, no dependencies.

   core.js is written for a browser, so this builds a small fake browser first:
   an in-memory localStorage, a stub location/history/document, and a fetch that
   throws. Then it runs core.js and tests-core.js in that one shared context, which
   is exactly what tests.html does with two <script> tags.

   The stubs are not decoration. core.js carries a live API_URL, and without them a
   test run would read real saved races and POST to the Apps Script endpoint.

   The same checks run in a browser via tests.html. Both load tests-core.js, so
   there is one copy of the tests, not two.
*/

import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = name => readFileSync(join(here, name), 'utf8');

/* ── A browser, roughly ─────────────────────────────────────────────────── */

function fakeStorage() {
  const map = new Map();
  return {
    getItem: k => (map.has(String(k)) ? map.get(String(k)) : null),
    setItem: (k, v) => { map.set(String(k), String(v)); },
    removeItem: k => { map.delete(String(k)); },
    clear: () => { map.clear(); },
    key: i => [...map.keys()][i] ?? null,
    get length() { return map.size; }
  };
}

/* Enough DOM that core.js never crashes reaching for an element. Every query
   misses, which is the honest answer: there is no page here. */
const noElement = null;
const fakeDocument = {
  querySelector: () => noElement,
  querySelectorAll: () => [],
  getElementById: () => noElement,
  createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, setAttribute() {} }),
  body: { dataset: {} },
  title: ''
};

const sandbox = {
  console,
  URL,
  URLSearchParams,
  Date,
  Math,
  JSON,
  Map,
  Set,
  Number,
  String,
  Boolean,
  Array,
  Object,
  Error,
  Promise,
  isNaN,
  parseInt,
  parseFloat,
  localStorage: fakeStorage(),
  location: { href: 'http://localhost/boltresults.html', search: '', origin: 'http://localhost' },
  history: { replaceState() {}, pushState() {} },
  document: fakeDocument,
  navigator: { onLine: true },
  setInterval: () => 0,
  clearInterval: () => {},
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: id => clearTimeout(id),
  fetch: () => { throw new Error('Network blocked in run-tests.mjs — a test reached fetch()'); }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

const context = createContext(sandbox);

/* ── Run ────────────────────────────────────────────────────────────────── */

try {
  runInContext(read('core.js'), context, { filename: 'core.js' });
} catch (err) {
  console.error('\n  core.js failed to load:\n  ' + err.stack + '\n');
  process.exit(1);
}

try {
  runInContext(read('tests-core.js'), context, { filename: 'tests-core.js' });
  // The suite is async — it tests sync(), which is where the interesting bugs are.
  // Without this await the results are read before the async group has finished.
  await sandbox.__TESTS_DONE__;
} catch (err) {
  console.error('\n  tests-core.js failed to load:\n  ' + err.stack + '\n');
  process.exit(1);
}

/* ── Page wiring ────────────────────────────────────────────────────────── */

/* input.js and results.js are not loaded above: they run against a real page, and
   the fake document here has no elements for them to find. That left a whole class
   of defect uncovered — an element deleted from the HTML while a page script still
   reaches for it at the top level. `$('#gone').addEventListener(...)` throws before
   boot() is ever called, so the page renders nothing at all and the browser shows
   only the static markup: no start list, no sync pill, no competitors. That shipped
   once (input.js reaching for #racePicker after it was removed from index.html) with
   all 78 checks below passing, so it is checked here rather than hoped about.

   A static check, not an executed one: pair each page script with its page and make
   sure every id it dereferences actually exists in that HTML. No DOM, no dependency. */
const PAGES = [['input.js', 'index.html'], ['results.js', 'boltresults.html'], ['core.js', null]];
const CORE_PAGES = ['index.html', 'boltresults.html'];

const idsUsedIn = src => [...new Set(
  [...src.matchAll(/\$\(\s*'#([A-Za-z0-9_-]+)'\s*\)/g)].map(m => m[1])
)];
const hasId = (html, id) => new RegExp(`id=["']${id}["']`).test(html);

const pageChecks = [];
for (const [script, page] of PAGES) {
  const src = read(script);
  // core.js serves both pages, so an id it uses need only exist on one of them.
  const pages = page ? [page] : CORE_PAGES;
  const htmls = pages.map(read);
  for (const id of idsUsedIn(src)) {
    const ok = htmls.some(html => hasId(html, id));
    pageChecks.push({
      group: 'page wiring',
      name: `${script} reaches for #${id}, which exists in ${pages.join(' or ')}`,
      ok,
      err: ok ? '' : `#${id} is used in ${script} but no element declares id="${id}" in ${pages.join(' or ')}.\n`
        + `If the element was deliberately removed, remove or null-guard the reference too —\n`
        + `an unguarded $('#${id}') at the top level of a page script stops the whole page booting.`
    });
  }
}

/* ── Report ─────────────────────────────────────────────────────────────── */

const out = sandbox.__TEST_RESULTS__;
if (!out) {
  console.error('\n  tests-core.js ran but set no results. Did the suite throw?\n');
  process.exit(1);
}

const wiringFailed = pageChecks.filter(c => !c.ok).length;
out.results = [...pageChecks, ...out.results];
out.total += pageChecks.length;
out.passed += pageChecks.length - wiringFailed;
out.failed += wiringFailed;

const dim = s => `\x1b[2m${s}\x1b[0m`;
const red = s => `\x1b[31m${s}\x1b[0m`;
const green = s => `\x1b[32m${s}\x1b[0m`;

let lastGroup = null;
for (const r of out.results) {
  if (r.group !== lastGroup) {
    console.log('\n' + dim(r.group));
    lastGroup = r.group;
  }
  if (r.ok) {
    console.log('  ' + green('ok') + '   ' + r.name);
  } else {
    console.log('  ' + red('FAIL') + ' ' + r.name);
    console.log(r.err.split('\n').map(l => '       ' + l).join('\n'));
  }
}

console.log('');
if (out.failed === 0) {
  console.log(green(`  ${out.passed} checks passed.`) + '\n');
  process.exit(0);
} else {
  console.log(red(`  ${out.failed} of ${out.total} checks FAILED.`) + '\n');
  process.exit(1);
}
