import type { EdgeDay } from "./edge-day";

// Tromsø, 69.6° north. Hours and coordinates are roughly right, not checked against the
// places' own pages: an edge day is about the sun, not the itinerary.

/**
 * The sun never rises. Around noon there is a few hours of blue twilight and then it is
 * dark from two, so a stop asking for midday light has no window to be in, and after-dark
 * starts in the early afternoon.
 */
export const POLAR_NIGHT_DAY: EdgeDay = {
  edge: "a sun that never rises",
  request: {
    city: "Tromsø",
    date: "2026-12-12",
    timezone: "Europe/Oslo",
    citySource: "chosen",
    energy: "calm",
    energySource: "chosen",
    travel: null,
    start: null,
    dinner: null,
    end: null,
    company: "partner",
  },
  day: {
    assumptions: { travel: "transit", start: "slow", dinner: null, end: "evening", company: null },
    dek: "Fjellheisen in the blue light around noon, a long lunch in the centre before it gets dark at two, and an evening in Ølhallen.",
    stops: [
      {
        startTime: "11:00",
        durationMinutes: 90,
        place: {
          name: "Fjellheisen",
          kind: "viewpoint",
          neighborhood: "Tromsdalen",
          summary:
            "The cable car up to Storsteinen, where the hours around noon are December's only daylight: no sun, a blue sky over the island and the city's lights already on below.",
          aesthetic: ["snow", "glass station"],
          coordinates: { lat: 69.6429, lng: 18.9936 },
          sensory: {
            energy: "calm",
            acoustic: "hushed",
            crowd: "sparse",
            texture: "Snow squeaking on the platform, wind, the cabin humming back down.",
          },
          light: {
            exposure: "open",
            orientation: "nw",
            bestWindow: "midday",
            note: "The sun stays below the horizon all day; around noon the sky to the south turns blue and pink, and by two it is dark.",
          },
        },
        dependsOn: ["travel", "start"],
      },
      {
        startTime: "13:00",
        durationMinutes: 75,
        place: {
          name: "Cinnamon buns by the quay",
          kind: "coffee",
          neighborhood: "Sentrum",
          summary:
            "The small cafés on Strandgata fill with lunch orders at one: soup and a cinnamon bun before the light goes.",
          aesthetic: ["pale wood", "big windows"],
          coordinates: { lat: 69.6493, lng: 18.9567 },
          sensory: {
            energy: "balanced",
            acoustic: "chatter",
            crowd: "busy",
            texture: "The espresso machine, boots on a wet floor, coats over every chair.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "The front windows give the last of the blue until two; after that it runs on lamps.",
          },
        },
        dependsOn: [],
      },
      {
        startTime: "16:00",
        durationMinutes: 120,
        place: {
          name: "Local beer on Storgata",
          kind: "bar",
          neighborhood: "Sentrum",
          summary:
            "The beer halls at the foot of Storgata, with long rows of local taps; by four the after-work tables are filling.",
          aesthetic: ["dark wood", "tiled floor"],
          coordinates: { lat: 69.6463, lng: 18.9539 },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture: "Glasses on wood, talk across the tables, snow stamped off at the door.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "after-dark",
            note: "Low lamps over the tables; outside it has been dark since two.",
          },
        },
        dependsOn: ["dinner", "end", "company"],
      },
    ],
    alternatives: [],
  },
};

/**
 * The sun never sets: it is still up over the sea at midnight, so no window has a sunset
 * or a dark to fall in, and the last stop ends after midnight. A model asked for the
 * midnight sun writes `sunset` as its best window, as here.
 */
export const MIDNIGHT_SUN_DAY: EdgeDay = {
  edge: "a sun that never sets, and a stop that ends after midnight",
  request: {
    city: "Tromsø",
    date: "2027-06-19",
    timezone: "Europe/Oslo",
    citySource: "chosen",
    energy: "lively",
    energySource: "chosen",
    travel: null,
    start: null,
    dinner: null,
    end: null,
    company: "family",
  },
  day: {
    assumptions: { travel: "taxi", start: "slow", dinner: "early", end: "late", company: null },
    dek: "The botanic garden in flower in the afternoon, Arctic fish by the harbour at seven, and Fjellheisen at midnight with the sun still up over the sea.",
    stops: [
      {
        startTime: "14:00",
        durationMinutes: 90,
        place: {
          name: "Tromsø Arctic-Alpine Botanic Garden",
          kind: "garden",
          neighborhood: "Breivika",
          summary:
            "Arctic and alpine plants on a slope by the university, flowering in the weeks of June after the snow has gone; by mid-afternoon it is warm enough to sit.",
          aesthetic: ["rock garden", "wildflowers"],
          coordinates: { lat: 69.6797, lng: 18.9714 },
          sensory: {
            energy: "calm",
            acoustic: "hushed",
            crowd: "sparse",
            texture: "Water running between the rocks, bees, a bus on the road below.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "afternoon",
            note: "The sun circles the sky without setting; in the afternoon it is high in the south-west and lights the rock beds from the side.",
          },
        },
        dependsOn: ["start"],
      },
      {
        startTime: "19:00",
        durationMinutes: 120,
        place: {
          name: "Arctic fish on the harbour",
          kind: "food",
          neighborhood: "Sentrum",
          summary:
            "Fish from the Arctic coast in the dining rooms on the harbour; at seven their window tables look out on boats in full daylight.",
          aesthetic: ["white tablecloths", "harbour windows"],
          coordinates: { lat: 69.6495, lng: 18.959 },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture: "Plates landing, a full room, gulls outside the glass.",
          },
          light: {
            exposure: "interior",
            orientation: "e",
            bestWindow: "none",
            note: "Evening sun comes through the harbour windows as bright as at noon.",
          },
        },
        dependsOn: ["dinner", "company"],
      },
      {
        startTime: "23:00",
        durationMinutes: 90,
        place: {
          name: "Fjellheisen",
          kind: "viewpoint",
          neighborhood: "Tromsdalen",
          summary:
            "The cable car runs until one in summer, so the top station at midnight is where to see the sun low in the north and still up.",
          aesthetic: ["glass station", "heather"],
          coordinates: { lat: 69.6429, lng: 18.9936 },
          sensory: {
            energy: "social",
            acoustic: "chatter",
            crowd: "busy",
            texture: "Cheering when the sun is at its lowest, wind, phones held up.",
          },
          light: {
            exposure: "open",
            orientation: "nw",
            bestWindow: "sunset",
            note: "At midnight the sun hangs low in the north above the sea; the island and the city go gold, and then it starts to climb.",
          },
        },
        dependsOn: ["travel", "end", "company"],
      },
    ],
    alternatives: [],
  },
};
