import type { WrittenDay } from "./written-day";
import { ROME_REQUEST } from "./city-days";

/**
 * Rome, as claude-sonnet-5-5 wrote it on 2026-11-11 under day-v11, for its own address (generation
 * 84123154-b2d9-4e77-85a3-e5bfc416daad). Kept as written, letters escaped twice read as the reader
 * reads them, so the address opens a day the product really wrote, slips and all; the normalizer
 * repairs what it repairs for any live day.
 */
export const ROME_DAY: WrittenDay = {
  request: ROME_REQUEST,
  day: {
    assumptions: {
      travel: "on-foot",
      start: "slow",
      dinner: null,
      end: "early",
      company: null,
    },
    dek: "A mid-morning start in Monti, the Forum and Colosseum while the November light is low, a late lunch near Campo de' Fiori, then Trastevere's lanes for a long family dinner after nine.",
    stops: [
      {
        startTime: "09:45",
        durationMinutes: 40,
        place: {
          name: "Cornetti on Via Leonina",
          kind: "coffee",
          neighborhood: "Monti",
          coordinates: {
            lat: 41.8955,
            lng: 12.4893,
          },
          sensory: {
            energy: "balanced",
            acoustic: "murmur",
            crowd: "steady",
            texture:
              "Espresso cups on zinc counters, shutters going up, locals standing for five minutes.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "morning",
            note: "The street is narrow, so sun only reaches the pavement mid-morning; before that it is all shade.",
          },
          summary:
            "Monti has its coffee standing at the counter, with a cornetto filled with cream or jam, and by quarter to ten the commuter rush has thinned out.",
          aesthetic: ["worn travertine", "painted shutters"],
        },
        dependsOn: ["start"],
      },
      {
        startTime: "10:40",
        durationMinutes: 150,
        place: {
          name: "Roman Forum and Palatine Hill",
          kind: "architecture",
          neighborhood: "Foro Romano",
          coordinates: {
            lat: 41.8925,
            lng: 12.4853,
          },
          sensory: {
            energy: "balanced",
            acoustic: "murmur",
            crowd: "busy",
            texture:
              "Gravel and worn paving stones underfoot, tour guides in several languages, pines overhead.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "morning",
            note: "In mid-November the sun stays low all day, so the columns throw long shadows across the paving even at noon.",
          },
          summary:
            "The ticket covers the Forum and the Palatine, and the Palatine's terrace looks back over the Forum from above. Late morning is the time to be inside, before the lunch hour empties the queues.",
          aesthetic: ["weathered marble", "umbrella pines"],
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "13:20",
        durationMinutes: 120,
        place: {
          name: "Pizza al taglio around Campo de' Fiori",
          kind: "food",
          neighborhood: "Campo de' Fiori",
          coordinates: {
            lat: 41.8956,
            lng: 12.4722,
          },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture: "Market stalls packing up, cutlery on plates, voices in a dozen languages.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "midday",
            note: "The square is open to the sky, so the early afternoon sun reaches the cobbles.",
          },
          summary:
            "Pizza by the slice or a plate of fried supplì is what most places around the square serve at lunch. The morning market winds down by about two, so the stalls give way to tables.",
          aesthetic: ["ochre plaster", "cobblestones"],
        },
        dependsOn: ["company"],
      },
      {
        startTime: "15:40",
        durationMinutes: 100,
        place: {
          name: "Piazza Navona and Sant'Agnese in Agone",
          kind: "architecture",
          neighborhood: "Parione",
          coordinates: {
            lat: 41.8992,
            lng: 12.4731,
          },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture: "Fountain water, street painters, children running across open stone.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "afternoon",
            note: "The low November sun turns the facades gold from about half past three; by five the square is in shade.",
          },
          summary:
            "The long oval is open and flat, so it suits a family: three fountains to look at and room to stop. Walk in around half past three, while the afternoon light is still on the facades.",
          aesthetic: ["baroque travertine", "terracotta facades"],
        },
        dependsOn: ["company", "travel"],
      },
      {
        startTime: "17:30",
        durationMinutes: 60,
        place: {
          name: "Villa Farnesina and Lungotevere",
          kind: "walk",
          neighborhood: "Trastevere",
          coordinates: {
            lat: 41.8935,
            lng: 12.4673,
          },
          sensory: {
            energy: "calm",
            acoustic: "hushed",
            crowd: "sparse",
            texture:
              "Plane tree leaves on the pavement, river water below the wall, bicycles passing.",
          },
          light: {
            exposure: "dappled",
            orientation: "w",
            bestWindow: "sunset",
            note: "The sun drops behind Gianicolo around half past four in November, so the river embankment goes pink after five.",
          },
          summary:
            "A flat walk along the Tiber's west bank at the hour the sun sets and the plane trees are bare, a quiet interval before dinner.",
          aesthetic: ["plane trees", "river stone"],
        },
        dependsOn: ["travel", "end"],
      },
      {
        startTime: "18:45",
        durationMinutes: 60,
        place: {
          name: "Aperitivo along Via della Lungaretta",
          kind: "bar",
          neighborhood: "Trastevere",
          coordinates: {
            lat: 41.8895,
            lng: 12.4699,
          },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture:
              "Spritz glasses, small plates of olives and cheese, sweaters and scarves at outdoor tables.",
          },
          light: {
            exposure: "covered",
            orientation: "none",
            bestWindow: "after-dark",
            note: "Streetlamps and shop windows replace daylight; the street is lit by about half past five.",
          },
          summary:
            "Aperitivo here means a spritz or a glass of white wine with a plate of olives and cheese. At this hour the street fills with people before the dinner tables open.",
          aesthetic: ["ivy-covered walls", "cobbled lane"],
        },
        dependsOn: ["company", "end"],
      },
      {
        startTime: "21:00",
        durationMinutes: 120,
        place: {
          name: "Cacio e pepe in Trastevere lanes",
          kind: "food",
          neighborhood: "Trastevere",
          coordinates: {
            lat: 41.8897,
            lng: 12.4694,
          },
          sensory: {
            energy: "balanced",
            acoustic: "chatter",
            crowd: "busy",
            texture:
              "Pasta water steam, candlelight, tables pushed close under a string of lights.",
          },
          light: {
            exposure: "covered",
            orientation: "none",
            bestWindow: "after-dark",
            note: "Candles and warm bulbs light the lanes after dark; the stone walls hold the glow.",
          },
          summary:
            "Cacio e pepe, carbonara and amatriciana are on nearly every menu in these lanes, and nine is when most Roman families sit down, so the kitchens are at full speed by then.",
          aesthetic: ["terracotta plaster", "candlelit stone"],
        },
        dependsOn: ["company", "end"],
      },
    ],
    alternatives: [
      {
        stopIndex: 0,
        options: [
          {
            name: "Coffee in Piazza della Madonna dei Monti",
            kind: "coffee",
            neighborhood: "Monti",
            coordinates: {
              lat: 41.8949,
              lng: 12.4942,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "A fountain, café tables set out on the cobbles, pigeons, low talk.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "morning",
              note: "The small square catches the morning sun by about ten, earlier than the lanes around it.",
            },
            summary:
              "The fountain square has coffee at tables outside, and a slower pace than the counters on the main street.",
            aesthetic: ["cobbles", "stone fountain"],
            reason:
              "The same neighbourhood and the same morning coffee, taken at a table on a square instead of standing at a counter.",
          },
          {
            name: "Colazione on Via Cavour",
            kind: "coffee",
            neighborhood: "Monti",
            coordinates: {
              lat: 41.8957,
              lng: 12.4925,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Traffic on the avenue, steamed milk, bags and strollers by the door.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "morning",
              note: "The wide avenue lets in light, but the shops under their awnings stay shaded.",
            },
            summary:
              "The avenue's cafés serve a bigger breakfast, with eggs and juice alongside the cornetti, to a mix of commuters and tourists.",
            aesthetic: ["travertine", "glass storefronts"],
            reason:
              "Still Monti and still breakfast, but on the busy avenue with a fuller menu and more noise.",
          },
        ],
      },
      {
        stopIndex: 1,
        options: [
          {
            name: "Basilica di San Clemente",
            kind: "sacred",
            neighborhood: "Celio",
            coordinates: {
              lat: 41.8893,
              lng: 12.498,
            },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Damp stone, echoing steps, guides speaking low in the lower levels.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "The upper church is lit by its windows and the lower levels by electric lamps, so the hour matters little.",
            },
            summary:
              "The church stands over older levels you walk down into, cooler and quieter than the open Forum. The basilica is open late morning, closed for a break at midday.",
            aesthetic: ["medieval mosaic", "damp stone"],
            reason:
              "It shares the layers of ancient Rome with the Forum, but trades the open ruins for a quiet descent underground.",
          },
          {
            name: "Colosseum interior",
            kind: "architecture",
            neighborhood: "Celio",
            coordinates: {
              lat: 41.8902,
              lng: 12.4922,
            },
            sensory: {
              energy: "social",
              acoustic: "chatter",
              crowd: "packed",
              texture: "Tour groups, audio guides, crowds on the stairs and along the arena rail.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "midday",
              note: "The low November sun comes through the arches at an angle and lights the inner wall.",
            },
            summary:
              "The arena is a five-minute walk from the Forum and fills with the biggest crowds in Rome by late morning.",
            aesthetic: ["weathered travertine", "brick arches"],
            reason:
              "The same ancient ground a few minutes from the Forum, but with far larger crowds and one big space instead of a long wander.",
          },
        ],
      },
      {
        stopIndex: 2,
        options: [
          {
            name: "Trattorie on Via dei Cappellari",
            kind: "food",
            neighborhood: "Campo de' Fiori",
            coordinates: {
              lat: 41.8946,
              lng: 12.4709,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "steady",
              texture:
                "A narrow lane, shutters half open, forks on plates and a few low conversations.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "none",
              note: "The lane stays shaded all day, so the light at lunch is the same as at any other hour.",
            },
            summary:
              "A narrow lane behind the square serves the same Roman lunch, with pasta and fried starters at fewer tables and less shouting.",
            aesthetic: ["plaster walls", "wooden shutters"],
            reason: "The same Roman lunch a block from the square, in a narrower and quieter lane.",
          },
          {
            name: "Streetfood around Mercato di Testaccio",
            kind: "market",
            neighborhood: "Testaccio",
            coordinates: {
              lat: 41.8767,
              lng: 12.4755,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture:
                "Vendors calling, queues at the sandwich stalls, plastic trays on narrow tables.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "none",
              note: "The market hall is lit from above and from its stalls, so midday and late morning look the same.",
            },
            summary:
              "The Saturday market stalls sell sandwiches of tripe, porchetta and fried street food to a crowd that eats standing.",
            aesthetic: ["steel and glass hall", "tiled stalls"],
            reason:
              "A Roman lunch with more stalls and more noise, a short tram ride south of the centre.",
          },
        ],
      },
      {
        stopIndex: 3,
        options: [
          {
            name: "Pantheon",
            kind: "architecture",
            neighborhood: "Pigna",
            coordinates: {
              lat: 41.8986,
              lng: 12.4769,
            },
            sensory: {
              energy: "balanced",
              acoustic: "murmur",
              crowd: "busy",
              texture: "Echoing footsteps, a round stone floor, a circle of sky overhead.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "midday",
              note: "A shaft of light from the opening in the dome moves across the wall and floor through the afternoon.",
            },
            summary:
              "The domed hall is a six-minute walk from the square and has a free, quick-moving queue on Saturday afternoon.",
            aesthetic: ["marble floor", "coffered dome"],
            reason:
              "It keeps the afternoon walk in the old centre and trades the open piazza for a single enclosed room.",
          },
          {
            name: "Piazza Farnese",
            kind: "walk",
            neighborhood: "Regola",
            coordinates: {
              lat: 41.8957,
              lng: 12.4716,
            },
            sensory: {
              energy: "calm",
              acoustic: "hushed",
              crowd: "sparse",
              texture:
                "Two fountains in granite basins, a wide empty stone square, a few people on the benches.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "afternoon",
              note: "The sun clears the rooftops by early afternoon and lights the palace facade.",
            },
            summary: "A calm square behind Campo de' Fiori with two big fountains and room to sit.",
            aesthetic: ["travertine facade", "granite basins"],
            reason:
              "It shares the open square and the afternoon light, but is quieter and has fewer people.",
          },
        ],
      },
      {
        stopIndex: 4,
        options: [
          {
            name: "Orto Botanico di Roma",
            kind: "garden",
            neighborhood: "Trastevere",
            coordinates: {
              lat: 41.89,
              lng: 12.4663,
            },
            sensory: {
              energy: "reflective",
              acoustic: "silent",
              crowd: "empty",
              texture: "Gravel paths, a fountain, dry leaves and birds in the palms.",
            },
            light: {
              exposure: "dappled",
              orientation: "none",
              bestWindow: "afternoon",
              note: "The low sun comes through bare branches and long shadows lie across the paths until closing.",
            },
            summary:
              "The botanical garden on the hillside has quiet paths and is the calmest open space near Trastevere, open until about six in November.",
            aesthetic: ["gravel paths", "palm trees"],
            reason:
              "Still a quiet walk in Trastevere before dinner, but through a garden instead of along the river.",
          },
          {
            name: "Piazza di Santa Maria in Trastevere",
            kind: "walk",
            neighborhood: "Trastevere",
            coordinates: {
              lat: 41.8895,
              lng: 12.4698,
            },
            sensory: {
              energy: "social",
              acoustic: "chatter",
              crowd: "packed",
              texture: "Fountain steps full of people, guitars, kids in the open square.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "sunset",
              note: "The gold mosaic on the church facade catches the last light around half past four.",
            },
            summary:
              "The main square of Trastevere fills with people at dusk, with the church mosaic lit by the last sun.",
            aesthetic: ["gold mosaic", "stone fountain"],
            reason:
              "The same neighbourhood at the same hour, but in the crowded central square instead of the quiet riverbank.",
          },
        ],
      },
      {
        stopIndex: 5,
        options: [
          {
            name: "Wine on Via della Scala",
            kind: "bar",
            neighborhood: "Trastevere",
            coordinates: {
              lat: 41.8911,
              lng: 12.4694,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "steady",
              texture: "Wine glasses, low stools, a few people reading menus on chalkboards.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Warm bulbs and shop windows light the street after about half past five.",
            },
            summary:
              "A quieter stretch of wine bars, where a glass of Lazio white and a plate of cheese is the usual order.",
            aesthetic: ["dark wood", "brick"],
            reason:
              "The same Trastevere aperitivo hour, but with wine and a lower volume instead of spritz on a crowded street.",
          },
          {
            name: "Spritz around Piazza Trilussa",
            kind: "bar",
            neighborhood: "Trastevere",
            coordinates: {
              lat: 41.8898,
              lng: 12.4713,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Music from open doors, plastic cups, crowds on the steps of the fountain.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "after-dark",
              note: "After dark the square is lit by streetlamps and the glow from the bar fronts.",
            },
            summary:
              "By evening the square at the edge of Trastevere is the loudest aperitivo spot nearby, with spritz sold at every corner.",
            aesthetic: ["cobblestones", "street lamps"],
            reason:
              "The same neighbourhood and the same drinks, but in a bigger and noisier crowd.",
          },
        ],
      },
      {
        stopIndex: 6,
        options: [
          {
            name: "Osterie on Via del Moro",
            kind: "food",
            neighborhood: "Trastevere",
            coordinates: {
              lat: 41.8886,
              lng: 12.4708,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "steady",
              texture: "Wooden tables, a narrow lane with few passers-by, low voices after nine.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "after-dark",
              note: "The lane is lit by a few wall lamps, so it is dimmer than the main street.",
            },
            summary:
              "A narrow lane of osterie serves the same Roman pasta, with fewer people and a slower pace after nine.",
            aesthetic: ["wooden tables", "plaster walls"],
            reason:
              "The same Roman dishes a few streets over, in a quieter lane with fewer tables.",
          },
          {
            name: "Pizzerie on Via della Paglia",
            kind: "food",
            neighborhood: "Trastevere",
            coordinates: {
              lat: 41.8903,
              lng: 12.4688,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture:
                "Wood ovens, pizza peels at the counter, queues at the door and shouted orders.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "after-dark",
              note: "The bright kitchens and neon signs light the lane well past nine.",
            },
            summary:
              "Pizza from wood ovens is the usual late dinner here, eaten fast at crowded tables.",
            aesthetic: ["tiled counters", "brick ovens"],
            reason:
              "Still dinner in Trastevere after nine, but pizza in a loud, quick room instead of pasta at a long table.",
          },
        ],
      },
    ],
  },
};
