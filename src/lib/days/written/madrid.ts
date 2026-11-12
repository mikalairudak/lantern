import type { WrittenDay } from "./written-day";
import { MADRID_START_REQUEST } from "./quick-starts";

/**
 * Madrid, as claude-sonnet-5-5 wrote it on 2026-10-31 under day-v8, for the
 * start that offers it (generation 4645b45c-2da2-4e47-bd59-bd1df35e786c). Kept as written, letters
 * escaped twice read as the reader reads them, so the start opens a day the product really
 * wrote, slips and all; the normalizer repairs what it repairs for any live day.
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
    dek: "A slow Saturday start with chocolate and churros near Sol, then the Rastro flea market in full swing, tapas on La Latina's bar street, Retiro in the afternoon, a late dinner in Malasaña and bars past midnight.",
    stops: [
      {
        startTime: "10:00",
        durationMinutes: 60,
        place: {
          name: "Churros by Plaza Mayor",
          kind: "coffee",
          neighborhood: "Sol",
          summary:
            "Hot chocolate thick enough to stand a churro in is the Madrid Saturday-morning habit, and the streets just off Plaza Mayor are where the late risers go once the shutters are up.",
          aesthetic: ["tiled counters", "dark wood"],
          coordinates: {
            lat: 40.4155,
            lng: -3.7075,
          },
          sensory: {
            energy: "balanced",
            acoustic: "murmur",
            crowd: "steady",
            texture: "Cups on saucers, fryers hissing, waiters calling orders across the counter.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "Indoors and under arcades, so the hour barely changes the light; the square outside is shaded until the sun clears the roofs.",
          },
        },
        dependsOn: ["start"],
      },
      {
        startTime: "11:15",
        durationMinutes: 120,
        place: {
          name: "El Rastro",
          kind: "market",
          neighborhood: "La Latina",
          summary:
            "The Saturday flea market fills Calle de la Ribera de Curtidores and the side streets from 9:00 to 15:00, and by mid-morning it is at its fullest, which suits a lively day.",
          aesthetic: ["street stalls", "painted shutters"],
          coordinates: {
            lat: 40.4082,
            lng: -3.7078,
          },
          sensory: {
            energy: "social",
            acoustic: "chatter",
            crowd: "packed",
            texture:
              "Vendors calling prices, shoulders brushing in the lanes, a guitar somewhere up the slope.",
          },
          light: {
            exposure: "open",
            orientation: "s",
            bestWindow: "midday",
            note: "The street runs downhill in full sun by late morning, so the stalls are brightest around noon.",
          },
        },
        dependsOn: ["start", "company"],
      },
      {
        startTime: "13:30",
        durationMinutes: 90,
        place: {
          name: "Tapas on Cava Baja",
          kind: "food",
          neighborhood: "La Latina",
          summary:
            "After the market the crowd drifts down to Cava Baja and Cava Alta for the Saturday vermouth-and-tapas round: croquetas, tortilla, patatas bravas, a cana of beer at each door.",
          aesthetic: ["stone facades", "zinc bars"],
          coordinates: {
            lat: 40.4127,
            lng: -3.7094,
          },
          sensory: {
            energy: "social",
            acoustic: "loud",
            crowd: "packed",
            texture:
              "Plates sliding along the bar, people spilling onto the cobbles, everyone talking at once.",
          },
          light: {
            exposure: "covered",
            orientation: "none",
            bestWindow: "none",
            note: "The narrow street stays in shade most of the day, with bar interiors lit warm; the hour matters less than the crowd.",
          },
        },
        dependsOn: ["company"],
      },
      {
        startTime: "15:30",
        durationMinutes: 150,
        place: {
          name: "Parque del Retiro",
          kind: "garden",
          neighborhood: "Retiro",
          summary:
            "On a mid-November Saturday afternoon the paths around the Estanque and the Palacio de Cristal are full of walkers, rowers and buskers while the plane trees hold their last yellow leaves.",
          aesthetic: ["gravel paths", "glass and iron"],
          coordinates: {
            lat: 40.4153,
            lng: -3.6844,
          },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture:
              "Gravel underfoot, oars knocking on the pond, a drum circle near the monument.",
          },
          light: {
            exposure: "dappled",
            orientation: "none",
            bestWindow: "afternoon",
            note: "The low November sun comes through the bare-thinning plane trees in the afternoon and turns the paths gold before it drops behind the roofs around half past five.",
          },
        },
        dependsOn: ["company"],
      },
      {
        startTime: "18:45",
        durationMinutes: 75,
        place: {
          name: "Plaza del Dos de Mayo",
          kind: "bar",
          neighborhood: "Malasaña",
          summary:
            "Early evening is when the square fills with friends sitting on the steps and terrace tables with a caña or vermouth, before the dinner crowd sets off.",
          aesthetic: ["brick facades", "terrace tables"],
          coordinates: {
            lat: 40.4251,
            lng: -3.7048,
          },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture:
              "Voices bouncing off the buildings, glasses on metal tables, skateboards somewhere behind.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "sunset",
            note: "The square is open to the sky, so the last light stays on the upper facades after the ground goes blue at around six.",
          },
        },
        dependsOn: ["company", "dinner"],
      },
      {
        startTime: "21:30",
        durationMinutes: 105,
        place: {
          name: "Raciones on Calle del Pez",
          kind: "food",
          neighborhood: "Malasaña",
          summary:
            "Madrid dines late on a Saturday, and by half past nine the streets around Calle del Pez are full of tables sharing raciones: croquetas, ensaladilla, calamares, a bottle of red between friends.",
          aesthetic: ["tiled bars", "dark wood"],
          coordinates: {
            lat: 40.4263,
            lng: -3.7061,
          },
          sensory: {
            energy: "social",
            acoustic: "loud",
            crowd: "packed",
            texture:
              "Plates landing in the middle of the table, glasses clinking, a wait on the pavement.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "after-dark",
            note: "After dark the street is lit by shopfronts and bar windows, warm yellow against the plain facades.",
          },
        },
        dependsOn: ["dinner", "company"],
      },
      {
        startTime: "23:30",
        durationMinutes: 120,
        place: {
          name: "Cocktails around Calle de la Palma",
          kind: "bar",
          neighborhood: "Malasaña",
          summary:
            "Past eleven the bars along Calle de la Palma and Calle del Espíritu Santo are the busiest they get, with gin and tonics in big glasses and music at the doorways, and it carries on past one.",
          aesthetic: ["neon signs", "worn plaster"],
          coordinates: {
            lat: 40.4268,
            lng: -3.7055,
          },
          sensory: {
            energy: "social",
            acoustic: "loud",
            crowd: "packed",
            texture:
              "Bass through open doors, small groups blocking the pavement, glasses passed out to the street.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "after-dark",
            note: "Street lamps and neon are the only light, and the bars glow brightest after midnight.",
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
            name: "Coffee on Calle del Arenal",
            kind: "coffee",
            neighborhood: "Sol",
            summary:
              "A short walk down Calle del Arenal, the Saturday-morning cafés serve café con leche and tostadas to a quieter crowd than the churro counters.",
            aesthetic: ["marble counters", "gilt mirrors"],
            coordinates: {
              lat: 40.4177,
              lng: -3.7084,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture:
                "Spoons on saucers, a newspaper turning, the street still waking up outside.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Indoors and shaded by the narrow street, so the light stays soft whatever the hour.",
            },
            reason:
              "It is still a Madrid morning cup near Sol, but you trade the churro-and-chocolate rush for toast and a quiet table.",
          },
          {
            name: "Mercado de San Miguel",
            kind: "market",
            neighborhood: "Sol",
            summary:
              "The glass-sided market beside Plaza Mayor opens by ten on a Saturday, with counters for coffee, pastries and small bites that fill up fast with groups.",
            aesthetic: ["glass and iron", "stone counters"],
            coordinates: {
              lat: 40.4155,
              lng: -3.7089,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Counters crowded two deep, trays held overhead, languages mixing.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "none",
              note: "The glass walls give an even daylight inside through the morning and midday.",
            },
            reason:
              "It keeps the breakfast-near-Plaza-Mayor idea but trades the sit-down churro counter for a standing, shoulder-to-shoulder market.",
          },
        ],
      },
      {
        stopIndex: 1,
        options: [
          {
            name: "Plaza de la Paja",
            kind: "garden",
            neighborhood: "La Latina",
            summary:
              "A few minutes up the slope, this sloping square beside the Jardín del Príncipe de Anglona is empty enough on a Saturday to sit and hear the church bells.",
            aesthetic: ["terracotta walls", "cobbles"],
            coordinates: {
              lat: 40.4113,
              lng: -3.7132,
            },
            sensory: {
              energy: "calm",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Pigeons on cobbles, a distant bell, footsteps echoing off the stone.",
            },
            light: {
              exposure: "open",
              orientation: "s",
              bestWindow: "midday",
              note: "The square opens to the south and holds the sun from late morning into early afternoon.",
            },
            reason:
              "It stays in La Latina and keeps the old-quarter setting, but trades the crush of stalls for an almost empty square.",
          },
          {
            name: "Plaza de Cascorro",
            kind: "shop",
            neighborhood: "La Latina",
            summary:
              "The top of the Rastro, where the market starts, with stalls of secondhand clothes and records and the loudest crowd on the slope.",
            aesthetic: ["street stalls", "painted shutters"],
            coordinates: {
              lat: 40.4099,
              lng: -3.7075,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture:
                "Hawkers shouting prices, racks wheeled through the crowd, music from a phone speaker.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "midday",
              note: "The square is open and sunlit by late morning, with the stalls throwing short shadows at noon.",
            },
            reason:
              "It is the same market, but trades the long walk down the slope for its busiest corner.",
          },
        ],
      },
      {
        stopIndex: 2,
        options: [
          {
            name: "Calle de Segovia",
            kind: "food",
            neighborhood: "La Latina",
            summary:
              "A short walk from Cava Baja, the bars along Calle de Segovia serve the same Saturday raciones and caña at a pace where you can still hold a conversation.",
            aesthetic: ["stone facades", "wooden doors"],
            coordinates: {
              lat: 40.4143,
              lng: -3.7128,
            },
            sensory: {
              energy: "balanced",
              acoustic: "chatter",
              crowd: "steady",
              texture:
                "Cutlery and conversation, people at pavement tables, less shoving at the bar.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "none",
              note: "The street is shaded for most of the day, with bar windows lit from inside.",
            },
            reason:
              "It keeps the tapas lunch in La Latina and trades the Cava Baja crush for a street with room to sit.",
          },
        ],
      },
      {
        stopIndex: 3,
        options: [
          {
            name: "Jardín del Príncipe de Anglona",
            kind: "garden",
            neighborhood: "La Latina",
            summary:
              "A small walled garden near Plaza de la Paja, quiet in the afternoon with benches, trimmed hedges and a view over the old rooftops.",
            aesthetic: ["clipped hedges", "stone benches"],
            coordinates: {
              lat: 40.4115,
              lng: -3.7137,
            },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "empty",
              texture: "Gravel, birds in the hedges, the city muffled beyond the wall.",
            },
            light: {
              exposure: "dappled",
              orientation: "none",
              bestWindow: "afternoon",
              note: "Trees and walls break the afternoon sun into patches on the paths.",
            },
            reason:
              "It is still a garden afternoon, but you trade Retiro's crowds for a small enclosed space that is nearly empty.",
          },
        ],
      },
      {
        stopIndex: 4,
        options: [
          {
            name: "Plaza de San Ildefonso",
            kind: "bar",
            neighborhood: "Malasaña",
            summary:
              "A few streets east, this smaller square has terrace tables and a quieter crowd than Dos de Mayo at the same early-evening hour.",
            aesthetic: ["brick facades", "terrace tables"],
            coordinates: {
              lat: 40.4263,
              lng: -3.701,
            },
            sensory: {
              energy: "balanced",
              acoustic: "murmur",
              crowd: "steady",
              texture: "Chairs scraping, low conversation, a dog under a table.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "sunset",
              note: "The square is open to the sky, so the last light lingers on the upper floors after the ground darkens.",
            },
            reason:
              "It is the same early-evening drink in a Malasaña square, trading the Dos de Mayo crowd for a smaller, quieter terrace.",
          },
          {
            name: "Calle de San Vicente Ferrer",
            kind: "bar",
            neighborhood: "Malasaña",
            summary:
              "The bars along this street fill up at the start of the Saturday night, with people standing in the doorways with a caña and a pincho.",
            aesthetic: ["neon signs", "worn tiles"],
            coordinates: {
              lat: 40.4266,
              lng: -3.7048,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture:
                "Music from open doors, groups on the pavement, glasses crowded on windowsills.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "after-dark",
              note: "The street is shaded by tall buildings, with bar signs the main light after six.",
            },
            reason:
              "It keeps the Malasaña early-evening drink but trades the open square for a louder street of crowded bars.",
          },
        ],
      },
      {
        stopIndex: 5,
        options: [
          {
            name: "Calle del Pez side streets",
            kind: "food",
            neighborhood: "Malasaña",
            summary:
              "The smaller streets off Calle del Pez have tables free later in the evening, serving the same raciones at a lower volume.",
            aesthetic: ["tiled bars", "plain facades"],
            coordinates: {
              lat: 40.4258,
              lng: -3.7066,
            },
            sensory: {
              energy: "balanced",
              acoustic: "chatter",
              crowd: "steady",
              texture: "Plates and murmured talk, a table by the window, no queue at the door.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "After dark the light comes from the windows and a few street lamps, soft and yellow.",
            },
            reason:
              "It keeps the late Saturday dinner of shared raciones and trades the packed main street for a calmer corner.",
          },
        ],
      },
      {
        stopIndex: 6,
        options: [
          {
            name: "Wine bars around Plaza de San Ildefonso",
            kind: "bar",
            neighborhood: "Malasaña",
            summary:
              "Past eleven the wine bars around the square pour by the glass at a lower volume, with people sitting rather than standing.",
            aesthetic: ["wooden tables", "brick walls"],
            coordinates: {
              lat: 40.4263,
              lng: -3.701,
            },
            sensory: {
              energy: "balanced",
              acoustic: "murmur",
              crowd: "steady",
              texture:
                "Glasses set down on wood, low conversation, a few people at the door for air.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Warm bar lighting inside and a dim square outside, with little change after midnight.",
            },
            reason:
              "It keeps the Malasaña late-night drink but trades the standing crowd of Calle de la Palma for seats and a lower volume.",
          },
        ],
      },
    ],
  },
};
