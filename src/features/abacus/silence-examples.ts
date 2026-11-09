/**
 * The silences' examples for the lab's matrix: the days a silence is shown on, the stream's
 * silences, and each worked out as the frame of the day's real stream before what it waits
 * for arrives. A plain module, so the lab's server page can read the axes; the cell that
 * draws a silence is a client component.
 */

import { ALICANTE_DAY } from "@/lib/fixtures/curated/alicante";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { LISBON_DAY } from "@/lib/fixtures/curated/lisbon";
import { CROWDED_DAY, LATE_NIGHT_DAY, MINIMAL_DAY } from "@/lib/fixtures/edge/edge-days";
import { dayText } from "@/lib/stream/simulate-day-stream";
import { hasEnergy, type DayDraft, type StopDraft } from "./day-draft";
import {
  draftAt,
  frameBefore,
  itineraryOf,
  pageFrameOf,
  windowAround,
  type ExampleDay,
  type StopRowStill,
} from "./stop-row-examples";
import { stopIdAt } from "@/lib/schema/positions";

/** A fixture day a silence is shown on. */
export interface SilenceDay {
  label: string;
  fixture: ExampleDay;
}

/**
 * The three days a visitor opens, and the edge days whose page frame none of them has:
 * twelve stops to midnight, one stop in a slow day, and a night that runs on to four. The
 * edge day of an eight-hour stop is framed as Kyoto and Alicante are, so it is left out.
 */
export const SILENCE_DAYS: readonly SilenceDay[] = [
  { label: "Kyoto", fixture: KYOTO_DAY },
  { label: "Alicante", fixture: ALICANTE_DAY },
  { label: "Lisbon", fixture: LISBON_DAY },
  { label: "twelve stops, to midnight", fixture: CROWDED_DAY },
  { label: "one stop", fixture: MINIMAL_DAY },
  { label: "a night past midnight", fixture: LATE_NIGHT_DAY },
];

/**
 * The stream's silences after a stop, in the order they come: its pause before the plan's
 * middle stop, as a live model's stream pauses there (`dayTextOffsets`); the middle stop
 * placed and named but bare, its words waiting for its bead, which waits for its light; and
 * its pause before the versions, after the last stop.
 */
export const SILENCE_MOMENTS = [
  { label: "a silence after a stop", key: "after-stop" },
  { label: "a row bare in a silence, waiting for its light", key: "bare-row" },
  { label: "a silence after the last stop", key: "after-last" },
] as const;

export type SilenceMoment = (typeof SILENCE_MOMENTS)[number]["key"];

/** A silence the day reaches, drawn as the page draws it; or why the day never reaches it. */
export type SilenceStill = StopRowStill | { unreached: string };

/** Why a day of one stop has no silence after a stop but its last. */
export const ONE_STOP =
  "This day has one stop, so its one silence after a stop is the one after its last.";

/** Whether the stop with this index has been placed. */
function hasStop(draft: DayDraft, index: number): boolean {
  return draft.stops.some((stop) => stop.id === stopIdAt(index));
}

/** Whether a stop is placed and weighed. */
function isWeighed(stop: StopDraft | undefined): boolean {
  return stop !== undefined && hasEnergy(stop);
}

/** Whether any stop's versions have started to arrive. */
function hasVersions(draft: DayDraft): boolean {
  return draft.stops.some((stop) => stop.alternatives.length > 0);
}

const stills = new Map<string, Promise<SilenceStill>>();

/**
 * A day's silence: the frame of its real stream before what the silence waits for arrives,
 * read as the page reads it. The silence is the day's, not a stop's: its line stands under
 * the day's last row, so the cell shows the last rows written, on the page's frame of the
 * day at that moment. Worked out once, since both themes and widths show the same frame.
 */
export function silenceOf(day: SilenceDay, moment: SilenceMoment): Promise<SilenceStill> {
  const key = `${day.label}:${moment}`;
  const known = stills.get(key);
  if (known) return known;
  const still = (async (): Promise<SilenceStill> => {
    const { fixture } = day;
    const middle = Math.floor(fixture.day.stops.length / 2);
    // A day of one stop pauses before it: the stop after its pause is its last.
    if (moment === "after-stop" && middle === 0) return { unreached: ONE_STOP };
    const itinerary = itineraryOf(fixture);
    const text = dayText(fixture.day);
    const at = await frameBefore(text, (draft) => {
      if (moment === "after-stop") return hasStop(draft, middle);
      if (moment === "bare-row") return isWeighed(draft.stops[middle]);
      return hasVersions(draft);
    });
    const draft = await draftAt(text, at);
    const page = pageFrameOf(draft.stops, itinerary);
    return {
      ...windowAround(draft, draft.stops.length - 1),
      at,
      itinerary,
      frame: moment === "bare-row" ? { kind: "bare", page } : { kind: "silence", page },
    };
  })();
  stills.set(key, still);
  return still;
}
