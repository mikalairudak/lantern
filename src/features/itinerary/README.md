# itinerary

The stream on the client: how a page plays a day or a re-plan from the app's routes, and what of a partial day it may draw. It has no components of its own; `src/features/day` draws what these hooks hold.

## Read first

1. `revealed.ts`. `revealedOf` keeps only what the stream will not change: a value is final once the field after it has started, and free text shows as it grows. Which fields grow is read from the schema, so a new text field needs no edit here.
2. `use-day-stream.ts`. `useDayStream` reads a day's stream into React state, at most one new partial a frame. It loads the reader (`src/lib/stream/read-day-stream.ts`) on the first play, not with the page; opens the stream a microtask late, so React's Strict Mode never sends the route two requests; asks once more for a day that came back empty; and throws a bug to the error boundary. Every stream ends in exactly one `DayOutcome` (`src/lib/stream/outcome.ts`).
3. `use-replan-stream.ts`. `useReplanStream`, the same for a targeted re-plan, which is all or nothing: any ending but a whole re-plan leaves the day as it was.

## Entry points

| File                   | What it holds                                                                                                                                                    | Read by                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `day-route.ts`         | `routeSourceFor`: a day from `POST /api/day`, with its city's signature or the kept day it was changed on. `answeredSourceFor`: an answer known without asking   | `Day`, the lab's benches                                                                               |
| `replan-route.ts`      | `replanRouteSourceFor`: a re-plan from `POST /api/replan`, whose body names the day and never carries it. `replanBasisOf`: what the page holds before it streams | `Day`, the lab's re-plan bench                                                                         |
| `use-day-stream.ts`    | `useDayStream`, `DaySource`, and `PlaceChecks`, each place's last check by its id                                                                                | `Day`, `DayStage`, `/day/[city]`, the lab                                                              |
| `use-replan-stream.ts` | `useReplanStream` and `ReplanSource`; a 409 from the route asks the page to re-plan the whole day                                                                | `Day`, the lab's re-plan bench                                                                         |
| `revealed.ts`          | `revealedOf` and `GROWING_TEXT_KEYS`                                                                                                                             | `src/features/abacus/day-draft.ts`, `DayStage`, `src/features/day/header-ready.ts`, the lab's examples |

## Lab helpers

`stream-frames.ts` finds the prefix of a real stream at which a component reaches a state (`firstAt`), and `use-still.tsx` reads such a frame into a lab cell. Only the `*-examples.ts` and `*-cell.tsx` files of the other features import them; the product never does.
