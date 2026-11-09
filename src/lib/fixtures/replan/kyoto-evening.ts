import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import type { ReplanBasis } from "@/lib/replan/merge";
import type { DayRequest, GeneratedStop } from "@/lib/schema/itinerary.schema";
import type { GeneratedReplan } from "@/lib/schema/replan.schema";
import { KYOTO_ITINERARY } from "./kyoto-morning";

/**
 * The evening's re-plan as a fixture, beside the morning's: the written Kyoto day's end
 * changed from home by eleven to out late, which rewrites its last stop alone, the dinner on
 * Pontocho at six (`docs/targeted-replan.md`; the golden set's fourth case is the same change
 * on a Kyoto day Sonnet wrote, and the route held its window live). Written by hand, no call
 * made it: dinner moves to seven and a new last stop runs to midnight, so the day, its frame
 * and the curve's end grow past the old one.
 */

function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`The written Kyoto day has nothing at ${index}`);
  return item;
}

/** The last stop the day had: dinner along Pontocho at six. */
const LAST = at(KYOTO_DAY.day.stops, 7);

export const KYOTO_OUT_LATE: DayRequest = { ...KYOTO_DAY.request, end: "late" };

/** Dinner an hour later, across the river on Kiyamachi. */
const LATE_DINNER: GeneratedStop = {
  ...LAST,
  startTime: "19:00",
  durationMinutes: 105,
  place: {
    ...LAST.place,
    name: "Izakaya along Kiyamachi",
    kind: "food",
    neighborhood: "Kiyamachi",
    summary:
      "By seven the counters along the Takase canal are full of people off work, and the kitchens send out skewers as fast as they are ordered.",
    aesthetic: ["paper lanterns", "counter seats", "narrow canal"],
    coordinates: { lat: 35.0067, lng: 135.7703 },
    sensory: {
      energy: "lively",
      acoustic: "loud",
      crowd: "busy",
      texture:
        "Orders called back to the grill, glasses knocked together, smoke from the charcoal.",
    },
    light: {
      exposure: "interior",
      orientation: "none",
      bestWindow: "none",
      note: "Bright lights over the counter all evening; the only change is the canal outside going dark.",
    },
  },
  dependsOn: ["dinner", "end", "company"],
};

/** The new last stop: the small bars up the stairs along the same canal, until midnight. */
const LATE_BARS: GeneratedStop = {
  ...LAST,
  startTime: "21:00",
  durationMinutes: 180,
  place: {
    ...LAST.place,
    name: "Bars along the Takase canal",
    kind: "bar",
    neighborhood: "Kiyamachi",
    summary:
      "After nine the bars up the narrow stairs fill and their doors stay open, so the canal street is still busy when you head home past midnight.",
    aesthetic: ["bar signs", "lit stairways", "willows over water"],
    coordinates: { lat: 35.0061, lng: 135.7705 },
    sensory: {
      energy: "social",
      acoustic: "chatter",
      crowd: "busy",
      texture:
        "Music through open doors, people talking on the little bridges, water over the weir.",
    },
    light: {
      exposure: "open",
      orientation: "none",
      bestWindow: "after-dark",
      note: "Nothing to see here by day; after dark the signs and lanterns double in the water.",
    },
  },
  dependsOn: ["end", "company"],
};

/** Out late: dinner at seven on Kiyamachi, and the bars along the canal until midnight. */
export const KYOTO_LATE_EVENING: GeneratedReplan = {
  stops: [LATE_DINNER, LATE_BARS],
  alternatives: [
    { ...at(KYOTO_DAY.day.alternatives, 7), stopIndex: 0 },
    { stopIndex: 1, options: [] },
  ],
  dek: "Honen-in at half past seven and the canal path, Murin-an at ten, tofu, the museum and matcha, Gion at dusk, then dinner on Kiyamachi at seven and the bars along the canal until midnight.",
};

/** What the page and the server hold before the late evening streams: its first re-plan. */
export const KYOTO_EVENING_BASIS: ReplanBasis = {
  itinerary: KYOTO_ITINERARY,
  request: KYOTO_OUT_LATE,
  changed: "end",
  windows: [{ from: 7, to: 7 }],
  idPrefix: "r1",
};
