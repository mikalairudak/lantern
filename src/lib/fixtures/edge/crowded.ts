import type { EdgeDay } from "./edge-day";

/**
 * Twelve stops, built for where text sits rather than how much of it there is (asked for
 * by the design session for the one-row stop):
 *
 * - the longest name on a stop of balanced energy, so its bead sits mid-wire and the name
 *   fits on neither side at phone width; it also has the longest summary;
 * - a long name on an alternative, and a long neighbourhood that wraps "kind · neighbourhood";
 * - a long name in its own sunset window, so the sun mark wraps with it;
 * - two ten-minute stops in a row, whose middles are ten minutes apart;
 * - an option with the same energy as its stop, so two beads sit at one point;
 * - a reason of five words and one of about two hundred characters;
 * - swaps of every count: two, one, an empty set and no set at all.
 *
 * Hours and coordinates are roughly right, not checked against the places' own pages.
 */
export const CROWDED_DAY: EdgeDay = {
  edge: "twelve stops, the longest text and swaps of every count",
  request: {
    city: "Barcelona",
    date: "2027-03-20",
    timezone: "Europe/Madrid",
    citySource: "chosen",
    energy: "social",
    energySource: "chosen",
    travel: null,
    start: null,
    dinner: null,
    end: null,
    company: null,
  },
  day: {
    assumptions: {
      travel: "transit",
      start: "early",
      dinner: "late",
      end: "late",
      company: "friends",
    },
    dek: "The Sagrada Família at opening, Tàpies before noon, lunch at a Born counter, the Picasso museum, sunset from the bunkers on Turó de la Rovira, and a late night in Gràcia.",
    stops: [
      {
        startTime: "09:00",
        durationMinutes: 75,
        place: {
          name: "Basílica i Temple Expiatori de la Sagrada Família",
          kind: "sacred",
          neighborhood: "Sagrada Família",
          summary:
            "Book the first entry at nine and the nave is at its quietest, with the morning sun coming through the blue and green glass on the east side and laying colour across the columns; by the afternoon the light has moved to the warm west windows and the queue at the Nativity facade reaches the corner.",
          aesthetic: ["stone columns", "stained glass", "tree-like vaults"],
          coordinates: { lat: 41.4036, lng: 2.1744 },
          sensory: {
            energy: "balanced",
            acoustic: "murmur",
            crowd: "steady",
            texture:
              "Audio guides held to ears, footsteps under the vaults, a guard asking for quiet.",
          },
          light: {
            exposure: "interior",
            orientation: "ne",
            bestWindow: "morning",
            note: "Morning sun comes through the blue and green glass on the east side; by late afternoon the west windows turn the nave orange.",
          },
        },
        dependsOn: ["start"],
      },
      {
        startTime: "10:30",
        durationMinutes: 15,
        place: {
          name: "Pastries in the Eixample",
          kind: "coffee",
          neighborhood: "Dreta de l'Eixample",
          summary:
            "A coffee and a pastry at a counter at half past ten, before the brunch tables along Sant Joan fill.",
          aesthetic: ["mismatched chairs"],
          coordinates: { lat: 41.3982, lng: 2.1719 },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture: "Cups on saucers, the grinder, prams parked by the door.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "Big windows onto Passeig de Sant Joan; bright inside from mid-morning.",
          },
        },
        dependsOn: ["start"],
      },
      {
        startTime: "11:00",
        durationMinutes: 45,
        place: {
          name: "Fundació Antoni Tàpies",
          kind: "gallery",
          neighborhood: "Dreta de l'Eixample",
          summary:
            "Tàpies's paintings under the wire cloud on the roof, quiet before noon while the crowds are at the Gaudí houses down the street.",
          aesthetic: ["exposed brick"],
          coordinates: { lat: 41.3915, lng: 2.1636 },
          sensory: {
            energy: "calm",
            acoustic: "hushed",
            crowd: "sparse",
            texture: "Wooden floors, a guard's radio, traffic far below the skylights.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "Skylights over the main room; the light is even whatever the hour.",
          },
        },
        dependsOn: [],
      },
      {
        startTime: "12:20",
        durationMinutes: 10,
        place: {
          name: "Fossar de les Moreres",
          kind: "architecture",
          neighborhood: "Sant Pere, Santa Caterina i la Ribera",
          summary: "Ten minutes at the red arc beside the church on the way to lunch.",
          aesthetic: ["red steel arc", "brick paving"],
          coordinates: { lat: 41.3836, lng: 2.1817 },
          sensory: {
            energy: "reflective",
            acoustic: "murmur",
            crowd: "sparse",
            texture: "Footsteps crossing, a busker on the far corner, pigeons.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "none",
            note: "The square is in the church's shadow until about noon, then in full sun.",
          },
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "12:30",
        durationMinutes: 10,
        place: {
          name: "Santa Maria del Mar",
          kind: "sacred",
          neighborhood: "Sant Pere, Santa Caterina i la Ribera",
          summary: "Ten minutes inside at half past twelve, before the afternoon tours start.",
          aesthetic: ["bare stone", "octagonal columns"],
          coordinates: { lat: 41.3838, lng: 2.182 },
          sensory: {
            energy: "calm",
            acoustic: "hushed",
            crowd: "steady",
            texture: "Whispers carrying up the columns, a chair scraping, the door swinging.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "Tall and dim; the stained glass is brightest around noon.",
          },
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "13:00",
        durationMinutes: 90,
        place: {
          name: "Cava and tapas on Montcada",
          kind: "bar",
          neighborhood: "Sant Pere, Santa Caterina i la Ribera",
          summary:
            "Anchovies and cava at the narrow counters along Montcada, crowded by one on a Saturday; order through the gap.",
          aesthetic: ["blue tiles", "marble counters"],
          coordinates: { lat: 41.3847, lng: 2.1813 },
          sensory: {
            energy: "social",
            acoustic: "loud",
            crowd: "packed",
            texture: "Corks popping, orders shouted over shoulders, plates passed overhead.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "Tiled walls under bright bulbs; the street doors are the only daylight.",
          },
        },
        dependsOn: ["company"],
      },
      {
        startTime: "15:00",
        durationMinutes: 75,
        place: {
          name: "Museu Picasso",
          kind: "museum",
          neighborhood: "Sant Pere, Santa Caterina i la Ribera",
          summary:
            "The early work in a row of Montcada palaces, after the morning groups have left at three.",
          aesthetic: ["gothic courtyards", "stone stairs"],
          coordinates: { lat: 41.3852, lng: 2.1808 },
          sensory: {
            energy: "balanced",
            acoustic: "murmur",
            crowd: "busy",
            texture: "Low talk in front of the canvases, the creak of old floors.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "Galleries lit the same all day; the courtyards are in shade by three.",
          },
        },
        dependsOn: [],
      },
      {
        startTime: "16:30",
        durationMinutes: 45,
        place: {
          name: "Parc de la Ciutadella",
          kind: "garden",
          neighborhood: "Parc de la Ciutadella",
          summary:
            "A walk past the cascade and the lake in the late afternoon, when the lawns fill with picnics.",
          aesthetic: ["palm avenues"],
          coordinates: { lat: 41.3881, lng: 2.1873 },
          sensory: {
            energy: "calm",
            acoustic: "murmur",
            crowd: "steady",
            texture: "Rowing boats knocking, a drum circle somewhere, parakeets in the palms.",
          },
          light: {
            exposure: "dappled",
            orientation: "none",
            bestWindow: "afternoon",
            note: "Afternoon sun comes low through the palms; by noon the paths are in flat light.",
          },
        },
        dependsOn: [],
      },
      {
        startTime: "17:30",
        durationMinutes: 15,
        place: {
          name: "Espresso in Sant Pere",
          kind: "coffee",
          neighborhood: "Sant Pere, Santa Caterina i la Ribera",
          summary: "A last espresso at half past five, before the bus up the hill.",
          aesthetic: ["espresso counters"],
          coordinates: { lat: 41.389, lng: 2.177 },
          sensory: {
            energy: "balanced",
            acoustic: "murmur",
            crowd: "steady",
            texture: "Grinders going, cups on the counters, a laptop or two.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "The lanes outside are in shade by late afternoon; inside, the rooms run on lamps.",
          },
        },
        dependsOn: [],
      },
      {
        startTime: "18:30",
        durationMinutes: 75,
        place: {
          name: "Turó de la Rovira (Bunkers del Carmel)",
          kind: "viewpoint",
          neighborhood: "El Carmel",
          summary:
            "The old anti-aircraft platforms on the hill, where people bring beer and sit on the concrete for sunset.",
          aesthetic: ["anti-aircraft platforms", "dry grass"],
          coordinates: { lat: 41.4192, lng: 2.1617 },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "packed",
            texture: "Cans opening, a guitar, wind over the hill, the city's hum below.",
          },
          light: {
            exposure: "open",
            orientation: "s",
            bestWindow: "sunset",
            note: "At sunset the light comes low from Collserola across the city to the sea; at midday the view is hazy and flat.",
          },
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "20:30",
        durationMinutes: 105,
        place: {
          name: "Catalan cooking in Gràcia",
          kind: "food",
          neighborhood: "Vila de Gràcia",
          summary:
            "Grilled meat and calçots on long tables in Gràcia; the rooms are loud by half past eight, when the city starts dinner.",
          aesthetic: ["wooden benches", "open grill"],
          coordinates: { lat: 41.4036, lng: 2.1597 },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture: "The grill hissing, wine poured from a porró, tables sharing bread.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "Warm lamps over the tables; the street outside is dark by eight.",
          },
        },
        dependsOn: ["dinner", "company"],
      },
      {
        startTime: "22:30",
        durationMinutes: 90,
        place: {
          name: "Beer on Gràcia's squares",
          kind: "bar",
          neighborhood: "Vila de Gràcia",
          summary:
            "The corner bars on Gràcia's squares, full by half past ten, with people spilling out onto the paving.",
          aesthetic: ["formica tables", "pool tables"],
          coordinates: { lat: 41.4021, lng: 2.1585 },
          sensory: {
            energy: "social",
            acoustic: "loud",
            crowd: "packed",
            texture: "Pool balls cracking, beer on the bar, talk carrying across the square.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "after-dark",
            note: "Strip lights inside, street lamps on the square; it only comes alive after dark.",
          },
        },
        dependsOn: ["travel", "start", "dinner", "end", "company"],
      },
    ],
    alternatives: [
      {
        stopIndex: 0,
        options: [
          {
            name: "Plaça de Gaudí",
            kind: "garden",
            neighborhood: "Sagrada Família",
            summary:
              "A bench by the pond facing the Nativity facade, in sun until about ten while the queue forms across the road.",
            aesthetic: ["pond", "plane trees"],
            coordinates: { lat: 41.4041, lng: 2.1752 },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "steady",
              texture: "Traffic on Carrer de la Marina, ducks, tour leaders calling names.",
            },
            light: {
              exposure: "open",
              orientation: "sw",
              bestWindow: "morning",
              note: "The facade faces the morning sun; after about ten it falls into its own shadow.",
            },
            reason:
              "The same Nativity facade in the same morning sun, looked at across the pond from a bench in the square instead of from inside the nave, with no ticket to book and none of the crowd at the doors.",
          },
        ],
      },
      {
        stopIndex: 2,
        options: [
          {
            name: "Galeria Joan Prats",
            kind: "gallery",
            neighborhood: "Dreta de l'Eixample",
            summary:
              "A commercial gallery on Rambla de Catalunya where you are often the only visitor before noon.",
            aesthetic: ["white walls"],
            coordinates: { lat: 41.3917, lng: 2.1622 },
            sensory: {
              energy: "reflective",
              acoustic: "silent",
              crowd: "empty",
              texture: "A desk, a phone that does not ring, the street through the glass.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Gallery lighting throughout; the shopfront takes some morning sun.",
            },
            reason: "Still art before noon, in an empty white room instead of a foundation.",
          },
          {
            name: "Casa Batlló",
            kind: "architecture",
            neighborhood: "Dreta de l'Eixample",
            summary:
              "Gaudí's house of bone-like balconies, packed with timed entries at eleven; the roof is the reward.",
            aesthetic: ["ceramic scales", "curved balconies"],
            coordinates: { lat: 41.3917, lng: 2.165 },
            sensory: {
              energy: "social",
              acoustic: "chatter",
              crowd: "packed",
              texture:
                "Audio-guide screens, shuffling queues on the stairs, gasps at the lightwell.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "morning",
              note: "The blue lightwell is at its brightest in the late morning; the rooms dim after.",
            },
            reason:
              "The same street of Modernisme, in Gaudí's crowded house instead of Tàpies's quiet rooms.",
          },
        ],
      },
      {
        stopIndex: 5,
        options: [
          {
            name: "Seafood tapas in the Born",
            kind: "bar",
            neighborhood: "Sant Pere, Santa Caterina i la Ribera",
            summary:
              "Seafood counters around the Born, where the day's catch decides what you eat; by one most have a queue at the door.",
            aesthetic: ["long counters"],
            coordinates: { lat: 41.3836, lng: 2.1834 },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Pans flaring, dishes called out, stools squeezed together.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Bright counter lights; no daylight past the door.",
            },
            reason: "Same counter crush, more seafood.",
          },
        ],
      },
      {
        stopIndex: 6,
        options: [
          {
            name: "Museu d'Història de Barcelona – Plaça del Rei",
            kind: "museum",
            neighborhood: "Barri Gòtic",
            summary:
              "Roman streets under the square, walked on glass walkways that are quiet in the mid-afternoon.",
            aesthetic: ["roman ruins", "glass walkways"],
            coordinates: { lat: 41.3841, lng: 2.1774 },
            sensory: {
              energy: "calm",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Footsteps on glass, dripping somewhere, a recorded voice in Catalan.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Underground and lit the same all day.",
            },
            reason:
              "Still a museum in the old city, underground among Roman walls instead of among the paintings.",
          },
        ],
      },
      { stopIndex: 7, options: [] },
      {
        stopIndex: 10,
        options: [
          {
            name: "Seafood on Gran de Gràcia",
            kind: "food",
            neighborhood: "Vila de Gràcia",
            summary:
              "Galician seafood along Gran de Gràcia, oysters on ice, and the rooms full by half past eight.",
            aesthetic: ["white tablecloths", "oysters on ice"],
            coordinates: { lat: 41.4012, lng: 2.1528 },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Shells cracked open, orders called, rooms of big family tables.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Bright and white inside whatever the hour.",
            },
            reason:
              "Still a big dinner in Gràcia, over seafood in a packed room instead of grilled meat on benches.",
          },
        ],
      },
      {
        stopIndex: 11,
        options: [
          {
            name: "Local wine in Gràcia",
            kind: "bar",
            neighborhood: "Vila de Gràcia",
            summary:
              "Small rooms of cheese and Catalan wine on the side streets, where a table at half past ten is still easy.",
            aesthetic: ["wine shelves", "small tables"],
            coordinates: { lat: 41.4, lng: 2.1578 },
            sensory: {
              energy: "balanced",
              acoustic: "murmur",
              crowd: "steady",
              texture: "Glasses set down, a cheese knife, low music.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Candles and low lamps; it is dark outside by now.",
            },
            reason:
              "A late glass in Gràcia again, at a small table instead of a packed corner bar.",
          },
        ],
      },
    ],
  },
};
