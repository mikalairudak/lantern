import type { WrittenDay } from "./written-day";
import { LONDON_REQUEST } from "./city-days";

/**
 * London, as claude-sonnet-5-5 wrote it on 2026-11-14 under day-v11 with the undated rule
 * (`EVAL_DAY_RULE`), for its own address (generation abcf1ad8-4874-486e-9627-2455d48c28f2). Kept as
 * written, letters escaped twice read as the reader reads them, so the address opens a day the
 * product really wrote, slips and all; the normalizer repairs what it repairs for any live day.
 */
export const LONDON_DAY: WrittenDay = {
  request: LONDON_REQUEST,
  day: {
    assumptions: {
      travel: "on-foot",
      start: "slow",
      dinner: "early",
      end: "early",
      company: null,
    },
    dek: "A Saturday for friends in Bloomsbury and Soho: coffee near the British Museum, the museum's galleries, a long lunch in Fitzrovia, a slow stretch of Soho streets and an early dinner in Chinatown before the bars fill.",
    stops: [
      {
        startTime: "10:00",
        durationMinutes: 45,
        place: {
          name: "Coffee on Museum Street",
          kind: "coffee",
          neighborhood: "Bloomsbury",
          coordinates: {
            lat: 51.5189,
            lng: -0.1257,
          },
          sensory: {
            energy: "balanced",
            acoustic: "murmur",
            crowd: "steady",
            texture:
              "Cups on saucers, pushchairs and tote bags going past, a low talk at the tables.",
          },
          light: {
            exposure: "covered",
            orientation: "none",
            bestWindow: "morning",
            note: "The street is narrow, so the sun reaches the pavement only for a short spell in the morning; inside, the light is even all day.",
          },
          summary:
            "A short street of coffee counters and bookshops a minute from the museum gate, where Saturday-morning tables fill from about ten with people meeting before the galleries.",
          aesthetic: ["brick facades", "painted shopfronts"],
        },
        dependsOn: ["start", "company"],
      },
      {
        startTime: "10:50",
        durationMinutes: 150,
        place: {
          name: "British Museum",
          kind: "museum",
          neighborhood: "Bloomsbury",
          coordinates: {
            lat: 51.5194,
            lng: -0.1269,
          },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture:
              "Footsteps on stone, guides' voices, a hum under the glass roof of the Great Court.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "midday",
            note: "Daylight comes down through the glass roof of the Great Court and is brightest around midday; the galleries are lit by lamps either way.",
          },
          summary:
            "Free to enter and open all day on a Saturday, so late morning suits it. Pick two or three galleries, such as Egypt and Greece, and leave the rest for another visit.",
          aesthetic: ["Portland stone", "glass roof"],
        },
        dependsOn: ["start", "company"],
      },
      {
        startTime: "13:30",
        durationMinutes: 90,
        place: {
          name: "Lunch on Charlotte Street",
          kind: "food",
          neighborhood: "Fitzrovia",
          coordinates: {
            lat: 51.519,
            lng: -0.1352,
          },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture: "Pavement tables, cutlery and loud talk, doors opening onto the street.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "midday",
            note: "The street runs north to south, so the pavement tables get sun around midday and fall into shade as the afternoon goes on.",
          },
          summary:
            "A ten-minute walk west from the museum, and a street of Italian, Spanish and Greek kitchens that serve a full lunch into the mid-afternoon on a Saturday.",
          aesthetic: ["red brick", "awnings"],
        },
        dependsOn: ["travel", "dinner", "company"],
      },
      {
        startTime: "15:20",
        durationMinutes: 60,
        place: {
          name: "Berwick Street Market",
          kind: "market",
          neighborhood: "Soho",
          coordinates: {
            lat: 51.5136,
            lng: -0.136,
          },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture:
              "Stallholders calling prices, crates scraped over tarmac, records flipped in racks.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "afternoon",
            note: "Open to the sky between low buildings, the street gets a slanting afternoon light on the stalls before the shops light up.",
          },
          summary:
            "The fruit and veg stalls trade through the afternoon on Saturday, with record shops and cafés on the same stretch, so you can browse it with no booking and no fixed end.",
          aesthetic: ["market stalls", "brick terraces"],
        },
        dependsOn: ["travel", "company"],
      },
      {
        startTime: "16:35",
        durationMinutes: 60,
        place: {
          name: "Beer on Dean Street",
          kind: "bar",
          neighborhood: "Soho",
          coordinates: {
            lat: 51.5142,
            lng: -0.1317,
          },
          sensory: {
            energy: "social",
            acoustic: "loud",
            crowd: "packed",
            texture:
              "Voices spilling from doorways, glasses clinking, smokers talking on the kerb.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "after-dark",
            note: "By this hour the street is turning to lamplight, and the pub windows glow against the blue outside.",
          },
          summary:
            "A quiet pint is easy to find here at this hour; the street is busy with Saturday drinkers but still has room before the early evening crowd.",
          aesthetic: ["dark wood", "brass fittings"],
        },
        dependsOn: ["end", "dinner", "company"],
      },
      {
        startTime: "17:50",
        durationMinutes: 90,
        place: {
          name: "Dumplings on Gerrard Street",
          kind: "food",
          neighborhood: "Chinatown",
          coordinates: {
            lat: 51.5111,
            lng: -0.1317,
          },
          sensory: {
            energy: "social",
            acoustic: "loud",
            crowd: "packed",
            texture:
              "Steam and plates, round tables, loud talk in several languages, red lanterns overhead.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "after-dark",
            note: "The red lanterns strung across the street give the light after dark, and the windows add to it.",
          },
          summary:
            "Dim sum and noodle kitchens are all open on a Saturday evening, and going at about six gets you a table before the queues form around seven.",
          aesthetic: ["red lanterns", "painted signs"],
        },
        dependsOn: ["dinner", "company"],
      },
      {
        startTime: "19:30",
        durationMinutes: 60,
        place: {
          name: "Cocktails on Greek Street",
          kind: "bar",
          neighborhood: "Soho",
          coordinates: {
            lat: 51.5139,
            lng: -0.1305,
          },
          sensory: {
            energy: "social",
            acoustic: "loud",
            crowd: "packed",
            texture: "Basement doors, bass from somewhere below, a queue at every second bar.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "after-dark",
            note: "The street is lit by shop signs and bar doorways, with dim candlelight inside.",
          },
          summary:
            "A short walk from dinner to a street of cocktail bars that start filling at about eight on a Saturday, so you get a drink before the doors have queues.",
          aesthetic: ["neon signs", "exposed brick"],
        },
        dependsOn: ["end", "company"],
      },
    ],
    alternatives: [
      {
        stopIndex: 0,
        options: [
          {
            name: "Tea in Russell Square",
            kind: "garden",
            neighborhood: "Bloomsbury",
            coordinates: {
              lat: 51.5213,
              lng: -0.1264,
            },
            sensory: {
              energy: "calm",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Gravel paths, plane trees, a few dog walkers and the fountain.",
            },
            light: {
              exposure: "dappled",
              orientation: "none",
              bestWindow: "morning",
              note: "Light comes through the plane trees and moves across the paths as the morning goes.",
            },
            summary:
              "A kiosk and benches at the middle of a big square, a five-minute walk from the museum.",
            aesthetic: ["plane trees", "gravel"],
            reason:
              "Same morning stop before the museum, but outdoors and quieter, trading a table for a bench.",
          },
          {
            name: "Brunch on Lamb's Conduit Street",
            kind: "food",
            neighborhood: "Bloomsbury",
            coordinates: {
              lat: 51.5236,
              lng: -0.1176,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Plates and loud brunch talk, doors open onto the street.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "morning",
              note: "The pedestrian-width street gets low sun in the morning and fills with shade by midday.",
            },
            summary:
              "A longer morning on a small street of bakeries and bistros, ten minutes east of the museum.",
            aesthetic: ["brick facades", "hanging signs"],
            reason:
              "Same neighbourhood and the same hour, but a sit-down brunch in place of a quick coffee.",
          },
        ],
      },
      {
        stopIndex: 1,
        options: [
          {
            name: "Foundling Museum",
            kind: "museum",
            neighborhood: "Bloomsbury",
            coordinates: {
              lat: 51.5247,
              lng: -0.1214,
            },
            sensory: {
              energy: "calm",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Creaking floors, low voices, paintings in small rooms.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Lit by lamps and window light in small rooms, much the same all day.",
            },
            summary:
              "A small museum of paintings and rooms, opening on Saturdays and quiet in the late morning.",
            aesthetic: ["panelled rooms", "oil paintings"],
            reason:
              "Still a Bloomsbury museum for the late morning, trading the big galleries for a few small rooms.",
          },
          {
            name: "Charles Dickens Museum",
            kind: "museum",
            neighborhood: "Bloomsbury",
            coordinates: {
              lat: 51.5236,
              lng: -0.1177,
            },
            sensory: {
              energy: "balanced",
              acoustic: "murmur",
              crowd: "steady",
              texture: "Stairs and floorboards, voices in small rooms, a hall of period furniture.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Daylight from small windows, with lamps in the rooms.",
            },
            summary:
              "A terraced house on Doughty Street, open on Saturdays and more of a house visit than a gallery.",
            aesthetic: ["Georgian terrace", "period furniture"],
            reason:
              "A museum in the same district, trading the big halls for a house visit; livelier because of its tight rooms and stairs.",
          },
        ],
      },
      {
        stopIndex: 2,
        options: [
          {
            name: "Sandwiches on Rathbone Place",
            kind: "food",
            neighborhood: "Fitzrovia",
            coordinates: {
              lat: 51.5175,
              lng: -0.1349,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "Paper bags, a short queue, voices low in side streets.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "midday",
              note: "Side streets with flat light through the middle of the day.",
            },
            summary:
              "A quieter stretch of sandwich counters and small kitchens a few minutes south of Charlotte Street.",
            aesthetic: ["brick", "shopfronts"],
            reason:
              "Same lunch hour in Fitzrovia, trading the sit-down meal for something lighter and quieter.",
          },
          {
            name: "Pizza on Goodge Street",
            kind: "food",
            neighborhood: "Fitzrovia",
            coordinates: {
              lat: 51.5206,
              lng: -0.1345,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Shared tables, ovens running, plates on every table.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Lamplit rooms, much the same through the afternoon.",
            },
            summary:
              "A street of pizza kitchens and shared tables, a few minutes north of Charlotte Street.",
            aesthetic: ["brick", "tiled counters"],
            reason:
              "Same lunch hour in Fitzrovia, trading a leisurely table for a livelier shared one.",
          },
        ],
      },
      {
        stopIndex: 3,
        options: [
          {
            name: "Soho Square",
            kind: "garden",
            neighborhood: "Soho",
            coordinates: {
              lat: 51.5156,
              lng: -0.1319,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "steady",
              texture: "Benches, pigeons, a few people on the lawn.",
            },
            light: {
              exposure: "dappled",
              orientation: "none",
              bestWindow: "afternoon",
              note: "Afternoon light falls through bare and leafy trees onto the lawn, then drops behind the buildings.",
            },
            summary: "A small green square with benches, three minutes north of the market.",
            aesthetic: ["lawn", "plane trees"],
            reason: "Same stretch of Soho, trading the stalls for a bench and some grass.",
          },
          {
            name: "Carnaby Street",
            kind: "shop",
            neighborhood: "Soho",
            coordinates: {
              lat: 51.513,
              lng: -0.1385,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Shop doors, music from each, shoppers in the street.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "afternoon",
              note: "Open to the sky overhead, with hung lights coming on as the afternoon fades.",
            },
            summary:
              "A pedestrian shopping street a few minutes west, much busier than the market on a Saturday.",
            aesthetic: ["shopfronts", "hung lights"],
            reason: "Same area and hour, trading the stalls for shop windows and a bigger crowd.",
          },
        ],
      },
      {
        stopIndex: 4,
        options: [
          {
            name: "Coffee on Bateman Street",
            kind: "coffee",
            neighborhood: "Soho",
            coordinates: {
              lat: 51.5137,
              lng: -0.1299,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "Cups, low talk, a side street with few passers-by.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Lamplit rooms in the late afternoon, with the street going dim outside.",
            },
            summary:
              "A quiet side street of coffee counters, a better choice if you want something to drink without the pub noise.",
            aesthetic: ["brick", "painted shopfronts"],
            reason:
              "Same break in the day in the same part of Soho, trading beer for coffee and the noise for quiet.",
          },
          {
            name: "Cocktails on Old Compton Street",
            kind: "bar",
            neighborhood: "Soho",
            coordinates: {
              lat: 51.513,
              lng: -0.1313,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Open doors, music, a crowd on the pavement.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Shop signs and doorways light the street as the sky dims.",
            },
            summary:
              "The busiest bar street in Soho, a few minutes south, which is loud by half past four on a Saturday.",
            aesthetic: ["neon signs", "brick"],
            reason:
              "Same part of Soho and same hour, trading the pub for a louder, more crowded bar street.",
          },
        ],
      },
      {
        stopIndex: 5,
        options: [
          {
            name: "Noodles on Lisle Street",
            kind: "food",
            neighborhood: "Chinatown",
            coordinates: {
              lat: 51.5114,
              lng: -0.1303,
            },
            sensory: {
              energy: "balanced",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Steamed windows, small tables, quick service.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Lamplit rooms, with the lanterns outside coming on in the evening.",
            },
            summary:
              "Smaller noodle kitchens a block from Gerrard Street, shorter meals and less shouting.",
            aesthetic: ["steamed windows", "painted signs"],
            reason:
              "Same Chinatown dinner, trading banquet tables for small ones and a shorter meal.",
          },
          {
            name: "Hot pot on Wardour Street",
            kind: "food",
            neighborhood: "Chinatown",
            coordinates: {
              lat: 51.5115,
              lng: -0.1319,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Boiling pots at every table, loud groups, steam overhead.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Lit by lamps indoors, with the street lanterns outside.",
            },
            summary:
              "Hot pot kitchens where each table cooks its own meal, good for a group of friends.",
            aesthetic: ["steam", "red lanterns"],
            reason: "Same Chinatown dinner, trading plates for a shared pot and a louder room.",
          },
        ],
      },
      {
        stopIndex: 6,
        options: [
          {
            name: "Wine on Rupert Street",
            kind: "bar",
            neighborhood: "Soho",
            coordinates: {
              lat: 51.5115,
              lng: -0.134,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "steady",
              texture: "Candlelit tables, bottles on shelves, low talk.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Candles and low lamps inside, dim against the street.",
            },
            summary: "A quieter street of wine bars two minutes west of the cocktail bars.",
            aesthetic: ["candlelight", "dark wood"],
            reason:
              "Same part of Soho and same hour, trading cocktails for wine and the noise for quiet.",
          },
          {
            name: "Drinks on Wardour Street",
            kind: "bar",
            neighborhood: "Soho",
            coordinates: {
              lat: 51.5124,
              lng: -0.1331,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Bass through the walls, queues at doors, crowds on the pavement.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Neon and signs light the street, dark rooms inside.",
            },
            summary:
              "A louder stretch of bars and clubs a block west, already busy early on a Saturday.",
            aesthetic: ["neon signs", "black walls"],
            reason: "Same part of Soho and same hour, trading the cocktail rooms for louder clubs.",
          },
        ],
      },
    ],
  },
};
