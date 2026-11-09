import type { GeneratedPlace } from "@/lib/schema/itinerary.schema";
import { ABACUS_DAY } from "@/lib/fixtures/hand-made/abacus-candidates";
import type { GeneratedOption } from "@/features/abacus/day-draft";
import type { DekPart } from "./dek";
import type { GeneratedRewrite, Recomposition } from "./recompose";
import { toGeneratedOption, toGeneratedPlace } from "./stream";

/**
 * How the day re-composes for answers about the morning and how to get around: a slow
 * morning rewrites the three morning stops, a tram or a taxi rewrites the walk at dusk.
 * The places are real. The two churrerías were checked to open on a Saturday morning all
 * year (October 2026); entrances, coordinates and character were not.
 */

const { stops } = ABACUS_DAY;

const CHURRERIA_SANTA_FAZ: GeneratedPlace = {
  name: "Churros in the old town",
  kind: "coffee",
  neighborhood: "Casco Antiguo",
  summary:
    "Chocolate and churros at an unhurried hour along Calle Mayor, at the foot of the old town.",
  aesthetic: ["churro counters", "small tables"],
  coordinates: { lat: 38.3449, lng: -0.4822 },
  sensory: {
    energy: "calm",
    acoustic: "murmur",
    crowd: "sparse",
    texture: "Cups on saucers, the churro fryer, a newspaper being folded.",
  },
  light: {
    exposure: "interior",
    orientation: "none",
    bestWindow: "none",
    note: "Indoor light; the narrow street outside is still in shade.",
  },
};

const PLAZA_GABRIEL_MIRO: GeneratedPlace = {
  name: "Plaza de Gabriel Miró",
  kind: "garden",
  neighborhood: "Centro",
  summary: "A square of old ficus trees around a fountain, for churros on a bench in the shade.",
  aesthetic: ["ficus trees", "fountain"],
  coordinates: { lat: 38.3437, lng: -0.4846 },
  sensory: {
    energy: "reflective",
    acoustic: "hushed",
    crowd: "empty",
    texture: "The fountain, pigeons, a street sweeper finishing up.",
  },
  light: {
    exposure: "dappled",
    orientation: "none",
    bestWindow: "morning",
    note: "Morning sun comes through the ficus in coins of light.",
  },
};

const CHURRERIA_CALDERON: GeneratedPlace = {
  name: "Churros by the market",
  kind: "coffee",
  neighborhood: "Centro",
  summary:
    "Busy churro counters in the streets around the Mercado Central, where its early shoppers stop.",
  aesthetic: ["counter", "glass cabinets"],
  coordinates: { lat: 38.3486, lng: -0.4881 },
  sensory: {
    energy: "balanced",
    acoustic: "chatter",
    crowd: "steady",
    texture: "Coffee machines, regulars greeted by name, baskets on the way to the market.",
  },
  light: {
    exposure: "interior",
    orientation: "none",
    bestWindow: "none",
    note: "Daylight from the open street doors.",
  },
};

const PLAYA_SAN_JUAN: GeneratedPlace = {
  name: "Playa de San Juan",
  kind: "walk",
  neighborhood: "San Juan",
  summary:
    "Seven kilometres of fine sand at the end of the tram line, nearly empty on a November evening.",
  aesthetic: ["fine sand", "palms", "open sea"],
  coordinates: { lat: 38.3705, lng: -0.418 },
  sensory: {
    energy: "calm",
    acoustic: "murmur",
    crowd: "sparse",
    texture: "The tram bell behind you, long low waves, a dog chasing gulls.",
  },
  light: {
    exposure: "open",
    orientation: "e",
    bestWindow: "sunset",
    note: "The sun sets behind the town; the sand and the sea turn pink.",
  },
};

const ALBUFERETA: GeneratedPlace = {
  name: "Playa de la Albufereta",
  kind: "viewpoint",
  neighborhood: "La Albufereta",
  summary: "A small cove two tram stops short of San Juan, under the hill of the Roman town.",
  aesthetic: ["small cove", "rocks"],
  coordinates: { lat: 38.359, lng: -0.4445 },
  sensory: {
    energy: "reflective",
    acoustic: "hushed",
    crowd: "empty",
    texture: "Water in the rocks, a fisherman's line, the tram passing above.",
  },
  light: {
    exposure: "open",
    orientation: "se",
    bestWindow: "sunset",
    note: "The cove falls into shade first; the sea holds the light longer.",
  },
};

const AVENIDA_NIZA: GeneratedPlace = {
  name: "Avenida de Niza",
  kind: "walk",
  neighborhood: "San Juan",
  summary: "The road behind San Juan beach, its terraces filling up as the light goes.",
  aesthetic: ["beach terraces", "palms"],
  coordinates: { lat: 38.3745, lng: -0.4135 },
  sensory: {
    energy: "balanced",
    acoustic: "chatter",
    crowd: "steady",
    texture: "Chairs scraping, a waiter crossing the road with a tray, the sea past the wall.",
  },
  light: {
    exposure: "open",
    orientation: "e",
    bestWindow: "sunset",
    note: "The terraces face the sea; the sky behind the town goes orange.",
  },
};

const CABO_HUERTAS: GeneratedPlace = {
  name: "Cabo de las Huertas",
  kind: "viewpoint",
  neighborhood: "Cabo de la Huerta",
  summary:
    "The rocky cape north of the city, a lighthouse over small coves, a short taxi ride out.",
  aesthetic: ["rocky coves", "lighthouse", "pines"],
  coordinates: { lat: 38.3545, lng: -0.4055 },
  sensory: {
    energy: "calm",
    acoustic: "murmur",
    crowd: "sparse",
    texture: "Waves in the rocks, wind in the pines, a fisherman's radio.",
  },
  light: {
    exposure: "open",
    orientation: "w",
    bestWindow: "sunset",
    note: "The sun sets across the bay behind the city, the castle in silhouette.",
  },
};

const SAN_FERNANDO: GeneratedPlace = {
  name: "Castillo de San Fernando",
  kind: "architecture",
  neighborhood: "Tossal",
  summary: "A second, quieter fort on the city's other hill, with Santa Bárbara across the roofs.",
  aesthetic: ["fort walls", "park paths"],
  coordinates: { lat: 38.352, lng: -0.4893 },
  sensory: {
    energy: "reflective",
    acoustic: "hushed",
    crowd: "empty",
    texture: "Gravel paths, a jogger, the city's hum from below.",
  },
  light: {
    exposure: "open",
    orientation: "e",
    bestWindow: "sunset",
    note: "Santa Bárbara's rock turns pink across the city as the sun goes.",
  },
};

const version = (place: GeneratedPlace, reason: string): GeneratedOption => ({ ...place, reason });

interface Rewrite extends GeneratedRewrite {
  versions: GeneratedOption[];
}

/** An answer's re-composition: its stops, their versions, and its part's fragment. */
function recomposition(
  answer: Recomposition["answer"],
  consequence: string,
  rewrites: readonly Rewrite[],
  dekPart: DekPart,
  dek: string,
): Recomposition {
  return {
    answer,
    consequence,
    generation: {
      revisions: [],
      stops: rewrites.map(({ id, startTime, durationMinutes, place }) => ({
        id,
        startTime,
        durationMinutes,
        place,
      })),
      alternatives: rewrites.map(({ id, versions }) => ({ stopId: id, options: versions })),
      dekPart,
      dek,
    },
  };
}

/** A stop of the first day moved to a new time, with its own versions. */
function moved(index: number, startTime: string, durationMinutes: number, id: string): Rewrite {
  const stop = stops[index]!;
  return {
    id,
    startTime,
    durationMinutes,
    place: toGeneratedPlace(stop.primary),
    versions: stop.alternatives.map(toGeneratedOption),
  };
}

/** The walk at dusk, by tram or by taxi. */
const DUSK = "stop-6";

export const DAYTIME_RECOMPOSITIONS: readonly Recomposition[] = [
  // A slow morning: no sunrise. Churros at nine, the castle before the crowds, then down
  // through Santa Cruz to the market, which keeps its time.
  recomposition(
    { key: "start", value: "slow" },
    "churros at nine",
    [
      {
        id: "stop-0",
        startTime: "09:00",
        durationMinutes: 45,
        place: CHURRERIA_SANTA_FAZ,
        versions: [
          version(PLAZA_GABRIEL_MIRO, "Churros still, taken to a bench under the trees."),
          version(CHURRERIA_CALDERON, "Churros still, at a busy counter by the market."),
        ],
      },
      moved(2, "10:00", 75, "stop-1"),
      moved(1, "11:15", 20, "stop-2"),
    ],
    "morning",
    "Churros at nine, the castle before the crowds, down through Santa Cruz to the market",
  ),
  recomposition(
    { key: "travel", value: "transit" },
    "San Juan beach at dusk",
    [
      {
        id: DUSK,
        startTime: "17:45",
        durationMinutes: 45,
        place: PLAYA_SAN_JUAN,
        versions: [
          version(
            ALBUFERETA,
            "The sea at dusk by tram still, at a small cove, not the long beach.",
          ),
          version(
            AVENIDA_NIZA,
            "The same beach at dusk, among the terraces instead of on the sand.",
          ),
        ],
      },
    ],
    "dusk",
    "the tram up the coast to San Juan at dusk",
  ),
  recomposition(
    { key: "travel", value: "taxi" },
    "the cape at sunset",
    [
      {
        id: DUSK,
        startTime: "17:35",
        durationMinutes: 45,
        place: CABO_HUERTAS,
        versions: [
          version(SAN_FERNANDO, "A view over the city at sunset still, from an empty fort."),
          version(
            AVENIDA_NIZA,
            "The coast at dusk still, among San Juan's terraces, not the rocks.",
          ),
        ],
      },
    ],
    "dusk",
    "a taxi out to the cape for the sunset",
  ),
];
