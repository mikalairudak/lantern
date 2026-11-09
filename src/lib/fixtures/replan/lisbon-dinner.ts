import type { GeneratedStop } from "@/lib/schema/itinerary.schema";
import type { GeneratedReplan } from "@/lib/schema/replan.schema";

/**
 * The golden set's third case as the re-plan bench plays it (`golden-replans.jsonl`, "dinner:
 * early to late"): Sonnet's calm Lisbon Saturday for two, its dinner changed from early to
 * eating late, which rewrites its last two stops, the seafood at half past five and the walk
 * at seven, so both leave at the day's end. Written by hand, no call made it: a viewpoint at
 * dusk, then dinner after nine, which ends the day later than before.
 */

const DUSK_VIEW: GeneratedStop = {
  startTime: "18:00",
  durationMinutes: 60,
  place: {
    name: "Miradouro de São Pedro de Alcântara",
    kind: "viewpoint",
    neighborhood: "Bairro Alto",
    summary:
      "The garden terrace across the valley from the castle, for the hour the sun goes down behind you and the whole of Alfama turns orange.",
    aesthetic: ["garden terrace", "stone balustrade", "red roofs"],
    coordinates: { lat: 38.7155, lng: -9.1442 },
    sensory: {
      energy: "calm",
      acoustic: "murmur",
      crowd: "steady",
      texture: "Low talk along the balustrade, a busker's guitar, the funicular bell below.",
    },
    light: {
      exposure: "open",
      orientation: "e",
      bestWindow: "sunset",
      note: "The terrace looks east, so at sunset the light is behind you and full on the castle and Alfama across the valley.",
    },
  },
  dependsOn: ["dinner", "company"],
};

const LATE_DINNER: GeneratedStop = {
  startTime: "21:00",
  durationMinutes: 90,
  place: {
    name: "Petiscos in Alfama",
    kind: "food",
    neighborhood: "Alfama",
    summary:
      "After nine the small taverns below the cathedral fill again, so a late table means plates of clams and grilled sardines with the street still awake outside.",
    aesthetic: ["tiled walls", "paper tablecloths", "narrow lanes"],
    coordinates: { lat: 38.7108, lng: -9.1312 },
    sensory: {
      energy: "balanced",
      acoustic: "chatter",
      crowd: "busy",
      texture:
        "Plates called out from the kitchen, wine poured at the next table, fado through a door.",
    },
    light: {
      exposure: "interior",
      orientation: "none",
      bestWindow: "none",
      note: "Warm lamps over the tables all evening; the lane outside is lit only by doorways after dark.",
    },
  },
  dependsOn: ["dinner", "end", "company"],
};

/** Eating late: the viewpoint at dusk, then dinner after nine. */
export const LISBON_LATE_DINNER: GeneratedReplan = {
  stops: [DUSK_VIEW, LATE_DINNER],
  alternatives: [
    { stopIndex: 0, options: [] },
    { stopIndex: 1, options: [] },
  ],
  dek: "A calm Saturday for two that starts with coffee and a river-view walk at half past seven, crosses Alfama and Graça on foot for a viewpoint and a long lunch, and ends with the sunset from São Pedro de Alcântara and a late dinner in Alfama.",
};
