# abacus

The chart a day is drawn on. Time runs down and energy runs across five lanes, reflective to social. Each stop is a wire, and its places are beads on it at their energies: the model's pick and up to two versions. A curve runs through the beads shown. The visitor reshapes the day by dragging the curve, tapping a bead or stepping a stop with the arrow keys, and code picks the version nearest the curve, on the client, with no model call: the model writes the options and the code picks (`docs/decisions.md`, "The day is drawn as an abacus"). Light is drawn on the time axis.

`DayStage` (`src/features/day/day-stage.tsx`) renders `DayRows` and holds the hooks below. The rest of `src/features/day` reads the chart's pure modules, `day-draft.ts`, `curve.ts`, `light.ts` and `clause.ts` most.

## How a streamed day reaches the chart

1. `day-draft.ts`. `draftDayOf` turns what the stream has revealed (`src/features/itinerary/revealed.ts`) into a `DayDraft` of `StopDraft`s, with the normalizer's ids (`stop-0`, `stop-0:p`, `stop-0:a1`), so no bead remounts when the day completes. It also says which stops may open while the day is written, and which versions the finished day will keep.
2. `use-arrivals.ts`. Each new stop's arrival: its wire draws in; once its row's room is open, its bead fills and slides to its energy; then the curve grows out to it.
3. `day-rows.tsx`. `DayRows`, the day as rows. Each row (`stop-row.tsx`) measures its words (`stop-words.tsx`) unseen before paint, `rows.ts` builds an elastic time scale from them (to scale until words need room), and wires and words spring there (`useSprungAll`). The rows tell the arrivals which rooms are open (`onRoomsOpen`), which closes the loop. An open stop's details lie over the day in its sheet (`words-sheet.tsx`).
4. `abacus-chart.tsx`. The SVG: the axes (`chart-axes.tsx`), the wires and beads (`chart-stop.tsx`), and the curve, eased while stops join (`track.ts`) and faded under the words' lines (`line-boxes.ts`).

`DayRows` is still one function of about 950 lines: the rows' sizes, the scale, the arrivals and the open sheet meet there. `StopRow` (`stop-row.tsx`) is one row: its time, its words and its sheet; `StopWords` (`stop-words.tsx`) its name and kind as the pen writes them; `WordsSheet` (`words-sheet.tsx`) the open stop's details; `PennedText` (`src/components/ui/penned-text.tsx`) text as far as the pen has written it, which the reading list uses too.

## The visitor's hands

- `use-chart-pointer.ts` tells a drag from a tap (4 px), and a tap on a bead from one near a wire, on one captured pointer.
- `use-energy-curve.ts`. `useEnergyCurve` holds the curve's levels and the visitor's picks, by stop id and place id: `selected` is what the chart shows during a drag, `committed` what the words show once it ends. A swap lives here; `Stop.selectedPlaceId` stays the model's pick, where a reset returns.
- `curve.ts`. The pure maths: a pull bends only the stops either side of the hand (`bendCurve`), a stop switches only when another version is clearly nearer (`SWITCH_MARGIN`), and the curve is a monotone cubic.
- `chart-stop.tsx`. Each stop is a keyboard slider; its beads are hidden from assistive technology.
- `geometry.ts`. The drawing's sizes, and bead targets 24 px across (WCAG 2.5.8).
- An open stop's sheet: `sheet-placement.ts` picks the side it unrolls to, `stop-details.ts` and `stop-details-view.tsx` say what it holds, and `map-action.ts` links the place on a map.

## Re-plans

A changed word proposes its part of the day beside the day, and the visitor takes it (`docs/decisions.md`, "A changed word proposes its part beside the day, and the visitor takes it"). `replan-frame.ts` draws the two versions as one list of rows: `replanFrameOf` while the proposal streams, the day's own stops all staying, and `forkFrameOf` once it is whole, either version the day; `forkAnchorsOf` says over which stop each part's fork row stands. A proposal's stops are drawn compact and blue (`StopRow`'s `isProposed`), off the day's curve, each a hollow bead on a dashed wire, with a dashed curve through them where the proposal's path leaves the day's (`proposal-path.ts`). `fork-row.tsx` is the row over each part: the two answers as a radio group, and what Lantern is doing, what the proposal would change (`work-line.ts`'s `receiptOf`) or why it failed. `replan.ts` re-picks the day locally for a new energy word, from the versions already written, and counts the stops a re-pick would change on screen, which the energy word's list says under each answer. `useArrivals`'s `origins`, a stop written again in place, serve only the lab's abacus concept (`src/app/lab/concepts/abacus/`).

## Read first

1. `curve.ts`, the model's options and the code's pick.
2. `use-energy-curve.ts`, the picks as state.
3. `day-draft.ts`, the bridge from the stream.
4. `rows.ts` and `geometry.ts`, a chart that makes room for words.
5. `use-chart-pointer.ts` and `chart-stop.tsx`, the pointer and the keyboard on one drawing.

## Lab registration

`*-matrix.tsx` is a component's `/lab/matrix` entry, `*-cell.tsx` draws one of its cells, and `*-examples.ts` holds its data: `stop-row-*` (the golden component, one stop's row, a proposal's compact row among its states), `fork-row-*`, `silence-*`, `axis-light-*` and `place-check-*`. They are registered in `src/app/lab/matrix/matrices.tsx`, and the product never imports them.

## Tests

Each sits beside its module, the curve's, the energy curve's and the arrivals' included. The tests of the lab's own abacus concept stay in `src/app/lab/concepts/abacus/`, where the chart was built before it moved here (`docs/decisions.md`, "The day is drawn as an abacus").
