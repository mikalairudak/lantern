import type { WrittenDay } from "./written-day";
import { NAFPLIO_START_REQUEST } from "./quick-starts";

/**
 * Nafplio, as claude-sonnet-5-5 wrote it on 2026-10-31 under day-v8, for the
 * start that offers it (generation f2bf6ba0-2037-48e6-be18-09ff41f9e2c0). Kept as written, letters
 * escaped twice read as the reader reads them, so the start opens a day the product really
 * wrote, slips and all; the normalizer repairs what it repairs for any live day.
 */
export const NAFPLIO_START_DAY: WrittenDay = {
  request: NAFPLIO_START_REQUEST,
  day: {
    assumptions: {
      travel: "on-foot",
      start: null,
      dinner: "early",
      end: "early",
      company: "partner",
    },
    dek: "A slow Saturday in Nafplio that starts with coffee on the old town's quiet backstreets, follows the shoreline path under Akronafplia to a swim-free stretch of sea, climbs to Palamidi in the afternoon light, and ends with grilled fish by the harbour before an early night.",
    stops: [
      {
        startTime: "10:00",
        durationMinutes: 60,
        place: {
          name: "Coffee on Staikopoulou",
          kind: "coffee",
          neighborhood: "Palio Nafplio",
          summary:
            "Late-morning coffee on a pedestrian street of old stone houses, when the morning rush of day-trippers has not yet filled the tables. Greek coffee and freddo espresso are what people order here, with something sweet from a nearby bakery.",
          aesthetic: ["neoclassical facades", "stone paving"],
          coordinates: {
            lat: 37.5679,
            lng: 22.8028,
          },
          sensory: {
            energy: "calm",
            acoustic: "murmur",
            crowd: "sparse",
            texture: "Cups on saucers, shutters opening, a few steps on stone.",
          },
          light: {
            exposure: "covered",
            orientation: "none",
            bestWindow: "morning",
            note: "The narrow street stays in shade until late morning, then a strip of sun crosses the tables around eleven.",
          },
        },
        dependsOn: [],
      },
      {
        startTime: "11:15",
        durationMinutes: 45,
        place: {
          name: "Archaeological Museum of Nafplio",
          kind: "museum",
          neighborhood: "Syntagma Square",
          summary:
            "A small museum on Syntagma Square with Mycenaean armour and pottery, quiet enough on a November morning to read every label. It is indoors, so the weather does not change it.",
          aesthetic: ["venetian stone", "whitewashed rooms"],
          coordinates: {
            lat: 37.5666,
            lng: 22.8058,
          },
          sensory: {
            energy: "reflective",
            acoustic: "hushed",
            crowd: "sparse",
            texture: "Soft footsteps, glass cases, an attendant turning a page.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "Lit from inside and from tall windows, so the hour makes little difference.",
          },
        },
        dependsOn: ["company"],
      },
      {
        startTime: "12:30",
        durationMinutes: 90,
        place: {
          name: "Arvanitia Promenade",
          kind: "walk",
          neighborhood: "Arvanitia",
          summary:
            "The path along the base of Akronafplia rock runs from the harbour end of the old town to a small pebble beach. At midday in November it is mostly locals walking dogs and couples on benches.",
          aesthetic: ["limestone cliff", "sea edge"],
          coordinates: {
            lat: 37.564,
            lng: 22.8081,
          },
          sensory: {
            energy: "reflective",
            acoustic: "hushed",
            crowd: "sparse",
            texture: "Waves on pebbles, gulls, the occasional jogger.",
          },
          light: {
            exposure: "open",
            orientation: "se",
            bestWindow: "midday",
            note: "The rock blocks the sun in the morning; by midday the path is in full light and the bay turns bright green.",
          },
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "14:15",
        durationMinutes: 60,
        place: {
          name: "Souvlaki on Vasileos Konstantinou",
          kind: "food",
          neighborhood: "Palio Nafplio",
          summary:
            "The old town's main street serves grilled pork and chicken in pita at lunchtime, eaten standing or at a few outdoor tables. Mid-afternoon is after the lunch rush, so there is room to sit.",
          aesthetic: ["stone paving", "painted shutters"],
          coordinates: {
            lat: 37.5672,
            lng: 22.8043,
          },
          sensory: {
            energy: "balanced",
            acoustic: "chatter",
            crowd: "steady",
            texture: "Grill smoke, plates set down, a radio from a doorway.",
          },
          light: {
            exposure: "dappled",
            orientation: "none",
            bestWindow: "afternoon",
            note: "Balconies and awnings break up the afternoon sun into stripes across the street.",
          },
        },
        dependsOn: [],
      },
      {
        startTime: "15:30",
        durationMinutes: 120,
        place: {
          name: "Palamidi Fortress",
          kind: "architecture",
          neighborhood: "Palamidi",
          summary:
            "The fortress on the hill above town is open until the late afternoon in winter, and the walls look out across the bay. Go up in the middle of the afternoon so the sun is low enough to light the sea and still leaves time to come down before dusk.",
          aesthetic: ["venetian stone", "open ramparts"],
          coordinates: {
            lat: 37.5641,
            lng: 22.7997,
          },
          sensory: {
            energy: "reflective",
            acoustic: "hushed",
            crowd: "sparse",
            texture: "Wind across the ramparts, boots on stone, distant church bells.",
          },
          light: {
            exposure: "open",
            orientation: "se",
            bestWindow: "afternoon",
            note: "The afternoon sun comes low from the west, warming the walls and throwing long shadows across the courtyards.",
          },
        },
        dependsOn: ["travel", "end"],
      },
      {
        startTime: "18:00",
        durationMinutes: 90,
        place: {
          name: "Fish by the Harbour on Akti Miaouli",
          kind: "food",
          neighborhood: "Akti Miaouli",
          summary:
            "The harbour front has a row of tavernas serving grilled fish, calamari and horta, and at six they are just opening for dinner. Early in the evening the tables by the water are free and the street is quiet.",
          aesthetic: ["harbour front", "whitewashed walls"],
          coordinates: {
            lat: 37.5668,
            lng: 22.807,
          },
          sensory: {
            energy: "calm",
            acoustic: "murmur",
            crowd: "sparse",
            texture: "Rigging tapping on masts, plates arriving, low talk.",
          },
          light: {
            exposure: "open",
            orientation: "se",
            bestWindow: "sunset",
            note: "The sun sets behind the town, so the harbour goes from gold to blue while you eat.",
          },
        },
        dependsOn: ["dinner", "company"],
      },
      {
        startTime: "19:45",
        durationMinutes: 60,
        place: {
          name: "Tea on Plateia Syntagmatos",
          kind: "coffee",
          neighborhood: "Syntagma Square",
          summary:
            "After dinner the square settles into hot drinks, herbal tea and sweet spoon desserts at the cafe tables. By eight the families have gone home and the square is quiet before an early night.",
          aesthetic: ["lamplit square", "marble paving"],
          coordinates: {
            lat: 37.5667,
            lng: 22.8055,
          },
          sensory: {
            energy: "calm",
            acoustic: "murmur",
            crowd: "steady",
            texture: "Spoons on saucers, a distant guitar, footsteps on marble.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "after-dark",
            note: "Street lamps and cafe windows light the square softly once the sky is dark.",
          },
        },
        dependsOn: ["end", "company"],
      },
    ],
    alternatives: [
      {
        stopIndex: 0,
        options: [
          {
            name: "Coffee on Komninou",
            kind: "coffee",
            neighborhood: "Palio Nafplio",
            summary:
              "A shaded side street one block over where the tables are fewer and the pace slower.",
            aesthetic: ["stone paving", "bougainvillea"],
            coordinates: {
              lat: 37.5683,
              lng: 22.8036,
            },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "empty",
              texture: "A shutter creaking, a spoon in a cup.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "morning",
              note: "Overhanging balconies keep the street in shade most of the morning.",
            },
            reason:
              "Same coffee and old-town stone, but even fewer tables and almost no passers-by.",
          },
          {
            name: "Coffee on Syntagma Square",
            kind: "coffee",
            neighborhood: "Syntagma Square",
            summary:
              "The square's cafes fill by late morning with people talking over frappe and espresso.",
            aesthetic: ["marble paving", "neoclassical facades"],
            coordinates: {
              lat: 37.5666,
              lng: 22.8056,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Chairs scraping, loud conversation, pigeons.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "morning",
              note: "The square is open to the sky, so the sun reaches the tables by ten.",
            },
            reason:
              "Same drink and same district, but in the open square with more people and noise.",
          },
        ],
      },
      {
        stopIndex: 1,
        options: [
          {
            name: "Church of Agios Spyridon",
            kind: "sacred",
            neighborhood: "Palio Nafplio",
            summary:
              "A small stone church just off the square, usually open in the morning and nearly always empty.",
            aesthetic: ["dark timber", "stone walls"],
            coordinates: {
              lat: 37.5672,
              lng: 22.8064,
            },
            sensory: {
              energy: "reflective",
              acoustic: "silent",
              crowd: "empty",
              texture: "Candle smoke, a floorboard, no voices.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "morning",
              note: "A few windows and candles give a low, even light at any hour.",
            },
            reason:
              "Same quiet indoor stop near the square, but a working church instead of a museum.\n",
          },
          {
            name: "Peloponnesian Folklore Foundation Museum",
            kind: "museum",
            neighborhood: "Palio Nafplio",
            summary:
              "A larger museum of costumes and textiles a few minutes' walk away, with more rooms and a shop.",
            aesthetic: ["neoclassical stone", "wooden floors"],
            coordinates: {
              lat: 37.5675,
              lng: 22.8049,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "steady",
              texture: "Guided groups, creaking floors, a shop till.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Even indoor light, so any hour works.",
            },
            reason: "Same indoor museum visit, trading the quiet for more rooms and more people.",
          },
        ],
      },
      {
        stopIndex: 2,
        options: [
          {
            name: "Bourtzi Viewpoint on Akti Miaouli",
            kind: "viewpoint",
            neighborhood: "Akti Miaouli",
            summary:
              "The harbour wall looks out to the small island fortress; a bench and a rail are all there is.",
            aesthetic: ["stone quay", "open sea"],
            coordinates: {
              lat: 37.5651,
              lng: 22.807,
            },
            sensory: {
              energy: "reflective",
              acoustic: "silent",
              crowd: "empty",
              texture: "Water against the quay, a fishing boat engine far off.",
            },
            light: {
              exposure: "open",
              orientation: "s",
              bestWindow: "midday",
              note: "Full sun on the water at midday, flat and bright.",
            },
            reason: "Same sea edge, shorter and quieter, with one view instead of a walk.",
          },
          {
            name: "Coffee on Akti Miaouli",
            kind: "coffee",
            neighborhood: "Akti Miaouli",
            summary:
              "Harbour-front cafes fill at midday with people watching the boats over a long coffee.",
            aesthetic: ["harbour front", "cane chairs"],
            coordinates: {
              lat: 37.5666,
              lng: 22.8068,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Chairs, loud talk, boats at the quay.",
            },
            light: {
              exposure: "open",
              orientation: "se",
              bestWindow: "midday",
              note: "Open to the sun and the water all midday.",
            },
            reason: "Same sea view, but sitting at a busy cafe table instead of walking.",
          },
        ],
      },
      {
        stopIndex: 3,
        options: [
          {
            name: "Spoon Sweets on Staikopoulou",
            kind: "coffee",
            neighborhood: "Palio Nafplio",
            summary:
              "A quieter afternoon stop of yogurt, spoon sweets and Greek coffee on the pedestrian street.",
            aesthetic: ["stone paving", "small tables"],
            coordinates: {
              lat: 37.5679,
              lng: 22.8029,
            },
            sensory: {
              energy: "calm",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Spoons, soft talk, a bicycle bell.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "afternoon",
              note: "Shade from balconies keeps the street soft all afternoon.",
            },
            reason: "Same old-town street, trading a grilled meal for something small and sweet.",
          },
          {
            name: "Meze on Plateia Syntagmatos",
            kind: "food",
            neighborhood: "Syntagma Square",
            summary:
              "The square's tavernas serve shared plates of cheese, dips and grilled meat with the afternoon crowd.",
            aesthetic: ["marble paving", "outdoor tables"],
            coordinates: {
              lat: 37.5667,
              lng: 22.8056,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Plates sliding across tables, loud talk, a waiter calling out.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "afternoon",
              note: "The square is open, so the tables get afternoon sun.",
            },
            reason:
              "Same grilled Greek food, but shared plates in the open square with more noise.",
          },
        ],
      },
      {
        stopIndex: 4,
        options: [
          {
            name: "Panagia Church Garden",
            kind: "garden",
            neighborhood: "Palamidi",
            summary:
              "A small shaded terrace partway up the hill steps, with benches and a view of the old town roofs.",
            aesthetic: ["stone terrace", "pine shade"],
            coordinates: {
              lat: 37.5656,
              lng: 22.802,
            },
            sensory: {
              energy: "reflective",
              acoustic: "silent",
              crowd: "empty",
              texture: "Wind in pines, a distant moped.",
            },
            light: {
              exposure: "dappled",
              orientation: "e",
              bestWindow: "afternoon",
              note: "Pine branches scatter the afternoon sun across the benches.",
            },
            reason:
              "Same hillside and view of the town, but short, shaded and without the fortress.",
          },
          {
            name: "Akronafplia Fortress Walls",
            kind: "architecture",
            neighborhood: "Akronafplia",
            summary:
              "The older fortress on the rock above the harbour, with walls to walk and a view over both bays.",
            aesthetic: ["venetian stone", "hilltop walls"],
            coordinates: {
              lat: 37.5649,
              lng: 22.8056,
            },
            sensory: {
              energy: "balanced",
              acoustic: "murmur",
              crowd: "steady",
              texture: "Voices on the walls, a hotel terrace below, wind.",
            },
            light: {
              exposure: "open",
              orientation: "s",
              bestWindow: "afternoon",
              note: "Open walls catch the afternoon sun from the south.",
            },
            reason: "Same fortress walls and views, but nearer the town and with more visitors.",
          },
        ],
      },
      {
        stopIndex: 5,
        options: [
          {
            name: "Fish on Staikopoulou",
            kind: "food",
            neighborhood: "Palio Nafplio",
            summary:
              "A few small tavernas on the pedestrian street serve grilled fish and horta at quiet candlelit tables.",
            aesthetic: ["stone paving", "candlelight"],
            coordinates: {
              lat: 37.5679,
              lng: 22.803,
            },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Low talk, cutlery, a cat under a chair.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Candles and lamps give a low light once the sun is down.",
            },
            reason: "Same grilled fish dinner, set back from the harbour on a quieter street.",
          },
          {
            name: "Ouzo on Bouboulinas",
            kind: "bar",
            neighborhood: "Bouboulinas",
            summary:
              "The seafront promenade fills with ouzo and meze at the bars as the evening begins.",
            aesthetic: ["sea promenade", "string lights"],
            coordinates: {
              lat: 37.5654,
              lng: 22.8079,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "busy",
              texture: "Music, glasses, loud groups along the sea wall.",
            },
            light: {
              exposure: "open",
              orientation: "se",
              bestWindow: "after-dark",
              note: "String lights and bar windows light the promenade after dark.",
            },
            reason: "Same harbour air and Greek table food, trading calm for a louder promenade.",
          },
        ],
      },
      {
        stopIndex: 6,
        options: [
          {
            name: "Herbal Tea on Papanikolaou",
            kind: "coffee",
            neighborhood: "Palio Nafplio",
            summary:
              "A side street a block from the square with a few tables for mountain tea and a sweet.",
            aesthetic: ["stone paving", "wooden tables"],
            coordinates: {
              lat: 37.567,
              lng: 22.8047,
            },
            sensory: {
              energy: "reflective",
              acoustic: "silent",
              crowd: "empty",
              texture: "A kettle, a footstep, lamplight.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "after-dark",
              note: "A single lamp and shop windows light the street after dark.",
            },
            reason: "Same hot drink and early night, on a quieter street away from the square.",
          },
          {
            name: "Wine on Plateia Philellinon",
            kind: "bar",
            neighborhood: "Palio Nafplio",
            summary:
              "The small square beside the square fills with wine and cheese plates on a Saturday evening.",
            aesthetic: ["stone square", "outdoor tables"],
            coordinates: {
              lat: 37.5673,
              lng: 22.8058,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Glasses, loud talk, music from a doorway.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Lamps and bar windows light the square after dark.",
            },
            reason: "Same square and evening, trading tea for wine and a livelier crowd.",
          },
        ],
      },
    ],
  },
};
