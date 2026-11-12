import type { WrittenDay } from "./written-day";
import { UTRECHT_START_REQUEST } from "./quick-starts";

/**
 * Utrecht, as claude-sonnet-5-5 wrote it on 2026-10-31 under day-v8, for the
 * start that offers it (generation 9e34e7ed-deb2-47ba-8834-ce60dc61cd61). Kept as written, letters
 * escaped twice read as the reader reads them, so the start opens a day the product really
 * wrote, slips and all; the normalizer repairs what it repairs for any live day.
 */
export const UTRECHT_START_DAY: WrittenDay = {
  request: UTRECHT_START_REQUEST,
  day: {
    assumptions: {
      travel: "on-foot",
      start: "slow",
      dinner: "early",
      end: "early",
      company: null,
    },
    dek: "A late-morning start on the Oudegracht wharf cellars, then the Domtoren and its square, an afternoon in the Centraal Museum, and an early dinner in the Wijk C streets before the day closes.",
    stops: [
      {
        startTime: "10:00",
        durationMinutes: 60,
        place: {
          name: "Coffee on the Oudegracht",
          kind: "coffee",
          neighborhood: "Binnenstad",
          summary:
            "Sunday morning is slow here: the wharf-side terraces and cellar rooms along the canal pour coffee and serve warm apple pie from about ten, with room for a family to sit before the crowds come.",
          aesthetic: ["canal brick", "wharf cellars"],
          coordinates: {
            lat: 52.0923,
            lng: 5.1186,
          },
          sensory: {
            energy: "balanced",
            acoustic: "murmur",
            crowd: "sparse",
            texture: "Bicycle bells on the quay above, cups on saucers, low talk.",
          },
          light: {
            exposure: "covered",
            orientation: "none",
            bestWindow: "morning",
            note: "The canal sits low between the houses, so the wharf is in soft shade until late morning and stays even all day.",
          },
        },
        dependsOn: ["start"],
      },
      {
        startTime: "11:15",
        durationMinutes: 75,
        place: {
          name: "Domtoren",
          kind: "viewpoint",
          neighborhood: "Binnenstad",
          summary:
            "A guided climb up the tower runs on Sundays from around noon, so a late-morning arrival suits it, and the view over the canals and red roofs is clearest before the afternoon haze settles. Book a timed slot ahead for the family.",
          aesthetic: ["weathered stone", "spiral stair"],
          coordinates: {
            lat: 52.0907,
            lng: 5.1214,
          },
          sensory: {
            energy: "balanced",
            acoustic: "murmur",
            crowd: "steady",
            texture: "Worn steps underfoot, wind at the top, bells from the carillon on the hour.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "midday",
            note: "The view is clearest in the middle of the day, when the sun is high and the city lies flat and bright below.",
          },
        },
        dependsOn: ["start"],
      },
      {
        startTime: "12:45",
        durationMinutes: 60,
        place: {
          name: "Pancakes on the Domplein",
          kind: "food",
          neighborhood: "Binnenstad",
          summary:
            "At lunchtime the streets around the square serve Dutch pancakes, big and thin, sweet with syrup or savoury with bacon, which suits children and adults alike.",
          aesthetic: ["old brick", "cobbles"],
          coordinates: {
            lat: 52.0913,
            lng: 5.1226,
          },
          sensory: {
            energy: "balanced",
            acoustic: "chatter",
            crowd: "busy",
            texture: "Cutlery and chatter, families at long tables, cobbles outside.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "Mostly indoors, so the light of the hour hardly matters; midday keeps the rooms bright.",
          },
        },
        dependsOn: [],
      },
      {
        startTime: "14:15",
        durationMinutes: 150,
        place: {
          name: "Centraal Museum",
          kind: "museum",
          neighborhood: "Agnietenkwartier",
          summary:
            "Open from noon on Sundays, it is a calm place to spend the grey middle of a November afternoon, with rooms to wander at your own pace and the Miffy collection that children tend to go straight to.",
          aesthetic: ["white walls", "painted wood"],
          coordinates: {
            lat: 52.0862,
            lng: 5.1263,
          },
          sensory: {
            energy: "calm",
            acoustic: "hushed",
            crowd: "steady",
            texture:
              "Soft footsteps on wood floors, murmured conversation, the occasional child's laugh.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "Gallery light is steady, so the hour does not change the rooms; the daylight outside is gone by about five.",
          },
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "17:30",
        durationMinutes: 75,
        place: {
          name: "Dinner on the Wijk C streets",
          kind: "food",
          neighborhood: "Wijk C",
          summary:
            "By half past five the cafe-restaurants on the streets of Wijk C are filling with Sunday dinner: stews, bitterballen and hearty plates, with a kids' menu or a half portion usually on offer.",
          aesthetic: ["brick facades", "warm lamps"],
          coordinates: {
            lat: 52.0885,
            lng: 5.1182,
          },
          sensory: {
            energy: "balanced",
            acoustic: "chatter",
            crowd: "busy",
            texture: "Warm rooms, cutlery and talk, bikes locked along the kerb outside.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "after-dark",
            note: "Dark by now, so the street is lit by shop windows and lamps, with candles on the tables inside.",
          },
        },
        dependsOn: ["dinner"],
      },
      {
        startTime: "19:15",
        durationMinutes: 45,
        place: {
          name: "Oudegracht Canal Walk",
          kind: "walk",
          neighborhood: "Binnenstad",
          summary:
            "A short stroll along the lit wharf after dinner, with the Domtoren glowing at the end of the canal; it is quiet enough on a Sunday evening to walk four across.",
          aesthetic: ["canal brick", "lamplight"],
          coordinates: {
            lat: 52.0925,
            lng: 5.1189,
          },
          sensory: {
            energy: "calm",
            acoustic: "hushed",
            crowd: "sparse",
            texture: "Footsteps on the quay, a passing bicycle, water against the wall.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "after-dark",
            note: "The canal reflects the street lamps and the lit tower, so it looks best once it is properly dark.",
          },
        },
        dependsOn: ["end"],
      },
    ],
    alternatives: [
      {
        stopIndex: 0,
        options: [
          {
            name: "Coffee on Springweg",
            kind: "coffee",
            neighborhood: "Springweg",
            summary:
              "A quieter street of small shops where coffee is served in compact rooms from late morning.",
            aesthetic: ["narrow street", "brick"],
            coordinates: {
              lat: 52.0942,
              lng: 5.1155,
            },
            sensory: {
              energy: "calm",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Few footsteps, the hiss of an espresso machine, a shop shutter lifting.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "morning",
              note: "A narrow street keeps the light soft and even through the morning.",
            },
            reason:
              "Same coffee and the same canal-side neighbourhood, but a quieter street without the wharf terraces.",
          },
          {
            name: "Drinks on the Neude",
            kind: "bar",
            neighborhood: "Neude",
            summary:
              "On Sunday the square's big terraces fill by late morning with people on coffee, hot chocolate and early beers.",
            aesthetic: ["open square", "stone"],
            coordinates: {
              lat: 52.0942,
              lng: 5.1192,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Voices across an open square, chairs scraping, bicycles passing.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "midday",
              note: "An open square takes the light all day, brightest around midday.",
            },
            reason:
              "Same coffee, but on a wide open square with more people instead of the quiet wharf.",
          },
        ],
      },
      {
        stopIndex: 1,
        options: [
          {
            name: "Domkerk",
            kind: "sacred",
            neighborhood: "Binnenstad",
            summary:
              "The cathedral beside the tower is open to walk through on Sunday, calm and high-ceilinged, with the carillon audible outside on the hour.",
            aesthetic: ["pale stone", "tall arches"],
            coordinates: {
              lat: 52.0909,
              lng: 5.1219,
            },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Footsteps echoing on stone, the occasional organ note, cool air.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "midday",
              note: "Light comes through the tall windows, strongest around midday.",
            },
            reason:
              "Same square and the same hour, but a quiet walk inside instead of a climb for the view.",
          },
          {
            name: "Museum Speelklok",
            kind: "museum",
            neighborhood: "Binnenstad",
            summary:
              "A short walk from the tower, this museum of mechanical instruments runs guided tours on Sunday, with music boxes and street organs playing in the rooms.",
            aesthetic: ["brass", "carved wood"],
            coordinates: {
              lat: 52.0916,
              lng: 5.1225,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Organ music, guide voices, children's chatter.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Indoors with steady lighting, so the hour does not matter.",
            },
            reason:
              "Same neighbourhood and a good family stop, but livelier and indoors instead of the tower view.",
          },
        ],
      },
      {
        stopIndex: 2,
        options: [
          {
            name: "Soup on the Zadelstraat",
            kind: "food",
            neighborhood: "Binnenstad",
            summary:
              "A quieter side street where small kitchens serve soup, bread and sandwiches at lunchtime.",
            aesthetic: ["narrow street", "brick"],
            coordinates: {
              lat: 52.0899,
              lng: 5.1196,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "Low talk, spoons on bowls, a quiet street outside.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Mostly indoors, so the light matters little at lunchtime.",
            },
            reason:
              "Same lunchtime in the old centre, but lighter and quieter instead of big pancakes.",
          },
          {
            name: "Beer on the Ledig Erf",
            kind: "bar",
            neighborhood: "Binnenstad",
            summary: "Sunday afternoon on the Ledig Erf is busy with locals over beers and snacks.",
            aesthetic: ["terrace", "brick"],
            coordinates: {
              lat: 52.0903,
              lng: 5.1189,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Loud talk, glasses clinking, chairs packed close.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "afternoon",
              note: "Open to the sky, it holds the afternoon light until it fades.",
            },
            reason:
              "Same area and the same hour, but packed and loud with drinks instead of a pancake table.",
          },
        ],
      },
      {
        stopIndex: 3,
        options: [
          {
            name: "Botanische Tuinen",
            kind: "garden",
            neighborhood: "Utrecht Science Park",
            summary:
              "The university's botanical gardens are open on Sundays, with greenhouses that stay warm in November.",
            aesthetic: ["glass", "green"],
            coordinates: {
              lat: 52.0856,
              lng: 5.1654,
            },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Damp earth, dripping leaves, quiet paths.",
            },
            light: {
              exposure: "dappled",
              orientation: "none",
              bestWindow: "midday",
              note: "Greenhouse glass softens the light, best in the middle of the day.",
            },
            reason:
              "A quiet afternoon indoors like the museum, with plants instead of paintings, trading proximity for a short trip out.",
          },
          {
            name: "Spoorwegmuseum",
            kind: "museum",
            neighborhood: "Maliebaan",
            summary:
              "The railway museum fills a Sunday afternoon with trains to climb aboard and rides.",
            aesthetic: ["steel", "brick"],
            coordinates: {
              lat: 52.0875,
              lng: 5.1334,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Whistles, children shouting, metal doors clanging.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Mostly indoors, so the light is steady at any hour.",
            },
            reason: "Same museum-in-the-afternoon plan for a family, but much busier and louder.",
          },
        ],
      },
      {
        stopIndex: 4,
        options: [
          {
            name: "Soup on the Twijnstraat",
            kind: "food",
            neighborhood: "Twijnstraat",
            summary:
              "A narrow street of small kitchens serving quiet dinners of soup and stew on Sunday evening.",
            aesthetic: ["canal brick", "lamplight"],
            coordinates: {
              lat: 52.0891,
              lng: 5.1235,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "Soft talk, candles, a quiet street outside.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Lit by candles and street lamps once it is dark.",
            },
            reason:
              "Same early dinner and the same warm lamps, but quieter and smaller than the Wijk C crowd.",
          },
          {
            name: "Beer on the Oudegracht",
            kind: "bar",
            neighborhood: "Binnenstad",
            summary:
              "By early evening the wharf cellars along the canal are full of people with beer and bitterballen.",
            aesthetic: ["wharf cellars", "brick"],
            coordinates: {
              lat: 52.0919,
              lng: 5.1183,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Loud rooms, glasses, canal-side crowds.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Lit by lamps along the quay after dark.",
            },
            reason:
              "Same early evening, but a loud, packed wharf with beer and snacks instead of a sit-down dinner.",
          },
        ],
      },
      {
        stopIndex: 5,
        options: [
          {
            name: "Wilhelminapark",
            kind: "garden",
            neighborhood: "Wilhelminapark",
            summary: "A dark park on a Sunday evening, with quiet paths and few people.",
            aesthetic: ["bare trees", "gravel"],
            coordinates: {
              lat: 52.0847,
              lng: 5.1296,
            },
            sensory: {
              energy: "reflective",
              acoustic: "silent",
              crowd: "empty",
              texture: "Gravel underfoot, wind in the bare trees, no voices.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Nearly dark under the trees, with only scattered lamps.",
            },
            reason: "Same quiet evening walk, trading the lit canal for a dark park.",
          },
          {
            name: "Drinks on the Neude",
            kind: "bar",
            neighborhood: "Neude",
            summary: "By evening the Neude's cafes light up and fill with people.",
            aesthetic: ["open square", "lamplight"],
            coordinates: {
              lat: 52.0942,
              lng: 5.1192,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Voices on an open square, glasses, warm windows.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Lit by cafe windows and lamps after dark.",
            },
            reason:
              "Same evening in the old centre, but a drink among a crowd instead of a quiet canal walk.",
          },
        ],
      },
    ],
  },
};
