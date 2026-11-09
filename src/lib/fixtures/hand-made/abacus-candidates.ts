import type { Alternative, Itinerary } from "@/lib/schema/itinerary.schema";
import { ALICANTE_SKETCH } from "./alicante-sketch";

/**
 * The Alicante day with candidates: every stop keeps the hand-written day's primary and gets
 * a quieter and a livelier version of the same kind of stop nearby. A stop at an end of
 * the energy scale gets only the version toward the middle. Concept-only: the alternative
 * places are real, but their hours, exact entrances and character were not checked, except
 * Churrería Santa Faz's, which opens at seven every day (October 2026).
 */

type AlternativeFields = Omit<Alternative, "id">;

interface StopCandidates {
  quieter?: AlternativeFields;
  livelier?: AlternativeFields;
}

const CANDIDATES: readonly StopCandidates[] = [
  {
    livelier: {
      name: "Churros in the old town",
      kind: "coffee",
      neighborhood: "Casco Antiguo",
      summary:
        "Chocolate and churros as the city wakes up, along Calle Mayor a street back from the sea.",
      aesthetic: ["churro counters", "small tables"],
      coordinates: { lat: 38.3449, lng: -0.4822 },
      sensory: {
        energy: "calm",
        acoustic: "murmur",
        crowd: "sparse",
        texture: "Cups on saucers, the churro fryer, early regulars.",
      },
      light: {
        exposure: "interior",
        orientation: null,
        bestWindow: null,
        note: "Indoor light; the sunrise happens without you.",
      },
      reason: "Still an early start near the sea, traded for a warm room and breakfast.",
    },
  },
  {
    quieter: {
      name: "Basílica de Santa María",
      kind: "sacred",
      neighborhood: "Casco Antiguo",
      summary: "The city's oldest church, Gothic behind a baroque front, cool and nearly empty.",
      aesthetic: ["gothic stone", "baroque portal"],
      coordinates: { lat: 38.3456, lng: -0.4797 },
      sensory: {
        energy: "reflective",
        acoustic: "hushed",
        crowd: "empty",
        texture: "Your footsteps on stone, a door closing somewhere.",
      },
      light: {
        exposure: "interior",
        orientation: null,
        bestWindow: null,
        note: "Dim inside; the high windows let the light in as shafts.",
      },
      reason: "The same old quarter, indoors and silent instead of out on the steps.",
    },
    livelier: {
      name: "Calle Mayor",
      kind: "walk",
      neighborhood: "Casco Antiguo",
      summary: "The old town's main street as the cafés put their tables out.",
      aesthetic: ["stone paving", "café tables", "iron balconies"],
      coordinates: { lat: 38.3449, lng: -0.4823 },
      sensory: {
        energy: "balanced",
        acoustic: "chatter",
        crowd: "steady",
        texture: "Shutters rolling up, coffee cups, a delivery van.",
      },
      light: {
        exposure: "open",
        orientation: null,
        bestWindow: "midday",
        note: "A narrow street: the sun reaches the paving only around noon.",
      },
      reason: "The same old town, on its busiest street instead of its quietest.",
    },
  },
  {
    quieter: {
      name: "MUBAG",
      kind: "museum",
      neighborhood: "Casco Antiguo",
      summary: "Fine art in an 18th-century palace at the foot of the castle hill.",
      aesthetic: ["palace rooms", "oil paintings"],
      coordinates: { lat: 38.3449, lng: -0.4814 },
      sensory: {
        energy: "calm",
        acoustic: "hushed",
        crowd: "sparse",
        texture: "Parquet floors, low voices, an attendant's radio.",
      },
      light: {
        exposure: "interior",
        orientation: null,
        bestWindow: null,
        note: "Gallery light; the courtyard gets sun late in the morning.",
      },
      reason: "History again, indoors and unhurried instead of up on the walls.",
    },
    livelier: {
      name: "Rambla de Méndez Núñez",
      kind: "walk",
      neighborhood: "Centro",
      summary: "The main avenue below the hill, busy with Saturday shoppers.",
      aesthetic: ["wide avenue", "kiosks"],
      coordinates: { lat: 38.3455, lng: -0.4858 },
      sensory: {
        energy: "lively",
        acoustic: "chatter",
        crowd: "busy",
        texture: "Buses, shop doors, a busker near the corner.",
      },
      light: {
        exposure: "open",
        orientation: "s",
        bestWindow: "morning",
        note: "It runs north to south, so the sun reaches the middle by mid-morning.",
      },
      reason: "Still a walk with the castle above you, in the crowd instead of over it.",
    },
  },
  {
    quieter: {
      name: "Pastries around Luceros",
      kind: "coffee",
      neighborhood: "Centro",
      summary: "Café terraces around the fountain square a few streets from the market.",
      aesthetic: ["fountain", "café terraces"],
      coordinates: { lat: 38.3466, lng: -0.4905 },
      sensory: {
        energy: "balanced",
        acoustic: "murmur",
        crowd: "steady",
        texture: "The fountain, traffic around it, cups on the tables.",
      },
      light: {
        exposure: "open",
        orientation: null,
        bestWindow: "midday",
        note: "Full sun in the middle of the day; the terraces have umbrellas.",
      },
      reason: "The same Saturday centre, watched from a terrace instead of from the crowd.",
    },
    livelier: {
      name: "Vermouth on Calle Castaños",
      kind: "bar",
      neighborhood: "Centro",
      summary: "The tapas street filling up for the Saturday vermouth.",
      aesthetic: ["tapas bars", "terraces"],
      coordinates: { lat: 38.3457, lng: -0.4864 },
      sensory: {
        energy: "social",
        acoustic: "loud",
        crowd: "packed",
        texture: "Glasses, shouted orders, someone's birthday.",
      },
      light: {
        exposure: "open",
        orientation: null,
        bestWindow: "midday",
        note: "A narrow street, in shade by early afternoon.",
      },
      reason: "Still eating your way through the centre, in the street instead of the stalls.",
    },
  },
  {
    quieter: {
      name: "Arroz a banda by the port",
      kind: "food",
      neighborhood: "Puerto",
      summary: "Rice and local wine in the quieter dining rooms along the port.",
      aesthetic: ["white linen", "harbour view"],
      coordinates: { lat: 38.3405, lng: -0.4825 },
      sensory: {
        energy: "reflective",
        acoustic: "hushed",
        crowd: "sparse",
        texture: "Cutlery, low talk, the harbour behind glass.",
      },
      light: {
        exposure: "interior",
        orientation: null,
        bestWindow: "midday",
        note: "Big windows onto the harbour: bright, never harsh.",
      },
      reason: "Rice by the port again, slower and quieter, in courses instead of one pan.",
    },
    livelier: {
      name: "Tapas on San Fernando",
      kind: "food",
      neighborhood: "Centro",
      summary: "Packed counters in the centre, with rice and wine by the glass.",
      aesthetic: ["long counters", "wine shelves"],
      coordinates: { lat: 38.3447, lng: -0.4842 },
      sensory: {
        energy: "lively",
        acoustic: "chatter",
        crowd: "busy",
        texture: "Full counters, plates landing, everyone talking at once.",
      },
      light: {
        exposure: "interior",
        orientation: null,
        bestWindow: null,
        note: "Warm indoor light; the street outside is in shade.",
      },
      reason: "Rice for lunch still, at a crowded counter instead of a table on the water.",
    },
  },
  {
    livelier: {
      name: "Horchata by Santa María",
      kind: "coffee",
      neighborhood: "Casco Antiguo",
      summary: "Horchata at the café tables on the square outside the museum, in the late sun.",
      aesthetic: ["baroque facade", "café tables"],
      coordinates: { lat: 38.3457, lng: -0.4799 },
      sensory: {
        energy: "calm",
        acoustic: "murmur",
        crowd: "sparse",
        texture: "Pigeons, a guitar from a doorway, cups on a tray.",
      },
      light: {
        exposure: "open",
        orientation: "w",
        bestWindow: "afternoon",
        note: "The basilica's front catches the low sun after four.",
      },
      reason: "The same corner of the old town, outside in the sun instead of in the galleries.",
    },
  },
  {
    quieter: {
      name: "Parque de Canalejas",
      kind: "garden",
      neighborhood: "Centro",
      summary: "Old ficus trees and benches by the port, at the quiet end of the promenade.",
      aesthetic: ["ficus roots", "stone benches"],
      coordinates: { lat: 38.3412, lng: -0.4878 },
      sensory: {
        energy: "calm",
        acoustic: "murmur",
        crowd: "sparse",
        texture: "Leaves, a dog walker, ropes knocking in the port.",
      },
      light: {
        exposure: "dappled",
        orientation: "w",
        bestWindow: "sunset",
        note: "Low sun comes through the ficus canopy in long stripes.",
      },
      reason: "Still by the sea at sunset, under the trees instead of on the promenade.",
    },
    livelier: {
      name: "Ice cream on the Explanada",
      kind: "food",
      neighborhood: "Centro",
      summary: "Busy ice cream and horchata counters along the promenade, under their awnings.",
      aesthetic: ["horchata", "awning"],
      coordinates: { lat: 38.3427, lng: -0.4845 },
      sensory: {
        energy: "lively",
        acoustic: "chatter",
        crowd: "busy",
        texture: "A queue, the scoop on the tub, children deciding.",
      },
      light: {
        exposure: "covered",
        orientation: "s",
        bestWindow: "sunset",
        note: "Under the awnings, with the promenade in full sunset in front of you.",
      },
      reason: "The same promenade at sunset, in the horchata queue instead of on a stroll.",
    },
  },
  {
    quieter: {
      name: "Rice dishes on Óscar Esplá",
      kind: "food",
      neighborhood: "Ensanche",
      summary:
        "Dining rooms of rice and grilled fish along the avenue, still filling at nine, early for an Alicante dinner, so a table comes without a long wait.",
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
        orientation: null,
        bestWindow: "after-dark",
        note: "Warm lamps; the street is dark by now.",
      },
      reason:
        "Dinner at nine again, sitting at a table instead of standing three deep at the counter.",
    },
  },
];

/** Quieter first, as the schema asks; ids are positions in the set, as the normalizer's. */
function alternativesFor(stopId: string, candidates: StopCandidates | undefined): Alternative[] {
  const versions = [candidates?.quieter, candidates?.livelier].flatMap((place) =>
    place ? [place] : [],
  );
  return versions.map((place, n) => ({ id: `${stopId}:a${n + 1}`, ...place }));
}

export const ABACUS_DAY: Itinerary = {
  ...ALICANTE_SKETCH,
  stops: ALICANTE_SKETCH.stops.map((stop, index) => ({
    ...stop,
    alternatives: alternativesFor(stop.id, CANDIDATES[index]),
  })),
};

/** Weather is a fact from code, not from the model; a fixture until MVP. */
export const ABACUS_WEATHER = "dry, 19°";
