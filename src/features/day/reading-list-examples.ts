import {
  completeDraftOf,
  draftDayOf,
  openableStopsOf,
  type StopDraft,
} from "@/features/abacus/day-draft";
import { dayContextOf } from "@/features/abacus/light";
import { itineraryOf, type ExampleDay } from "@/features/abacus/stop-row-examples";
import { revealedOf } from "@/features/itinerary/revealed";
import { firstAt, partialAt } from "@/features/itinerary/stream-frames";
import { ALICANTE_DAY } from "@/lib/fixtures/curated/alicante";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { LISBON_DAY } from "@/lib/fixtures/curated/lisbon";
import { CROWDED_DAY, LATE_NIGHT_DAY, MINIMAL_DAY } from "@/lib/fixtures/edge/edge-days";
import type { DayContext } from "@/lib/geo/sun";
import { dayText } from "@/lib/stream/simulate-day-stream";
import { enteredOf, versionsWrittenOf } from "./reading-gates";

/** The list to read on the days whose extremes it meets. */
export const READING_DAYS: readonly { label: string; fixture: ExampleDay }[] = [
  { label: "Kyoto, calm", fixture: KYOTO_DAY },
  { label: "Lisbon, lively: a loud place says its line too", fixture: LISBON_DAY },
  { label: "Alicante, a sun at its best light", fixture: ALICANTE_DAY },
  { label: "twelve stops, the longest words", fixture: CROWDED_DAY },
  { label: "one stop, one version", fixture: MINIMAL_DAY },
  { label: "a night past midnight", fixture: LATE_NIGHT_DAY },
];

/**
 * The moments a day's list lives through, from its real stream: a stop waiting while its
 * line is written, a row the pen writes as it comes in, the versions' second pass, a version
 * swapped, and a changed word's proposal beside the day, its fork row over it.
 */
export const READING_STATES = [
  { key: "whole", label: "whole" },
  { key: "waiting", label: "a stop waits while its line is written" },
  { key: "pen", label: "the last row let in, being written" },
  { key: "versions", label: "versions written for the first stops" },
  { key: "swapped", label: "the first stop swapped to its next version" },
  { key: "proposed", label: "two stops a changed word proposes, its fork row over them" },
] as const;

export type ReadingState = (typeof READING_STATES)[number]["key"];

export interface ReadingStill {
  stops: readonly StopDraft[];
  entered: number;
  versionsShown: ReadonlySet<string>;
  picks: readonly number[];
  daylight: DayContext;
  /** A changed word's proposal beside the day, by id, blue and "proposed". */
  proposed?: ReadonlySet<string>;
  /** The stop its fork row stands over. */
  forkAnchor?: string;
  heldPen?: { id: string; written: number };
}

/** The stop a waiting frame stands on: the third, or the day's last on a shorter day. */
function subjectOf(fixture: ExampleDay, from: number): number {
  return Math.min(from, fixture.day.stops.length - 1);
}

/** The list at a frame of the day's stream, let in as the day lets it in. */
async function frameOf(fixture: ExampleDay, at: number, daylight: DayContext) {
  const text = dayText(fixture.day);
  const revealed = revealedOf(await partialAt(text, at), null);
  const draft = draftDayOf(revealed);
  return {
    stops: draft.stops,
    entered: enteredOf(draft.stops, openableStopsOf(revealed.day, draft)),
    versionsShown: versionsWrittenOf(draft.stops, revealed.day.alternatives, draft.isComplete),
    picks: draft.stops.map(() => 0),
    daylight,
  };
}

const stills = new Map<string, Promise<ReadingStill>>();

/** A still of the list: worked out once, since both themes and widths show it. */
export function readingStillOf(day: number, state: ReadingState): Promise<ReadingStill> {
  const key = `${day}:${state}`;
  const known = stills.get(key);
  if (known) return known;
  const still = (async (): Promise<ReadingStill> => {
    const fixture = (READING_DAYS[day] ?? READING_DAYS[0]!).fixture;
    const itinerary = itineraryOf(fixture);
    const daylight = dayContextOf(itinerary);
    const text = dayText(fixture.day);
    const whole = completeDraftOf(itinerary).stops;
    const all = new Set(whole.map((stop) => stop.id));
    const wholeStill = {
      stops: whole,
      entered: whole.length,
      versionsShown: all,
      picks: whole.map(() => 0),
      daylight,
    };
    switch (state) {
      case "whole":
        return wholeStill;
      case "swapped":
        return {
          ...wholeStill,
          picks: whole.map((stop, index) => (index === 0 && stop.alternatives.length > 0 ? 1 : 0)),
        };
      case "proposed": {
        // The day's second and third stops drawn as a proposal beside the rest, the fork's row
        // over the first of them.
        const proposed = whole.slice(1, 3);
        return {
          ...wholeStill,
          proposed: new Set(proposed.map((stop) => stop.id)),
          forkAnchor: proposed[0]?.id,
        };
      }
      case "waiting":
      case "pen": {
        // Mid-word in the subject stop's one line, which its row waits for.
        const subject = subjectOf(fixture, 2);
        // The search wants a state the stream never leaves: from here the line only grows.
        const at = await firstAt(
          text,
          ({ day: partial }) => (partial.stops?.[subject]?.place?.summary ?? "").length >= 12,
        );
        const frame = await frameOf(fixture, at, daylight);
        if (state === "waiting" || frame.entered === 0) return frame;
        const last = frame.stops[frame.entered - 1]!;
        // The pen past the time and the name, a few letters into what and where.
        const written = 5 + (last.primary.name?.length ?? 0) + 8;
        return { ...frame, heldPen: { id: last.id, written } };
      }
      case "versions": {
        // The subject stop's set just begun: the sets before it are whole.
        const subject = subjectOf(fixture, 3);
        const at = await firstAt(text, ({ day: partial }) =>
          (partial.alternatives ?? []).some((set) => set?.stopIndex === subject),
        );
        return frameOf(fixture, at, daylight);
      }
    }
  })();
  stills.set(key, still);
  return still;
}
