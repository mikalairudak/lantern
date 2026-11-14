# Architecture

Lantern plans one day in a city, hour by hour, as quiet or as lively as the visitor asks. A language model writes the day as JSON held to a Zod schema. Code checks it, repairs small slips, and draws it with deterministic React components while it streams. Once the day is written, everything the visitor does to it (the energy curve, a swap, the light) runs on the client. After the day itself, the only other model calls are reading the visitor's first sentence and re-planning: a changed word writes again the part of the day it shaped, or the whole day where no stop names a changed time word or the part would hold most of the day, and the page proposes the result beside the day for the visitor to take.

This page describes the tree as it stands. Why each piece is the way it is lives in `docs/decisions.md`; how it is tested and measured lives in `docs/harness.md`.

## A request's life

```mermaid
flowchart TD
  text["Visitor's sentence<br/>start screen (features/day)"] -->|POST /api/intake| intake["Intake: Haiku reads the text<br/>into a typed DayRequest;<br/>Geoapify resolves the city;<br/>the city is signed (HMAC)"]
  intake -->|DayRequest + signature| dayRoute["POST /api/day<br/>same-site check, schema check"]
  dayRoute -->|a written day's exact request| sim["Written day replayed through<br/>the AI SDK's mock model"]
  dayRoute -->|any other, live off| off["503: unavailable"]
  dayRoute -->|any other, live on| gates["City gate: written, signed or kept,<br/>else 403; then the visitor's count;<br/>then the app's caps hold the worst case"]
  gates --> call["Sonnet streams GeneratedDay<br/>(streamText + Output.object);<br/>Haiku writes it again, unseen;<br/>places checked on Geoapify"]
  sim --> wire["AI SDK UI message stream"]
  call --> wire
  call -.->|after the response| log[("generation_log:<br/>cost, outcome, repairs, checks")]
  wire --> reader["Stream reader: partial JSON,<br/>then exactly one DayOutcome"]
  reader --> normalizer["Normalizer: GeneratedDay to Itinerary,<br/>with every repair listed"]
  reader --> revealed["Revealed partial: only values<br/>whose next field has started"]
  revealed --> draft["DayDraft: stops the finished<br/>day will keep"]
  normalizer --> view["Day view: header sentence,<br/>abacus chart or reading list"]
  draft --> view
  view --> local["Curve, swaps, light:<br/>client only, no model call"]
```

## Folder map

| Folder                       | What it holds                                                                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/`                   | Routes: the start screen (`page.tsx`), a day's address (`day/[city]`), `/privacy`, the API (intake, day, a kept day, replan, events), `/lab` and `/studio` |
| `src/proxy.ts`               | Asks for the studio password on `/lab` and `/studio`, nowhere else                                                                                         |
| `src/features/day/`          | The page around a day: the orchestrator (`day.tsx`), start screen, header sentence, reading list, the visitor's days, kept days                            |
| `src/features/abacus/`       | The chart: rows, beads, the energy curve and its gestures, the streaming draft, a re-plan's fork                                                           |
| `src/features/itinerary/`    | The client side of the stream: the hooks that play a day or a re-plan, and what of a partial day may be drawn (`revealed.ts`)                              |
| `src/features/theme/`        | The theme choice, set before the first paint                                                                                                               |
| `src/features/analytics/`    | Page views, with a kept day's id left out and none from the owner's browsers                                                                               |
| `src/components/ui/`         | Primitives on the design tokens: `Fold`, `GlidingHeight`, `Ink`, the mark, and small hooks such as `useSprung`                                             |
| `src/lib/schema/`            | The data contract (Zod): the day, the intake, the re-plan                                                                                                  |
| `src/lib/normalizer/`        | From a generation to the app layer: repairs, refusals, ids                                                                                                 |
| `src/lib/stream/`            | The wire: the simulator, the readers, the outcomes, place-check parts, and `POST /api/day`'s body                                                          |
| `src/lib/live/`              | Live generation on the server: model calls, prompts, limits, spend, the log, kept days' reads                                                              |
| `src/lib/intake/`            | `POST /api/intake`'s body: the live intake call, the city lookup, the written intake                                                                       |
| `src/lib/replan/`            | A targeted re-plan: its request, windows and merge                                                                                                         |
| `src/lib/quality/`           | Pure checks over one generation, recorded on every live day; the paid eval rounds that run them live in `src/eval/`                                        |
| `src/eval/`                  | The paid eval (`pnpm eval:live`): rounds that call a model, spend money or write round files; no non-test module in `src` imports it                       |
| `src/lib/places/`            | The Geoapify client and place matching                                                                                                                     |
| `src/lib/db/`                | The `Sql` port (Neon's HTTP driver in production, PGlite in tests), migrations, read-only reports                                                          |
| `src/lib/events/`            | Anonymous product events: schema, sender, route body, Postgres store                                                                                       |
| `src/lib/days/`              | The six written days the site serves (`written/`), a day's address, a kept day's id, headers and the five answers of `GET /api/day/<id>`                   |
| `src/lib/fixtures/`          | Hand-written and edge days for tests and the lab, golden sets and test doubles, none of which a public page loads                                          |
| `src/lib/time/`              | The clock, including days that run past midnight                                                                                                           |
| `src/lib/geo/`               | Sun position, light windows, distances                                                                                                                     |
| `src/lib/tokens/`            | Motion springs, icon sizes, the root's size, theme colours, the token catalog, and the tests that hold them                                                |
| `src/lib/http/`              | Security headers and the studio lock                                                                                                                       |
| `src/lib/analytics/`         | What page views leave out, where they are counted, and the owner's mark that counts a browser out                                                          |
| `src/lib/brand/`             | The link card's line length and the favicon's ICO writer                                                                                                   |
| `src/lib/ops/`               | `pnpm prod:read`: production's database through a read-only role                                                                                           |
| `src/lib/site.ts`            | The public address, the site's description and each page's metadata                                                                                        |
| `src/lib/same-site.ts`       | The 403 for a post from another site                                                                                                                       |
| `src/lib/server-timing.ts`   | The `Server-Timing` header the intake, day and re-plan routes answer with                                                                                  |
| `src/lib/browser-storage.ts` | Every key Lantern keeps in a visitor's browser, with what the privacy page says of it                                                                      |
| `src/lib/lab-matrix.ts`      | `labMatrix` and the types every `/lab` matrix entry is written in                                                                                          |
| `src/lib/repo-hygiene.ts`    | The rules for what may be committed: its test holds every tracked file to them, and the `commit-msg` hook each message                                     |
| `db/migrations/`             | Forward-only, checksummed SQL migrations                                                                                                                   |
| `db/roles/`                  | The read-only production role                                                                                                                              |
| `e2e/`                       | Playwright specs; `e2e/visual/` holds the pixel baseline of the `/lab` matrices                                                                            |
| `scripts/`                   | The build check, migrations, reports, the paid eval round and its table, the favicon, the production read, the commit message check                        |
| `docs/`                      | Decisions, harness, security, ops, roadmap, case study, and the contracts and plans listed under "Where decisions are recorded"                            |

**Lab registration sits beside each component.** A `*-matrix.tsx` file exports the component's `labMatrix` entry, a `*-cell.tsx` file renders one cell (a stand-in parent, a frozen stream frame), and a `*-examples.ts` file holds the data the cells draw. No product module imports them; `src/app/lab/matrix/matrices.tsx` registers the entries. `src/features/itinerary/use-still.tsx` and `src/features/itinerary/stream-frames.ts` are the lab's helpers for freezing a stream at one frame.

**Where a failure goes.** An address with no page, or a city with no written day, gets `src/app/not-found.tsx`. An error while rendering a page gets `src/app/error.tsx`, and one in the root layout `src/app/global-error.tsx`. Both draw `PageFailed` (`src/features/day/page-failed.tsx`): the failure said in Lantern's words, a way to open the page again and the way back to the start, with no error's text shown. Under Cache Components a server's failure still answers 200, with Next's noindex in the first HTML. A stream that ends without a day is not an error: it is one of the outcomes in flow 3, each with its own notice.

### How the layers import

- `src/app` uses `src/features`, `src/lib` and `src/components`. Nothing imports `src/app` but tests.
- Nothing imports `src/eval` but its own modules, `scripts/` and tests. It may read a feature, which is why it sits beside `src/lib`: `src/eval/replan-round.ts` reads a re-plan as the page draws it (`replanFrameOf`).
- `src/components/ui` imports only `src/lib/tokens`.
- `src/lib` imports no feature. The days the site serves live in `src/lib/days`, where the day route, the re-plan and kept days read them. No module a public page loads imports `src/lib/fixtures`: the type of a day written ahead of time, `WrittenDay`, lives in `src/lib/days/written/written-day.ts`, and the fixtures take it from there.
- Features build on `src/lib` and on each other: `day` uses `abacus`, `itinerary` and `theme`, `abacus` uses `itinerary`, and a few small edges run back to `day`. `src/features/abacus/stop-details-view.tsx` and `src/features/abacus/sticky-scale.tsx` take link classes from `src/features/day/link-classes.ts`, `src/features/theme/theme-choice.tsx` takes the lists' sheet from `src/features/day/word-list.tsx`, and `src/features/theme/theme-button-cell.tsx` the masthead from `src/features/day/masthead.tsx`.
- Tests import across layers freely, routes included.

**Lint holds the directions between layers.** `no-restricted-imports` in `eslint.config.mjs` has one pattern per direction (`APP_IMPORTS`, `EVAL_IMPORTS`, `FEATURE_IMPORTS`, `LIB_BEYOND_TOKENS`), set folder by folder through `restrictImports`, so a block that loosens how its files style or play a day keeps their layer's patterns. It knows no exception but tests (`**/*.test.*`), which it exempts. `src/lib/tokens/token-lint.test.ts` lints a probe import for each direction and the exemption. The rule reads static imports by alias or relative path, not `import()`, and no `import()` crosses a layer today. How features import each other is described above, not checked.

## Flows

**1. The visitor's sentence becomes a request.** The start screen (`src/features/day/start-day.tsx`, with its field in `src/features/day/start-header.tsx`) takes at most 200 characters (`MAX_INTAKE_TEXT_CHARS`, `src/lib/schema/intake.schema.ts`). With live generation off, `src/features/day/written-reader.ts` reads the text in the browser and plays only a written day. With it on, `src/features/day/intake-route.ts` posts the text to `src/app/api/intake/route.ts`, a one-line adapter over `answerIntakeRequest` (`src/lib/intake/answer-intake-request.ts`):

- It refuses a post from another site (`src/lib/same-site.ts`) and checks the body.
- It counts the visitor under a salted hash of the address (`src/lib/live/visitor.ts`), then holds the call's worst case against the app's caps (`src/lib/live/limits.ts`).
- Haiku reads the text under `GeneratedIntakeSchema` (`src/lib/live/intake-prompt.ts`), and `src/lib/intake/resolve-city.ts` looks the city up on Geoapify.
- `normalizeIntake` (`src/lib/normalizer/normalize-intake.ts`) makes the answer. A named city makes a `DayRequest`; when the name could mean several cities ("Portland"), Lantern plays the first as its assumption and offers the others. Text that names no city makes a question, with the cities found to pick from.
- `src/lib/live/city-signature.ts` signs every city the answer could play (an HMAC of the city and its zone), so the day route writes no city an intake did not vouch for.

While the database may still be waking, `src/lib/intake/early-call.ts` lets the model call start beside the limits instead of after them. Without the flag, the route answers from `src/lib/intake/written-intake.ts`, the same stand-in the browser uses.

**2. A day is written.** `src/features/day/day.tsx`, the page's orchestrator, plays a request through `src/features/itinerary/day-route.ts` to `src/app/api/day/route.ts`, a one-line adapter over `answerDayRequest` (`src/lib/stream/answer-day-request.ts`). After the same-site and body checks there are three paths.

- **A written day.** A request equal, word for word, to one of the six days the product wrote ahead of time (`src/lib/days/written/days.ts`) replays that day through the AI SDK's mock model (`src/lib/stream/simulate-day-stream.ts`), with the place checks its run recorded (`src/lib/stream/written-place-checks.ts`). It counts against nothing and plays with the flag on or off. A browser that has watched this version to its end gets it whole, at once.
- **Live generation off.** Any other request is a 503, which the page reads as `unavailable`.
- **A live day.** With `LIVE_GENERATION=1` (`src/lib/live/flag.ts`), `answerLiveDay` (`src/lib/live/live-day.ts`) takes it, through three gates in order:
  1. The city must be a written day's, carry the intake's signature, or be the city of the kept day the request names (`mayWriteCity`). Otherwise the answer is a 403, before anything is counted.
  2. The visitor's count is taken.
  3. The app's caps hold the day's worst case, `DAY_RESERVE_USD`, and the shadow's, `SHADOW_RESERVE_USD`, both defined in `src/lib/live/live-day.ts` from `worstCaseUsd` in `src/lib/live/models.ts`. Past the visitor's limit or the day's hold, the answer is a 429 the page reads as `limited`; with no room for the shadow, the day runs without it.

  Then `startStreamedCall` (`src/lib/live/streamed-call.ts`) runs `streamText` with `Output.object(GeneratedDaySchema)` on Sonnet.

The live stream is teed. Cancelling the visitor's copy, as leaving the page does, leaves the server's copy reading on, so the day is written to its end (`untilCancelled`). The server reads its copy with the page's own reader, so the log records the outcome the visitor saw. `src/lib/live/place-checks-in-stream.ts` checks each place on Geoapify (`src/lib/places/verify-place.ts`) once its fields are final, and sends each check in the same stream. Haiku writes the same request unseen beside it (the shadow), so the two models can be compared on real traffic. After the response, `after()` settles each hold at the reported cost, then writes one row per call to `generation_log` (`src/lib/live/postgres-stores.ts`), with the quality checks scored on that day.

**3. The stream becomes a day on screen.** `useDayStream` (`src/features/itinerary/use-day-stream.ts`) loads `src/lib/stream/read-day-stream.ts` with `import()` on the first play, so the start screen does not carry the AI SDK's parser, and hands React the latest partial once per animation frame. `readDayStream` reads the chunks through `src/lib/stream/message-stream.ts` and turns them into partial days and exactly one `DayOutcome` (`src/lib/stream/outcome.ts`): `complete`, `cut`, `disconnected`, `refused`, `invalid`, `unavailable` or `limited`. A finished day passes through `normalizeDay` (`src/lib/normalizer/normalize.ts`) and becomes an `Itinerary`; a cut one keeps the stops that arrived whole (`salvagedDay`). While the day streams, two steps keep the page from drawing something that later disappears:

- `revealedOf` (`src/features/itinerary/revealed.ts`) keeps only the values whose next field has started, since a streamed number or enum value is final only then.
- `draftDayOf` (`src/features/abacus/day-draft.ts`) applies the normalizer's own rules (`keptAsWrittenOf`, `swapRefusalOf`) to see which stops and versions the finished day will keep.

`shownDayOf` (`src/features/day/shown-day.ts`) decides which day `Day` draws: a re-plan merged into it, a kept day, a day drawn whole, the stream once it plays the request on screen, or the day held while another request streams. `src/features/day/day-stage.tsx` draws every day, written, live or kept. It paces the header sentence with a pen (`src/features/day/use-pen.ts`), then lands the rows on the chart (`src/features/abacus/day-rows.tsx`, `src/features/abacus/abacus-chart.tsx`) or on the reading list (`src/features/day/reading-list.tsx`). An ending without a day maps to its notice in `src/features/day/stream-ending.ts`.

**4. The visitor reshapes the day locally.** Each stop has up to three versions: the primary and up to two alternatives (`ALTERNATIVES_PER_STOP`), each at a named energy level. The prompt asks for one quieter and one livelier; the scored `swap-direction` check measures how often a day keeps to that.

- `src/features/abacus/use-chart-pointer.ts` tells a drag from a tap on the chart's SVG (`DRAG_THRESHOLD`, 4 px).
- `src/features/abacus/curve.ts` bends the curve at the two stops on either side of the hand (`bendCurve`, `pullGain`). Each stop shows the version nearest the curve, with a margin before switching (`pickAll`, `SWITCH_MARGIN`), and the curve is drawn as a monotone cubic (`monotoneSlopes`, `hermiteAt`).
- Each stop is also a keyboard slider (`src/features/abacus/chart-stop.tsx`).
- `useEnergyCurve` (`src/features/abacus/use-energy-curve.ts`) holds the curve's levels and the visitor's picks.

**What a swap changes.** `Stop.selectedPlaceId` is the day's plan: the version the stop is planned to show, which the normalizer sets to the primary. A swap or a drag never writes it. The visitor's choices are a separate map from stop id to place id (`Picks`, in `useEnergyCurve`): `selected` follows a drag, and `committed` catches up when it ends. A stop with no pick shows its plan, so a reset clears the map. `src/features/day/picked-places.ts` and `src/features/day/use-picked-places.ts` keep the map in the browser, so a day reopens as the visitor left it. Only a changed energy word moves the plan, and it does so locally: `replanForEnergy` (`src/features/abacus/replan.ts`) shifts each stop's planned energy by the change of word and makes the version nearest it the new `selectedPlaceId`, and the picks are cleared. Place data never changes, and place ids double as Motion `layoutId`s.

**5. A changed word proposes its part of the day.** The energy word re-picks locally (flow 4). Any other word re-plans only with live generation on; without it, the word says what it would have re-planned (`src/features/day/not-yet.ts`). For a finished day, `replanPlanOf` (`src/lib/replan/windows.ts`) says what a changed word does, from the stops' `dependsOn`, and the page and the route read the same plan (`docs/decisions.md`, "A changed word proposes its part beside the day, and the visitor takes it"):

- **`targeted`**: the windows, the stretches the word shaped. The start's window runs from the first stop through the last it shaped, the end's from the first stop that names it through the last stop, and dinner's and company's are each run of the stops that name them. A time word's windows are widened through the kept stops the new word leaves no room for, since the merge never moves a kept stop.
- **`word`**: travel, and company where no stop names it, change the word alone. `DayStage` keeps every stop and says so in the facts line, with no call, live generation on or off.
- **`full`**: a time word no stop names, or windows that would hold more than two thirds of the stops (`MAX_SHARE_REWRITTEN`), write the whole day again.

A targeted re-plan runs from `replan` in `src/features/day/day.tsx`:

- The page posts through `src/features/itinerary/replan-route.ts` to `src/app/api/replan/route.ts`. It names the day it re-plans, a written day's slug or a kept day's id, and never sends the day itself (`docs/security.md`, S1).
- `answerReplanRequest` (`src/lib/live/live-replan.ts`) reads the day from the server's own records and computes the plan again; one that is not `targeted` is a 409, which sends the page to the whole day.
- It runs the streamed call a day makes (`startStreamedCall`) with `src/lib/live/replan-prompt.ts` and `GeneratedReplanSchema` (`src/lib/schema/replan.schema.ts`), on the day's model, with no shadow.
- `src/lib/stream/read-replan-stream.ts` treats a re-plan as all or nothing, and merges a finished one with `mergeShownReplan` (`src/lib/replan/merge.ts`), which fails one whose merge drops a new stop.
- The page draws the new part as a proposal beside the day, which it never touches (`docs/decisions.md`, "A changed word proposes its part beside the day, and the visitor takes it"). `replanFrameOf` (`src/features/abacus/replan-frame.ts`) lays the day's rows and the proposal's in one list by time while it streams, and `forkFrameOf` once it is whole. The proposal's stops are compact blue rows on dashed wires, with a dashed curve through them (`src/features/abacus/proposal-path.ts`); a stop written again at its own place and hour stays one row (`stayingStopOf`). Over each part stands a fork row (`src/features/abacus/fork-row.tsx`, placed by `forkAnchorsOf`): the visitor's answer and the proposal's as a radio group, what Lantern is doing, then what the proposal would change (`receiptOf`, `src/features/abacus/work-line.ts`), or why it failed. While a fork stands, the facts line under the headline says what it writes and where to see it (`forkNoteOf`, `src/features/day/not-yet.ts`).
- Taking the proposal merges it into the day in place, its rows keeping their ids. Either version is taken again from memory, with no call, until the next changed word settles the fork; a failed proposal fades, and the day stays as it was.

A `full` plan, a word changed on a day not yet finished, or a 409 writes a whole new day: `replanWholeDay` in `src/features/day/day.tsx` asks `POST /api/day` again with the changed word while the day on screen holds its place. Its proposal stands under one fork row, its stops not drawn beside the day, and taken, it takes the page whole.

**6. A day's address opens it again.** `src/app/day/[city]/page.tsx` serves both kinds of address.

- A written day's slug is prerendered whole by `generateStaticParams`. An inline script from `src/features/day/seen-days.ts` tells whether this device has watched that version to its end, and only a visitor who has not sees it played; a search engine's renderer counts as one that has (`isRenderingCrawler`), so it reads the day whole. On its own page, a play of the day that ends without it gives way to the day whole, with no ending said (`wholeInPlaceOf`, `src/features/day/shown-day.ts`); a live day, a kept day and another written day played there keep their endings. The live flag is read on each visit in its own Suspense part (`src/features/day/live-flag.tsx`, `src/lib/live/live-now.ts`), so the static shell never waits for it.
- A kept day is a live day stored in the log under an id, written to its end even when the visitor leaves. Its address is read at request time (`storedDayOf`, `src/lib/live/stored-days.ts`), with the five answers in `src/lib/days/stored-day.ts`: written, cut, failed, unknown and expired. While the day is still being written, `src/features/day/kept-day-page.tsx` polls `src/app/api/day/[id]/route.ts`.

The record stays in the log; it is the link that lasts. After `DAY_LINK_DAYS` (30 days) the address answers `expired` with what was asked, and the page offers to write the day again. The visitor's list of their own days lives in their browser.

## The data contract

`src/lib/schema/itinerary.schema.ts` has two layers. The `Generated*` schemas are what the model is held to:

- strict objects, with every field required;
- no numeric, length, count, pattern or format keywords, except `minItems: 1` on a day's stops;
- few union types, because each nullable is a union and unions count against the provider's grammar limit. A "none" is an enum member (`NONE`) instead.

Each field's `.describe()` string is what the model reads about that field. Fields are declared in the order the page draws them, so a stream fills the page from the top, and `src/lib/schema/in-schema-order.ts` reorders hand-written fixtures the same way. `src/lib/schema/itinerary.schema.test.ts` walks the emitted JSON Schema of all three generated schemas and fails on any unportable keyword, open object, optional field or undocumented field. It also lists every union the provider must compile.

The app layer (`Itinerary`, `Stop`, `Place`) adds ids, the request's context and invariants: a selection that names one of the stop's own places, no blank or invisible-only text, no overlapping stops, and ids unique across the day. `normalizeDay` (`src/lib/normalizer/normalize.ts`) builds it from a finished generation:

- It repairs what it can: it trims text, reformats a time, clamps a duration, shortens an overlap.
- It drops a stop or an option it cannot show, and refuses a day with no stop left or a blank line about the day.
- It returns every repair as a typed `RepairKind` with its path.

Ids are positions in the generation (`stop-0`, `stop-0:p`, `stop-0:a1`), so a streamed row's key equals the finished row's key. A re-plan's new stops take its round's prefix (`replanIdPrefix`, `src/lib/replan/request.ts`: `r1-stop-0`), so a day re-planned again keeps every id unique.

A day may run past midnight: `runningStart` and `runningSpans` in `src/lib/time/clock.ts` read 00:15 after 23:30 as the next day's minutes. The model describes light in named levels, and `src/lib/geo/light-windows.ts` and `src/lib/geo/sun.ts` compute when each window falls, from the sun at the place's coordinates, date and time zone. The intake (`src/lib/schema/intake.schema.ts`) and the re-plan (`src/lib/schema/replan.schema.ts`) follow the same rules. The model never writes markdown or HTML: components own every label. The request's words read as `src/features/day/facts.ts` says them, and a stop's kind as `kindWordOf` in `src/features/abacus/meal.ts` does.

## How the design system is enforced

- **A closed theme.** `src/app/globals.css` starts its `@theme` with `--*: initial`, so only the declared colours, type sizes, spacing, widths and radii become utilities. Colours are `light-dark()` pairs inlined into each utility, so `data-theme` on any element switches its subtree.
- **Lint, with tests of its own.** `eslint.config.mjs` reads the same stylesheet. It rejects classes outside the theme, arbitrary values, per-class durations, `dark:` overrides, removed focus outlines, raw colours and literal inline styles. It also keeps the AI SDK reader off the start screen's bundle (`EAGER_READER`) and holds the layers' directions ("How the layers import"). `src/lib/tokens/token-lint.test.ts` runs ESLint on probe components and imports to prove each rule fires.
- **Accessibility bars as unit tests.** `src/lib/tokens/palette.test.ts` reads the colours back out of the stylesheet (`src/lib/tokens/theme-colors.ts`). It holds text to 5:1 contrast and drawn marks to 3:1, and keeps the accents distinguishable under simulated colour blindness.
- **Motion in one place.** `src/lib/tokens/motion.ts` names three springs by intent (`snappy`, `layout`, `gentle`). `springOver` and `gentleOver` stretch a spring over a long glide, so it moves no faster than over its reach; a frame drawn late still steps further. `src/components/ui/gliding-height.tsx`, `src/components/ui/fold.tsx` and `src/components/ui/use-sprung.ts` apply them.
- **Every state as data.** A component's `/lab` matrix is a `labMatrix` entry beside it (`src/lib/lab-matrix.ts`; for example `src/features/abacus/stop-row-matrix.tsx`), registered in `src/app/lab/matrix/matrices.tsx`. Each cell is drawn in both themes, at a phone's width and at a laptop's. `src/app/lab/matrix/matrices.test.tsx` renders every cell on every commit, and `e2e/visual/matrices.visual.ts` (`pnpm e2e:visual`) compares them with a pixel baseline.
- **The catalog.** `src/lib/tokens/catalog.ts` lists the tokens with their roles for `/lab/tokens`, and `src/lib/tokens/catalog.test.ts` checks it against the stylesheet.

## How the harness keeps quality

- **The commit gate.** `.githooks/pre-commit` runs `pnpm check` on every commit: format, lint, typecheck, and unit tests with an 80% coverage gate (`vitest.config.mts`). A `commit-msg` hook checks the message against the rules in `CLAUDE.md`, "Everything committed is public", as `src/lib/repo-hygiene.test.ts` checks the files. `.github/workflows/ci.yml` runs `pnpm check` again with `pnpm build:check` on every push to `develop` or `main` and every pull request, and `pnpm e2e` in a second job on pull requests, on pushes to `main` and by hand. Work lands on `develop`; `main` takes only releases, each tagged.
- **No live service in tests.**
  - Written and fixture days stream through the real AI SDK path on its mock model (`src/lib/stream/simulate-day-stream.ts`), with seeded uneven pacing (`src/lib/stream/uneven-pace.ts`) and every ending the outcome protocol lists.
  - A fake Claude API sits behind the real provider (`src/lib/fixtures/live/mock-claude.ts`), and Postgres runs in WASM (`src/lib/fixtures/db/pglite.ts`).
  - One contract suite runs against both the in-memory and the Postgres stores (`src/lib/live/limits-contract.ts`).
  - Edge days hold components and checks to the schema's extremes (`src/lib/fixtures/edge/edge-days.ts`).
- **Checks without reference answers.** `runQualityChecks` (`src/lib/quality/checks.ts`) scores one generation with pure functions. Hard checks say a day is broken; scored ones hold a measure to a threshold. They run over every fixture before each commit and on every live day, and the results are recorded in that day's log row. No check blocks a stream: the schema and the normalizer decide what a visitor sees.
- **Paid eval rounds.** `pnpm eval:live` (`scripts/live-eval.ts`) runs production's own route handlers in-process against live Claude, on an in-memory bench (`src/eval/day-round.ts`). It sends nothing until `EVAL_CONFIRM_USD` covers the round's worst case (`src/eval/round.ts`). A voice judge (`src/eval/voice/judge.ts`, `src/eval/voice/round.ts`) judges each day three times, and its agreement with labelled lines is reported as Cohen's kappa; its numbers compare writers, never give an absolute share. `pnpm eval:table` (`scripts/eval-table.mts`) writes the README's table from the saved runs.
- **The browser.** `pnpm e2e` (`playwright.config.ts`) runs on a laptop viewport and a phone viewport, with live generation off. `e2e/fixtures.ts` gives every spec CPU throttling on demand (`pnpm e2e:busy`) and its own client address. `scripts/build-check.mts` serves the production build and requests real pages, including a random `/day/<uuid>`.
- **The maps stay true.** `src/lib/doc-paths.test.ts` fails when a path this page or the README names no longer exists. `src/lib/decisions-index.test.ts` fails when an entry of `docs/decisions.md` is missing from its Index, or a link there leads to no entry, and `src/lib/decision-citations.test.ts` when a comment or a doc quotes a heading the log does not hold.

## Where decisions are recorded

- `docs/decisions.md` is an edited log of the decisions worth explaining. Each entry has a heading made of a date and a sentence that states the decision, followed by **Decision**, **Why** and **Cost**, and, where the decision changed on the way, **How it got here**. Entries are in date order, and an Index lists each under its area. Code comments cite an entry by its heading's sentence, or the first clause of a long one, word for word.
- `docs/harness.md` holds the measurements: what each layer of the harness checks, each prompt version and what it moved, the eval rounds that settled a choice, and the recipes for tests that a busy machine or an in-between frame would break.
- `docs/security.md` is the threat model and the audit (findings S1 onward), and `docs/ops.md` is the operations runbook.
- `docs/design-direction.md` is the visual language as it stands: its principles, palette and type, the chart, motion, each surface, and how the look was found. A comment cites a design rule by its section there, and the reason for it by its `docs/decisions.md` entry.
- Contracts written before a piece was built: `docs/targeted-replan.md` (the re-plan), `docs/grounding.md` (place checks) and `docs/voice.md` (the voice rubric). `docs/place-match-audit.md` checks the place-matching rules by eye, and `docs/discoverability.md` covers search and link previews.
- `docs/roadmap.md` holds scope and dates, and `docs/case-study.md` tells the story in one read. `docs/brand/` keeps the mark's source files.

## Start here

1. `src/lib/schema/itinerary.schema.ts`, with `src/lib/schema/itinerary.schema.test.ts`: the contract, and the test that keeps it portable.
2. `src/lib/stream/outcome.ts`, then `src/lib/stream/read-day-stream.ts`: every way a stream ends, and the salvage rule.
3. `src/lib/normalizer/normalize.ts`: repair, refuse, ids by position, and the two rules the streaming draft reuses.
4. `src/lib/live/live-day.ts` (`answerLiveDay`) and `src/lib/live/streamed-call.ts` (`startStreamedCall`, `untilCancelled`), with `src/lib/live/limits.ts` and `src/lib/live/postgres-stores.ts`: the day route, the streamed call, the worst-case hold and the log.
5. `src/features/abacus/curve.ts`, with `src/features/abacus/use-energy-curve.ts`: the model writes the versions, and code picks among them.
6. `eslint.config.mjs` and `src/lib/lab-matrix.ts`: how the design system is enforced, and how components are reviewed across their states.

## Words the code uses

| Word                   | Meaning                                                                                                                                                | Where                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| abacus                 | The chart: time runs down, energy runs across five lanes                                                                                               | `src/features/abacus/`                                                          |
| wire, bead             | A stop's horizontal line on the chart, and a version drawn on it at its energy                                                                         | `src/features/abacus/chart-stop.tsx`                                            |
| version, twin          | One of a stop's places (the primary or an alternative); two versions at the same energy                                                                | `src/features/abacus/curve.ts`, `src/features/abacus/geometry.ts`               |
| energy                 | Five named levels, from reflective to social (`ENERGY_LEVELS`)                                                                                         | `src/lib/schema/itinerary.schema.ts`                                            |
| curve                  | The line through the shown beads that the visitor drags                                                                                                | `src/features/abacus/curve.ts`, `src/features/abacus/use-energy-curve.ts`       |
| plan, pick             | The version a stop is planned to show (`selectedPlaceId`); the one the visitor chose instead (`Picks`)                                                 | `src/lib/schema/itinerary.schema.ts`, `src/features/abacus/use-energy-curve.ts` |
| selected, committed    | The picks the chart shows, following a drag; the picks the rest of the page shows, caught up at release                                                | `src/features/abacus/use-energy-curve.ts`                                       |
| dek                    | The one line the model writes about the day                                                                                                            | `src/lib/schema/itinerary.schema.ts`                                            |
| facts, words           | The request's words in the header sentence (city, energy, start, dinner, end, travel, company)                                                         | `src/features/day/facts.ts`                                                     |
| assumption             | A word the model chose because the visitor did not say it, shown with a dotted underline                                                               | `src/lib/normalizer/normalize.ts` (`factsOf`)                                   |
| written day            | A day the product wrote ahead of time, served from the build at its own address                                                                        | `src/lib/days/written/days.ts`                                                  |
| stage                  | One request on screen as the page draws it: its header, its chart or list, its ending                                                                  | `src/features/day/day-stage.tsx`                                                |
| kept day               | A live day stored in the log, opened at `/day/<id>`; its link lasts 30 days                                                                            | `src/lib/days/stored-day.ts`                                                    |
| seen                   | Watched to its end on this device, so it opens whole                                                                                                   | `src/features/day/seen-days.ts`                                                 |
| start                  | The start screen; one of the eight written days its index offers                                                                                       | `src/features/day/start-offers.ts`                                              |
| reading                | One city that a typed name could mean (`CityReading`)                                                                                                  | `src/lib/schema/intake.schema.ts`                                               |
| shadow                 | The same request written by Haiku, never shown, logged as a pair with the visitor's day                                                                | `src/lib/live/live-day.ts`                                                      |
| hold, settle           | The worst case reserved against the caps before a call, then replaced by the reported cost                                                             | `src/lib/live/limits.ts`                                                        |
| outcome                | One of the seven ways a stream ends                                                                                                                    | `src/lib/stream/outcome.ts`                                                     |
| salvage                | What a cut stream still shows                                                                                                                          | `src/lib/stream/read-day-stream.ts`                                             |
| repair                 | A fix the normalizer made, logged by kind and path                                                                                                     | `src/lib/normalizer/normalize.ts`                                               |
| re-plan, window, round | Writing again the part of the day a changed word shaped; one stretch of it; the count of re-plans                                                      | `src/lib/replan/`                                                               |
| proposal, fork         | A re-plan drawn beside the day until the visitor takes it; the day and a proposal as two paths, with a fork row over each part holding the two answers | `src/features/abacus/replan-frame.ts`, `src/features/abacus/fork-row.tsx`       |
| revealed               | A partial day cut down to the values whose next field has started                                                                                      | `src/features/itinerary/revealed.ts`                                            |
| draft                  | The stops and versions a partial day may draw                                                                                                          | `src/features/abacus/day-draft.ts`                                              |
| pen                    | Text let onto the page one piece at a time                                                                                                             | `src/features/day/use-pen.ts`, `src/components/ui/ink.tsx`                      |
| room, held             | Height reserved before content arrives; content kept on screen while the next thing loads                                                              | `src/components/ui/gliding-height.tsx`, `src/features/day/day-stage.tsx`        |
| whole                  | Drawn complete at once, with no playback                                                                                                               | `src/features/day/day.tsx`                                                      |
| sheet                  | An open stop's details, laid over the day so no row moves                                                                                              | `src/features/abacus/words-sheet.tsx`, `src/features/abacus/sheet-placement.ts` |
| density                | Open, standard or folded: how much of a row is shown                                                                                                   | `src/features/abacus/density.ts`                                                |
| matrix                 | A component's states laid out as data in `/lab`                                                                                                        | `src/lib/lab-matrix.ts`                                                         |
| still                  | A stream frozen at one frame, for a matrix cell                                                                                                        | `src/features/itinerary/use-still.tsx`                                          |
| studio                 | `/studio` and `/lab`, behind the owner's password                                                                                                      | `src/proxy.ts`, `src/lib/http/studio-gate.ts`                                   |

"Written" means only a day served from the build; the views are named for what they draw.
