import type { EdgeDay } from "./edge-day";

/**
 * The least a day can be: one stop, no swaps, one tag, no orientation or best light, and
 * the shortest line in every text field. M+ opens at ten from Tuesday to Sunday.
 */
export const MINIMAL_DAY: EdgeDay = {
  edge: "one stop, no swaps and the shortest text",
  request: {
    city: "Hong Kong",
    date: "2026-12-05",
    timezone: "Asia/Hong_Kong",
    citySource: "chosen",
    energy: "reflective",
    energySource: "chosen",
    travel: "on-foot",
    start: "slow",
    dinner: "early",
    end: "early",
    company: "alone",
  },
  day: {
    assumptions: { travel: null, start: null, dinner: null, end: null, company: null },
    dek: "M+ from ten, while it is quiet.",
    stops: [
      {
        startTime: "10:00",
        durationMinutes: 120,
        place: {
          name: "M+",
          kind: "museum",
          neighborhood: "West Kowloon",
          summary: "Quiet from opening at ten.",
          aesthetic: ["raw concrete"],
          coordinates: { lat: 22.3014, lng: 114.1596 },
          sensory: {
            energy: "reflective",
            acoustic: "hushed",
            crowd: "sparse",
            texture: "Hushed rooms.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "Gallery light; no sun inside.",
          },
        },
        dependsOn: [],
      },
    ],
    alternatives: [],
  },
};
