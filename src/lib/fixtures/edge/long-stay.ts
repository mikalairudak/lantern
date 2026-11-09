import { MAX_STOP_MINUTES } from "@/lib/schema/itinerary.schema";
import type { EdgeDay } from "./edge-day";

/**
 * The longest stay the schema allows, a full day on foot, then dinner and a view lit
 * after dark. The last two stops are an hour and more apart by bus, because the day is
 * here for the walk. Hours and coordinates are roughly right, not checked.
 */
export const LONG_STAY_DAY: EdgeDay = {
  edge: "a stop as long as the schema allows",
  request: {
    city: "Hong Kong",
    date: "2026-12-06",
    timezone: "Asia/Hong_Kong",
    citySource: "chosen",
    energy: "balanced",
    energySource: "chosen",
    travel: null,
    start: null,
    dinner: null,
    end: null,
    company: null,
  },
  day: {
    assumptions: { travel: "taxi", start: "early", dinner: "early", end: "early", company: null },
    dek: "Eight hours on the MacLehose Trail from Pak Tam Chung to the beaches and back over the hill, seafood in Sai Kung at five, and the harbour lit from the Peak.",
    stops: [
      {
        startTime: "07:30",
        durationMinutes: MAX_STOP_MINUTES,
        place: {
          name: "MacLehose Trail, Sections 1 and 2",
          kind: "walk",
          neighborhood: "Sai Kung East Country Park",
          summary:
            "Eight hours on foot from Pak Tam Chung, past the dam at High Island Reservoir and down to the beaches at Sai Wan and Ham Tin, then over the hill to Pak Tam Au; starting at half past seven keeps the climbs in the cool of the morning.",
          aesthetic: ["volcanic columns", "white sand", "concrete steps"],
          coordinates: { lat: 22.3906, lng: 114.3238 },
          sensory: {
            energy: "balanced",
            acoustic: "hushed",
            crowd: "sparse",
            texture: "Boots on concrete steps, surf below the path, a radio at the Sai Wan kiosk.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "morning",
            note: "Low winter sun lights the columns at the dam in the morning; by noon the beaches glare and there is no shade.",
          },
        },
        dependsOn: ["start"],
      },
      {
        startTime: "17:00",
        durationMinutes: 105,
        place: {
          name: "Seafood on the waterfront",
          kind: "food",
          neighborhood: "Sai Kung Town",
          summary:
            "Cantonese seafood on small floors off the waterfront; at five there is a table without booking, early enough for anyone coming off the trail.",
          aesthetic: ["formica tables", "fish tanks"],
          coordinates: { lat: 22.3826, lng: 114.2733 },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture: "Woks firing, tanks bubbling by the door, a table of hikers still in boots.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "Strip lights inside; the harbour outside is dark by six.",
          },
        },
        dependsOn: ["dinner"],
      },
      {
        startTime: "19:30",
        durationMinutes: 90,
        place: {
          name: "Sky Terrace 428",
          kind: "viewpoint",
          neighborhood: "The Peak",
          summary:
            "The roof of the Peak Tower, looking north over the harbour to Kowloon, with every tower lit by half past seven.",
          aesthetic: ["steel parapet", "glass towers"],
          coordinates: { lat: 22.2711, lng: 114.1497 },
          sensory: {
            energy: "social",
            acoustic: "chatter",
            crowd: "packed",
            texture: "Camera shutters, many languages, wind over the parapet.",
          },
          light: {
            exposure: "open",
            orientation: "n",
            bestWindow: "after-dark",
            note: "After dark the towers across the harbour are lit; by day the view is often flat with haze.",
          },
        },
        dependsOn: ["travel", "end"],
      },
    ],
    alternatives: [],
  },
};
