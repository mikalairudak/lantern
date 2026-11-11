import type { WrittenDay } from "./written-day";
import { NEW_YORK_REQUEST } from "./city-days";

/**
 * New York, as claude-sonnet-5-5 wrote it on 2026-11-11 under day-v11, for its own address
 * (generation 8e758373-f18d-4090-9d9d-d1671c825cf1). Kept as written, letters escaped twice read as
 * the reader reads them, so the address opens a day the product really wrote, slips and all; the
 * normalizer repairs what it repairs for any live day.
 */
export const NEW_YORK_DAY: WrittenDay = {
  request: NEW_YORK_REQUEST,
  day: {
    assumptions: {
      travel: "on-foot",
      start: "slow",
      dinner: "late",
      end: null,
      company: null,
    },
    dek: "A slow Saturday start with coffee on Bleecker, a walk through the Village to Washington Square, the Chelsea Market lunch crowd and the Chelsea galleries, then the High Line at dusk, a late dinner in the East Village and drinks that run past midnight.",
    stops: [
      {
        startTime: "10:00",
        durationMinutes: 45,
        place: {
          name: "Coffee on Bleecker Street",
          kind: "coffee",
          neighborhood: "West Village",
          coordinates: {
            lat: 40.7335,
            lng: -74.0035,
          },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture:
              "Espresso machines, dog leashes, strollers and weekend brunch lines out the doors.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "morning",
            note: "The street runs east to west, so the sun comes down the block at mid-morning and the sidewalk tables are warmest around ten.",
          },
          summary:
            "Coffee and pastries on the street at ten, when the Saturday brunch crowd is building but tables on the sidewalk still turn over.",
          aesthetic: ["brownstone brick", "street cafe"],
        },
        dependsOn: ["start"],
      },
      {
        startTime: "11:00",
        durationMinutes: 75,
        place: {
          name: "Washington Square Park",
          kind: "walk",
          neighborhood: "Greenwich Village",
          coordinates: {
            lat: 40.7308,
            lng: -73.9973,
          },
          sensory: {
            energy: "social",
            acoustic: "chatter",
            crowd: "busy",
            texture:
              "Buskers by the fountain, chess tables clacking, dogs in the run, a piano somewhere.",
          },
          light: {
            exposure: "dappled",
            orientation: "none",
            bestWindow: "midday",
            note: "In November the plane trees are mostly bare, so the sun reaches the fountain plaza all through late morning.",
          },
          summary:
            "On a Saturday late morning the fountain plaza fills with musicians and chess players, and a loop around the paths is the easiest way to see it.",
          aesthetic: ["marble arch", "bare plane trees"],
        },
        dependsOn: ["start"],
      },
      {
        startTime: "12:30",
        durationMinutes: 90,
        place: {
          name: "Chelsea Market",
          kind: "market",
          neighborhood: "Chelsea",
          coordinates: {
            lat: 40.7424,
            lng: -74.0061,
          },
          sensory: {
            energy: "social",
            acoustic: "loud",
            crowd: "packed",
            texture:
              "Brick corridor, steam from the kitchens, trays being carried over your shoulder, strangers sharing tables.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "Lit from inside, so the hour changes nothing about the light; it only changes the size of the crowd.",
          },
          summary:
            "Lunch hour on a Saturday is the busiest the market gets, so go in hungry, eat standing at a counter and keep moving.",
          aesthetic: ["exposed brick", "industrial pipes"],
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "14:15",
        durationMinutes: 105,
        place: {
          name: "West Chelsea Galleries",
          kind: "gallery",
          neighborhood: "Chelsea",
          coordinates: {
            lat: 40.7479,
            lng: -74.0045,
          },
          sensory: {
            energy: "balanced",
            acoustic: "murmur",
            crowd: "steady",
            texture:
              "Concrete floors, white rooms, footsteps and low talk, a street door that opens onto the next building.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "afternoon",
            note: "Many of the converted warehouses have skylights, so the rooms are at their softest in the early afternoon.",
          },
          summary:
            "The galleries between 10th and 11th Avenues are open on Saturdays in the afternoon and free, so you can walk in off the street and leave when a room stops holding you.",
          aesthetic: ["white cube", "poured concrete", "skylights"],
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "16:15",
        durationMinutes: 75,
        place: {
          name: "The High Line",
          kind: "walk",
          neighborhood: "Chelsea",
          coordinates: {
            lat: 40.748,
            lng: -74.0048,
          },
          sensory: {
            energy: "lively",
            acoustic: "murmur",
            crowd: "busy",
            texture:
              "Wood decking underfoot, wind off the river at the cross streets, grasses gone brown and gold.",
          },
          light: {
            exposure: "open",
            orientation: "w",
            bestWindow: "sunset",
            note: "Sunset is just after half past four in mid-November, so the Hudson end of the walk catches low orange light on the buildings.",
          },
          summary:
            "Walking it south to north around sunset means the light is behind you on the river side, and the buildings along the way turn warm while the crowd thins toward Hudson Yards.",
          aesthetic: ["steel and timber", "wild grasses"],
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "17:45",
        durationMinutes: 60,
        place: {
          name: "Wine on Bleecker and Jones",
          kind: "bar",
          neighborhood: "West Village",
          coordinates: {
            lat: 40.7326,
            lng: -74.0043,
          },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture: "Small tables close together, windows steamed up, glasses on zinc counters.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "after-dark",
            note: "By six the streetlamps are on and the room glow is mostly candles and low bulbs.",
          },
          summary:
            "An early-evening glass of wine before a late dinner, in the stretch of small wine bars west of Seventh Avenue that fill from six.",
          aesthetic: ["zinc bar", "candlelight"],
        },
        dependsOn: ["dinner"],
      },
      {
        startTime: "21:00",
        durationMinutes: 120,
        place: {
          name: "Dinner along East 6th Street",
          kind: "food",
          neighborhood: "East Village",
          coordinates: {
            lat: 40.7286,
            lng: -73.9892,
          },
          sensory: {
            energy: "social",
            acoustic: "loud",
            crowd: "packed",
            texture:
              "Curry smoke from the row of Indian restaurants, sidewalk hosts calling out, doors open to the cold.",
          },
          light: {
            exposure: "covered",
            orientation: "none",
            bestWindow: "after-dark",
            note: "After dark the strings of coloured lights above the doors are most of the light on the block.",
          },
          summary:
            "Past nine on a Saturday the second-floor and basement rooms along this block are full and kitchens run until after eleven, so a late table is easy to find.",
          aesthetic: ["string lights", "tin ceilings"],
        },
        dependsOn: ["dinner"],
      },
      {
        startTime: "23:15",
        durationMinutes: 120,
        place: {
          name: "Drinks on Avenue A",
          kind: "bar",
          neighborhood: "East Village",
          coordinates: {
            lat: 40.7265,
            lng: -73.9815,
          },
          sensory: {
            energy: "social",
            acoustic: "loud",
            crowd: "packed",
            texture: "Music through every door, people in the doorways, jukeboxes, shots and beer.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "after-dark",
            note: "Red and amber bulbs behind the bars throw most of the light onto the sidewalk.",
          },
          summary:
            "Saturday after eleven is when the bars along Avenue A are at their fullest and stay open until two or later.",
          aesthetic: ["dive bar", "neon signs"],
        },
        dependsOn: [],
      },
    ],
    alternatives: [
      {
        stopIndex: 0,
        options: [
          {
            name: "Coffee on Christopher Street",
            kind: "coffee",
            neighborhood: "West Village",
            coordinates: {
              lat: 40.7333,
              lng: -74.0044,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "steady",
              texture: "Counter chatter, a few sidewalk tables, quieter than Bleecker.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "morning",
              note: "Low morning sun reaches the sidewalk tables for the first couple of hours.",
            },
            summary: "Coffee a few blocks west where the brunch queues are shorter.",
            aesthetic: ["brick", "sidewalk tables"],
            reason:
              "Same neighborhood and same coffee at the same hour, but with fewer people and less queue.",
          },
          {
            name: "Brunch on Bleecker and MacDougal",
            kind: "food",
            neighborhood: "Greenwich Village",
            coordinates: {
              lat: 40.7298,
              lng: -74.0005,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture:
                "Brunch lines on the sidewalk, plates across crowded tables, trays moving fast.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "morning",
              note: "Awnings shade the sidewalk, so the light is even through the morning.",
            },
            summary:
              "The busiest brunch corner of the Village, with eggs and pancakes and a wait at the door.",
            aesthetic: ["awnings", "street bustle"],
            reason:
              "Still a morning meal in the Village, trading the quick coffee for a full sit-down in a louder crowd.",
          },
        ],
      },
      {
        stopIndex: 1,
        options: [
          {
            name: "Mercer Street",
            kind: "walk",
            neighborhood: "SoHo",
            coordinates: {
              lat: 40.7253,
              lng: -73.9996,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "Cobblestones, cast-iron facades, few cars, footsteps echoing.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "midday",
              note: "The narrow street is lit from above at midday and in shade the rest of the day.",
            },
            summary:
              "A quieter cast-iron block a few minutes south of the park, with less foot traffic.",
            aesthetic: ["cast iron", "cobblestone"],
            reason:
              "Still an outdoor Village-area walk at the same hour, trading the fountain crowd for a quiet block.",
          },
          {
            name: "Bleecker Street Playground and Sixth Avenue",
            kind: "walk",
            neighborhood: "Greenwich Village",
            coordinates: {
              lat: 40.7312,
              lng: -74.0006,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Basketball courts, street vendors, people everywhere, honking.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "midday",
              note: "Open to the sky, so midday sun reaches the courts and the avenue.",
            },
            summary:
              "The basketball courts and busy corner a few blocks away, with more noise than the park.",
            aesthetic: ["asphalt", "street vendors"],
            reason:
              "Same neighborhood walk at the same hour, trading the park's open paths for louder streets.",
          },
        ],
      },
      {
        stopIndex: 2,
        options: [
          {
            name: "Hudson River Park at Pier 57",
            kind: "walk",
            neighborhood: "Chelsea",
            coordinates: {
              lat: 40.7424,
              lng: -74.0083,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "Wind off the water, gulls, joggers passing, rooftop lawn quiet.",
            },
            light: {
              exposure: "open",
              orientation: "w",
              bestWindow: "afternoon",
              note: "Open to the river, so the sun is full and low through the afternoon.",
            },
            summary: "The riverside walk a few minutes west of the market, away from the crowd.",
            aesthetic: ["waterfront", "timber piers"],
            reason:
              "Same neighborhood at lunchtime, trading the packed halls for open air and a quieter walk.",
          },
          {
            name: "Tacos on Ninth Avenue",
            kind: "food",
            neighborhood: "Chelsea",
            coordinates: {
              lat: 40.7418,
              lng: -74.0044,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Counter shouting, salsa and griddles, a line out the door.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "none",
              note: "Awnings and overhead lights mean the hour barely changes the light.",
            },
            summary: "A lunch stretch of taquerias and counters for a faster, louder meal.",
            aesthetic: ["tile counters", "griddles"],
            reason:
              "Same lunch hour and neighbourhood as the market, with a quicker counter meal in a louder crowd.",
          },
        ],
      },
      {
        stopIndex: 3,
        options: [
          {
            name: "Rubin Museum Block on 17th Street",
            kind: "walk",
            neighborhood: "Chelsea",
            coordinates: {
              lat: 40.7405,
              lng: -73.9975,
            },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Quiet sidewalks, brownstone steps, almost no one about.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "afternoon",
              note: "Afternoon sun comes down the side street at a low angle.",
            },
            summary: "A quiet residential stretch to slow down before the High Line.",
            aesthetic: ["brownstone", "quiet street"],
            reason:
              "Still on foot in Chelsea at the same hour, trading gallery rooms for a hushed street.",
          },
          {
            name: "Tenth Avenue Gallery Openings",
            kind: "gallery",
            neighborhood: "Chelsea",
            coordinates: {
              lat: 40.749,
              lng: -74.005,
            },
            sensory: {
              energy: "social",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Crowds spilling onto the sidewalk, wine cups, loud conversation.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "afternoon",
              note: "Gallery lights are on all day, so the hour hardly matters.",
            },
            summary:
              "The busiest block of galleries on a Saturday afternoon, where openings spill onto the sidewalk.",
            aesthetic: ["white walls", "street crowds"],
            reason:
              "Same galleries district at the same hour, trading quiet rooms for a busy, social crowd.",
          },
        ],
      },
      {
        stopIndex: 4,
        options: [
          {
            name: "Hudson Yards Terrace",
            kind: "viewpoint",
            neighborhood: "Hudson Yards",
            coordinates: {
              lat: 40.7536,
              lng: -74.002,
            },
            sensory: {
              energy: "balanced",
              acoustic: "murmur",
              crowd: "steady",
              texture: "Wide plazas, wind between towers, soft steady footsteps.",
            },
            light: {
              exposure: "open",
              orientation: "w",
              bestWindow: "sunset",
              note: "Open to the west, so the last light hits the glass towers at sunset.",
            },
            summary: "A wide plaza at the north end of the High Line for watching sunset.",
            aesthetic: ["glass towers", "stone plaza"],
            reason:
              "Same sunset hour and the same end of the line, trading the walk for a still view.",
          },
          {
            name: "Little Island at Pier 55",
            kind: "walk",
            neighborhood: "Chelsea",
            coordinates: {
              lat: 40.7421,
              lng: -74.0108,
            },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Wind off the Hudson, wooden steps, almost no one on the paths.",
            },
            light: {
              exposure: "open",
              orientation: "w",
              bestWindow: "sunset",
              note: "Open to the river, so the last sun lands directly on the park.",
            },
            summary: "A planted park on a pier a short walk away, quiet at dusk.",
            aesthetic: ["timber", "planted lawns"],
            reason:
              "Same sunset light and the same stretch of riverfront, trading the long walk for a quiet place to stand.",
          },
        ],
      },
      {
        stopIndex: 5,
        options: [
          {
            name: "Tea on Perry Street",
            kind: "coffee",
            neighborhood: "West Village",
            coordinates: {
              lat: 40.7353,
              lng: -74.0057,
            },
            sensory: {
              energy: "calm",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Quiet tables, steam from cups, a few people reading.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Warm bulbs and candles carry the room as it gets dark.",
            },
            summary: "A quiet tea stop on a residential street before dinner.",
            aesthetic: ["warm wood", "candlelight"],
            reason:
              "Same neighbourhood and early-evening hour, trading wine for tea and the crowd for quiet.",
          },
          {
            name: "Cocktails on Hudson Street",
            kind: "bar",
            neighborhood: "West Village",
            coordinates: {
              lat: 40.734,
              lng: -74.006,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Packed bar tops, shaking tins, people standing three deep.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Dim amber bulbs light the rooms once the sky is dark.",
            },
            summary: "A louder strip of cocktail bars just up the street, full by six.",
            aesthetic: ["dark wood", "amber bulbs"],
            reason:
              "Same neighbourhood and hour as the wine stop, trading quiet tables for a loud, packed bar.",
          },
        ],
      },
      {
        stopIndex: 6,
        options: [
          {
            name: "Dinner on East 7th Street",
            kind: "food",
            neighborhood: "East Village",
            coordinates: {
              lat: 40.7275,
              lng: -73.984,
            },
            sensory: {
              energy: "balanced",
              acoustic: "chatter",
              crowd: "steady",
              texture: "Small rooms, plates at close tables, steady talk.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Candles and low bulbs are most of the light at this hour.",
            },
            summary: "A quieter block of small restaurants near Tompkins Square with later tables.",
            aesthetic: ["exposed brick", "candlelight"],
            reason:
              "Same neighbourhood and late hour, trading the busy curry block for smaller rooms.",
          },
          {
            name: "Dumplings on St. Marks Place",
            kind: "food",
            neighborhood: "East Village",
            coordinates: {
              lat: 40.7295,
              lng: -73.988,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture:
                "Steam from kitchens, counter orders called out, people eating on the sidewalk.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Neon and shop signs carry most of the light on the block.",
            },
            summary: "Late-night counters along St. Marks serve ramen and dumplings past midnight.",
            aesthetic: ["neon signs", "tile counters"],
            reason:
              "Same neighbourhood and late hour, trading a sit-down dinner for faster, louder counters.",
          },
        ],
      },
      {
        stopIndex: 7,
        options: [
          {
            name: "Quiet Cocktails on East 9th Street",
            kind: "bar",
            neighborhood: "East Village",
            coordinates: {
              lat: 40.7279,
              lng: -73.9855,
            },
            sensory: {
              energy: "balanced",
              acoustic: "murmur",
              crowd: "steady",
              texture: "Low lamps, quiet conversation, bartenders stirring.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Low lamps and candles make most of the light.",
            },
            summary: "A calmer row of small cocktail bars a few blocks west.",
            aesthetic: ["dark wood", "candlelight"],
            reason:
              "Same neighbourhood and late hour, trading the packed Avenue A bars for quieter rooms.",
          },
        ],
      },
    ],
  },
};
