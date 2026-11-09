import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { normalizeDay } from "@/lib/normalizer/normalize";
import type { ReplanBasis } from "@/lib/replan/merge";
import type {
  DayRequest,
  GeneratedAlternative,
  GeneratedStop,
  Itinerary,
} from "@/lib/schema/itinerary.schema";
import type { GeneratedReplan } from "@/lib/schema/replan.schema";

/**
 * The owner's case as a fixture (`docs/targeted-replan.md`): the written Kyoto day, its start
 * changed from early to slow, and a re-plan of its morning, the two stops before the garden at
 * ten, written by hand. No call made it; it is a re-plan as `GeneratedReplanSchema` allows.
 */

function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`The written Kyoto day has nothing at ${index}`);
  return item;
}

const normalized = normalizeDay(KYOTO_DAY.request, KYOTO_DAY.day);
if (!normalized.ok) throw new Error("The written Kyoto day normalizes");

/** The written Kyoto day as the page holds it. */
export const KYOTO_ITINERARY: Itinerary = normalized.itinerary;

export const KYOTO_SLOW_START: DayRequest = { ...KYOTO_DAY.request, start: "slow" };

/** The temple a slow morning starts at, at nine, in place of Honen-in at half past seven. */
function shorenIn(startTime: string, minutes: number): GeneratedStop {
  const temple = at(KYOTO_DAY.day.stops, 0);
  return {
    ...temple,
    startTime,
    durationMinutes: minutes,
    place: {
      ...temple.place,
      name: "Shoren-in",
      kind: "sacred",
      neighborhood: "Awataguchi",
      summary:
        "The gates open at nine, and in the first hour the veranda over the pond garden is quiet enough to sit on with only the gardeners about.",
      aesthetic: ["camphor trees", "tatami veranda", "pond garden"],
      coordinates: { lat: 35.0093, lng: 135.7829 },
      sensory: {
        energy: "reflective",
        acoustic: "hushed",
        crowd: "sparse",
        texture:
          "Socks on polished boards, water falling into the pond, a gardener's shears outside.",
      },
      light: {
        exposure: "covered",
        orientation: "e",
        bestWindow: "morning",
        note: "The veranda faces the garden to the east, so the morning sun reaches into the rooms; after noon they are in shade.",
      },
    },
  };
}

/** The shrine up the slope behind Shoren-in, a stop of its own rather than the canal walk. */
function awataShrine(startTime: string, minutes: number): GeneratedStop {
  const temple = at(KYOTO_DAY.day.stops, 0);
  return {
    ...temple,
    startTime,
    durationMinutes: minutes,
    place: {
      ...temple.place,
      name: "Awata Shrine",
      kind: "sacred",
      neighborhood: "Awataguchi",
      summary:
        "Up the stone steps behind Shoren-in before ten, while the courtyard is still being swept and nobody else has made the climb.",
      aesthetic: ["vermilion gate", "stone steps", "cedar slope"],
      coordinates: { lat: 35.0086, lng: 135.7871 },
      sensory: {
        energy: "reflective",
        acoustic: "hushed",
        crowd: "empty",
        texture:
          "A rake on the gravel, the bell rope knocking on its box, traffic far below on Sanjo.",
      },
      light: {
        exposure: "dappled",
        orientation: "w",
        bestWindow: "afternoon",
        note: "The slope faces west, so the courtyard keeps the cedars' shade all morning and takes the sun only after lunch.",
      },
    },
    dependsOn: ["start"],
  };
}

/** The canal down to the garden's gate, a short walk of its own. */
function okazakiCanal(startTime: string, minutes: number): GeneratedStop {
  const walk = at(KYOTO_DAY.day.stops, 1);
  return {
    ...walk,
    startTime,
    durationMinutes: minutes,
    place: {
      ...walk.place,
      name: "Okazaki Canal",
      kind: "walk",
      neighborhood: "Okazaki",
      summary:
        "Ten minutes along the wide canal to Murin-an's gate, the banks still empty enough at a quarter to ten to walk at the water's edge.",
      aesthetic: ["stone embankment", "willows", "wide water"],
      coordinates: { lat: 35.0119, lng: 135.7836 },
      sensory: {
        energy: "calm",
        acoustic: "murmur",
        crowd: "sparse",
        texture: "Fast water at the lock gate, a few joggers, bicycle bells on the bridge.",
      },
      light: {
        exposure: "open",
        orientation: "e",
        bestWindow: "morning",
        note: "The canal runs east to west, so the low sun lies along the water until about ten; by noon the banks are in full glare.",
      },
    },
    dependsOn: ["travel"],
  };
}

/** A slow morning: a temple at nine and the shrine above it, both done before ten. */
export const KYOTO_SLOW_MORNING: GeneratedReplan = {
  stops: [shorenIn("09:00", 35), awataShrine("09:40", 15)],
  alternatives: [{ ...at(KYOTO_DAY.day.alternatives, 0), stopIndex: 0 }],
  dek: "Shoren-in at nine and the shrine above it, then the garden at ten and the day as before.",
};

/**
 * A slow morning of one stop where the day had two: the old morning gives way to fewer rows,
 * so the rows below rise by the difference.
 */
export const KYOTO_SLOW_MORNING_ONE: GeneratedReplan = {
  stops: [shorenIn("09:00", 50)],
  alternatives: [{ ...at(KYOTO_DAY.day.alternatives, 0), stopIndex: 0 }],
  dek: "Shoren-in at nine, then the garden at ten and the day as before.",
};

/**
 * A slow morning of three stops where the day had two: the third has no old row to take the
 * turn of, so the rows below make room for it.
 */
export const KYOTO_SLOW_MORNING_THREE: GeneratedReplan = {
  stops: [shorenIn("09:00", 20), awataShrine("09:22", 15), okazakiCanal("09:40", 15)],
  alternatives: [{ ...at(KYOTO_DAY.day.alternatives, 0), stopIndex: 0 }],
  dek: "Shoren-in at nine, the shrine above it and the canal down to the garden at ten.",
};

/** A version written for a new stop of the slow morning, from the written day's first option. */
function versionNear(
  name: string,
  coordinates: { lat: number; lng: number },
  energy: GeneratedAlternative["sensory"]["energy"],
  summary: string,
  reason: string,
): GeneratedAlternative {
  const option = at(at(KYOTO_DAY.day.alternatives, 0).options, 0);
  return {
    ...option,
    name,
    kind: "sacred",
    neighborhood: "Higashiyama",
    coordinates,
    sensory: { ...option.sensory, energy },
    summary,
    reason,
  };
}

/**
 * The slow morning with versions of its own: one beside each new stop, within the walk, and
 * one past it, which the merge drops and the stream must never draw. The other slow mornings
 * reuse the written day's first versions, which stand by Honen-in, too far from Shoren-in to
 * keep, so their new stops draw none.
 */
export const KYOTO_SLOW_MORNING_WITH_VERSIONS: GeneratedReplan = {
  stops: [shorenIn("09:00", 35), awataShrine("09:40", 15)],
  alternatives: [
    {
      stopIndex: 0,
      options: [
        versionNear(
          "Chion-in",
          // About 420 m south of Shoren-in.
          { lat: 35.0055, lng: 135.7826 },
          "calm",
          "The great gate is open from nine and the steps up to it fill slowly, so the first hour is the one to climb them.",
          "The same temple slope at nine, with a bigger gate and more people on the steps instead of the veranda.",
        ),
        versionNear(
          "Kiyomizu-dera",
          // About 1.6 km south, past the walk a version may be from its stop.
          { lat: 34.9949, lng: 135.785 },
          "lively",
          "The stage over the valley at nine, before the school groups arrive at ten.",
          "A temple at nine still, on a busier hill instead of a quiet one.",
        ),
      ],
    },
    {
      stopIndex: 1,
      options: [
        versionNear(
          "Okazaki Park",
          // About 630 m north of Awata Shrine.
          { lat: 35.0136, lng: 135.7838 },
          "calm",
          "The open lawns before ten, when the museums have not opened and only dog walkers cross them.",
          "The same quiet quarter of an hour before ten, on open grass instead of the shrine's steps.",
        ),
      ],
    },
  ],
  dek: "Shoren-in at nine and the shrine above it, then the garden at ten and the day as before.",
};

/** What the page and the server hold before the slow morning streams: its first re-plan. */
export const KYOTO_MORNING_BASIS: ReplanBasis = {
  itinerary: KYOTO_ITINERARY,
  request: KYOTO_SLOW_START,
  changed: "start",
  windows: [{ from: 0, to: 1 }],
  idPrefix: "r1",
};
