# Balance Bolt — style guide

The design system as actually built, so a new screen can be added without reading
every line of `styles.css`. Tokens come from the
[club race calendar app](https://jthoyer.github.io/BalanceTRI-app/) so the two feel
like one product.

Everything here is plain CSS in one file. No build step, no framework, no utility
classes. If you need a new pattern, add it to `styles.css` **and** to this file.

---

## 1. Colour

### Tokens

| Token | Hex | What it is for |
|---|---|---|
| `--ink` | `#182542` | Body text, hero and card backgrounds, the default "dark" |
| `--muted` | `#566177` | Secondary text: helper copy, table headers, metadata |
| `--line` | `#d9dfe8` | **Decorative** container edges only — panels, cards, table wrappers |
| `--line-strong` | `#78849c` | **Any control boundary**: inputs, selects, small buttons, dashed zones |
| `--canvas` | `#f7f8fa` | Page background |
| `--yellow` | `#f8c44f` | Fills only — primary button, wave start button, hero highlight |
| `--yellow-soft` | `#ffe08f` | Small accent **text** on ink or green (the eyebrow on dark cards) |
| `--green` | `#116b43` | A wave that is running, a bang-on result, success |
| `--green-bg` | `#e8f6ee` | Series prize card, connected sync pill. **Not** the winning row — that is `--gold-bg` |
| `--navy-bg` | `#eef2fb` | Bib badges, status tags, table headers, the furthest-from-the-call row |
| `--gold` | `#dba82f` | 1st place: medal card fill and rank badge. Deeper than `--yellow` on purpose — a medal is not a button |
| `--gold-rim` | `#8c6214` | The 1st-place card edge, and the numeral in its medal chip |
| `--gold-bg` | `#fbf0d5` | Leading row tint on both tables |
| `--silver` | `#d3dae3` | 2nd place: medal card fill and rank badge |
| `--silver-rim` | `#5f6b7d` | The 2nd-place card edge, and the numeral in its medal chip |
| `--bronze` | `#9c5a2c` | 3rd place: medal card fill and rank badge. The one medal dark enough to take white text |
| `--bronze-rim` | `#6f3f1e` | The 3rd-place card edge, and the numeral in its medal chip |
| `--slate` | `#3f4d6b` | A wave where everyone is home |
| `--red` | `#b3261e` | Errors, destructive actions |
| `--red-bg` | `#fdecec` | Error message and danger button background |
| `--focus` | `#285ba8` | Focus ring on light backgrounds (white ring on dark ones) |
| `--brand-blue` | `#00a3e0` | Brand mark only. **Never** used for text — 2.87:1 on white |

### The two-tier border rule

This is the rule most easily got wrong. `--line` is 1.34:1 against white: fine for
the edge of a decorative card, nowhere near enough for anything a person operates.
**Anything that is a control gets `--line-strong`.** If you are unsure whether the
thing you are drawing is a control, use `--line-strong`.

### Measured contrast

Ratios computed against the WCAG 2.1 relative-luminance formula. Body text needs
4.5:1, large text (≥18.66px bold or ≥24px) needs 3:1, UI component boundaries and
states need 3:1.

**Text on dark**

| Pair | Ratio |
|---|---|
| `#ffffff` on `--ink` | 15.19 |
| `#edf0f7` (hero body copy) on `--ink` | 13.32 |
| `#e6ebf5` (wave meta, wave size) on `--ink` | 12.71 |
| `--yellow-soft` on `--ink` | 11.80 |
| `--yellow` on `--ink` | 9.41 |
| `#ffffff` on `--slate` | 8.45 |
| `#e6ebf5` on `--slate` | 7.07 |
| `#ffffff` on `--green` | 6.55 |
| `#e7f4ec` (confirm detail) on `--green` | 5.78 |
| `#e6ebf5` on `--green` | 5.48 |
| `--yellow-soft` on `--green` | 5.08 |
| `#ffffff` (name, delta, eyebrow) on `--bronze` | 5.37 |
| `#faf0e9` (bronze card detail) on `--bronze` | 4.78 |

**Text on light**

| Pair | Ratio |
|---|---|
| `--ink` on `#ffffff` | 15.19 |
| `--ink` on `--canvas` | 14.30 |
| `--ink` on `--green-bg` | 13.64 |
| `--ink` on `--navy-bg` | 13.55 |
| `--ink` on `--gold-bg` (leading row) | 13.40 |
| `--ink` on `#eef0f4` (secondary button) | 13.32 |
| `--ink` on `--silver` (2nd medal card, 2nd rank badge) | 10.79 |
| `--ink` on `--yellow` (primary button label) | 9.41 |
| `--bronze-rim` on `#ffffff` (3rd medal chip numeral) | 8.73 |
| `#2c3752` (silver card detail) on `--silver` | 8.40 |
| `--ink` on `--gold` (1st medal card, 1st rank badge) | 6.98 |
| `--green` on `#ffffff` | 6.55 |
| `--red` on `#ffffff` | 6.54 |
| `--muted` on `#ffffff` | 6.23 |
| `--muted` on `#fffaf0` (adhoc prize card) | 5.99 |
| `--green` on `--green-bg` | 5.88 |
| `--muted` on `--canvas` | 5.86 |
| `--green` on `--navy-bg` (bang-on delta, furthest row) | 5.84 |
| `--green` on `--gold-bg` (bang-on delta, leading row) | 5.78 |
| `--red` on `--red-bg` | 5.72 |
| `--muted` on `--green-bg` | 5.59 |
| `--muted` on `--navy-bg` | 5.55 |
| `--muted` on `--gold-bg` | 5.49 |
| `--muted` on `#eef0f4` | 5.46 |
| `#2c3752` (gold card detail) on `--gold` | 5.44 |
| `--gold-rim` on `#ffffff` (1st medal chip numeral) | 5.42 |
| `--silver-rim` on `#ffffff` (2nd medal chip numeral) | 5.40 |

**Non-text (3:1 needed)**

| Pair | Ratio |
|---|---|
| `--ink` fill on `#ffffff` | 15.19 |
| `--focus` ring on `#ffffff` | 6.66 |
| `--focus` ring on `--canvas` | 6.27 |
| `--red` border on `--canvas` | 6.15 |
| `--focus` ring on `--green-bg` | 5.98 |
| `--focus` ring on `--navy-bg` | 5.94 |
| `--focus` ring on `--gold-bg` | 5.88 |
| `--green` fill on `#ffffff` | 6.55 |
| `--bronze-rim` medal card edge on `--canvas` | 8.21 |
| `--gold-rim` medal card edge on `--canvas` | 5.10 |
| `--silver-rim` medal card edge on `--canvas` | 5.09 |
| `--yellow` start button on the `--green` wave bar | 4.05 |
| `--line-strong` on `#ffffff` | 3.76 |
| `--line-strong` on `#fffaf0` | 3.62 |
| `--line-strong` on `--canvas` | 3.54 |
| `--line-strong` on `--green-bg` | 3.38 |
| `--line-strong` on `--navy-bg` | 3.36 |
| `--line-strong` on `#eef0f4` | 3.30 |

**Deliberately below 3:1, and why that is allowed**

| Pair | Ratio | Reason |
|---|---|---|
| `--line` on `#ffffff` | 1.34 | Decorative card and panel edges. Carries no state and no affordance; the content inside identifies the card. |
| `#eff1f4` row dividers on `#ffffff` | 1.13 | Decorative separators between list rows. |
| `#e0c07a` on `#ffffff` (adhoc prize tint) | 1.75 | Decorative tint. The card is identified by its heading, not its border. |
| `#eef0f4` (Cancel fill) on `--canvas` (call editor) | 1.07 | A `.secondary-button` sitting on the editor's own `--canvas` surface. Identified by its `--line-strong` border, which measures 3.54 against that surface and 3.30 against its own fill. |
| `--navy-bg` hover fill on `#ffffff` | 1.12 | `.quiet-button.neutral:hover`. A hover tint, not a state anyone has to see; the button is identified by its `--ink` border at 15.19 and its `--ink` label at 13.55. |
| `--yellow` fill against `--canvas` | 1.52 | The primary button is identified by its `--ink` label at 9.41:1. WCAG 1.4.11 does not require a boundary when the component is identifiable another way. |
| `#ffffff` medal chip on `--gold` / `--silver` | 2.18 / 1.41 | Decorative disc. The place number inside it is the component, at 5.42:1 and 5.40:1. |
| `#ffffff` bib pill on `--gold-bg` / `--navy-bg` rows | 1.13 / 1.12 | Decorative pill, same case as the `--line` card edge. The bib number reads at 15.19:1. It is white rather than `--navy-bg` only because `--navy-bg` on a tinted row measures 1.01 and the pill shape disappears entirely. |

**Never do this** (both were live bugs, now fixed):

- `#f6cf69` eyebrow text on a white panel — 1.62:1. Eyebrows on light backgrounds use `--muted`.
- `--yellow` eyebrow text on `--green` — 4.05:1, under the 4.5 needed for 12px text. Use `--yellow-soft`.

### Never colour alone

Rank is always printed as a number as well as tinted. "Bang on" results are green
*and* say `0:03 under`. A running racer gets a `Waiting` / `On course` status tag,
not just grey text. A medal is never only a colour: the card carries a place number
in its chip *and* spells out the prize ("2nd closest to the call"), and the matching
rank badge in the table has the numeral inside the metal pill. Nobody has to tell
gold from bronze to know who won.

---

## 2. Type

Two families, loaded from Google Fonts:

- **Outfit** (600/700) — headings, clocks, numbers, anything that should feel big.
- **DM Sans** (400/500/600/700) — everything else. Body is `400 16px/1.5`.

| Role | Size | Family / weight |
|---|---|---|
| Hero headline | `clamp(2rem, 9vw, 3.25rem)`, letter-spacing `-1.2px` | Outfit 700 |
| Race clock | `clamp(2.75rem, 16vw, 5rem)` | Outfit 700, tabular |
| Section `h1` / `h2` | 24px → 28px at ≥700px | Outfit 600/700 |
| Wave bar `h3` | 20px | Outfit 700 |
| Wave card `h3` | 18px | Outfit 700 |
| Podium name | 26px → 30px | Outfit 700 |
| Prize winner | 20px → 22px | Outfit 700 |
| Wave clock | 28px → 30px | Outfit 700, tabular |
| Timing row elapsed | 19px | Outfit 700 |
| Body | 16px | DM Sans 400 |
| Table cell | 15px | DM Sans 400 |
| Helper text, metadata | 14px | DM Sans 400, `--muted` |
| Sub-line under a name | 12–13px | DM Sans 400, `--muted` |
| Eyebrow | 12px, letter-spacing `1.2px`, uppercase in the copy | DM Sans 700 |
| Table column header | 11px, letter-spacing `0.8px`, uppercase | DM Sans 700, `--muted` |

Rules:

- Every element showing a time gets `font-variant-numeric: tabular-nums` so digits
  do not jitter as a clock ticks.
- Form inputs are **16px minimum**. Anything smaller makes iOS zoom on focus and the
  layout jumps mid-race.
- Uppercase is done in the copy, not with `text-transform`, except for table headers
  and prize card titles where the source text is the readable form.

---

## 3. Spacing, shape, elevation

- **Border radius is 9px.** Everywhere, except pills and badges which are `999px`.
- Vertical rhythm: `.panel` 20px margin block, `.section-head` 28px top / 12px bottom,
  grids and lists gap 12px, form field groups 12–14px.
- Padding: panel `22px 18px` → `28px` at ≥700px. Hero `28px 22px` → `48px 54px`.
  Cards `16–20px`.
- One shadow in the whole system: `0 8px 24px rgba(18,31,55,.12)` on the sticky race
  clock, and only while it is stuck (phones). Everything else is flat.
- Tap targets: `--tap` 48px for primary controls, `--tap-min` 44px is the floor and
  nothing goes below it — including low-emphasis buttons like Edit call, Undo and Take
  it back.

---

## 4. Components

### Hero (`.hero` / `.hero-copy`)
Dark navy block on the light canvas, 9px radius. Contains an eyebrow, the page `h1`,
optional body copy, and a highlight line. Body copy inside a hero uses `#edf0f7`, not
pure white, to soften the block without dropping below 4.5:1.

### Clock hero (`.clock-hero`)
A hero carrying the race clock. `position: sticky; top: 0` on phones so the clock is
never scrolled away during timing; static from 700px up. The clock itself is
`role="timer" aria-live="off"` — see §6.

**Running vs stopped.** A clock counts up while it carries `data-live-from`. When the
last racer in the race stops their clock, `raceStoppedAt()` returns that instant,
`data-live-from` is removed from the race clock *and* every wave clock, and each is
written once with its final elapsed time and given `.stopped` (`--yellow-soft`). The
state is also said in words under the race clock — "Race done — clocks stopped on
13:05" — so the tint is never the only signal. Undoing a finish restores the running
state, because stopped-ness is derived, never stored.

### Panel (`.panel`)
White card, `--line` border, 9px radius. The default container for a form or a block
of settings. `.panel-heading` holds an optional eyebrow plus the `h2`.

### Section head (`.section-head`)
Heading plus one line of helper text, used to introduce a region that is not a card.

### Race picker (`.race-pick`)
A `<fieldset>` with legend "Which race" and five native radios styled as a segmented
control. The radio itself is visually hidden but focusable; the `<label>` carries the
paint. Arrow keys, `Home`/`End` and screen-reader group semantics all come free from
the native radio group — **do not** rebuild this with buttons and `role="radio"`.
Each label has a visually-hidden `Race ` prefix so it announces as "Race 3", not "3".

### Thumb bar (`.thumb-bar`)
Fixed to the bottom of the viewport on phones, `position: static` pills under the logo
from 700px up. Sits inside `.shell` before `<main>` in the DOM so keyboard order
reaches navigation before content.

- `.tab-strip` is `role="tablist"`; each `.view-tab` is `role="tab"` with roving
  `tabindex` and arrow-key support.
- The bar holds tabs only. `index.html` and `boltresults.html` do not link to each
  other, so there is no cross-page link pattern inside it — one would belong outside
  the tablist, because it would not be a tab.
- The sign-up page has no sections to switch between, so it has **no thumb bar at all**
  and no `has-thumb-bar` class on `<body>`. Same for `admin.html`.
- `body.has-thumb-bar` reserves the bar's height, and `html { scroll-padding-bottom }`
  keeps focused elements from ending up underneath it.

### Wave card (`.wave-card`)
Start-list grouping. Ink header bar with `h3 "Wave N"` and a racer count, then a plain
`<ul>` of `.roster-entry` rows.

### Wave bar (`.wave-bar`)
Race-control header for one wave. Background encodes state and the meta text repeats
it in words:
- `.pending` → `--ink`, shows "On the line" and a **Start wave N** button
- `.running` → `--green`, shows a live clock
- `.done` → `--slate`, shows the final clock

### Timing row (`.timing-row`)
One racer during a race: bib, name, "called 25:00", an **Edit call** button, then either a
live clock plus a **Finish** button, or the elapsed time, the delta and an **Undo** button.
It wraps on narrow phones with the action staying on the thumb side (`margin-left: auto`).

**Edit call sits with the call, not with the action.** It carries its own
`margin-right: auto`, so the two auto margins share the row's free space and leave it
against the name while the clock and Finish stay on the right edge — and on a narrow phone
the row wraps between them. That placement is deliberate: Finish is the one control in this
app that must never be pressed by accident, so nothing else is parked beside it. The same
reasoning removed the per-racer Remove button from the sign-up sheet's start list.

### Call editor (`.timing-edit`)
The form Edit call opens: a `.time-field` fieldset with the same Minutes / Seconds
`.two-columns` pair the sign-up form uses, one line of `.helper-text`, a `.form-error`, and
a `.dialog-footer` holding **Cancel** (`.secondary-button`) and **Save the call**
(`.save-button`). Race control only — `index.html` has no editing on it at all.

`flex-basis: 100%` drops it onto its own line *inside* the timing row, the same trick
`.start-button` uses inside `.wave-bar`, so the form never squeezes the clock sideways. From
700px up the two boxes are capped at 150px each, the way the race picker caps its five
options — a field that holds three digits should not be half the shell wide.

**The open editor is state, not DOM.** `renderControl()` rebuilds the whole wave list and
the sheet poll calls it every `POLL_MS`, so an editor that existed only in the DOM would be
snatched away mid-correction. `results.js` holds `callEdit = { id, minutes, seconds, error }`
and the render puts the form back exactly as it was; `data-focus-key` on both boxes lets
`keepFocus()` return the caret to the one that had it. One row is open at a time.

**The helper line states the consequence before the button is pressed**, because it differs:
before the first gun the edit can re-bucket the racer *and a neighbour*, since the
five-minute groups are drawn off the whole field; after `wavesLocked` the wave is fixed and
only the time they are measured against changes; and if they are already home, the
leaderboard moves under them.

### Bib badge (`.bib`)
Pill on `--navy-bg` with the race number, tabular. Always rendered with a
visually-hidden `Racer ` prefix so it does not announce as a bare digit.

### Status tag (`.status-tag`)
Small `--navy-bg` pill for a non-numeric state — `On course`, `Waiting`.

### Podium card (`.podium-card`)
Up to four per race, and they *are* the automatic prizes — there is no second list of
them anywhere on the page. Each card is a 2px-rimmed block holding an optional medal
chip, an eyebrow naming the prize, the racer, the delta and the called/ran detail.

| Variant | Fill / rim | Text | Chip | When |
|---|---|---|---|---|
| `.gold` | `--gold` / `--gold-rim` | `--ink`, detail `#2c3752` | `1` | Closest to the call |
| `.silver` | `--silver` / `--silver-rim` | `--ink`, detail `#2c3752` | `2` | 2nd closest |
| `.bronze` | `--bronze` / `--bronze-rim` | `#ffffff`, detail `#faf0e9` | `3` | 3rd closest |
| `.outlier` | `--ink` / `--ink` | `#ffffff`, detail `#e6ebf5`, eyebrow `--yellow-soft` | none | Furthest from the call |

**`.outlier` is deliberately not a metal and deliberately has no chip** — a wooden
spoon that looked like a fourth medal would read as 4th place. It only appears when
more than three racers have finished: with three or fewer, the furthest racer is
already wearing bronze, and naming them twice is the duplication this layout removed.

`.medal-chip` is a 30px white disc holding the place number, `aria-hidden` because the
eyebrow beside it already says which prize this is and the table repeats the rank.

### Prize card (`.prize-card`)
White card, uppercase `--muted` `h3` title, big Outfit winner name, `--muted` detail.
Now only for prizes the podium does not already award: `.adhoc` (warm tint, carries a
"Take it back" button) and `.series` (green tint with a thick left border, for
series-wide prizes). The three closest-to-the-call prizes and the wooden spoon are
podium cards, not prize cards.

### Rule card (`.rule-card`)
White card with a 4px `--ink` left border, used to explain a scoring rule in the place
the rule applies. The series ranking rule lives in one on the Series panel — a ranking
nobody can derive from the table is a bug, not a feature.

### Storage notice (`.storage-notice`)
Same look as the rule card — white, 4px `--ink` left border — but a different job: it
warns that data is device-only. Present on `index.html` and `boltresults.html` in the
markup, `hidden` by default, and shown or hidden exactly once, in `boot()`
(`core.js`), based on whether `API_URL` is set — never re-evaluated per render, since
the constant cannot change at runtime. Not a live region: it is decided before the
page is usable, not announced mid-session. Not shown on `admin.html`, which holds no
race data of its own.

### Sync pill (`.sync-pill`)
One small label in the header carrying five states, in priority order: **"Not saving
on this device"** (storage refused a write — `.error`), **"Local only"** (no
`API_URL`), **"Offline — N to send"** / **"Sheet unreachable"** (`.error`), **"Saving
N…"**, **"Synced"** (`.ok`). Deliberately not a live region — at a four-second poll it
would natter. Only a genuine change between online and offline is announced, once.

The storage state outranks the sheet state because it is worse: an unreachable sheet
still has every time safe on the phone, whereas a device that cannot write loses the
lot on refresh. `save()` catches the failure rather than throwing, so the sign-up
still lands in memory, still queues, and still draws — a volunteer mid-race gets a
warning, not a form that silently does nothing.

### Confirm card (`.confirm-card`)
Green block shown after a successful sign-up with the race number, wave and predicted
time. Visual confirmation only; the same text also goes to the announcer.

Shown through `showConfirm()` in `input.js`, never from `render()`: the sheet poll
re-renders every `POLL_MS`, so a render-driven rule would snatch the card away
mid-read. Nothing on the sign-up page can change the race or take the racer off the
list, so the card stands until the next sign-up overwrites it.

Before the first gun it says "wave 2 **for now**", because `buildWaveMap` regroups on
every sign-up until `wavesLocked`. Stating a fluid wave as settled is a promise the
app cannot keep.

### Admin splash (`admin.html`, `.admin-links`, `.admin-link-card`)
The one page that deliberately links elsewhere. A hero, then two `.panel`s in a
`.admin-links` grid (single column on phones, two from 700px), each an
`.admin-link-card` — eyebrow, `h2`, one line of `.helper-text`, and a full-width
button-styled `<a>` pinned to the card's bottom with `margin-top: auto` so mismatched
copy lengths still end on the same line. No JS: the page is pure navigation, so it
carries no `core.js` and no thumb bar. Route "for racers" through `.primary-button`
and "for race control" through `.save-button` — matching weight, distinct colour, no
ranking implied between the two jobs.

### Buttons

| Class | Use | Look |
|---|---|---|
| `.primary-button` | The main action on a form | `--yellow` fill, `--ink` label, 52px |
| `.save-button` | Secondary primary — "Stop their clock" | `--ink` fill, white label, 52px |
| `.start-button` | Fire a wave | `--yellow` fill inside the wave bar, 56px |
| `.finish-button` | Stop one racer's clock | `--ink` fill, 48px |
| `.secondary-button` | Admin actions | `#eef0f4` fill, `--line-strong` border |
| `.secondary-button.danger` | Destructive | `--red-bg` fill, `--red` border and label |
| `.quiet-button` | Edit call / Undo / Take it back | White, `--line-strong` border, 44px |
| `.quiet-button.neutral` | Same, where the action is **not** a reversal or a removal (Edit call) | As above, but the hover is `--ink` / `--navy-bg` instead of red |
| `.text-button` | Header-only, low weight | Transparent, `--muted` |

Full-width on phones, `width: auto` from 700px up.

`.primary-button`, `.secondary-button` and `.save-button` are also used on `<a>`
elements (`admin.html`'s two links). A `<button>` centres its content and respects
`width: 100%` for free; an `<a>` is inline and does neither, so
`a.primary-button, a.secondary-button, a.save-button { display: flex; ... }` gives the
anchor case the same layout. Keep this in mind before adding a fourth button class —
the anchor rule needs the new class added to its selector too, or a link styled with
it will sit left-aligned and shrink-wrapped instead of centred and full-width.

### Tables (`.board`, `.board-wrap`)
`.board-wrap` is the scroll container and is `role="region"` + `tabindex="0"` +
`aria-labelledby` pointing at the table's `<caption>`, so a keyboard user can scroll
it. Wide columns get `.col-wide` and are `display: none` on phones, where the same
information is repeated in a `.racer-sub` line under the name. The name cell is a
`<th scope="row">`. Never let a table force horizontal scrolling at 320px.

**Row and cell states.**

| Class | Means | How it reads without colour |
|---|---|---|
| `tr.is-first` | Leader | Rank number `1` in the rank column |
| `tr.is-last` | Furthest from the call | Rank number, and the podium card names them |
| `.rank-badge.medal.gold` / `.silver` / `.bronze` | 1st, 2nd, 3rd — the three automatic prizes | The place number sits inside the metal pill |
| `tr.is-running` | Still on course | `On course` / `Waiting` status tag |
| `tr.not-eligible` | Under four finished races, out of the grand prize | Rank shows `—`, and the sub-line says "needs 2 more to qualify" |
| `td.is-dropped` | The race dropped by best-four scoring | `<s>` strikethrough plus a visually-hidden "(dropped)" |

`.is-dropped` measures 5.49:1, 5.86:1 and 6.23:1 against its row backgrounds
(`--gold-bg`, `--canvas`, white) — greying a cell is never allowed to push it
under 4.5:1.

---

## 5. Mobile first and breakpoints

Base CSS is the phone. There are exactly two breakpoints and both only add:

- **`@media (min-width: 700px)`** — the real one. Thumb bar becomes top pills, buttons
  stop being full width, wide table columns appear and `.racer-sub` disappears, grids
  go multi-column, hero padding grows, the clock stops being sticky.
- **`@media (min-width: 1000px)`** — the podium drops to a 230px minimum so all four
  cards (three medals plus the wooden spoon) sit on one row in the 1100px shell.
  That is all.

Non-negotiables:

- Layout must reflow at **320px** with no horizontal scrolling.
- `.shell` is `min(1100px, calc(100% - 32px))`.
- Safe-area insets are respected on the fixed bar via `env(safe-area-inset-bottom)`.
- `@media (prefers-reduced-motion: reduce)` kills transitions, animations and smooth
  scrolling. Keep it. There is very little motion to begin with — that is the point.
- `@media (forced-colors: active)` restores the selected state of race-picker options
  and tabs with an outline, because painted backgrounds are dropped in that mode.

---

## 6. Accessibility rules the code follows

WCAG 2.1 AA. These are the decisions worth knowing before adding a screen.

**Live regions are rationed.** There is exactly one polite live region per page:
`#announcer`, a visually-hidden `role="status"`. Short, deliberate sentences go
through `announce()` — "Racer 4, Priya, finished, 12 seconds over."

Nothing that ticks is ever inside a live region. The race clock is
`role="timer" aria-live="off"`; wave clocks and per-racer clocks are plain text. A
clock that speaks five times a second makes the page unusable. Containers that
re-render wholesale (`#startList`, `#waveControls`, `#prizeList`, the boards) have no
`aria-live` at all — announcing an entire rebuilt list is worse than announcing
nothing.

**The sync pill is not a live region.** It polls every four seconds; as a live region
it would natter constantly. It is a plain label preceded by a visually-hidden
"Sheet connection:", and only a genuine online↔offline transition is announced, once,
through `#announcer`.

**Focus survives re-rendering.** Rendering replaces DOM, which would drop focus every
time someone presses Finish. Buttons that survive a render under a different name
carry `data-focus-key`, and `keepFocus()` moves focus to the same key afterwards — so
Finish → Undo → Finish keeps you in the same row. The call editor's two boxes carry one
too, so the four-second poll cannot rebuild the form out from under someone typing in it.
Where an element genuinely disappears (Start wave, Take it back, and the editor on Save,
Cancel or `Escape`) the handler decides explicitly where focus goes next — the editor hands
it back to the Edit call button that opened it. Never let focus fall back to `<body>`.

**Move focus after the render, never during it.** `renderControl()` builds a row and its
editor detached and appends the finished wave block afterwards, and `.focus()` on a node
that is not in the document yet does nothing and reports nothing. Every explicit focus move
therefore runs *after* `render()` returns and re-queries the DOM for its target. Redrawing a
validation error is the case that has to be split: `showFieldError(..., { moveFocus: false })`
rewires the ARIA on every render, and only the one render that follows a failed save moves
the caret.

**Errors.** Each form error is a `role="alert"` paragraph. On failure the offending
field gets `aria-invalid="true"` and the error's id appended to its
`aria-describedby`; both are cleared as soon as the field is edited. Focus moves to
that field (`showFieldError`, `core.js`), so a keyboard or screen-reader user who
submitted from the last box lands on the one to fix instead of hunting for it — and
on a phone, where the message sits above the submit button and off screen, the field
is scrolled back into view. WCAG 2.1 AA, 3.3.1.

**Headings.** One `h1` per rendered view. Because panels are toggled with
`display: none`, only the active view's headings are in the accessibility tree, so
each `role="tabpanel"` starts its own `h1` → `h2` → `h3` ladder.

**Keyboard.** Every action is reachable and operable without a pointer. Tabs use the
ARIA authoring practice: roving `tabindex`, `←`/`→`/`Home`/`End`, and focus moves into
the panel on activation. `:focus-visible` gives a 3px `--focus` outline with 3px
offset, switched to white on ink and green surfaces. Nothing traps focus. A skip link
is the first element on every page.

**Targets and reflow.** 44px minimum on everything interactive, 48px on primary
controls, 16px form inputs, 320px reflow with no horizontal scroll.

**Text alternatives.** The logo's `alt` is the club name. Decorative glyphs (`+`, `★`,
`→`, `↗`) are `aria-hidden="true"` so they are not read as words. Icon-free buttons
whose visible text is ambiguous in isolation ("Edit call", "Undo", "Finish", "Take it
back") get an `aria-label` naming the racer — Edit call's also states the time it is about
to change, since "edit" alone does not say what. A disclosure button carries `aria-expanded`,
and `aria-controls` only while the thing it controls exists.

**ARIA is a last resort.** Radios for the race picker, `<fieldset>`/`<legend>` for
groups, `<th scope>` for tables, real `<button>`s and `<a>`s. `role="tab"` and
`role="status"` are used because HTML has no equivalent; nothing else is.

---

## 7. Tone of voice

Direct, warm, slightly cheeky, inclusive. "We", not "you". Short sentences. British
spelling.

- Speak to a club member standing at a finish line in the rain, not to a user.
- Lead with the human bit: "Call your time. **Then run it.**"
- Empty states say what happens next, not what is missing: "Prizes appear as soon as
  the first racer finishes."
- Errors are friendly and actionable, never blaming: "Pop your name in first.",
  "Give us a predicted time — even a rough one."
- Two ways of being wrong get two messages. An empty form gets "Give us a predicted
  time — even a rough one."; somebody who typed 0 and 0 gets "Nought is not a time.
  What are you chasing?" Telling the second person to enter a time they believe they
  just entered helps nobody.
- Automatic prize names stay plain and literal: "Closest to the call", "Furthest
  from the call". Adhoc prizes are where the organiser's humour lives. Buttons stay
  literal too: "Stop their clock".
- Confirmations are plain, and hedge only where the app genuinely does not know yet:
  "Ada — racer #3, wave 3 for now." before the first gun, "wave 3" after it.
- Sentence case for headings and buttons. Uppercase only for eyebrows and table
  headers.
- Never call it a "user", a "participant" or an "entry". They are racers, and they
  have names.
