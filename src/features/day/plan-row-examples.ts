import { beadOrderOf, candidatesOf } from "@/features/abacus/curve";
import { completeDraftOf, type StopDraft } from "@/features/abacus/day-draft";
import { dayContextOf } from "@/features/abacus/light";
import { itineraryOf, type ExampleDay } from "@/features/abacus/stop-row-examples";
import { WRITTEN_DAYS } from "@/lib/days/written/days";
import { ALICANTE_DAY } from "@/lib/fixtures/curated/alicante";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { LISBON_DAY } from "@/lib/fixtures/curated/lisbon";
import { LATE_NIGHT_DAY } from "@/lib/fixtures/edge/edge-days";
import type { DayContext, LightQuality } from "@/lib/geo/sun";
import type { Stop } from "@/lib/schema/itinerary.schema";
import { runningSpans } from "@/lib/time/clock";
import { lightAt } from "./light-rail";

/**
 * One row of the plan in each light its bead answers to, as a proposal's stop and a taken one,
 * and with its versions on one line, on two, on one side alone and with the longest names of
 * the written days, from the fixture days and the days the site serves.
 */

/** Where a row of each light is looked for, in this order. */
const LIGHT_DAYS: readonly ExampleDay[] = [ALICANTE_DAY, KYOTO_DAY, LISBON_DAY, LATE_NIGHT_DAY];

const DAYLIGHT: readonly LightQuality[] = ["soft", "clear"];
const GOLDEN: readonly LightQuality[] = ["golden"];
const AFTER_DARK: readonly LightQuality[] = ["blue", "dark"];

/** How a row stands: the day's own, a proposal beside the day, or a proposal taken as it is shown. */
export type RowRole = "day" | "proposed" | "taken";

export interface PlanRowStill {
  stop: StopDraft;
  daylight: DayContext;
}

export interface PlanRowExample {
  label: string;
  role: RowRole;
  /** Worked out in the cell, once for each cell drawn. */
  still: () => PlanRowStill;
  /** Set as on a 320 px phone: 288 px inside its gutters, 208 px for a stop's words. */
  isNarrow?: boolean;
}

/** The first stop of the fixture days whose start falls in one of `lights`, or a day's last. */
function inLight(lights: readonly LightQuality[], isLatest = false): () => PlanRowStill {
  return () => {
    for (const fixture of LIGHT_DAYS) {
      const itinerary = itineraryOf(fixture);
      const daylight = dayContextOf(itinerary);
      const stops = completeDraftOf(itinerary).stops;
      const isInLight = ({ from }: { from: number }) => lights.includes(lightAt(daylight, from));
      const spans = runningSpans(stops);
      const at = isLatest ? spans.findLastIndex(isInLight) : spans.findIndex(isInLight);
      const stop = stops[at];
      if (stop) return { stop, daylight };
    }
    throw new Error(`No fixture day has a stop starting in ${lights.join(" or ")}.`);
  };
}

/** The names either side of a stop's planned place along the wire, as its arrows say them. */
function sidesOf(stop: Stop): { before: string | null; after: string | null } {
  const order = beadOrderOf(stop);
  const at = order.indexOf(0);
  const nameAt = (index: number | undefined) =>
    index === undefined ? null : (candidatesOf(stop)[index]?.name ?? "");
  return { before: nameAt(order[at - 1]), after: nameAt(order[at + 1]) };
}

type Sides = ReturnType<typeof sidesOf>;

/**
 * The stop of the days the site serves that scores highest among those `isWanted` keeps, as
 * the plan draws it on its own day.
 */
function writtenStopBy(
  isWanted: (sides: Sides) => boolean,
  score: (sides: Sides) => number,
): () => PlanRowStill {
  return () => {
    let best: (PlanRowStill & { score: number }) | null = null;
    for (const written of WRITTEN_DAYS) {
      const itinerary = itineraryOf(written);
      for (const stop of itinerary.stops) {
        const sides = sidesOf(stop);
        if (!isWanted(sides)) continue;
        const each = score(sides);
        if (best === null || each > best.score) {
          best = { stop, daylight: dayContextOf(itinerary), score: each };
        }
      }
    }
    if (best === null) throw new Error("No written day has a stop with versions so placed.");
    return { stop: best.stop, daylight: best.daylight };
  };
}

const isBothSides = ({ before, after }: Sides) => before !== null && after !== null;
const lengthOf = ({ before, after }: Sides) => (before?.length ?? 0) + (after?.length ?? 0);
const longestOf = ({ before, after }: Sides) => Math.max(before?.length ?? 0, after?.length ?? 0);

export const PLAN_ROW_EXAMPLES: readonly PlanRowExample[] = [
  { label: "a stop in daylight: an ink bead", role: "day", still: inLight(DAYLIGHT) },
  {
    label: "golden hour: lamp rail, amber time",
    role: "day",
    still: inLight(GOLDEN),
  },
  { label: "after dark: the bead lit", role: "day", still: inLight(AFTER_DARK, true) },
  {
    label: "before sunrise: lit too, as the rail is dotted",
    role: "day",
    still: inLight(AFTER_DARK),
  },
  {
    label: "a proposal's stop after dark: never lit",
    role: "proposed",
    still: inLight(AFTER_DARK, true),
  },
  {
    label: "a proposal taken: its glow grows",
    role: "taken",
    still: inLight(AFTER_DARK, true),
  },
  {
    label: "a version each side, the shortest pair: one line",
    role: "day",
    still: writtenStopBy(isBothSides, (sides) => -lengthOf(sides)),
  },
  {
    label: "a version each side, the longest pair: a line each",
    role: "day",
    still: writtenStopBy(isBothSides, lengthOf),
  },
  {
    label: "one version, on its left",
    role: "day",
    still: writtenStopBy(({ before, after }) => before !== null && after === null, lengthOf),
  },
  {
    label: "one version, on its right",
    role: "day",
    still: writtenStopBy(({ before, after }) => before === null && after !== null, lengthOf),
  },
  {
    label: "the longest name of the written days, at 320 px",
    role: "day",
    still: writtenStopBy(isBothSides, longestOf),
    isNarrow: true,
  },
];
