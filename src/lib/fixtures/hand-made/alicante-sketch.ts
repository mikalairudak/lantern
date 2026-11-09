import type { Itinerary, Place, Stop } from "@/lib/schema/itinerary.schema";

/**
 * A Saturday in Alicante, the abacus concept's first day, written by hand before the shared
 * fixtures. Concept-only: the shared fixtures and their normalizer belong to src/lib
 * (pre-MVP step 4). A Spanish day runs late, with lunch at two and dinner after nine, so
 * it stretches the layout further than an early day would. Coordinates are approximate
 * entrances.
 */

type PlaceFields = Omit<Place, "id">;

function stop(index: number, startTime: string, durationMinutes: number, place: PlaceFields): Stop {
  const placeId = `stop-${index}:p`;
  return {
    id: `stop-${index}`,
    startTime,
    durationMinutes,
    primary: { id: placeId, ...place },
    alternatives: [],
    selectedPlaceId: placeId,
    // What else each stop depends on lives with the abacus concept's re-compositions.
    dependsOn: ["energy"],
  };
}

export const ALICANTE_SKETCH: Itinerary = {
  dek: "Sunrise from the beach under the castle, the old town before it wakes, rice on the marina, and tapas standing up after nine.",
  city: "Alicante",
  date: "2026-11-14",
  timezone: "Europe/Madrid",
  facts: {
    energy: { value: "calm", source: "chosen" },
    travel: { value: "on-foot", source: "assumed" },
    start: { value: "early", source: "assumed" },
    dinner: { value: "late", source: "assumed" },
    end: { value: "early", source: "assumed" },
    company: { value: null, source: "asked" },
  },
  stops: [
    stop(0, "07:45", 45, {
      name: "Playa del Postiguet",
      kind: "viewpoint",
      neighborhood: "Postiguet",
      summary:
        "The city beach below the castle cliff, before anyone has put a towel down. The sun comes up out of the bay.",
      aesthetic: ["pale sand", "palms", "open sea"],
      coordinates: { lat: 38.3459, lng: -0.4776 },
      sensory: {
        energy: "reflective",
        acoustic: "hushed",
        crowd: "empty",
        texture: "Small waves, a beach rake, gulls.",
      },
      light: {
        exposure: "open",
        orientation: "e",
        bestWindow: "sunrise",
        note: "The sun rises straight out of the sea; the castle rock above turns pink first.",
      },
    }),
    stop(1, "08:45", 45, {
      name: "Barrio de Santa Cruz",
      kind: "walk",
      neighborhood: "Casco Antiguo",
      summary:
        "Whitewashed houses stacked up the castle hill, with potted geraniums on the steps. Steep, quiet and lived-in.",
      aesthetic: ["whitewash", "geraniums", "stone steps"],
      coordinates: { lat: 38.3468, lng: -0.4797 },
      sensory: {
        energy: "calm",
        acoustic: "hushed",
        crowd: "sparse",
        texture: "Your own steps, a radio through a window, a cat on a doorstep.",
      },
      light: {
        exposure: "open",
        orientation: "s",
        bestWindow: "morning",
        note: "Low morning sun warms the whitewash; by noon the lanes glare.",
      },
    }),
    stop(2, "09:45", 90, {
      name: "Castillo de Santa Bárbara",
      kind: "architecture",
      neighborhood: "Benacantil",
      summary:
        "A hilltop fortress over the whole bay, reached by a lift cut into the rock across the road from the beach.",
      aesthetic: ["limestone", "ramparts", "bay view"],
      coordinates: { lat: 38.3456, lng: -0.4784 },
      sensory: {
        energy: "balanced",
        acoustic: "murmur",
        crowd: "steady",
        texture: "Wind on the ramparts, families on the stairs, the port far below.",
      },
      light: {
        exposure: "open",
        orientation: null,
        bestWindow: "morning",
        note: "Morning air is clearest; haze softens the far coast by midday.",
      },
    }),
    stop(3, "11:45", 60, {
      name: "Mercado Central",
      kind: "market",
      neighborhood: "Centro",
      summary:
        "A modernist market hall from the early 1920s, at its busiest on a Saturday. Have a vermouth at a stall bar before lunch.",
      aesthetic: ["modernist hall", "fish counters", "tiled stalls"],
      coordinates: { lat: 38.3479, lng: -0.4875 },
      sensory: {
        energy: "lively",
        acoustic: "chatter",
        crowd: "busy",
        texture: "Fishmongers calling prices, knives on boards, a crowd at the bar.",
      },
      light: {
        exposure: "interior",
        orientation: null,
        bestWindow: null,
        note: "Daylight from the high windows falls on the fish counters.",
      },
    }),
    stop(4, "14:00", 105, {
      name: "Paella on the marina",
      kind: "food",
      neighborhood: "Puerto",
      summary:
        "A long Saturday lunch on the marina, where rice cooked thin in the pan is the point. Order one for the table and take your time.",
      aesthetic: ["paella pans", "marina", "white tablecloths"],
      coordinates: { lat: 38.3412, lng: -0.48 },
      sensory: {
        energy: "calm",
        acoustic: "murmur",
        crowd: "steady",
        texture: "Spoons on pans, unhurried talk, halyards ringing on the masts.",
      },
      light: {
        exposure: "covered",
        orientation: "s",
        bestWindow: "midday",
        note: "Under the awnings the light is bright but soft; the water does the glittering.",
      },
    }),
    stop(5, "16:15", 60, {
      name: "MACA",
      kind: "museum",
      neighborhood: "Casco Antiguo",
      summary:
        "The contemporary art museum in a 17th-century building beside the Basilica of Santa María, with a room of Eusebio Sempere's shimmering geometric work.",
      aesthetic: ["baroque façade", "white galleries", "op art"],
      coordinates: { lat: 38.3453, lng: -0.4808 },
      sensory: {
        energy: "reflective",
        acoustic: "hushed",
        crowd: "sparse",
        texture: "Soft steps on stone, a guard's chair creaking, nothing else.",
      },
      light: {
        exposure: "interior",
        orientation: null,
        bestWindow: null,
        note: "Gallery light inside; the square outside turns gold after five.",
      },
    }),
    stop(6, "17:20", 45, {
      name: "Explanada de España",
      kind: "walk",
      neighborhood: "Centro",
      summary:
        "The seafront promenade, paved in a rippling mosaic of marble tiles under rows of palms. Half of Alicante walks it at dusk.",
      aesthetic: ["marble mosaic", "palms", "seafront"],
      coordinates: { lat: 38.3421, lng: -0.484 },
      sensory: {
        energy: "balanced",
        acoustic: "murmur",
        crowd: "busy",
        texture: "Marble ripples underfoot, a busker, palm fronds in the wind.",
      },
      light: {
        exposure: "open",
        orientation: "s",
        bestWindow: "sunset",
        note: "The last sun slants along the palms and catches the marble ripples.",
      },
    }),
    stop(7, "21:00", 120, {
      name: "Tapas on Calle Villegas",
      kind: "bar",
      neighborhood: "Centro",
      summary:
        "The tapas counters of the centre, where locals stand three deep. Point at what looks good and keep ordering.",
      aesthetic: ["marble counters", "wood panelling", "tapas"],
      coordinates: { lat: 38.3462, lng: -0.4869 },
      sensory: {
        energy: "social",
        acoustic: "loud",
        crowd: "packed",
        texture: "Shouted orders, clinking glasses, a counter three deep.",
      },
      light: {
        exposure: "interior",
        orientation: null,
        bestWindow: "after-dark",
        note: "Warm bar light; it only fills up after nine.",
      },
    }),
  ],
};
