import type { WrittenDay } from "./written-day";
import { AMSTERDAM_REQUEST } from "./city-days";

/**
 * Amsterdam, as claude-sonnet-5-5 wrote it on 2026-11-11 under day-v11, for its own address
 * (generation 12218de8-0954-4e56-889b-48740db747f7). Kept as written, letters escaped twice read as
 * the reader reads them, so the address opens a day the product really wrote, slips and all; the
 * normalizer repairs what it repairs for any live day.
 */
export const AMSTERDAM_DAY: WrittenDay = {
  request: AMSTERDAM_REQUEST,
  day: {
    assumptions: {
      travel: "on-foot",
      start: null,
      dinner: "early",
      end: "evening",
      company: null,
    },
    dek: "A slow Sunday that begins with coffee along the Jordaan canals, moves through the Westerkerk and Anne Frank's neighbourhood, takes the Hortus Botanicus in the afternoon light, and ends with an early family dinner in the Plantage.",
    stops: [
      {
        startTime: "10:00",
        durationMinutes: 60,
        place: {
          name: "Coffee along Prinsengracht",
          kind: "coffee",
          neighborhood: "Jordaan",
          coordinates: {
            lat: 52.3745,
            lng: 4.8838,
          },
          sensory: {
            energy: "calm",
            acoustic: "murmur",
            crowd: "sparse",
            texture:
              "Bicycle bells on the quay, cups on saucers, a few families under the lime trees.",
          },
          light: {
            exposure: "open",
            orientation: "s",
            bestWindow: "morning",
            note: "The canal faces south, so the sun reaches the water by mid-morning even in November and the quay is warmest then.",
          },
          summary:
            "On a Sunday the canal streets wake late and slowly, so ten o'clock is when coffee and apple pie are being poured for people who have nowhere to be yet.",
          aesthetic: ["canal-house brick", "dark timber"],
        },
        dependsOn: ["start"],
      },
      {
        startTime: "11:15",
        durationMinutes: 60,
        place: {
          name: "Westerkerk",
          kind: "sacred",
          neighborhood: "Jordaan",
          coordinates: {
            lat: 52.3752,
            lng: 4.884,
          },
          sensory: {
            energy: "reflective",
            acoustic: "hushed",
            crowd: "sparse",
            texture:
              "Footsteps on stone, a low organ now and then, the tower bells on the quarter hour.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "Light comes through the tall clear windows, so the nave is even whatever the hour, and the weather outside barely changes it.",
          },
          summary:
            "The church is a short walk from the coffee street and is usually quiet before the afternoon, with a Sunday service in the morning to plan around: check whether visiting is open before you go in.",
          aesthetic: ["whitewashed stone", "dark oak"],
        },
        dependsOn: ["start", "company"],
      },
      {
        startTime: "12:45",
        durationMinutes: 60,
        place: {
          name: "Pancakes along Prinsengracht",
          kind: "food",
          neighborhood: "Jordaan",
          coordinates: {
            lat: 52.3735,
            lng: 4.8832,
          },
          sensory: {
            energy: "balanced",
            acoustic: "chatter",
            crowd: "steady",
            texture: "Griddle hiss, plates set down, children's voices at long tables.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "Mostly indoors in tall canal-house windows, so the light is the same grey-white at noon as at two.",
          },
          summary:
            "Pannenkoeken, thin and the size of the plate, sweet with syrup or bacon and cheese, are the Sunday lunch for families in Amsterdam, and noon is early enough to find a table.",
          aesthetic: ["canal-house brick", "scrubbed wood"],
        },
        dependsOn: ["company", "travel"],
      },
      {
        startTime: "14:30",
        durationMinutes: 90,
        place: {
          name: "Hortus Botanicus",
          kind: "garden",
          neighborhood: "Plantage",
          coordinates: {
            lat: 52.3667,
            lng: 4.9082,
          },
          sensory: {
            energy: "calm",
            acoustic: "hushed",
            crowd: "steady",
            texture: "Gravel paths, warm glasshouse air, water dripping in the palm house.",
          },
          light: {
            exposure: "dappled",
            orientation: "none",
            bestWindow: "afternoon",
            note: "In November the sun sits low from early afternoon and lights the glasshouse glass gold, then fades by half past four.",
          },
          summary:
            "The garden is open on Sundays through late afternoon, and the glasshouses are warm on a cold November day, which suits an unhurried family visit at this hour.",
          aesthetic: ["glass and iron", "wet gravel"],
        },
        dependsOn: ["travel", "end"],
      },
      {
        startTime: "16:15",
        durationMinutes: 45,
        place: {
          name: "Hot chocolate on Plantage Middenlaan",
          kind: "coffee",
          neighborhood: "Plantage",
          coordinates: {
            lat: 52.3665,
            lng: 4.9092,
          },
          sensory: {
            energy: "calm",
            acoustic: "murmur",
            crowd: "sparse",
            texture: "Wide pavement, tram bells in the distance, breath showing in the cold.",
          },
          light: {
            exposure: "open",
            orientation: "s",
            bestWindow: "sunset",
            note: "The street is wide and open to the south-west, so dusk comes in as a long orange band down its length around half past four.",
          },
          summary:
            "A wide quiet street just outside the garden gate where hot chocolate and stroopwafels are the sensible answer to a November afternoon turning dark.",
          aesthetic: ["brick facades", "tree-lined"],
        },
        dependsOn: ["travel", "end"],
      },
      {
        startTime: "17:30",
        durationMinutes: 90,
        place: {
          name: "Indonesian rijsttafel in the Plantage",
          kind: "food",
          neighborhood: "Plantage",
          coordinates: {
            lat: 52.367,
            lng: 4.91,
          },
          sensory: {
            energy: "balanced",
            acoustic: "murmur",
            crowd: "steady",
            texture:
              "Many small dishes passed round, a warm smell of coconut and chilli, low talk.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "after-dark",
            note: "Lamp-lit rooms by now, since the sun has set, and the warm light suits the long shared table.",
          },
          summary:
            "Rijsttafel is how Amsterdam does a family dinner, rice with a dozen small dishes shared in the middle, and half past five is early enough to eat well and be home by eight.",
          aesthetic: ["warm lamplight", "dark timber"],
        },
        dependsOn: ["dinner", "end", "company"],
      },
    ],
    alternatives: [
      {
        stopIndex: 0,
        options: [
          {
            name: "Café quay on Bloemgracht",
            kind: "coffee",
            neighborhood: "Jordaan",
            coordinates: {
              lat: 52.3733,
              lng: 4.8808,
            },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "empty",
              texture: "Still water, a lone cyclist, a door opening somewhere.",
            },
            light: {
              exposure: "open",
              orientation: "e",
              bestWindow: "morning",
              note: "The low houses let the morning sun reach the water early and it stays on the quay until about noon.",
            },
            summary:
              "A quieter canal a few streets west where coffee is a single pot on a windowsill table and the street stays nearly empty on a Sunday morning.",
            aesthetic: ["canal-house brick", "painted shutters"],
            reason:
              "Same canal-side coffee and pastry, but on a narrower street with almost no passers-by.",
          },
          {
            name: "Coffee on Westermarkt",
            kind: "coffee",
            neighborhood: "Jordaan",
            coordinates: {
              lat: 52.3757,
              lng: 4.8843,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Voices in several languages, scraping chairs, the church bells overhead.",
            },
            light: {
              exposure: "open",
              orientation: "s",
              bestWindow: "midday",
              note: "The square is open to the south and gets the most direct sun of any spot nearby from late morning.",
            },
            summary:
              "The square beside the Westerkerk fills early on Sundays with visitors and locals taking coffee outside in their coats.",
            aesthetic: ["cobbles", "brick facades"],
            reason:
              "Same coffee and apple pie, but on a busy square in the full sun instead of a quiet quay.",
          },
        ],
      },
      {
        stopIndex: 1,
        options: [
          {
            name: "Begijnhof",
            kind: "garden",
            neighborhood: "Centrum",
            coordinates: {
              lat: 52.3694,
              lng: 4.89,
            },
            sensory: {
              energy: "reflective",
              acoustic: "silent",
              crowd: "sparse",
              texture: "A walled lawn, small gabled houses, no traffic noise at all.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "midday",
              note: "Walls hold off the wind and the courtyard is brightest around midday when the sun clears the roofs.",
            },
            summary:
              "A walled courtyard of old houses with a small lawn, about 15 minutes' walk east, with no shops and nothing to buy, quiet at noon on a Sunday.",
            aesthetic: ["brick", "grass and gables"],
            reason:
              "Shares the church's stillness and the hour, but is a courtyard in the open air rather than a nave.",
          },
          {
            name: "Noordermarkt",
            kind: "market",
            neighborhood: "Jordaan",
            coordinates: {
              lat: 52.3799,
              lng: 4.8856,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Stall-holders calling, cheese samples, crowds shuffling between stalls.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "morning",
              note: "Open sky over the square, so the light is steady and bright through the market hours.",
            },
            summary:
              "The square beside the Noorderkerk is full of stalls on Sunday mornings with food, books and second-hand goods.",
            aesthetic: ["canvas awnings", "cobbles"],
            reason:
              "Same neighbourhood and the same slow Sunday pace, but crowded and loud instead of hushed.",
          },
        ],
      },
      {
        stopIndex: 2,
        options: [
          {
            name: "Soup on Lindengracht",
            kind: "food",
            neighborhood: "Jordaan",
            coordinates: {
              lat: 52.379,
              lng: 4.8815,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "Steam at the windows, spoons on bowls, a slow trickle of people.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Small windows on the street mean the room stays dim and warm whatever the weather.",
            },
            summary:
              "A long quiet street of small rooms where split-pea soup with rye bread is the plain lunch on a cold Sunday.",
            aesthetic: ["brick", "dark wood"],
            reason:
              "Shares the Dutch lunch and the neighbourhood but trades the big griddle tables for a quieter, smaller room.",
          },
          {
            name: "Fries along Singel",
            kind: "food",
            neighborhood: "Centrum",
            coordinates: {
              lat: 52.3735,
              lng: 4.8905,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture:
                "Fryer hiss, paper cones, queues out the door and people eating on the quay.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "midday",
              note: "Eaten standing in the open air, the light is whatever the day gives and it is most pleasant at midday.",
            },
            summary:
              "Fries with mayonnaise in a paper cone are what Amsterdam eats on the move at lunchtime, and the canal edge is where people stand and eat them.",
            aesthetic: ["paper cones", "canal quay"],
            reason:
              "Same neighbourhood stretch and a Dutch lunch, but eaten standing and faster rather than at a table.",
          },
        ],
      },
      {
        stopIndex: 3,
        options: [
          {
            name: "Hermitage Amsterdam",
            kind: "museum",
            neighborhood: "Plantage",
            coordinates: {
              lat: 52.3656,
              lng: 4.9021,
            },
            sensory: {
              energy: "balanced",
              acoustic: "murmur",
              crowd: "steady",
              texture: "Wide rooms, soft footfalls, a river outside the windows.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Lit by gallery lamps, so the time of day makes no difference inside.",
            },
            summary:
              "A museum on the Amstel river a few minutes' walk from the garden, open on Sunday afternoons and indoors if the weather turns.",
            aesthetic: ["white walls", "old brick"],
            reason:
              "Shares the neighbourhood and the afternoon hour but is a gallery with rooms to walk instead of a garden.",
          },
          {
            name: "Artis Royal Zoo",
            kind: "garden",
            neighborhood: "Plantage",
            coordinates: {
              lat: 52.366,
              lng: 4.916,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Children running, bird calls, gravel paths and paper maps.",
            },
            light: {
              exposure: "dappled",
              orientation: "none",
              bestWindow: "afternoon",
              note: "Trees thin out in November and the low afternoon light reaches the paths until about four.",
            },
            summary:
              "The zoo next to the garden is open on Sundays and is where families with children spend the afternoon.",
            aesthetic: ["gravel paths", "tall trees"],
            reason:
              "Shares the green setting and the afternoon, but trades quiet glasshouses for animals and noisy children.",
          },
        ],
      },
      {
        stopIndex: 4,
        options: [
          {
            name: "Tea at Hortus entrance",
            kind: "coffee",
            neighborhood: "Plantage",
            coordinates: {
              lat: 52.367,
              lng: 4.9085,
            },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "empty",
              texture: "Warm glass, clinking cups, a lone reader.",
            },
            light: {
              exposure: "interior",
              orientation: "s",
              bestWindow: "afternoon",
              note: "South-facing glass catches the last low sun until about four.",
            },
            summary: "A glass tea room at the garden entrance, quiet late on a Sunday afternoon.",
            aesthetic: ["glass and iron", "white tables"],
            reason:
              "Shares the warm drink and the garden edge but is a seated tea room that is quieter than the street.",
          },
          {
            name: "Pastries on Weesperstraat",
            kind: "coffee",
            neighborhood: "Plantage",
            coordinates: {
              lat: 52.365,
              lng: 4.9068,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Tram bells, doors swinging open, pastry boxes tied with string.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "afternoon",
              note: "A wide road with open sky, so the low afternoon light falls straight down it.",
            },
            summary:
              "A busier street of bakeries a few minutes' walk south where families pick up pastries and hot drinks before heading home.",
            aesthetic: ["shop windows", "brick"],
            reason:
              "Same warm drink and sweet stop but on a busy street with trams instead of a quiet wide pavement.",
          },
        ],
      },
      {
        stopIndex: 5,
        options: [
          {
            name: "Soup on Plantage Kerklaan",
            kind: "food",
            neighborhood: "Plantage",
            coordinates: {
              lat: 52.3664,
              lng: 4.9115,
            },
            sensory: {
              energy: "calm",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Low lamps, quiet spoons, a heater ticking.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "After dark the small rooms are lit by lamps only and feel warm.",
            },
            summary:
              "A quiet street of small rooms near the garden where a simple soup and bread supper is eaten early on a Sunday.",
            aesthetic: ["warm lamplight", "plain wood"],
            reason:
              "Shares the early family dinner and the neighbourhood but trades the shared table of dishes for a quiet, simpler supper.",
          },
          {
            name: "Burgers along Weesperplein",
            kind: "food",
            neighborhood: "Plantage",
            coordinates: {
              lat: 52.3645,
              lng: 4.9075,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Music, grills, crowded benches, a queue out the door.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Bright indoor lights by evening, same at any hour after dark.",
            },
            summary:
              "A busier stretch near the river where burgers are what students and families eat on a Sunday evening.",
            aesthetic: ["bright lights", "steel and wood"],
            reason:
              "Shares the early dinner and nearby streets but trades the shared quiet table for a loud, quick burger meal.",
          },
        ],
      },
    ],
  },
};
