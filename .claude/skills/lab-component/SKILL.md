---
name: lab-component
description: Build or change a Lantern UI component the Dynamic UI way, from the schema's value space and the stream's real frames to a /lab matrix entry, tests and a look in both themes. Distilled from the golden component, the one-row stop.
when_to_use: Adding a component to src/features or src/components/ui, changing how one looks, streams or folds, or when someone says "new component", "lab-component" or "put it in the matrix".
---

# Building a component the Dynamic UI way

The model writes the content, so a component is designed for every value the schema allows and every moment of the stream, not for one mockup. This is the procedure the one-row stop was built and lifted by (`src/features/abacus/stop-row.tsx`, its words in `stop-words.tsx`, its matrix in `src/features/abacus/stop-row-matrix.tsx`). The rules themselves are in `CLAUDE.md` ("Designing components", "Consistency", "Definition of done"); this file is the order of work and the traps already paid for.

## 1. Read what is agreed

- **The contract.** `src/lib/schema/itinerary.schema.ts`. Props are its types (`Place`, `Stop`, `Itinerary`), or the draft types while the day streams (`StopDraft`, `DayDraft` in `src/features/abacus/day-draft.ts`). Never redefine a shape or a vocabulary.
- **The design.** The section of `docs/design-direction.md` that covers the component, and `docs/decisions.md`. The stream's choreography is "As each stop arrives" and its Rules, for the order; the chart's form is "The abacus" (beads, names on the wires), and the header's is "The day page". When the code and the design disagree, ask the owner; do not settle it in the code.
- **Next 16.** Read the guide in `node_modules/next/dist/docs/` before using a Next API (`AGENTS.md`).

## 2. Map the value space from fixtures

Take the extremes from real fixture days, never from invented strings:

- `src/lib/fixtures/curated/`: Kyoto, Alicante, Lisbon.
- `src/lib/fixtures/edge/`: `crowded` (twelve stops, the longest text, every count of versions), `minimal` (one stop, the shortest text), `long-stay` (eight hours), `late-night` (past midnight), `polar` (a sun that never rises or sets), `repaired` (every slip the normalizer fixes).

Name each example for what it tests and pick its stop by index, as `STOP_ROW_EXAMPLES` in `src/features/abacus/stop-row-examples.ts` does ("the longest name", "after midnight"). Cover the shortest and longest text, `null` fields, 0, 1 and 2 versions, 1 to 3 tags, and the schema's limits on time and duration.

## 3. Map the lifecycle from the real stream

States: nothing yet → partly streamed → complete → interactive (swapped, folded by density, open) → each outcome without a day (`src/lib/stream/outcome.ts`).

- **Use real frames.** `dayText(day)` (`src/lib/stream/simulate-day-stream.ts`) → a prefix → `parsePartialJson` → `revealedOf(partial, null)` (`src/features/itinerary/revealed.ts`) → `draftDayOf`. Find a state by searching the stream for its first frame (`stateAt` in `stop-row-examples.ts`). Do not build partials by hand: they miss what the stream really does.
- **What a frame can hold.** A number or an enum is final only once the next field has started; a duration grows 1 → 15 → 150. Free text grows and can stop mid-word. A time is read as the normalizer reads it (`parseClock` in `src/lib/time/clock.ts`: `9:45` is `09:45`).
- **Ids never change.** They are positional, as the normalizer's: `stop-N`, `stop-N:p`, `stop-N:aK`. The complete state draws the normalized itinerary (`completeDraftOf`) with the same ids, so nothing remounts and no `layoutId` jumps when the day completes. Write a test for it (`day-draft.test.ts` has the pattern).
- **Each state shows what the design says.** A row placed before its name rendered nothing, while the choreography says its start time shows the moment it is placed. Check every state against the design, not only against the last screenshot.
- **Size from streaming text without a jump.** Measure before the first paint (`useLayoutEffect`). What sits below eases on `SPRINGS` (`useSprungAll`, `GlidingHeight`); it never jumps. Pick a side and wrap from the resting state, not from this frame. Words already written never change lines: `text-pretty`, not `text-balance` (`docs/decisions.md`, "A row's words go where its bead comes to rest").
- **Transitions can be interrupted.** Test a new request mid-stream, and that a stale run never shows (the request gate in `Day`, `src/features/day/day.tsx`).
- **Hold room for what has arrived.** A later arrival must never push what is already on screen: the header keeps room for every word that has arrived, and a row keeps its estimated height until its name is written.
- **Watch it move.** `/lab/stream` scrubs any fixture frame by frame and ends it in every outcome.

## 4. Build from tokens and primitives

- **Where code lives.** Primitives in `src/components/ui` (`cn`, `Ink`, `Fold`, `GlidingHeight`, `useSprung`, `useWrittenText`, `useElementSize`). Features in `src/features/<feature>`: `itinerary` (the stream), `abacus` (the chart, its rows and gestures), `day` (the request as a sentence over the abacus). Product code never imports from `src/app/lab`.
- **Tokens only.** Visual values come from `src/app/globals.css` and `src/lib/tokens/`; lint rejects the rest. A new value is a new token, listed in `src/lib/tokens/catalog.ts` (a test checks the match) and shown at `/lab/tokens`. A new token is a design decision: agree it with the owner.
- **Colours.** They go through `light-dark()` in `@theme inline`; a `--color-*` on `:root` freezes one theme. Each accent keeps one meaning (amber and lamp light, `energy` energy, `swap` swapping, ink what is chosen; amber says light in words, lamp draws it); a new meaning is a conversation with the owner, not a fifth accent.
- **Motion.** Anything that moves uses `SPRINGS` (`src/lib/tokens/motion.ts`). With reduced motion an element appears in its final state; the day sets `MotionConfig reducedMotion="user"`.
- **Words.** Enum values map to labels in code (`FACT_OPTIONS` in `src/features/day/facts.ts`). The model never writes UI copy, markdown or markup; UI copy is in English.

## 5. Register it in the matrix

- **The entry.** `labMatrix<Props>({ key, title, note, base, axes, render })` from `src/lib/lab-matrix.ts`, in `<component>-matrix.tsx` beside the component. Axes are plain data: states, data extremes, densities. Themes and widths are not axes: the renderer sets every cell in both themes, at a phone's width and at the column the component takes on a laptop, which the entry declares as `wide` (the abacus's by default, the page's for the header).
- **The list.** Add it to `MATRICES` in `src/app/lab/matrix/matrices.tsx`. It then shows at `/lab/matrix/<key>` and on `/lab`.
- **The baseline.** `pnpm e2e:visual` shoots the matrix's default view, its first axis down and its second across, at a phone's width in both themes. Declare `baseline` when the default view is not the right one to shoot, as when it holds cells a day never reaches.
- **Async cells.** A cell that parses stream frames works in an effect, says "Reading the day…" until it has them, and caches by example and state so every density shares the work (`stillOf`).

## 6. Test it

- **Unit tests beside the code.** Components with Testing Library; test what a visitor does and sees. jsdom has no layout and no media queries, so stub them as the existing tests do: `ResizeObserver` with a fixed box (`src/features/abacus/stop-row-cell.test.tsx`); `matchMedia` for reduced motion and `fetch` answered by `answerDayRequest` for anything that plays a day (`src/features/day/day.test.tsx`); `scrollTo` and `scrollIntoView`.
- **The coverage gate.** 80% of lines, branches, functions and statements over `src/`, except `src/app`. It counts everything in `src/features` and `src/components/ui`, so a component without tests can pull branches under the gate the moment it moves out of the lab. Measure before a move, not in a failing hook.
- **Prove a test bites.** Break the code it guards, watch it fail, put the code back.
- **e2e for what only a browser shows.** `e2e/*.spec.ts`, Playwright on desktop and phone (`pnpm e2e`, its own server on port 3417). Use `reducedMotion: "reduce"` so only the stream takes time, and wait on the state, such as `aria-busy="false"` on the day's energy group, never on a fixed timeout.

## 7. Look at it

- Run `pnpm check`, then `pnpm e2e`.
- Look at the matrix and the page at 390 px and at a laptop's width, light and dark. Check: tokens only; every state present; nothing jumps between consecutive frames; the longest text wraps well at 390 px beside a bead mid-scale (about 130 px either side); focus is visible; reduced motion shows final states; contrast measured for any new text role (both themes, ground and surface, at least 4.5:1, where the app holds 5:1); pointer targets at least 24 px; the keyboard path (Tab order, Escape, focus back to what opened a panel); and one frame-by-frame sample of the stream with `/ui-review`'s snippet.
- If a token edit does not show in `pnpm dev`, stop it and delete `.next/dev`.
- Before it merges, run `/ui-review` on the branch, for a fresh agent that has not seen the work.

## Done when

- The matrix entry is registered, and every cell has been looked at in both themes and both widths.
- Tests sit beside the code, `pnpm check` and `pnpm e2e` pass, and `/ui-review` found nothing open.
- A decision a later reader of the code would want explained is in `docs/decisions.md`.
- If the change alters what is built or agreed, the section of `docs/design-direction.md` that covers it says so, and the owner knows.

## Proven

- **On the written header (2026-10-26).** Followed step by step, it built the header's matrix from real frames and `stream-ending.ts`, and the matrix showed what no bench had: a null dinner reads "with …?", and a day with no versions shrinks its header when the stream ends. Its traps: a matrix's axes exported from a `"use client"` module pass every jsdom test and answer 500, since the server page reads the registry, so its examples live in a plain module (`day-stage-header-examples.ts`, as `stop-row-examples.ts`); `revealedOf` takes the raw partial, and a partial already revealed loses its last final value a second time; a cell's wrapper is `relative`, or an `sr-only` status line escapes the grid's scroll and widens the page; a phone cell was 388 px inside its border, 2 px under a 390 px phone, and wrapped 22 of the header's cells where a phone does not until the cell became `box-content`, so measure a wrap against the bench before trusting it. `/ui-review` then found a missing ending (a cut with the day kept), a missing shortest day and the sideways scroll, which the author's own capture had missed.
