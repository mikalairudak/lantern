import type { WrittenDay } from "./written-day";
import { MADRID_START_REQUEST } from "./quick-starts";

/**
 * Madrid, as claude-sonnet-5-5 wrote it on 2026-11-12 under day-v11 with the undated rule
 * (`EVAL_DAY_RULE`), for the quick start that offers it (generation
 * 9d6bfb70-105a-4901-8246-5e010a84572c). Kept as written, letters escaped twice read as the reader
 * reads them, so the address opens a day the product really wrote, slips and all; the normalizer
 * repairs what it repairs for any live day.
 */
export const MADRID_START_DAY: WrittenDay = {
  request: MADRID_START_REQUEST,
  day: {
    assumptions: {
      travel: "on-foot",
      start: "slow",
      dinner: "late",
      end: null,
      company: null,
    },
    dek: "A Sunday that starts at the Rastro's stalls on Ribera de Curtidores, moves through the Lavapiés and Huertas terrace streets for vermouth and tapas, crosses to the Retiro for the afternoon, then runs from a late dinner in Chueca to bars that stay open past midnight.",
    stops: [
      {
        startTime: "10:30",
        durationMinutes: 90,
        place: {
          name: "El Rastro",
          kind: "market",
          neighborhood: "La Latina",
          coordinates: {
            lat: 40.4098,
            lng: -3.7071,
          },
          sensory: {
            energy: "social",
            acoustic: "loud",
            crowd: "packed",
            texture:
              "Vendors calling, shoulders brushing, music from a stall, the smell of fried churros.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "morning",
            note: "The street runs downhill and stays open to the sky, so the stalls are in full light by late morning; go early before the crowd thickens.",
          },
          summary:
            "The Sunday flea market runs on Ribera de Curtidores and the streets off it until mid-afternoon, and by half past ten it is full but still easy to move through. Keep your phone in a front pocket.",
          aesthetic: ["canvas awnings", "secondhand clutter"],
        },
        dependsOn: ["start"],
      },
      {
        startTime: "12:15",
        durationMinutes: 75,
        place: {
          name: "Vermouth and tapas on Calle de la Cava Baja",
          kind: "bar",
          neighborhood: "La Latina",
          coordinates: {
            lat: 40.4125,
            lng: -3.7095,
          },
          sensory: {
            energy: "social",
            acoustic: "loud",
            crowd: "packed",
            texture:
              "Standing crowds at the bar, plates passed over heads, voices bouncing off the narrow street.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "midday",
            note: "The narrow street is shaded most of the day, with a strip of sun overhead around midday.",
          },
          summary:
            "On Sunday after the market, this street fills with people standing at the bar for a vermouth and small plates before lunch. Order at the bar rather than waiting for a table.",
          aesthetic: ["tiled bar fronts", "dark wood"],
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "14:00",
        durationMinutes: 90,
        place: {
          name: "Tapas on Calle de la Cava Baja",
          kind: "food",
          neighborhood: "La Latina",
          coordinates: {
            lat: 40.4121,
            lng: -3.7092,
          },
          sensory: {
            energy: "social",
            acoustic: "loud",
            crowd: "packed",
            texture:
              "Plates clattering, stools scraping, tables of friends sharing from the middle.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "none",
            note: "Light matters little: it is indoors and under awnings, and the street is shaded through lunch.",
          },
          summary:
            "The same street turns to lunch after two, with croquetas, tortilla and fried squid shared across the table. Madrid's lunch hour starts late, so the crowd peaks around half past two.",
          aesthetic: ["tiled bar fronts", "dark wood"],
        },
        dependsOn: ["start", "company"],
      },
      {
        startTime: "16:15",
        durationMinutes: 120,
        place: {
          name: "Parque del Retiro",
          kind: "garden",
          neighborhood: "Retiro",
          coordinates: {
            lat: 40.4153,
            lng: -3.6844,
          },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture:
              "Gravel paths, buskers by the lake, rowing boats knocking together, families on benches.",
          },
          light: {
            exposure: "dappled",
            orientation: "none",
            bestWindow: "afternoon",
            note: "The sun drops lower through the bare and half-bare trees, so the paths are striped with light and shadow by late afternoon.",
          },
          summary:
            "On a Sunday afternoon the park is full of people, and the lake and the paths around it are the busiest part. Walk to the Palacio de Cristal side if you want it a little quieter.",
          aesthetic: ["gravel paths", "clipped hedges"],
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "18:45",
        durationMinutes: 75,
        place: {
          name: "Caña and vermouth on Plaza de Santa Ana",
          kind: "bar",
          neighborhood: "Huertas",
          coordinates: {
            lat: 40.4146,
            lng: -3.701,
          },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture: "Terrace tables edging the square, glasses, guitar from a doorway.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "sunset",
            note: "The square stays open to the sky and catches the last light before the facades go dark and the street lamps come on.",
          },
          summary:
            "The square's terraces fill with early-evening drinkers, and a small beer with a plate of olives is the standard order before dinner. Madrid dines late, so this is the long wait before the real meal.",
          aesthetic: ["terrace tables", "stone facades"],
        },
        dependsOn: ["dinner"],
      },
      {
        startTime: "21:15",
        durationMinutes: 120,
        place: {
          name: "Dinner around Plaza de Chueca",
          kind: "food",
          neighborhood: "Chueca",
          coordinates: {
            lat: 40.4219,
            lng: -3.6975,
          },
          sensory: {
            energy: "social",
            acoustic: "loud",
            crowd: "packed",
            texture: "Packed tables, shared plates, loud conversation spilling onto the pavement.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "after-dark",
            note: "After dark the square is lit by street lamps and the glow from terraces and windows.",
          },
          summary:
            "By half past nine the streets off the square are full with groups sitting down to dinner, and shared plates of jamón, gambas and bravas are the usual order. A late Sunday dinner here is normal, not an exception.",
          aesthetic: ["warm lamplight", "painted facades"],
        },
        dependsOn: ["dinner", "company"],
      },
      {
        startTime: "23:30",
        durationMinutes: 150,
        place: {
          name: "Drinks on Calle de Pelayo",
          kind: "bar",
          neighborhood: "Chueca",
          coordinates: {
            lat: 40.4224,
            lng: -3.6998,
          },
          sensory: {
            energy: "social",
            acoustic: "loud",
            crowd: "packed",
            texture: "Music from open doors, groups on the pavement, glasses clinking inside.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "after-dark",
            note: "Light comes from the bars themselves and the street lamps, warm and low.",
          },
          summary:
            "The bars around here stay open well past midnight, and the street is full on a Sunday until late. Go in with the group and settle in, because the best order is one more round.",
          aesthetic: ["dim lamplight", "dark wood"],
        },
        dependsOn: ["end", "company"],
      },
    ],
    alternatives: [
      {
        stopIndex: 0,
        options: [
          {
            name: "Plaza de la Cebada Market",
            kind: "market",
            neighborhood: "La Latina",
            coordinates: {
              lat: 40.4113,
              lng: -3.7082,
            },
            sensory: {
              energy: "balanced",
              acoustic: "chatter",
              crowd: "steady",
              texture:
                "Counters with fish and fruit, shoppers calling orders, a coffee bar at the back.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "none",
              note: "Light does not matter here: the market is roofed and lit from above.",
            },
            summary:
              "A covered local market a few minutes from the Rastro, calmer than the open-air stalls and a good place for a coffee first.",
            aesthetic: ["iron roof", "tiled counters"],
            reason:
              "Same neighbourhood and the same Sunday-morning shopping feel, but roofed and quieter than the open-air Rastro.",
          },
          {
            name: "Plaza de Tirso de Molina",
            kind: "walk",
            neighborhood: "Lavapiés",
            coordinates: {
              lat: 40.4128,
              lng: -3.7048,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Flower stalls, street musicians, a crowd gathering around the fountain.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "midday",
              note: "The square is open to the sky, so it holds full light through the middle of the day.",
            },
            summary:
              "A lively square on the edge of the Rastro, with street performers and stalls, and busier than the market lanes themselves.",
            aesthetic: ["open square", "painted facades"],
            reason:
              "Next to the market and just as full of Sunday people, but trading browsing for street performers.",
          },
        ],
      },
      {
        stopIndex: 1,
        options: [
          {
            name: "Plaza de los Carros",
            kind: "walk",
            neighborhood: "La Latina",
            coordinates: {
              lat: 40.4117,
              lng: -3.7101,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "Church bells, a few benches, pigeons crossing the cobbles.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "midday",
              note: "The small square is open to the sky and gets light at midday.",
            },
            summary:
              "A quiet square a few steps from the vermouth bars, for a bench and a rest before lunch.",
            aesthetic: ["cobblestones", "stone church"],
            reason:
              "Same neighbourhood and the same pre-lunch hour, but a bench in the open instead of a crowded bar.",
          },
          {
            name: "Calle de Segovia Bars",
            kind: "bar",
            neighborhood: "La Latina",
            coordinates: {
              lat: 40.4133,
              lng: -3.7118,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Shouting over the bar, standing crowds, music from several doors.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Light does not matter here: the bars are indoors and lit artificially.",
            },
            summary:
              "A louder strip a few minutes away, with more stand-up bars and a younger Sunday crowd.",
            aesthetic: ["dark wood", "neon signs"],
            reason:
              "The same vermouth-before-lunch hour a short walk away, but louder and more crowded than Cava Baja.",
          },
        ],
      },
      {
        stopIndex: 2,
        options: [
          {
            name: "Mercado de San Miguel",
            kind: "market",
            neighborhood: "Sol",
            coordinates: {
              lat: 40.4155,
              lng: -3.7089,
            },
            sensory: {
              energy: "balanced",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Glass-walled stalls, small plates at standing counters, a steady hum.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "none",
              note: "Light does not matter here: the market is roofed and lit from above.",
            },
            summary:
              "A covered market a few minutes away where you can pick small plates from different stalls and eat standing.",
            aesthetic: ["iron and glass", "tiled counters"],
            reason:
              "Same small-plates lunch a short walk away, but under a roof and slower than the packed bars.",
          },
          {
            name: "Calle de la Cava Baja Late Lunch",
            kind: "food",
            neighborhood: "La Latina",
            coordinates: {
              lat: 40.4119,
              lng: -3.7094,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Full dining rooms, big tables, waiters moving fast.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Light does not matter here: the dining rooms are indoors.",
            },
            summary:
              "The same street's sit-down side, with larger tables and a longer lunch for a big group.",
            aesthetic: ["dark wood", "tiled walls"],
            reason:
              "The same street and the same lunch hour, trading standing at the bar for a table.",
          },
        ],
      },
      {
        stopIndex: 3,
        options: [
          {
            name: "Real Jardín Botánico",
            kind: "garden",
            neighborhood: "Retiro",
            coordinates: {
              lat: 40.4112,
              lng: -3.6912,
            },
            sensory: {
              energy: "calm",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Gravel paths, labelled trees, a greenhouse and very few voices.",
            },
            light: {
              exposure: "dappled",
              orientation: "none",
              bestWindow: "afternoon",
              note: "The low afternoon sun reaches through the tree canopy and lights the gravel paths in patches.",
            },
            summary:
              "A walled garden on the park's edge, much quieter than the main paths, open through the afternoon.",
            aesthetic: ["gravel paths", "glass greenhouse"],
            reason: "Next to the Retiro and just as green, but walled in and far quieter.",
          },
          {
            name: "Paseo de Coches",
            kind: "walk",
            neighborhood: "Retiro",
            coordinates: {
              lat: 40.4162,
              lng: -3.687,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture:
                "Cyclists, skaters, street performers and a steady crowd on the main avenue.",
            },
            light: {
              exposure: "dappled",
              orientation: "none",
              bestWindow: "afternoon",
              note: "Trees line the avenue, so the sun comes through in stripes through the afternoon.",
            },
            summary:
              "The park's busiest avenue on a Sunday afternoon, full of skaters, buskers and families.",
            aesthetic: ["tree-lined avenue", "gravel"],
            reason: "Same park and same afternoon, but on the main avenue where the crowd is.",
          },
        ],
      },
      {
        stopIndex: 4,
        options: [
          {
            name: "Plaza de las Cortes",
            kind: "walk",
            neighborhood: "Huertas",
            coordinates: {
              lat: 40.416,
              lng: -3.6985,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "A few benches, a bronze statue, traffic far off.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "sunset",
              note: "The square is open to the sky and catches the last light before the facades go dark.",
            },
            summary:
              "A quieter square a few minutes from Santa Ana, for a bench and a short rest before dinner.",
            aesthetic: ["stone facades", "bronze statue"],
            reason:
              "Same neighbourhood and the same evening hour, but a quiet bench instead of a crowded terrace.",
          },
          {
            name: "Calle de Echegaray",
            kind: "bar",
            neighborhood: "Huertas",
            coordinates: {
              lat: 40.4137,
              lng: -3.6997,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture:
                "Small bars side by side, people spilling onto the narrow street, music from the doors.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "The street is lit by the bars and street lamps once it is dark.",
            },
            summary:
              "A narrow street of small bars close to the square, louder and more packed once the evening starts.",
            aesthetic: ["narrow street", "painted facades"],
            reason:
              "Same drinking hour a few steps away, but tighter and louder than the open terraces.",
          },
        ],
      },
      {
        stopIndex: 5,
        options: [
          {
            name: "Plaza de Olavide",
            kind: "food",
            neighborhood: "Chamberí",
            coordinates: {
              lat: 40.4343,
              lng: -3.7012,
            },
            sensory: {
              energy: "balanced",
              acoustic: "chatter",
              crowd: "steady",
              texture: "Terrace tables around a tree-filled square, a murmur of conversation.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "after-dark",
              note: "After dark the square is lit softly by street lamps and the terrace lights.",
            },
            summary:
              "A calmer square for a late dinner, with terrace tables and a more local crowd.",
            aesthetic: ["tree-filled square", "terrace tables"],
            reason: "A late dinner with shared plates, but slower and easier to talk than Chueca.",
          },
          {
            name: "Calle de Hortaleza Late Dinner",
            kind: "food",
            neighborhood: "Chueca",
            coordinates: {
              lat: 40.4222,
              lng: -3.6996,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Full dining rooms, shouting over the music, plates arriving fast.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Light does not matter here: the dining rooms are indoors.",
            },
            summary: "A busier dining street a few steps away, with more groups and later tables.",
            aesthetic: ["dark wood", "tiled walls"],
            reason:
              "Same neighbourhood and the same late dinner, but louder and packed with groups.",
          },
        ],
      },
      {
        stopIndex: 6,
        options: [
          {
            name: "Calle de San Andrés",
            kind: "bar",
            neighborhood: "Malasaña",
            coordinates: {
              lat: 40.4263,
              lng: -3.7055,
            },
            sensory: {
              energy: "balanced",
              acoustic: "murmur",
              crowd: "steady",
              texture: "Wine bars and small rooms, low music, people at tables.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "The bars are lit low and warm from inside.",
            },
            summary:
              "A quieter row of wine bars a short walk away, where you can sit and talk after midnight.",
            aesthetic: ["dark wood", "warm lamplight"],
            reason:
              "Same late-night drinking a short walk away, but seated and quieter than Chueca.",
          },
          {
            name: "Calle de Fuencarral",
            kind: "bar",
            neighborhood: "Malasaña",
            coordinates: {
              lat: 40.4251,
              lng: -3.7013,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture:
                "Music from every door, people spilling onto the street, a crowd moving between bars.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "The bars and street lamps provide most of the light after dark.",
            },
            summary:
              "A louder, busier strip a short walk away, where the crowd moves from bar to bar past midnight.",
            aesthetic: ["neon signs", "dark interiors"],
            reason: "Same late-night hour nearby, but busier and louder than Pelayo.",
          },
        ],
      },
    ],
  },
};
