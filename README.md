# Balance Tri Club — Beat the clock

A prediction race timer for a **five-race series**. Racers call their finish time
before the gun; the winner is whoever lands closest to their own call. Speed is
irrelevant, which is the point.

Static HTML/CSS/JS — no build step. Styled with the same tokens as the
[club race calendar](https://jthoyer.github.io/BalanceTRI-app/), and mobile first,
because it gets used one-handed at a finish line. `STYLEGUIDE.md` is the design
system and the accessibility rules the code follows, in prose; `styleguide.html` is
the same content, live — every example on it is the real component from `styles.css`,
not a picture of one.

## Three pages

| Page | Who has it open | What is on it |
|---|---|---|
| **`index.html`** | The sign-up table, a phone passed around | Name, predicted minutes and seconds, confirmation of race number and wave, the start list |
| **`boltresults.html`** | Whoever is timing, plus the screen everyone crowds round | **Timing** (wave start buttons, per-racer finish buttons, an Edit call button on each racer, finish-by-number, race admin), **Results** (leaderboard and prizes), **Series** (standings across all five races) |
| **`admin.html`** | Whoever is setting up on the day | A splash with one button to each of the two pages above — nothing else |

`index.html` and `boltresults.html` are **independent — neither links to the other**.
Open whichever one the job needs: the sign-up table has no route into race control, and
the timing screen has no route back to sign-up. `admin.html` is the exception — a
one-way jumping-off point that links to both, for whoever is running the day and needs
to move between them. `boltresults.html` carries a **Race 1–5** picker; the selected
race is stored on the device and mirrored into the URL as `?race=2`, so a screen can be
parked on one race and left alone. `index.html` has no picker of its own — whoever is
signing people up gets whichever race is already in the URL or stored on that device, so
switching races is an admin action taken on `boltresults.html`, not something the phone
being passed around can do on its own.

## How a race runs

1. **Sign up** — on `index.html`, enter a name and a predicted time for
   whichever race is already showing. Racers get the next number (1, 2, 3…) *within
   that race* and a wave.
2. **Waves** — everyone whose predicted time is within **five minutes** of each other
   goes in the same wave, so a wave leaves together and comes home together. Wave 1 is
   the **slowest** calls and the last wave the quickest, so the waves go off in number
   order and come home together. Four waves is a hard cap: if the field spreads across more than
   four five-minute groups, the closest neighbouring groups are merged until four
   remain, so one wave may span more than five minutes. The grouping
   recalculates as people sign up and freezes the moment the first wave starts. Anyone
   who signs up after that joins the next wave still waiting on the line.
3. **Fixing a call** — a mistyped prediction is corrected on `boltresults.html` →
   **Timing**, with **Edit call** on the racer's row. Before the first gun that re-buckets
   them into the wave they now belong in — and can move whoever was closest to them, since
   the five-minute groups are drawn off the whole field. After it, waves are locked and only
   the time they are measured against changes, which is what makes a post-race correction
   possible at all. The sign-up sheet cannot do this: it is a phone passed hand to hand at
   the start line, and its start list is deliberately read-only.
4. **Start** — on `boltresults.html` → **Timing**, each wave has its own start button
   and its own clock. Once the first wave is off, every wave still on the line counts down
   to a **target start** that brings it home with the first wave: the first gun plus the
   difference between the two waves' median calls. At zero it says **Start now** — it never
   starts a wave by itself. **−30s / +30s** nudge a wave's target (that wave only). Nudges
   go to the sheet, so every phone counts down to the same target; if two phones nudge at
   once, the last to reach the sheet wins. A wave started early or late does not shift anyone else's target. The race clock at the top runs from the first gun and stays stuck
   to the top of the screen while you scroll.
5. **Finish** — stop each racer's clock individually as they cross, either with the
   Finish button on their row or by typing their number into **Finish by number**. The
   global clock and every other wave keep running.
6. **Last one home** — when the final racer's clock is stopped, the race clock *and*
   every wave clock stop together, frozen on that instant. Nothing on the page carries
   on counting once the race is over. Undo a finish and they all start running again.
7. **Results** — the leaderboard updates live, ranked by the gap between actual and
   predicted time, shown in minutes and seconds.

## The series

A person is the same person across all five races when their **name matches** —
trimmed and case-insensitive, so `Ada`, ` ada ` and `ADA` are one racer. Race numbers
are per race; predictions can differ every race; anyone can enter any or all of the
five.

**The grand prize is best four of five:**

1. **Your four best races count.** Race all five and your worst result is dropped, so
   one shocker doesn't sink a series. The dropped race still shows in the table, struck
   through, because people want to see the one that got binned.
2. **Finish four races to qualify.** Anyone on fewer than four is listed below the
   qualifiers, ranked `—`, and is not in the running however good those races were.
3. **Smallest best-four total wins.** Add up the differences from the four that count.

Differences are absolute — a minute under your call costs exactly what a minute over
costs. The rule is printed on the Series panel so nobody has to guess.

## Prizes

Per race, awarded automatically as results come in:

| Prize | Who gets it | Shown as |
|---|---|---|
| Closest to the call | Smallest gap between actual and predicted — **1st place** | Gold medal card |
| 2nd closest to the call | Second-smallest gap | Silver medal card |
| 3rd closest to the call | Third-smallest gap | Bronze medal card |
| Furthest from the call | Largest gap — **last place**, and only once more than three racers are home | Dark navy card, deliberately not a medal |

These sit above the ranked table on the Results panel, which is one combined
leaderboard-and-prizes section: a racer's name and times are printed once, on their
medal card and in their table row, never in a second list underneath.

Plus **adhoc prizes** — type any prize name on the Results panel, pick a racer, award
it. Best hat, best excuse, whatever the day throws up. Those are the only prizes in
the list below the table.

Per-race prizes are unaffected by series eligibility — someone who only turns up once
can still win every prize on the day.

Across the whole series there are two:

| Prize | Who gets it |
|---|---|
| Grand prize | Smallest **best-four** total, among people who finished at least four races |
| Most consistent | Lowest **average** difference, across at least three completed races |

The two are independent on purpose: someone with three near-perfect races can take Most
consistent without qualifying for the grand prize.

## Connecting the Google Sheet

Out of the box the app stores everything in the browser on one device, which is enough
for a small race run from a single phone. To share the series across devices —
sign-ups on one screen, timing on another, leaderboard on a third — connect the
spreadsheet:

1. Open the [race spreadsheet](https://docs.google.com/spreadsheets/d/1exilWhjiLgbO1sGGSXqYvk20W5K5ANy3xRh0n1qCRfQ/edit).
2. **Extensions → Apps Script**, delete what's in `Code.gs`, paste in `apps-script.gs`.
3. **Deploy → New deployment → Web app**, execute as **Me**, access **Anyone**.
4. Copy the `/exec` URL and paste it into `API_URL` at the top of **`core.js`**.

The `Racers`, `Waves`, `Prizes` and `Meta` tabs are created automatically on first
use. `Racers`, `Waves` and `Prizes` each carry a `race` column and every read and
write is scoped to one race. A sheet left over from the single-race version is
migrated the first time it is touched: a `race` column is inserted and everything
already there is filed under race 1.

A wave's countdown nudge is stored in `Meta` as `nudge:<race>:<wave>`, in seconds.
**Clear times** and **Wipe race** remove that race's nudges.

**Updating the script.** When `apps-script.gs` changes, paste it in again and use
**Deploy → Manage deployments → Edit → Version: New version**. That keeps the same
`/exec` URL. A *new deployment* would give a new URL, and `core.js` would need it.

The pill in the top right shows the connection state: *Local only*, *Synced*,
*Saving…* or *Offline*. Actions taken while offline are queued in an outbox and sent
when the signal returns, so patchy reception at the finish line never loses a time.

Local storage upgrades the same way: a race saved by the previous single-race version
is loaded into **Race 1** rather than being thrown away.

## Timing accuracy

Start and finish times are captured on the device the moment the button is pressed and
stored as epoch milliseconds, so network lag never lands on a racer's result. Results
are computed to the millisecond and displayed rounded to the second.

One caveat worth knowing: elapsed time is `finish − wave start`, both read from the
device clock. **Start a wave and finish its racers from the same device**, or from
devices whose clocks agree. Two phones a few seconds apart will produce times a few
seconds apart.

## Running it

It's a static site. Open `index.html`, or serve the folder:

```bash
python3 -m http.server 4173
```

Then visit `http://localhost:4173/`.

## Deploying

The site lives at [jthoyer/BalanceBolt](https://github.com/jthoyer/BalanceBolt) and is
served by GitHub Pages, the same way the race calendar app is. `index.html` is the
sign-up page, so the bare Pages URL is what you hand to racers; the timing screen is at
`/boltresults.html`.

```bash
git push -u origin main
```

Then, once per repo: **Settings → Pages → Build and deployment → Source: Deploy from a
branch**, branch `main`, folder `/ (root)`. The site appears at
`https://jthoyer.github.io/BalanceBolt/` a minute or so later.

## Files

| File | What it is |
|---|---|
| `admin.html` | Splash page, links to sign-up and race control — no JS, static only |
| `index.html` | Sign-up page |
| `boltresults.html` | Race control, leaderboard, prizes, series standings |
| `styleguide.html` | The design system, rendered live from real components. No JS |
| `styleguide.css` | Doc-only layout for `styleguide.html` — swatches, demo frames, nav. Never touched by the other three pages |
| `core.js` | Shared model: state, five-race storage and migration, sync and outbox, wave assignment, results, series scoring, shared chrome. **`API_URL` lives at the top** |
| `input.js` | Sign-up page rendering and form handling |
| `results.js` | Timing, leaderboard, prizes and series rendering |
| `styles.css` | Mobile-first styles, club design tokens |
| `apps-script.gs` | Google Sheets backend — paste into the spreadsheet's Apps Script |
| `STYLEGUIDE.md` | Design system, measured contrast ratios, component patterns, tone of voice |
| `assets/balance-logo.png` | Club logo |
