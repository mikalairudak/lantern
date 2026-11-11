import type { WrittenDay } from "./written-day";
import { BARCELONA_REQUEST } from "./city-days";

/**
 * Barcelona, as claude-sonnet-5-5 wrote it on 2026-11-11 under day-v11, for its own address
 * (generation c9053524-fb1a-45b0-9709-aa6ec588caf8). Kept as written, letters escaped twice read as
 * the reader reads them, so the address opens a day the product really wrote, slips and all; the
 * normalizer repairs what it repairs for any live day.
 */
export const BARCELONA_DAY: WrittenDay = {
  request: BARCELONA_REQUEST,
  day: {
    assumptions: {
      travel: "on-foot",
      start: "slow",
      dinner: null,
      end: "late",
      company: null,
    },
    dek: "A slow start with coffee in El Born, the Santa Caterina market at lunch, an afternoon in the Gothic Quarter and the Ciutadella, a vermouth hour, a late Gràcia dinner and a long night of bars in the Raval.",
    stops: [
      {
        startTime: "10:00",
        durationMinutes: 60,
        place: {
          name: "Coffee on Carrer del Rec",
          kind: "coffee",
          neighborhood: "El Born",
          coordinates: {
            lat: 41.3854,
            lng: 2.1826,
          },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture:
              "Espresso machines hissing, strollers and friends on the narrow street, the first terraces filling.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "morning",
            note: "The street is narrow, so sun only drops in for a short stretch around midday; at ten it is bright shade.",
          },
          summary:
            "Saturday mornings start late here: at ten the terraces are filling for coffee and croissants, and the street is busy without being packed yet.",
          aesthetic: ["stone facades", "bistro tables"],
        },
        dependsOn: ["start", "company"],
      },
      {
        startTime: "11:15",
        durationMinutes: 75,
        place: {
          name: "Museu Picasso",
          kind: "museum",
          neighborhood: "El Born",
          coordinates: {
            lat: 41.3852,
            lng: 2.1809,
          },
          sensory: {
            energy: "balanced",
            acoustic: "murmur",
            crowd: "busy",
            texture:
              "Quiet footsteps on stone, guides whispering in small groups, a courtyard with some echo.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "Lit by gallery lamps, so the hour does not change what you see; the courtyard takes some daylight.",
          },
          summary:
            "Open since ten, it is one street from the coffee, and booking a slot ahead lets you skip the queue that builds up by noon.",
          aesthetic: ["medieval stone palaces", "white gallery walls"],
        },
        dependsOn: ["start"],
      },
      {
        startTime: "13:00",
        durationMinutes: 75,
        place: {
          name: "Mercat de Santa Caterina",
          kind: "market",
          neighborhood: "El Born",
          coordinates: {
            lat: 41.3863,
            lng: 2.1783,
          },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture: "Stall holders calling, knives on boards, plates clinking at the counters.",
          },
          light: {
            exposure: "covered",
            orientation: "none",
            bestWindow: "midday",
            note: "The wavy tiled roof throws colored light over the stalls, strongest around noon.",
          },
          summary:
            "Saturday lunch is when the counters at the back are full of locals, so you can share plates of seafood, tortilla and croquettes standing or seated at the bar.",
          aesthetic: ["colored ceramic roof", "tiled counters"],
        },
        dependsOn: ["company"],
      },
      {
        startTime: "14:40",
        durationMinutes: 60,
        place: {
          name: "Carrer del Bisbe and Plaça Sant Felip Neri",
          kind: "walk",
          neighborhood: "Barri Gòtic",
          coordinates: {
            lat: 41.3837,
            lng: 2.1763,
          },
          sensory: {
            energy: "balanced",
            acoustic: "murmur",
            crowd: "steady",
            texture:
              "Stone alleys that echo footsteps, a fountain in the small square, a guitar somewhere.",
          },
          light: {
            exposure: "dappled",
            orientation: "none",
            bestWindow: "afternoon",
            note: "Narrow alleys stay in shade and the sun only reaches the squares, so afternoon brings the best light into the open spaces.",
          },
          summary:
            "After lunch, the quiet lanes behind the cathedral let you walk the meal off, and the small square is calm while the main streets are still busy.",
          aesthetic: ["gothic stone", "wrought iron"],
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "16:00",
        durationMinutes: 90,
        place: {
          name: "Parc de la Ciutadella",
          kind: "garden",
          neighborhood: "La Ribera",
          coordinates: {
            lat: 41.3883,
            lng: 2.1875,
          },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture:
              "Drums by the fountain, rowing boats knocking on the pond, friends spread out on the grass.",
          },
          light: {
            exposure: "dappled",
            orientation: "none",
            bestWindow: "afternoon",
            note: "The sun drops lower through the palms and plane trees from around four, with long warm light across the paths.",
          },
          summary:
            "On a Saturday afternoon half the city is here, so the paths around the pond and the big cascade fountain are full of people and music.",
          aesthetic: ["palm trees", "gravel paths", "stone fountain"],
        },
        dependsOn: ["company", "travel"],
      },
      {
        startTime: "18:30",
        durationMinutes: 75,
        place: {
          name: "Vermouth along Carrer de la Princesa",
          kind: "bar",
          neighborhood: "El Born",
          coordinates: {
            lat: 41.3846,
            lng: 2.1813,
          },
          sensory: {
            energy: "social",
            acoustic: "chatter",
            crowd: "busy",
            texture:
              "Glasses clinking at the doorways, small talk spilling onto the pavement, plates of olives and anchovies passed around.",
          },
          light: {
            exposure: "covered",
            orientation: "none",
            bestWindow: "after-dark",
            note: "The sun is gone from the street by half past six, so lamps and bar windows take over as it gets dark.",
          },
          summary:
            "Vermouth with olives and anchovies is the Saturday pre-dinner drink here, and a late dinner leaves room for it at the usual hour.",
          aesthetic: ["old stone", "zinc counters"],
        },
        dependsOn: ["dinner", "company"],
      },
      {
        startTime: "20:00",
        durationMinutes: 30,
        place: {
          name: "Passeig de Gràcia",
          kind: "walk",
          neighborhood: "Eixample",
          coordinates: {
            lat: 41.3917,
            lng: 2.1649,
          },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture: "Shop doors opening, buses idling, crowds under the lit facades.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "after-dark",
            note: "At eight it is fully dark and the facades are lit from below, which is the time to see the carved stonework.",
          },
          summary:
            "An evening stroll to see the lit facades is an easy way to cover the distance toward Gràcia while you wait for a late dinner.",
          aesthetic: ["modernista facades", "wide pavements"],
        },
        dependsOn: ["travel", "dinner"],
      },
      {
        startTime: "21:15",
        durationMinutes: 120,
        place: {
          name: "Tapas around Plaça de la Vila de Gràcia",
          kind: "food",
          neighborhood: "Gràcia",
          coordinates: {
            lat: 41.4005,
            lng: 2.1573,
          },
          sensory: {
            energy: "social",
            acoustic: "loud",
            crowd: "packed",
            texture:
              "Voices overlapping, chairs scraping on the square, waiters moving between crowded tables.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "after-dark",
            note: "Street lamps and string lights are the only light, so the square looks warmest from nine.",
          },
          summary:
            "Nine is early for the late sitting here: the square fills with friends sharing patatas bravas, croquetas and grilled vegetables, and the tables turn slowly.",
          aesthetic: ["village square", "white-washed walls"],
        },
        dependsOn: ["dinner", "company", "end"],
      },
      {
        startTime: "23:30",
        durationMinutes: 150,
        place: {
          name: "Cocktails and beer along Carrer de Joaquín Costa",
          kind: "bar",
          neighborhood: "El Raval",
          coordinates: {
            lat: 41.3815,
            lng: 2.1695,
          },
          sensory: {
            energy: "social",
            acoustic: "loud",
            crowd: "packed",
            texture:
              "Music through open doors, queues at the narrow bars, glasses on the pavement.",
          },
          light: {
            exposure: "covered",
            orientation: "none",
            bestWindow: "after-dark",
            note: "Neon and low bar lamps only, so the street looks the same from eleven to closing.",
          },
          summary:
            "On a Saturday the bars along this street are full from eleven until the small hours, and each one is a few steps from the next.",
          aesthetic: ["neon signs", "tiled bar fronts"],
        },
        dependsOn: ["end", "company"],
      },
    ],
    alternatives: [
      {
        stopIndex: 0,
        options: [
          {
            name: "Coffee in Plaça de Sant Agustí Vell",
            kind: "coffee",
            neighborhood: "El Born",
            coordinates: {
              lat: 41.3868,
              lng: 2.1822,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "A few tables on the square, pigeons, the odd local with a newspaper.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "morning",
              note: "The square is open to the sky, so it gets direct sun from mid-morning.",
            },
            summary:
              "A small square a few streets from the main drag, where coffee is slower and the morning stays quiet.",
            aesthetic: ["stone facades", "plane trees"],
            reason: "The same morning coffee in El Born, trading the busy lane for a quiet square.",
          },
          {
            name: "Coffee on Passeig del Born",
            kind: "coffee",
            neighborhood: "El Born",
            coordinates: {
              lat: 41.3846,
              lng: 2.1833,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture:
                "Waiters weaving between tables, brunch orders shouted, loud talk across the promenade.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "midday",
              note: "The wide promenade gets sun by late morning, so terrace tables are in light from about eleven.",
            },
            summary:
              "The promenade terraces are at their loudest on a Saturday late morning, with coffee and brunch plates at every table.",
            aesthetic: ["long promenade", "terrace tables"],
            reason:
              "The same coffee hour and neighbourhood, trading the side lane for the busiest terraces.",
          },
        ],
      },
      {
        stopIndex: 1,
        options: [
          {
            name: "Basilica de Santa Maria del Mar",
            kind: "sacred",
            neighborhood: "El Born",
            coordinates: {
              lat: 41.3837,
              lng: 2.1819,
            },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Footsteps on stone, candles, a few whispers under the tall nave.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "midday",
              note: "Light comes through the tall windows and is strongest around midday, when the stone glows.",
            },
            summary:
              "A few streets from the museum, the nave is tall and quiet, with plain stone walls and slim columns.",
            aesthetic: ["gothic stone", "stained glass"],
            reason: "Also inside stone walls in El Born, but silent instead of a busy museum.",
          },
          {
            name: "Born Centre de Cultura i Memòria",
            kind: "museum",
            neighborhood: "El Born",
            coordinates: {
              lat: 41.3856,
              lng: 2.1836,
            },
            sensory: {
              energy: "social",
              acoustic: "chatter",
              crowd: "busy",
              texture:
                "Voices echoing off the iron roof, people crossing excavated streets and talking at the cafe tables.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "none",
              note: "Under a high iron roof, so the light stays even and the hour does not matter.",
            },
            summary:
              "A former market hall with excavated streets inside, open to walk through, with a cafe and more noise than a gallery.",
            aesthetic: ["iron roof", "excavated stone"],
            reason:
              "Also a short walk in El Born, trading quiet galleries for a bigger, noisier hall.",
          },
        ],
      },
      {
        stopIndex: 2,
        options: [
          {
            name: "Plaça de Santa Maria",
            kind: "walk",
            neighborhood: "El Born",
            coordinates: {
              lat: 41.3838,
              lng: 2.1823,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "A few people on the steps, pigeons, soft talk in front of the church.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "midday",
              note: "The small square gets direct sun around midday, then the church shades it.",
            },
            summary:
              "A small square in front of the basilica where you can sit on the steps with food from the market.",
            aesthetic: ["stone facade", "cobbles"],
            reason:
              "The same lunch in El Born, taken outdoors on a quiet square instead of at the counter.",
          },
          {
            name: "Bar-hopping on Carrer dels Banys Vells",
            kind: "bar",
            neighborhood: "El Born",
            coordinates: {
              lat: 41.3846,
              lng: 2.1803,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture:
                "Narrow doorways full of people, plates passed overhead, talk and laughter on the street.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "none",
              note: "A narrow street in shade all day, so the light stays the same.",
            },
            summary:
              "A narrow street of small bars where lunch is vermouth and tapas standing at the door.",
            aesthetic: ["stone alleys", "wooden doors"],
            reason: "The same Saturday lunch hour in El Born, with the energy turned up to bars.",
          },
        ],
      },
      {
        stopIndex: 3,
        options: [
          {
            name: "Plaça del Rei",
            kind: "walk",
            neighborhood: "Barri Gòtic",
            coordinates: {
              lat: 41.3844,
              lng: 2.177,
            },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Footsteps on flagstones, wide steps, hardly any voices.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "afternoon",
              note: "Stone walls on all sides catch the low afternoon sun and glow warm.",
            },
            summary:
              "A closed square of old stone with wide steps, usually the quietest spot in the Gothic Quarter.",
            aesthetic: ["medieval stone", "flagstones"],
            reason: "The same Gothic Quarter afternoon, trading the lanes for one hushed square.",
          },
          {
            name: "Carrer d'Avinyó",
            kind: "shop",
            neighborhood: "Barri Gòtic",
            coordinates: {
              lat: 41.3801,
              lng: 2.1769,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture:
                "Shop doors open to the street, music from the doorways, crowds moving slowly.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "none",
              note: "The narrow street stays in shade most of the day, so the light stays even.",
            },
            summary:
              "A Saturday afternoon street of small shops and bars, with noise and people at every door.",
            aesthetic: ["stone alleys", "shop signs"],
            reason:
              "Still in the Gothic Quarter, trading quiet stone lanes for a crowded shopping street.",
          },
        ],
      },
      {
        stopIndex: 4,
        options: [
          {
            name: "Hivernacle del Parc de la Ciutadella",
            kind: "garden",
            neighborhood: "La Ribera",
            coordinates: {
              lat: 41.3889,
              lng: 2.1866,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "Wet earth and leaves, quiet footsteps on gravel, filtered daylight.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "afternoon",
              note: "Sun comes through the glass and trees and turns softer as the afternoon goes.",
            },
            summary:
              "A glass and iron greenhouse in the same park, with palms and ferns and far fewer people than the pond.",
            aesthetic: ["iron and glass", "palm leaves"],
            reason: "Still in the Ciutadella, but indoors among plants instead of the busy pond.",
          },
          {
            name: "Platja de la Barceloneta",
            kind: "walk",
            neighborhood: "La Barceloneta",
            coordinates: {
              lat: 41.3784,
              lng: 2.1925,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "busy",
              texture: "Football on the sand, music from beach bars, joggers on the promenade.",
            },
            light: {
              exposure: "open",
              orientation: "se",
              bestWindow: "afternoon",
              note: "Fully open to the sky, with low sun along the sand in the late afternoon.",
            },
            summary:
              "A Saturday afternoon on the sand, with the beach bars and promenade full of people.",
            aesthetic: ["sand", "promenade"],
            reason:
              "A big open space for the same afternoon, trading the park for the sea and the crowd.",
          },
        ],
      },
      {
        stopIndex: 5,
        options: [
          {
            name: "Wine in Plaça de les Olles",
            kind: "bar",
            neighborhood: "El Born",
            coordinates: {
              lat: 41.3832,
              lng: 2.1827,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "A few tables outside, low talk, glasses set down on marble.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "after-dark",
              note: "A small square lit by lamps after sunset, with a soft glow on the walls.",
            },
            summary:
              "A small square a few steps from the vermouth street where the early evening is for a glass of wine and a plate of cheese.",
            aesthetic: ["old stone", "wood tables"],
            reason: "Same early evening drink, trading the busy doorways for a quiet table.",
          },
          {
            name: "Cocktails along Carrer dels Assaonadors",
            kind: "bar",
            neighborhood: "El Born",
            coordinates: {
              lat: 41.3856,
              lng: 2.1815,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Music through open doors, queues at the bar, groups on the pavement.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Bar lamps and neon take over from the daylight at about half past six.",
            },
            summary:
              "A short street of cocktail bars that fills quickly on Saturday evenings, with music at every door.",
            aesthetic: ["neon signs", "stone alleys"],
            reason:
              "The same pre-dinner drink in El Born, trading vermouth for cocktails and more noise.",
          },
        ],
      },
      {
        stopIndex: 6,
        options: [
          {
            name: "Arc de Triomf",
            kind: "architecture",
            neighborhood: "Sant Pere",
            coordinates: {
              lat: 41.3911,
              lng: 2.1806,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "A wide promenade with palms, a few skaters and walkers, soft footsteps.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "after-dark",
              note: "The red brick is lit from below after dark, and the promenade is a long open stretch of sky.",
            },
            summary:
              "A red brick arch at the head of a wide palm-lined walk, quiet on Saturday evenings.",
            aesthetic: ["red brick", "palm trees"],
            reason:
              "An evening walk with a landmark at the end, trading the shop crowds for a quiet promenade.",
          },
          {
            name: "Rambla de Catalunya",
            kind: "walk",
            neighborhood: "Eixample",
            coordinates: {
              lat: 41.3926,
              lng: 2.1623,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture:
                "Terraces full of talk, glasses and plates, heaters glowing along the wide pavement.",
            },
            light: {
              exposure: "dappled",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Plane trees and terrace lamps make the light warm and patchy after dark.",
            },
            summary: "A wide tree-lined pavement of terraces, full of friends on a Saturday night.",
            aesthetic: ["plane trees", "terrace tables"],
            reason: "A parallel evening walk in the Eixample, with more noise and more tables.",
          },
        ],
      },
      {
        stopIndex: 7,
        options: [
          {
            name: "Plaça del Sol",
            kind: "food",
            neighborhood: "Gràcia",
            coordinates: {
              lat: 41.4012,
              lng: 2.1569,
            },
            sensory: {
              energy: "balanced",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Terrace tables, steady talk, a few guitars in the square.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Lit by the street lamps, with an even glow across the square.",
            },
            summary:
              "A neighbouring square in Gràcia where the late dinner is a little less crowded, with grilled vegetables and croquetas at outdoor tables.",
            aesthetic: ["village square", "terrace tables"],
            reason:
              "The same late dinner in Gràcia, trading the loudest square for a slightly calmer one.",
          },
          {
            name: "Carrer de Verdi",
            kind: "food",
            neighborhood: "Gràcia",
            coordinates: {
              lat: 41.4035,
              lng: 2.1565,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Queues at the door, plates passing overhead, talk at full volume.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Shop lights and street lamps only, so it feels the same all evening.",
            },
            summary:
              "A busy street of small kitchens and bars where dinner turns into a crowd at every door on Saturday.",
            aesthetic: ["narrow street", "shop fronts"],
            reason: "The same Gràcia dinner, with the energy turned up in a busy street.",
          },
        ],
      },
      {
        stopIndex: 8,
        options: [
          {
            name: "Wine on Carrer del Doctor Dou",
            kind: "bar",
            neighborhood: "El Raval",
            coordinates: {
              lat: 41.3825,
              lng: 2.1702,
            },
            sensory: {
              energy: "balanced",
              acoustic: "chatter",
              crowd: "steady",
              texture: "Low lamps, wine glasses on small tables, steady talk.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Lit by bar windows only, so it looks the same from eleven to closing.",
            },
            summary:
              "A calmer street in the Raval where late wine and cheese plates suit a smaller table.",
            aesthetic: ["wood tables", "low lamps"],
            reason: "The same late-night Raval, trading the loud bars for wine at a smaller table.",
          },
          {
            name: "Dancing around Carrer de Nou de la Rambla",
            kind: "bar",
            neighborhood: "El Raval",
            coordinates: {
              lat: 41.379,
              lng: 2.1738,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Bass through the walls, queues at the doors, crowds on the pavement.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Neon and bar lights only, the same all night.",
            },
            summary:
              "A street of music bars and clubs that is busiest well after midnight on Saturdays.",
            aesthetic: ["neon signs", "dark doorways"],
            reason:
              "The same Raval night with the volume up, trading the cocktail bars for dancing.",
          },
        ],
      },
    ],
  },
};
