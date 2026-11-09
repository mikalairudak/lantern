import type { ReplanBasis } from "@/lib/replan/merge";
import {
  DayRequestSchema,
  ItinerarySchema,
  type DayRequest,
  type Itinerary,
} from "@/lib/schema/itinerary.schema";
import { GeneratedReplanSchema, type GeneratedReplan } from "@/lib/schema/replan.schema";
import recorded from "./elche-dinner.json";

/**
 * A test day on production: an early, family Thursday in Elche whose dinner was changed from "early
 * dinner" to "eating late", rebuilt from the day's page and kept as a regression case. The kept
 * stops, the new stops and the line about the day are production's own. The window's old stops
 * (13:15, 16:30, 18:15 and 20:00) and their lines are a reconstruction, since the page no longer
 * shows the day before. The re-plan holds the fifth stop the merge dropped, "Coffee on Plaça de
 * Baix" at 18:30. With it, merging gives production's day, ids and times included.
 *
 * The day is the shape two faults took (`docs/decisions.md`, "A changed word proposes its part
 * beside the day, and the visitor takes it"). It assumed "home by eleven", which replan-v6 told the
 * model was open, and the evening ran to 23:45. And the new coffee repeats the kept 07:45 one, so
 * the merge dropped it, leaving 17:30 to 21:00 empty while the line about the day still names
 * "coffee on the square again".
 */

/** The day's request: Lantern assumed its dinner, its end and its travel. */
export const ELCHE_REQUEST: DayRequest = DayRequestSchema.parse(recorded.request);

/** The day before the re-plan, as production's record of it read. */
export const ELCHE_ITINERARY: Itinerary = ItinerarySchema.parse(recorded.itinerary);

/** The request with its dinner changed to "eating late", as the page sends it. */
export const ELCHE_EATING_LATE: DayRequest = { ...ELCHE_REQUEST, dinner: "late" };

/** The re-plan as the model wrote it, its repeated coffee included. */
export const ELCHE_LATE_DINNER: GeneratedReplan = GeneratedReplanSchema.parse(recorded.replan);

/** What the page and the server held before the re-plan streamed: the day's first. */
export const ELCHE_DINNER_BASIS: ReplanBasis = {
  itinerary: ELCHE_ITINERARY,
  request: ELCHE_EATING_LATE,
  changed: "dinner",
  // The lunch, and the afternoon from the garden to the day's end.
  windows: [
    { from: 4, to: 4 },
    { from: 6, to: 8 },
  ],
  idPrefix: "r1",
};

/**
 * Production's merged day, stop by stop, as its page shows it: no `r1-stop-2`, the coffee, and
 * the garden written again at its own hour standing as the stop it was (`stayingStopOf`).
 */
export const ELCHE_SHOWN_STOPS = [
  "stop-0 07:45",
  "stop-1 08:45",
  "stop-2 11:00",
  "stop-3 12:30",
  "r1-stop-0 13:15",
  "stop-5 15:00",
  "stop-6 16:30",
  "r1-stop-3 21:00",
  "r1-stop-4 23:15",
];

/** The same re-plan without the coffee: nothing is dropped, and 17:30 to 21:00 still stands empty. */
export const ELCHE_LATE_DINNER_UNREPEATED: GeneratedReplan = {
  ...ELCHE_LATE_DINNER,
  stops: ELCHE_LATE_DINNER.stops.filter((_, index) => index !== 2),
  alternatives: ELCHE_LATE_DINNER.alternatives
    .filter(({ stopIndex }) => stopIndex !== 2)
    .map((set) => ({ ...set, stopIndex: set.stopIndex > 2 ? set.stopIndex - 1 : set.stopIndex })),
};
