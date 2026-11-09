import type { GeneratedPlace } from "@/lib/schema/itinerary.schema";
import { ALICANTE_SKETCH } from "@/lib/fixtures/hand-made/alicante-sketch";
import type { GeneratedOption } from "@/features/abacus/day-draft";
import type { Recomposition } from "./recompose";
import { toGeneratedPlace } from "./stream";

/**
 * How the evening re-composes for each answer about it: who is coming, dinner and the
 * end of the night. Every one rewrites only dinner, the stop that depends on them. The
 * places are real and were checked to serve dinner on a Saturday at the times they are
 * given here (October 2026): the early dinners start at half past eight because Racó del
 * Plà and La Ereta open then. Entrances, coordinates and character were not checked.
 */

const DINNER = "stop-7";

const NOU_MANOLIN = toGeneratedPlace(ALICANTE_SKETCH.stops[7]!.primary);

const EL_BUEN_COMER: GeneratedPlace = {
  name: "Rice on Calle Mayor",
  kind: "food",
  neighborhood: "Casco Antiguo",
  summary:
    "Old-town dining rooms along Calle Mayor, with rice, grilled fish and croquetas and a table for everyone.",
  aesthetic: ["dining rooms", "long tables"],
  coordinates: { lat: 38.3447, lng: -0.4817 },
  sensory: {
    energy: "balanced",
    acoustic: "chatter",
    crowd: "steady",
    texture: "Plates passed across long tables, children allowed to be children.",
  },
  light: {
    exposure: "interior",
    orientation: "none",
    bestWindow: "after-dark",
    note: "Warm room light; the old town is dark outside by eight.",
  },
};

const RACO_DEL_PLA: GeneratedPlace = {
  name: "Rice dishes in El Pla",
  kind: "food",
  neighborhood: "El Pla",
  summary:
    "Traditional rice houses a short walk inland that serve from half past eight, before the city sits down.",
  aesthetic: ["rice pans", "white tablecloths"],
  coordinates: { lat: 38.3498, lng: -0.4823 },
  sensory: {
    energy: "calm",
    acoustic: "murmur",
    crowd: "sparse",
    texture: "Pans set down on the tables, quiet regulars, nobody in a hurry.",
  },
  light: {
    exposure: "interior",
    orientation: "none",
    bestWindow: "after-dark",
    note: "Lamplight over the tables; the street outside is quiet.",
  },
};

const PIRIPI: GeneratedPlace = {
  name: "Rice dishes on Óscar Esplá",
  kind: "food",
  neighborhood: "Ensanche",
  summary:
    "Dining rooms of rice and grilled fish along the avenue, their tables big enough to share and still filling at nine.",
  aesthetic: ["wood panelling", "white tablecloths"],
  coordinates: { lat: 38.3448, lng: -0.4935 },
  sensory: {
    energy: "lively",
    acoustic: "chatter",
    crowd: "busy",
    texture: "A full room, but you can hear your own table.",
  },
  light: {
    exposure: "interior",
    orientation: "none",
    bestWindow: "after-dark",
    note: "Warm lamps; the street is dark by now.",
  },
};

const LA_ERETA: GeneratedPlace = {
  name: "Plates below the castle",
  kind: "food",
  neighborhood: "Casco Antiguo",
  summary:
    "Dining rooms on the castle's slope, with the city's lights spread out below their windows.",
  aesthetic: ["glass walls", "city view"],
  coordinates: { lat: 38.3462, lng: -0.479 },
  sensory: {
    energy: "reflective",
    acoustic: "hushed",
    crowd: "sparse",
    texture: "Cutlery, low voices, the city silent behind the glass.",
  },
  light: {
    exposure: "interior",
    orientation: "w",
    bestWindow: "after-dark",
    note: "The city lit below the windows; low lamps inside.",
  },
};

const EL_PORTAL: GeneratedPlace = {
  name: "Wine and tapas on Bilbao",
  kind: "bar",
  neighborhood: "Centro",
  summary:
    "Wine by the glass and small plates along the street, busy at the counters, with quieter corners behind.",
  aesthetic: ["wine shelves", "marble counters"],
  coordinates: { lat: 38.3449, lng: -0.4857 },
  sensory: {
    energy: "balanced",
    acoustic: "chatter",
    crowd: "steady",
    texture: "Corks, a low playlist, glasses set down on marble.",
  },
  light: {
    exposure: "interior",
    orientation: "none",
    bestWindow: "after-dark",
    note: "Low, warm light; the street outside is dark.",
  },
};

const SENTO: GeneratedPlace = {
  name: "Montaditos in the old town",
  kind: "bar",
  neighborhood: "Casco Antiguo",
  summary:
    "Narrow bars of montaditos in the old town, where a stool at the counter comes quickly on your own.",
  aesthetic: ["steel counters", "beer taps"],
  coordinates: { lat: 38.3472, lng: -0.4831 },
  sensory: {
    energy: "lively",
    acoustic: "chatter",
    crowd: "busy",
    texture: "The plancha hissing, beer taps, orders called down the counter.",
  },
  light: {
    exposure: "interior",
    orientation: "none",
    bestWindow: "after-dark",
    note: "Bright bar light, the street dark behind the door.",
  },
};

const EL_BARRIO: GeneratedPlace = {
  name: "El Barrio",
  kind: "walk",
  neighborhood: "Casco Antiguo",
  summary:
    "The old town's bar streets: tapas at one open door, a drink at the next, until midnight.",
  aesthetic: ["narrow lanes", "open doors"],
  coordinates: { lat: 38.3455, lng: -0.481 },
  sensory: {
    energy: "social",
    acoustic: "loud",
    crowd: "packed",
    texture: "Music from three bars at once, glasses on window ledges, a crowd in the lane.",
  },
  light: {
    exposure: "open",
    orientation: "none",
    bestWindow: "after-dark",
    note: "Street lamps and bar doors; the castle lit above the roofs.",
  },
};

const version = (place: GeneratedPlace, reason: string): GeneratedOption => ({ ...place, reason });

interface Dinner {
  startTime: string;
  durationMinutes: number;
  place: GeneratedPlace;
  versions: GeneratedOption[];
}

/**
 * An evening answer: dinner written again, its versions, and the evening's fragment of the
 * line about the day, which closes it.
 */
function evening(
  answer: Recomposition["answer"],
  consequence: string,
  { startTime, durationMinutes, place, versions }: Dinner,
  evening: string,
  revisions: Recomposition["generation"]["revisions"] = [],
): Recomposition {
  return {
    answer,
    consequence,
    generation: {
      revisions,
      stops: [{ id: DINNER, startTime, durationMinutes, place }],
      alternatives: [{ stopId: DINNER, options: versions }],
      dekPart: "evening",
      dek: evening,
    },
  };
}

/**
 * With family, the hero: Lantern revises "eating late" to an early dinner, and dinner moves
 * from a counter three deep at nine to a table for everyone at half past eight.
 */
export const WITH_FAMILY = evening(
  { key: "company", value: "family" },
  "dinner at half past eight, at a table",
  {
    startTime: "20:30",
    durationMinutes: 90,
    place: EL_BUEN_COMER,
    versions: [
      version(RACO_DEL_PLA, "Still a family table at half past eight, in a quieter room inland."),
      version(PIRIPI, "The tapas bar's own kitchen, at a table big enough for everyone."),
    ],
  },
  "a table for everyone in the old town at half past eight",
  [{ key: "dinner", value: "early", reason: "an earlier dinner suits a family" }],
);

export const EVENING_RECOMPOSITIONS: readonly Recomposition[] = [
  evening(
    { key: "company", value: "alone" },
    "a stool at the counter",
    {
      startTime: "21:00",
      durationMinutes: 90,
      place: SENTO,
      versions: [
        version(LA_ERETA, "Dinner on your own still, slower, at a window over the city."),
        version(NOU_MANOLIN, "The busiest counter in town, where nobody notices you came alone."),
      ],
    },
    "montaditos on a stool at the counter after nine",
  ),
  evening(
    { key: "company", value: "partner" },
    "a corner for two",
    {
      startTime: "21:00",
      durationMinutes: 120,
      place: EL_PORTAL,
      versions: [
        version(LA_ERETA, "Still dinner for two, slower, with the city lit below."),
        version(NOU_MANOLIN, "Tapas for two, standing at the busiest counter in town."),
      ],
    },
    "a corner for two in a wine bar after nine",
  ),
  WITH_FAMILY,
  evening(
    { key: "company", value: "friends" },
    "plates to share",
    {
      startTime: "21:00",
      durationMinutes: 120,
      place: PIRIPI,
      versions: [
        version(EL_PORTAL, "Small plates to share still, around a wine list instead of a table."),
        version(NOU_MANOLIN, "Plates to share still, standing three deep at the counter."),
      ],
    },
    "a long table of plates to share after nine",
  ),
  evening(
    { key: "dinner", value: "early" },
    "dinner at half past eight",
    {
      startTime: "20:30",
      durationMinutes: 90,
      place: RACO_DEL_PLA,
      versions: [
        version(LA_ERETA, "Still at half past eight, slower: a tasting menu over the city."),
        version(
          EL_BUEN_COMER,
          "Still at half past eight, in a busier dining room in the old town.",
        ),
      ],
    },
    "a quiet dinner inland at half past eight, before the city sits down",
  ),
  evening(
    { key: "end", value: "late" },
    "El Barrio until midnight",
    {
      startTime: "21:00",
      durationMinutes: 180,
      place: EL_BARRIO,
      versions: [
        version(EL_PORTAL, "A late night still, with a glass at a wine bar instead of the lanes."),
      ],
    },
    "tapas from bar to bar in El Barrio until midnight",
  ),
];
