---
name: ui-review
description: A fresh-eyes review of Lantern UI work before it merges. Runs in its own agent, which has not seen the work being built; it reads the diff, opens the pages and the /lab matrix, samples the stream frame by frame, measures, and reports findings with file:line and evidence.
when_to_use: Before the engineering session merges a branch that changes UI into `develop`, or before the author of a component says it is done. Give it the branch or commit range and the URL of a dev server that serves it, as in "/ui-review <branch> http://localhost:<port>".
argument-hint: "[branch or commit range] [dev server URL]"
arguments: [target, url]
context: fork
agent: general-purpose
---

# Review Lantern UI work with fresh eyes

You are reviewing UI changes in Lantern, a travel day planner where a model streams a day as typed JSON and React components draw it as it arrives. You have not seen this work being built, and that is the point: judge the code and the page, not anyone's account of them. **Do not edit, commit or push anything.** Report what you find.

- **What to review:** `$target`, a branch or a commit range. For a branch, the change is `git diff develop...$target`.
- **Scope: choose it yourself, from the diff, before you open a browser,** and say which you chose and why on the report's first line. The brief can only raise it. Use the cheapest scope that covers the change's risk, and spend it on looking, not on tooling:
  - **Light** (about 15 tool calls): copy, a test-only change, a token value, or CSS that changes no layout or motion. Read the diff. Look at each touched surface once at 390 and 1440, in the theme or themes it affects. Check only what such a change can break: a word that wraps or leaves the screen, contrast, an overflow, a matrix diff. No stream sampling.
  - **Targeted** (about 40 tool calls): the brief names points, usually a round after review findings; or the diff touches layout without touching motion or the stream. Check those points, or that layout, with the measures they need.
  - **Full**: a new component, anything that moves, the stream, the header's or the rows' timing, or a primitive in `src/components/ui`. Everything below.
    A diff that touches `src/features/abacus/day-rows.tsx`, `stop-row.tsx`, `stop-words.tsx`, `words-sheet.tsx`, `day-stage-header.tsx`, `day-stage.tsx`, `gliding-height.tsx`, a spring or a pen is at least targeted on motion, whatever its size.
- **Measure with numbers, not pictures.** Have `browser_evaluate` return a compact JSON summary (the worst pace, the frame and the row; times; counts), never raw frame arrays. Use `browser_snapshot` only for an accessibility question.
- **Screenshots only as evidence of a finding,** at the viewport, `scale: "css"`, never full-page unless the finding is the page's length.
- **Do not run `pnpm e2e`, `pnpm build:check` or `pnpm check`.** They run on every merge. Run one spec only to prove a finding, and `pnpm e2e:visual` only when the change touches a matrix.
- **Reuse probes.** If `.claude/skills/ui-review/tools/` holds a probe for a measure (the frame sampler, header and first-row timing, pointer targets, overflow), run it instead of writing one.
  - **Tools.** Plain Node scripts, each with `--help`; they open a fresh context, never type, refuse lanternday.com, and print one compact JSON. Run from the repository root with `node .claude/skills/ui-review/tools/<name>.cjs`:
    - `stream.cjs <url> [--width 390] [--theme light|dark] [--reduced] [--cpu 1|2|4] [--ms 20000]`: the section 3 sampler. Header and first-row times from first paint, the worst row pace over 100 ms, `dayGlides`, rows moved after the day was written, words outside the viewport, console errors.
    - `targets.cjs <url> [--width] [--theme] [--selector "<css>"]`: the least effective pointer-target height of every interactive element, and any under 24 px.
    - `overflow.cjs <url> [--widths 360,390,1440] [--theme]`: `scrollWidth` against the viewport per width, and any text whose box leaves it.
    - `shot.cjs <url> <out.png> [--width] [--theme] [--view read] [--wait ms] [--reduced]`: one viewport screenshot at css scale, as evidence only.
- **Where it runs:** `$url`, a dev server serving `$target`. The main checkout's server is `http://localhost:3000`; a branch's own worktree serves on the port it was given. Check that the server's worktree is at the target's head (`git worktree list`, then `git -C <worktree> rev-parse HEAD`). If no URL was given or nothing answers there, review the code only and say so first in the report.

## 1. Read the change and the rules

1. `git log --oneline develop..$target` and `git diff --stat develop...$target`, then the diff of every file under `src/` and `e2e/`. List the components it touches and the `/lab/matrix/<key>` entries that show them (`src/app/lab/matrix/matrices.tsx`).
2. Read the rules the work must keep: `CLAUDE.md` (Dynamic UI, Consistency, Definition of done); the section of `docs/design-direction.md` that covers these components; "As each stop arrives" and its Rules (the stream's choreography); "Ground and ink: Night market" and "Accents: light, energy and versions"; `docs/decisions.md` entries the diff relates to; `docs/voice.md` for any words the UI says.
3. Note what the change claims to do (commit messages, any `docs/` it edits). Check the claims; do not adopt them.

## 2. Look at it in a grid

Use the Playwright browser tools if this session has them (navigate, resize, emulate media, evaluate, screenshot); otherwise write a short script with `@playwright/test`'s `chromium` and run it with `node` from the repository root. Screenshots go in `.playwright-mcp/`; delete that folder when you are done.

- **Widths:** a phone at 390×844 and a laptop at 1440×900. For the header and the page's margins also 1280 and about 1180, where the open stop's column has broken before.
- **Themes:** light and dark (emulate the colour scheme, or the lab's theme switch, which sets `data-theme`). System once, to see that the theme is not frozen.
- **Motion:** reduced motion on and off. With it on, everything appears in its final state, with no drawing in and no slides.
- **Data:** the public site offers only the six quick starts since 2026-11-05: Kanazawa (the reference day for timings), Bologna (lively, twins, its seventh row's known excess), Madrid (the longest words), Nafplio (quiet, the longest line about the day on a phone), Porto and Utrecht. Kyoto, Lisbon and Alicante, written by hand, play only on the lab's bench at `/lab/concepts/day`. Also the late-night edge day (past midnight), and the matrix's extremes: the longest name, a long neighbourhood, two versions at one energy, one version only, after midnight, eight hours.
- **Lifecycle:** the stream at the landing pace and at a live model's uneven pace (`/lab/stream` has the pace and the endings), the finished day, the interactive day (drag the curve, swap a version, open a stop, hold the sun), and every ending: complete, cut with a day kept, cut without one, refused, unavailable, limited.
- **Interruptions:** Replay mid-stream, another city mid-stream, a grab while the curve's preview shows. The layout holds, and nothing from the old run flashes.
- **Pages:** `/day/kanazawa` (a written day; `/day` alone redirects to the start screen), `/lab/concepts/day`, `/lab/concepts/abacus`, and the touched `/lab/matrix/<key>` entries. Judge a matrix's phone cells in a viewport of 466 px or less, where the page lays them out as a phone sees them, and its wide cells at 1440.
- **The visual baseline:** run `pnpm e2e:visual` on its own (never beside `pnpm e2e`: they share `.next-e2e`) and read every diff it reports; a diff the change means to make is a finding to note, one it does not is a finding to fix.

## 3. Sample the stream, and measure

Still frames hide most of what goes wrong; almost every past bug here was visible only in motion. Take at least one frame-by-frame sample of a day streaming in. Open `/day/kanazawa` with reduced motion off, and straight away run this in the page, at 390 px and again at 1440 px (the worst shifts have always been on a phone). Do not scroll or touch the page while it samples. It stops when the day is written; after that the page changes nothing by itself (`docs/decisions.md`, "The page never changes the day by itself"), so a day left alone must stay as written, and its invitation, the ring and the dashed example, only draws. Rows are measured against the day's list, so the header's glide and any scroll do not count as a row moving; the list's own glide is counted apart, as `dayGlides`.

<!-- prettier-ignore -->
```js
async () => {
  const day = () => document.querySelector('ol[aria-label="The day"]');
  const rows = () => [...document.querySelectorAll('ol[aria-label="The day"] > li')];
  const header = () => document.querySelector("header")?.getBoundingClientRect().height ?? 0;
  // The chart says it is busy until the day is written and every bead rests.
  const isWritten = () =>
    document.querySelector('[role="group"][aria-label^="The day\'s energy"]')?.getAttribute("aria-busy") === "false";
  const frames = [];
  const start = performance.now();
  await new Promise((done) => {
    const tick = () => {
      const dayTop = day()?.getBoundingClientRect().top ?? null;
      frames.push({
        t: performance.now() - start,
        header: header(),
        dayTop,
        tops: rows().map((li) => li.getBoundingClientRect().top - (dayTop ?? 0)),
      });
      // Stop once the day is written: nothing moves by itself after that.
      if (!isWritten() && performance.now() - start < 30000) requestAnimationFrame(tick);
      else done();
    };
    requestAnimationFrame(tick);
  });
  let headerSettled = 0;
  let dayGlides = 0;
  for (let i = 1; i < frames.length; i++) {
    // A spring's sub-pixel tail is not the header still growing.
    if (Math.abs(frames[i].header - frames[i - 1].header) > 0.5) headerSettled = frames[i].t;
    if (frames[i].dayTop !== frames[i - 1].dayTop) dayGlides += 1;
  }
  // A row's pace over about six frames, in px per 60 Hz frame. React draws the rows from their
  // springs in a task of its own, before a frame's read or after it, so one frame can show a
  // row standing and the next twice its glide. Over 100 ms that evens out; a jump still reads
  // far over it. Rows only ever arrive at the end, so a row keeps its index.
  const WINDOW_MS = 100;
  let worst = { px: 0, row: -1, at: 0 };
  for (let i = 1; i < frames.length; i++) {
    let j = i - 1;
    while (j > 0 && frames[i].t - frames[j].t < WINDOW_MS) j--;
    const elapsed = (frames[i].t - frames[j].t) / (1000 / 60);
    frames[i].tops.forEach((top, row) => {
      const before = frames[j].tops[row];
      if (before === undefined || elapsed <= 0) return;
      const px = Math.abs(top - before) / elapsed;
      if (px > worst.px) worst = { px, row, at: Math.round(frames[i].t) };
    });
  }
  const firstRow = frames.find((f) => f.tops.length > 0)?.t;
  const writtenAt = frames.at(-1)?.t;
  return { frames: frames.length, worst, headerSettled, firstRow, writtenAt, dayGlides };
}
```

The measures that hold today, and that the work must keep:

- **A written row's pace over 100 ms is at most about 3 px a frame** (Kanazawa and Nafplio under 1.5 px; Madrid's rows on a laptop read 3.2 in about half the runs, a known excess to fix, not to pass; measured on 2026-11-01, Bologna's seventh row, moved 41 px by its `layout` spring as the last row lands under it after a quick start, reads 3.6 to 3.9, a known excess kept on purpose: slowing it broke Kyoto's frame glide). A single frame's step is not the measure: one frame can show a row standing and the next twice its glide. Rows a change does not touch do not move against the chart at all.
- **A gesture that changes the whole day settles in about 1.5 s** (the energy word re-picking every row, in either view; 2026-11-03): the 3 px bar then holds for the rows on screen when the visitor pressed, and rows below the fold may move faster. A re-pick that keeps the bar everywhere by gliding for 3 s or more reads as the layout deflating on its own, and is a finding.
- **The header reaches its final height before the first stop lands:** for Kanazawa at the landing pace on a production build, from first paint, about 2.0 s on a laptop and 2.1 s on a phone, with the first row (its start time alone) at about 2.5 s and 2.7 s; under reduced motion the header at about 1.6 s and the first row at about 1.8 s on both (measured 2026-11-05, three runs each; Kyoto read 1.9/2.0 and 2.6/2.8 before it left the public site). The dev server reads about 0.2–0.8 s slower, so compare a dev server with a dev server. A first row that lands before the header has settled is a blocker, not noise. The empty chart frame glides down once, not repeatedly.
- **No word leaves the screen:** compare each text element's `getBoundingClientRect()` with the viewport, at 390 px above all.
- **Contrast:** every text role on the ground and on a raised surface, in both themes, at least 4.5:1 (the app holds 5:1). The only recorded exception is the day dimmed to 30% under a held sun, which is inert.
- **If the diff touches colours** in `src/app/globals.css`: `palette.test.ts` must still hold its bars; and a look at where each colour is applied, since neither the test nor the baseline's default threshold sees a token used in the wrong place.
- **A clean console:** no failed resource (a 503 on the "not yet" path was one), no React warnings.
- **Hands and keys:** every pointer target is at least 24×24 px, or spaced as WCAG 2.2's 2.5.8 allows (the beads are 24 px by design, `src/features/abacus/geometry.ts`); 44 px is the aim for buttons and words, a note rather than a blocker. Focus is always visible; Tab never lands inside something hidden; a closing panel gives focus back to what opened it.

## 4. Check it against what is agreed

- **Real data, never a fake skeleton; drying ink, never spinners; a raised surface means something** (only an open stop is raised).
- **Order on screen is the order of the fields** in the generation schema. Per stop: start time and duration (the wire draws in, the start time shows in the gutter, an outlined bead lands at the requested energy), then the name in drying ink, then energy (the bead fills and slides; the curve follows the beads and never changes shape in one frame), then light. Versions come last, after every stop. One movement per stop at a time; nothing before its data exists; the lab's controls never cover the chart on a phone. "As each stop arrives" in `docs/design-direction.md` gives the order, and "The abacus" the form: beads on wires, each name beside its bead (`docs/decisions.md`, "The day is drawn as an abacus"). In a pause, the waiting phrase sits by the bead the next name will be written beside, and the chart keeps a tick at the pen, never a spinner or a shimmer (`docs/decisions.md`, "Designing for Dynamic UI"). The header is written by a pen, and the stops land once the pen has reached the line about the day, 0.3 s apart.
- **One colour, one meaning:** amber and lamp are light (amber in words, lamp drawn), `energy` is energy, `swap` is swapping, ink is what is chosen.
- **Type:** Fira Sans regular, one weight, told apart by size and ink. The model's phrases are italic; the UI's are upright.
- **Density follows the energy a row shows.** A stop gets its sun only with at least 20 minutes inside the sunrise or sunset window. Past midnight the hours run on (01:00 after 23:00, never the morning).
- **Tokens only**, and the words in the UI follow `docs/voice.md`: no banned phrases, no exclamation marks.
- **A partial is never shown as final:** an enum half-written ("ea"), a value repaired to `null`, a number still growing. After a cut, the outcome decides what shows, not the last partial.

## 5. Look for the mistakes made here before

Each of these happened once; check that the change does not bring one back:

- Something above grows and pushes the chart or the rows down. The opposite also failed: room held for every possible answer left a 140 px empty band on a phone.
- `text-balance` moving words already written from line to line while a phrase streams (`text-pretty` keeps them).
- Words chasing their bead frame by frame, switching sides, leaving the screen, rows jumping instead of gliding.
- A row being written again losing its height, so the waiting phrase shrinks to nothing.
- A plate behind words cutting the curve with square edges (words carry a halo instead).
- A long name beside a bead mid-scale on a phone breaking into three lines.
- A sheet or caption covering its own row, the axis marks or the fold; a scroll that runs ahead of the room it needs.
- A placed row hiding its start time before its name arrives.
- An even replay pace that flashes the line about the day past in a tenth of a second.
- A pointer that flips a bead at a boundary, a curve lagging the hand, rows moving on release.
- Underlines on words that are not the model's assumptions, reading as dead links.
- An icon whose stroke scales down with its size until it disappears at 12 px.

## 6. Report

Lead with a verdict in one line: ready to merge, ready with notes, or not ready. Then the findings, most serious first, each with:

- **What is wrong,** in one sentence.
- **Where:** `file:line`, and the page, width, theme and moment.
- **Evidence:** the screenshot path, or the number you measured against the number it should be.
- **The rule it breaks,** with where it is written (`CLAUDE.md`, a section of `docs/design-direction.md`, an entry in `docs/decisions.md`).
- **Severity:** a blocker (breaks a recorded rule or a measure above), should fix, or a note.

Before you report a timing failure, reproduce it on a warm server: a cold compile once failed an e2e spec that then passed ten times in a row. If you run e2e, set your own `E2E_PORT` (never 3417, the main checkout's). A token change that does not show may be a stale `.next/dev`: say so; it is not a bug in the change.

Then two short lists: what you checked and found right, and what you could not check and why. Say plainly when a finding is a judgement rather than a broken rule. Delete `.playwright-mcp/` before you finish.

## Proven

- **On the written header (2026-10-26).** Run through the Skill tool, it forked a fresh agent that read only the diff, held every cell against `/day` and the ending bench at 390 and 1440, and found three should-fixes the author had missed: the page scrolling sideways (measure `document.documentElement.scrollWidth`; the visual spec makes each figure `relative`, so its shots hide it), an ending with no cell (a cut that keeps its day) and no shortest day; two notes (phone cells 2 px narrow, a decision's date); and a product bug outside the diff, a null dinner reading "with …?". The trap: it skipped `pnpm e2e`, which shares the author's `.next-e2e`, so the author's own e2e run is the record.
