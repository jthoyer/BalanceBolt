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
| `--green` | `#116b43` | A wave that is running, first place, success |
| `--green-bg` | `#e8f6ee` | Winning row tint, series prize card |
| `--navy-bg` | `#eef2fb` | Bib badges, status tags, table headers |
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
| `#e7f4ec` (podium detail, confirm detail) on `--green` | 5.78 |
| `#e6ebf5` on `--green` | 5.48 |
| `--yellow-soft` on `--green` | 5.08 |

**Text on light**

| Pair | Ratio |
|---|---|
| `--ink` on `#ffffff` | 15.19 |
| `--ink` on `--canvas` | 14.30 |
| `--ink` on `#fdf6e4` (last-place row) | 14.09 |
| `--ink` on `--green-bg` | 13.64 |
| `--ink` on `--navy-bg` | 13.55 |
| `--ink` on `#eef0f4` (secondary button) | 13.32 |
| `--ink` on `--yellow` (primary button label) | 9.41 |
| `--green` on `#ffffff` | 6.55 |
| `--red` on `#ffffff` | 6.54 |
| `--muted` on `#ffffff` | 6.23 |
| `--muted` on `#fffaf0` (adhoc prize card) | 5.99 |
| `--green` on `--green-bg` | 5.88 |
| `--muted` on `--canvas` | 5.86 |
| `--muted` on `#fdf6e4` | 5.78 |
| `--red` on `--red-bg` | 5.72 |
| `--muted` on `--green-bg` | 5.59 |
| `--muted` on `--navy-bg` | 5.55 |
| `--muted` on `#eef0f4` | 5.46 |

**Non-text (3:1 needed)**

| Pair | Ratio |
|---|---|
| `--ink` fill on `#ffffff` | 15.19 |
| `--focus` ring on `#ffffff` | 6.66 |
| `--focus` ring on `--canvas` | 6.27 |
| `--red` border on `--canvas` | 6.15 |
| `--focus` ring on `--green-bg` | 5.98 |
| `--focus` ring on `--navy-bg` | 5.94 |
| `--green` fill on `#ffffff` | 6.55 |
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
| `--yellow` fill against `--canvas` | 1.52 | The primary button is identified by its `--ink` label at 9.41:1. WCAG 1.4.11 does not require a boundary when the component is identifiable another way. |

**Never do this** (both were live bugs, now fixed):

- `#f6cf69` eyebrow text on a white panel — 1.62:1. Eyebrows on light backgrounds use `--muted`.
- `--yellow` eyebrow text on `--green` — 4.05:1, under the 4.5 needed for 12px text. Use `--yellow-soft`.

### Never colour alone

Rank is always printed as a number as well as tinted. "Bang on" results are green
*and* say `0:03 under`. A running racer gets a `Waiting` / `On course` status tag,
not just grey text.

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
  nothing goes below it — including low-emphasis buttons like Remove and Undo.

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
One racer during a race: bib, name, "called 25:00", then either a live clock plus a
**Finish** button, or the elapsed time, the delta and an **Undo** button. It wraps on
narrow phones with the action staying on the thumb side (`margin-left: auto`).

### Bib badge (`.bib`)
Pill on `--navy-bg` with the race number, tabular. Always rendered with a
visually-hidden `Racer ` prefix so it does not announce as a bare digit.

### Status tag (`.status-tag`)
Small `--navy-bg` pill for a non-numeric state — `On course`, `Waiting`.

### Podium card (`.podium-card`)
Two per race: `.first` on `--green`, `.last` on `--ink`. Eyebrow, name, delta, detail.
Eyebrow uses `--yellow-soft`.

### Prize card (`.prize-card`)
White card, uppercase `--muted` `h3` title, big Outfit winner name, `--muted` detail.
Variants: `.adhoc` (warm tint, carries a "Take it back" button) and `.series` (green
tint with a thick left border, for series-wide prizes).

### Rule card (`.rule-card`)
White card with a 4px `--ink` left border, used to explain a scoring rule in the place
the rule applies. The series ranking rule lives in one on the Series panel — a ranking
nobody can derive from the table is a bug, not a feature.

### Confirm card (`.confirm-card`)
Green block shown after a successful sign-up with the race number, wave and predicted
time. Visual confirmation only; the same text also goes to the announcer.

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
| `.quiet-button` | Remove / Undo / Take it back | White, `--line-strong` border, 44px |
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
| `tr.is-running` | Still on course | `On course` / `Waiting` status tag |
| `tr.not-eligible` | Under four finished races, out of the grand prize | Rank shows `—`, and the sub-line says "needs 2 more to qualify" |
| `td.is-dropped` | The race dropped by best-four scoring | `<s>` strikethrough plus a visually-hidden "(dropped)" |

`.is-dropped` measures 5.59:1 and 6.23:1 against its row backgrounds — greying a cell
is never allowed to push it under 4.5:1.

---

## 5. Mobile first and breakpoints

Base CSS is the phone. There are exactly two breakpoints and both only add:

- **`@media (min-width: 700px)`** — the real one. Thumb bar becomes top pills, buttons
  stop being full width, wide table columns appear and `.racer-sub` disappears, grids
  go multi-column, hero padding grows, the clock stops being sticky.
- **`@media (min-width: 1000px)`** — podium gets wider columns. That is all.

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
Finish → Undo → Finish keeps you in the same row. Where an element genuinely
disappears (Start wave, Remove, Take it back) the handler decides explicitly where
focus goes next. Never let focus fall back to `<body>`.

**Errors.** Each form error is a `role="alert"` paragraph. On failure the offending
field gets `aria-invalid="true"` and the error's id appended to its
`aria-describedby`; both are cleared as soon as the field is edited. Focus is not
moved — the alert announces and the message is visible next to the button.

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
whose visible text is ambiguous in isolation ("Remove", "Undo", "Finish") get an
`aria-label` naming the racer.

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
  "Predict a time longer than zero — nobody is that quick."
- Prize names carry the humour, interface labels do not: "Off like a rabbit", "Took
  the scenic route", "Bang on". Buttons stay literal: "Stop their clock".
- Confirmations are plain: "Ada — racer #3, wave 3."
- Sentence case for headings and buttons. Uppercase only for eyebrows and table
  headers.
- Never call it a "user", a "participant" or an "entry". They are racers, and they
  have names.
