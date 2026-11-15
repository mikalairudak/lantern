import { UTRECHT_START_DAY } from "@/lib/days/written/utrecht";
import { normalizeDay } from "@/lib/normalizer/normalize";
import type { ReplanBasis } from "@/lib/replan/merge";
import type { DayRequest, GeneratedStop, Itinerary } from "@/lib/schema/itinerary.schema";
import type { GeneratedReplan } from "@/lib/schema/replan.schema";

/**
 * Utrecht's morning made early: the written Utrecht day, a slow Sunday morning from coffee on the
 * Oudegracht at ten, its start changed to early, and a re-plan of its morning written by hand. No
 * call made it; it is a re-plan as `GeneratedReplanSchema` allows. It keeps the day's two morning
 * places at earlier hours, the coffee at half past seven and the tower at half past eight, and
 * adds a park before lunch: a proposal of one new stop and two of the day's own made earlier,
 * which a list sorted by hour reads as the same coffee twice.
 */

function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`The written Utrecht day has nothing at ${index}`);
  return item;
}

const normalized = normalizeDay(UTRECHT_START_DAY.request, UTRECHT_START_DAY.day);
if (!normalized.ok) throw new Error("The written Utrecht day normalizes");

/** The written Utrecht day as the page holds it. */
export const UTRECHT_ITINERARY: Itinerary = normalized.itinerary;

/** The request with its start changed to early, as the page sends it. */
export const UTRECHT_EARLY_START: DayRequest = { ...UTRECHT_START_DAY.request, start: "early" };

const COFFEE = at(UTRECHT_START_DAY.day.stops, 0);
const TOWER = at(UTRECHT_START_DAY.day.stops, 1);

/** The coffee on the quay at half past seven, while most of the street is still shut. */
const EARLY_COFFEE: GeneratedStop = {
  ...COFFEE,
  startTime: "07:30",
  durationMinutes: 45,
  place: {
    ...COFFEE.place,
    summary:
      "On a Sunday most of the street is still shut at half past seven, and the few counters that have opened serve coffee and a warm roll to a handful of early walkers. Children have the quay to themselves for a short while before the crowd arrives.",
  },
};

/** The tower at half past eight, its slot booked ahead. */
const EARLY_TOWER: GeneratedStop = {
  ...TOWER,
  startTime: "08:30",
  durationMinutes: 60,
  place: {
    ...TOWER.place,
    summary:
      "Check the opening time for Sunday and book a slot before you set out; the climb is long and children who like stairs will enjoy it. From the top you see the canal lines and the red roofs, and the lanes you will walk later.",
  },
};

/** A park at the edge of the old centre, room to run before lunch: the morning's new stop. */
const PARK: GeneratedStop = {
  startTime: "10:00",
  durationMinutes: 90,
  place: {
    name: "Park Lepelenburg",
    kind: "garden",
    neighborhood: "Binnenstad",
    summary:
      "A park with a playground at the edge of the old centre, so it gives children room to run before a seated meal. Ten minutes on foot from the tower, with benches for the adults.",
    aesthetic: ["old city wall", "plane trees"],
    coordinates: { lat: 52.0874, lng: 5.1275 },
    sensory: {
      energy: "lively",
      acoustic: "chatter",
      crowd: "sparse",
      texture: "Children on the climbing frame, leaves underfoot, a bicycle bell on the path.",
    },
    light: {
      exposure: "open",
      orientation: "none",
      bestWindow: "morning",
      note: "The lawns lie open to the low November sun in the morning; by early afternoon the plane trees shade most of them.",
    },
  },
  dependsOn: ["start", "company"],
};

/** An early morning: the coffee and the tower before ten, then the park until lunch. */
export const UTRECHT_EARLY_MORNING: GeneratedReplan = {
  stops: [EARLY_COFFEE, EARLY_TOWER, PARK],
  alternatives: [
    { ...at(UTRECHT_START_DAY.day.alternatives, 0), stopIndex: 0 },
    { ...at(UTRECHT_START_DAY.day.alternatives, 1), stopIndex: 1 },
  ],
  dek: "Coffee on the Oudegracht at half past seven, the Domtoren at half past eight and Park Lepelenburg until lunch, then pancakes on the Domplein and the day as before.",
};

/** What the page and the server hold before the early morning streams: its first re-plan. */
export const UTRECHT_MORNING_BASIS: ReplanBasis = {
  itinerary: UTRECHT_ITINERARY,
  request: UTRECHT_EARLY_START,
  changed: "start",
  // The coffee and the tower, the morning before lunch.
  windows: [{ from: 0, to: 1 }],
  idPrefix: "r1",
};
