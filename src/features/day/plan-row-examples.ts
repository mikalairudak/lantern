import { completeDraftOf, type StopDraft } from "@/features/abacus/day-draft";
import { dayContextOf } from "@/features/abacus/light";
import { itineraryOf, type ExampleDay } from "@/features/abacus/stop-row-examples";
import { ALICANTE_DAY } from "@/lib/fixtures/curated/alicante";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { LISBON_DAY } from "@/lib/fixtures/curated/lisbon";
import { LATE_NIGHT_DAY } from "@/lib/fixtures/edge/edge-days";
import type { DayContext, LightQuality } from "@/lib/geo/sun";
import { runningSpans } from "@/lib/time/clock";
import { lightAt } from "./light-rail";

/**
 * One row of the plan in each light its bead answers to, and as a proposal's stop and a taken
 * one, from the fixture days: the first stop of these days whose start falls in the light asked.
 */

/** Where a row of each light is looked for, in this order. */
const DAYS: readonly ExampleDay[] = [ALICANTE_DAY, KYOTO_DAY, LISBON_DAY, LATE_NIGHT_DAY];

const DAYLIGHT: readonly LightQuality[] = ["soft", "clear"];
const GOLDEN: readonly LightQuality[] = ["golden"];
const AFTER_DARK: readonly LightQuality[] = ["blue", "dark"];

/** How a row stands: the day's own, a proposal beside the day, or a proposal taken as it is shown. */
export type RowRole = "day" | "proposed" | "taken";

export interface PlanRowExample {
  label: string;
  lights: readonly LightQuality[];
  role: RowRole;
  /** The day's last stop in that light, an evening's, rather than its first. */
  isLatest?: boolean;
}

export const PLAN_ROW_EXAMPLES: readonly PlanRowExample[] = [
  { label: "a stop in daylight: an ink bead", lights: DAYLIGHT, role: "day" },
  { label: "golden hour: lamp rail, amber time", lights: GOLDEN, role: "day" },
  { label: "after dark: the bead lit", lights: AFTER_DARK, role: "day", isLatest: true },
  { label: "before sunrise: lit too, as the rail is dotted", lights: AFTER_DARK, role: "day" },
  {
    label: "a proposal's stop after dark: never lit",
    lights: AFTER_DARK,
    role: "proposed",
    isLatest: true,
  },
  {
    label: "a proposal taken: its glow grows",
    lights: AFTER_DARK,
    role: "taken",
    isLatest: true,
  },
];

export interface PlanRowStill {
  stop: StopDraft;
  daylight: DayContext;
}

/** The first stop of the fixture days whose start falls in one of `lights`, or its day's last. */
export function planRowStillOf(lights: readonly LightQuality[], isLatest = false): PlanRowStill {
  for (const fixture of DAYS) {
    const itinerary = itineraryOf(fixture);
    const daylight = dayContextOf(itinerary);
    const stops = completeDraftOf(itinerary).stops;
    const spans = runningSpans(stops);
    const isInLight = ({ from }: { from: number }) => lights.includes(lightAt(daylight, from));
    const at = isLatest ? spans.findLastIndex(isInLight) : spans.findIndex(isInLight);
    const stop = stops[at];
    if (stop) return { stop, daylight };
  }
  throw new Error(`No fixture day has a stop starting in ${lights.join(" or ")}.`);
}
