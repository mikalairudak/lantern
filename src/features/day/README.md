# day

The page around a day: the start screen, the request said as a sentence over the chart, the list to read, a day's address, the visitor's own days, and every ending without a day. The chart itself is `src/features/abacus`, and the stream's hooks are `src/features/itinerary`.

## Layers

- **Where the pages call in.** `src/app/page.tsx` renders `StartDay` (`start-day.tsx`) with the written days' gists (`written-pool.ts`). `src/app/day/[city]/page.tsx` renders `Day` for a written day, prerendered whole, and `KeptDayPage` (`kept-day-page.tsx`) for a kept day's id. `src/app/not-found.tsx` renders `NoDayHere`.
- **The orchestrator.** `day.tsx`. `Day` lands on a request, the start screen or a kept day; turns the visitor's text or a pressed start into a run; holds the start screen while the run's header streams; re-plans a changed word; names the day's address and history entry; and keeps the visitor's list of days.
- **Views.** `day-stage.tsx` (`DayStage`: one run drawn, its header, its chart or list, its ending), `day-stage-header.tsx` (`DayStageHeader`: the sentence, the line about the day, the facts line, the notice), `start-header.tsx` (the question and the quick starts), `reading-list.tsx`, `city-word.tsx` and `sentence-word.tsx` (a word's list), `view-switch.tsx` (Chart · Read), `your-days-list.tsx`, `masthead.tsx`, `foot-line.tsx`, and smaller pieces.
- **Pure logic.** `sentence.ts` and `facts.ts` (the request as words, every label owned by code), `stream-ending.ts` (an outcome to what the header says), `shown-day.ts` (which day is drawn, from the five the page holds), `progress.ts` (the line under the chart), `header-ready.ts`, `kept-day.ts`, `seen-days.ts`, `your-days.ts`, `picked-places.ts`, `view-choice.ts`, `day-title.ts` (a tab's title; a day's address is `src/lib/days/address.ts`), `not-yet.ts` (the re-plan's words, each answer's forecast among them), `replan-controls.ts` (a word change as the page tells the header of it), `intake-route.ts`, and the rest of the `.ts` files.
- **Hooks.** `use-pen.ts`, `use-silence.ts`, `use-your-days.ts`, `use-picked-places.ts`, `use-day-events.ts` (the product's events, the start screen's among them) and `use-read-to-end.ts` (the line under a whole day staying in view). `live-flag.tsx` holds the live flag, read for each visit, which the static shell never waits for.
- **Lab registration.** `*-matrix.tsx` is a component's `/lab/matrix` entry, `*-cell.tsx` draws one of its cells, and `*-examples.ts` holds its data. They are registered in `src/app/lab/matrix/matrices.tsx`, and the product never imports them.

## A run's life

A run is one request on screen, counted so that a day played since is told apart from the one before.

1. **Asked.** The visitor types a text or presses a start. The text is read by the intake route (`intake-route.ts`), or, with live generation off, by a stand-in that knows only the written days (`written-reader.ts`). On the start screen the day is `pending`: it streams while the start screen keeps its place, until Lantern's words for its headline have streamed whole or 8 s have passed; the line about the day is then written on the day's page.
2. **Takes the page.** The run becomes `asked`, `DayStage` draws it in the start screen's place, and the address names it. A day landed on directly is asked at once.
3. **Streamed.** `DayStage` writes the header with the pen and lands the rows one beat apart, on the chart or the list, until the stream ends in one outcome.
4. **Whole or kept.** A written day this device has watched to its end opens whole next time (`seen-days.ts`), and on its own page a play of it that ends without the day gives way to the day whole (`wholeInPlaceOf` in `shown-day.ts`). A live day is kept on the server and opens again at `/day/<id>` (`kept-day.ts`).
5. **Forked.** The energy word re-picks among the versions already written, with no call. Any other word that shapes stops proposes its part of the day anew, drawn beside the day on screen, which keeps its run and stays the visitor's; taken, the proposal merges into the run in place, and either version is taken again from memory until the next word changes (`docs/decisions.md`, "A changed word proposes its part beside the day, and the visitor takes it"). A word the route cannot target proposes a whole new day: it streams while this one is held, and taken, takes the page as a new run.

## Words the code uses

- **pen**: lets what has arrived onto the page one piece at a time, a beat apart, in the order the sentence reads, so the header is seen being written (`use-pen.ts`).
- **room**: height held before what fills it has arrived, so nothing below moves when it does. The header holds room for the sun's times and for the longest clause the curve could add.
- **held**: kept on screen while the next thing streams: the start screen while its day's header streams, the day on screen while a re-plan does.
- **takes the page**: replaces what is on screen, once enough of it has streamed to stand in its place.
- **whole**: drawn complete at once, with nothing played.
- **stage**: one run drawn (`day-stage.tsx`): its header (`day-stage-header.tsx`), its chart or list, and its ending. The views are named for what they draw; "written" is kept for the days below.
- **written day**: one of the six days the product wrote ahead of time, served from the build at its own address. **Kept day**: a live day in the generation log, opened at `/day/<id>` for 30 days.

## Read first

1. `facts.ts` and `sentence.ts`: the request as a sentence, every label owned by code.
2. `use-pen.ts`: the word the rest of the folder leans on.
3. `stream-ending.ts`: every ending without a day, as a plain module the lab sets.
4. `seen-days.ts` and `live-flag.tsx`: a static page that still knows a returning visitor, and the live flag.
5. `day-stage.tsx`, then `day.tsx`: the run drawn, then the runs orchestrated. Both are long, about 1,400 and 1,900 lines; read their types first.
