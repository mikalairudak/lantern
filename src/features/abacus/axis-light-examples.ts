/**
 * The time axis's light in the lab's matrix: days across what the light can do to the axis,
 * and the moments of a day it is seen in. A plain module, so the lab's server page can read
 * the axes; the cell that draws a day is a client component.
 */

import { ALICANTE_DAY } from "@/lib/fixtures/curated/alicante";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { LISBON_DAY } from "@/lib/fixtures/curated/lisbon";
import {
  LATE_NIGHT_DAY,
  MIDNIGHT_SUN_DAY,
  MINIMAL_DAY,
  POLAR_NIGHT_DAY,
} from "@/lib/fixtures/edge/edge-days";
import { dayText } from "@/lib/stream/simulate-day-stream";
import { completeDraftOf, type DayDraft } from "./day-draft";
import {
  draftAt,
  frameBefore,
  itineraryOf,
  pageFrameOf,
  type ExampleDay,
  type StopRowStill,
} from "./stop-row-examples";
import { stopIdAt } from "@/lib/schema/positions";

/** A fixture day, drawn as the page draws it under the light it is lived in. */
export interface LightDay {
  label: string;
  fixture: ExampleDay;
}

/**
 * Days across what the light can do to the time axis: an evening into night, a dawn and a
 * dusk, a dinner deep in the night, a night past midnight, a polar noon that is only blue
 * hour, a sun that never sets, and a single morning stop on a frame that runs on into the
 * evening, as far as the chart's least height takes it once the day is whole.
 */
export const LIGHT_DAYS: readonly LightDay[] = [
  { label: "Kyoto", fixture: KYOTO_DAY },
  { label: "Alicante, dawn and dusk", fixture: ALICANTE_DAY },
  { label: "Lisbon, dinner after dark", fixture: LISBON_DAY },
  { label: "past midnight", fixture: LATE_NIGHT_DAY },
  { label: "polar night", fixture: POLAR_NIGHT_DAY },
  { label: "midnight sun", fixture: MIDNIGHT_SUN_DAY },
  { label: "one stop", fixture: MINIMAL_DAY },
];

/**
 * The day as a visitor finds it, whole; as it was being written, its light down to the
 * stops placed so far; and with its last stop open. Whole comes first, the one the visual
 * baseline shoots.
 */
export const LIGHT_STATES = [
  { label: "whole", key: "whole" },
  { label: "being written", key: "writing" },
  { label: "the last stop open", key: "open" },
] as const;

export type LightState = (typeof LIGHT_STATES)[number]["key"];

/** Whether the stop with this index has been placed. */
function hasStop(draft: DayDraft, index: number): boolean {
  return draft.stops.some((stop) => stop.id === stopIdAt(index));
}

/** Whether any stop's versions have started to arrive. */
function hasVersions(draft: DayDraft): boolean {
  return draft.stops.some((stop) => stop.alternatives.length > 0);
}

const stills = new Map<string, Promise<StopRowStill>>();

/**
 * A day on the page's frame at a moment: whole, its last stop the one a cell opens; or as
 * its real stream stands just before the stop after its middle one is placed, or before its
 * versions on a day of one stop. Worked out once, since both themes and widths show it.
 */
export function stillOf(day: LightDay, state: LightState): Promise<StopRowStill> {
  const key = `${day.label}:${state}`;
  const known = stills.get(key);
  if (known) return known;
  const still = (async (): Promise<StopRowStill> => {
    const itinerary = itineraryOf(day.fixture);
    if (state !== "writing") {
      const draft = completeDraftOf(itinerary);
      return {
        draft,
        subject: draft.stops.length - 1,
        at: null,
        itinerary,
        frame: { kind: "page", page: pageFrameOf(draft.stops, itinerary), isWhole: true },
      };
    }
    const text = dayText(day.fixture.day);
    const next = Math.floor(day.fixture.day.stops.length / 2) + 1;
    const at = await frameBefore(text, (draft) => hasStop(draft, next) || hasVersions(draft));
    const draft = await draftAt(text, at);
    return {
      draft,
      subject: draft.stops.length - 1,
      at,
      itinerary,
      frame: { kind: "page", page: pageFrameOf(draft.stops, itinerary), isWhole: false },
    };
  })();
  stills.set(key, still);
  return still;
}
