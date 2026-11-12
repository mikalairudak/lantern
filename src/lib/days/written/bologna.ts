import type { WrittenDay } from "./written-day";
import { BOLOGNA_START_REQUEST } from "./quick-starts";

/**
 * Bologna, as claude-sonnet-5-5 wrote it on 2026-10-31 under day-v8, for the
 * start that offers it (generation faebcc08-8385-4a92-ba3e-aa61475b419f). Kept as written, letters
 * escaped twice read as the reader reads them, so the start opens a day the product really
 * wrote, slips and all; the normalizer repairs what it repairs for any live day.
 */
export const BOLOGNA_START_DAY: WrittenDay = {
  request: BOLOGNA_START_REQUEST,
  day: {
    assumptions: {
      travel: "on-foot",
      start: "slow",
      dinner: "late",
      end: "late",
      company: null,
    },
    dek: "A mid-morning coffee near Piazza Maggiore, the market streets of the Quadrilatero at lunch, the portico climb to the Two Towers and the university quarter by evening, then late tortellini and wine in the cellars off Via del Pratello.",
    stops: [
      {
        startTime: "09:30",
        durationMinutes: 45,
        place: {
          name: "Coffee along Via Drapperie",
          kind: "coffee",
          neighborhood: "Quadrilatero",
          summary:
            "Bologna drinks its coffee standing up, a quick espresso or a cappuccino with a pastry, and by half past nine on a Saturday the lanes of the old market quarter are filling up while the shutters are still going up.",
          aesthetic: ["arcaded lanes", "cobblestone"],
          coordinates: {
            lat: 44.4941,
            lng: 11.3445,
          },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "steady",
            texture: "Cups on counters, shutters rattling up, shop owners calling across the lane.",
          },
          light: {
            exposure: "covered",
            orientation: "none",
            bestWindow: "morning",
            note: "The lanes are narrow and the sun only reaches the stones for a short while around midday, so the morning light is soft and even.",
          },
        },
        dependsOn: ["start"],
      },
      {
        startTime: "10:30",
        durationMinutes: 60,
        place: {
          name: "Basilica di San Petronio",
          kind: "sacred",
          neighborhood: "Piazza Maggiore",
          summary:
            "The big brick-and-marble church on the main square opens in the morning and is free to walk through. Go in before midday, when the nave is quiet and the light comes in high through the long windows.",
          aesthetic: ["unfinished marble facade", "pale stone"],
          coordinates: {
            lat: 44.4937,
            lng: 11.3431,
          },
          sensory: {
            energy: "calm",
            acoustic: "hushed",
            crowd: "steady",
            texture: "Footsteps on stone, a murmur of languages, an occasional bell from outside.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "morning",
            note: "Daylight enters from high windows, so the nave is brightest in late morning and dimmer once the sun moves round.",
          },
        },
        dependsOn: [],
      },
      {
        startTime: "12:00",
        durationMinutes: 90,
        place: {
          name: "Tagliatelle in the Quadrilatero",
          kind: "food",
          neighborhood: "Quadrilatero",
          summary:
            "This is the lunch street for fresh egg pasta, tagliatelle al ragù and tortellini in broth, with cured meats and cheese on the side. Saturday lunch fills early, so be at a table by noon.",
          aesthetic: ["market stalls", "arcaded lanes"],
          coordinates: {
            lat: 44.4934,
            lng: 11.3452,
          },
          sensory: {
            energy: "social",
            acoustic: "loud",
            crowd: "busy",
            texture: "Plates clinking, vendors calling prices, a long line at the cheese counters.",
          },
          light: {
            exposure: "covered",
            orientation: "none",
            bestWindow: "midday",
            note: "Midday sun cuts into the lanes for a short while and lights up the produce stalls, then the lanes drop back into shade.",
          },
        },
        dependsOn: ["company"],
      },
      {
        startTime: "13:45",
        durationMinutes: 75,
        place: {
          name: "Mercato delle Erbe",
          kind: "market",
          neighborhood: "Via Ugo Bassi",
          summary:
            "A covered food hall with stalls of fruit, cheese and fish, and counters where friends can share a plate and a glass of wine in the early afternoon without a booking.",
          aesthetic: ["iron roof", "market stalls"],
          coordinates: {
            lat: 44.4967,
            lng: 11.3421,
          },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture: "Voices under a high roof, crates being moved, glasses clinking.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "Daylight from the roof keeps the hall evenly lit through the afternoon, so the hour makes little difference inside.",
          },
        },
        dependsOn: ["company"],
      },
      {
        startTime: "15:15",
        durationMinutes: 90,
        place: {
          name: "Due Torri and Strada Maggiore",
          kind: "walk",
          neighborhood: "Centro Storico",
          summary:
            "Walk under the porticoes from Via Rizzoli to the two leaning towers, then on along Strada Maggiore. The covered walkway keeps you dry whatever the November weather does, and the late-afternoon light is low and warm on the brick.",
          aesthetic: ["terracotta brick", "arcaded streets"],
          coordinates: {
            lat: 44.4942,
            lng: 11.3468,
          },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture:
              "Footsteps under vaulted ceilings, bicycle bells, shopfronts and street musicians.",
          },
          light: {
            exposure: "covered",
            orientation: "none",
            bestWindow: "afternoon",
            note: "The low afternoon sun slants in at the ends of the porticoes and turns the brick orange for the last hour before dusk.",
          },
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "17:15",
        durationMinutes: 90,
        place: {
          name: "Spritz around Piazza Verdi",
          kind: "bar",
          neighborhood: "University Quarter",
          summary:
            "By early evening the square outside the opera house fills with students and friends, so this is the hour to take an aperitivo, a spritz or a beer, with small plates on the side.",
          aesthetic: ["graffiti", "worn stone"],
          coordinates: {
            lat: 44.4968,
            lng: 11.3516,
          },
          sensory: {
            energy: "social",
            acoustic: "loud",
            crowd: "packed",
            texture:
              "Voices overlapping across the square, music from open doors, people sitting on the steps.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "sunset",
            note: "The sun drops behind the buildings by about five and the square turns blue, then orange under the streetlights.",
          },
        },
        dependsOn: ["end", "company"],
      },
      {
        startTime: "21:00",
        durationMinutes: 120,
        place: {
          name: "Tortellini along Via del Pratello",
          kind: "food",
          neighborhood: "Pratello",
          summary:
            "The long street west of the centre is where Saturday dinner starts late, with tortellini in broth, mortadella and local wine, and the tables fill after nine and run on past eleven.",
          aesthetic: ["low porticoes", "painted walls"],
          coordinates: {
            lat: 44.4975,
            lng: 11.3365,
          },
          sensory: {
            energy: "social",
            acoustic: "loud",
            crowd: "packed",
            texture:
              "Tables spilling onto the pavement, glasses and plates, voices rising as the evening goes on.",
          },
          light: {
            exposure: "covered",
            orientation: "none",
            bestWindow: "after-dark",
            note: "The street is lit by warm lamps and shop windows after dark, with little daylight reaching it under the porticoes at any hour.",
          },
        },
        dependsOn: ["dinner", "company"],
      },
      {
        startTime: "23:15",
        durationMinutes: 90,
        place: {
          name: "Wine on Via del Pratello",
          kind: "bar",
          neighborhood: "Pratello",
          summary:
            "After dinner the same street turns into a run of small bars with wine by the glass and beer, and the crowd stays out on the pavement well past midnight.",
          aesthetic: ["painted walls", "low porticoes"],
          coordinates: {
            lat: 44.4972,
            lng: 11.3355,
          },
          sensory: {
            energy: "social",
            acoustic: "loud",
            crowd: "packed",
            texture: "Music from open doors, laughter, smokers and drinkers filling the pavement.",
          },
          light: {
            exposure: "covered",
            orientation: "none",
            bestWindow: "after-dark",
            note: "Lamplight and neon from the bars lights the pavement, so the street looks the same from eleven until closing.",
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
            name: "Coffee along Via Clavature",
            kind: "coffee",
            neighborhood: "Quadrilatero",
            summary:
              "A quieter lane of the same market quarter where coffee and pastries are drunk at a slower pace in the first hours.",
            aesthetic: ["arcaded lanes", "cobblestone"],
            coordinates: {
              lat: 44.4932,
              lng: 11.3441,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "Cups being set down, a few shoppers, a delivery cart on the stones.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "morning",
              note: "The narrow lane stays in shade until late, so the light is gentle through the morning.",
            },
            reason:
              "The same quarter and the same espresso, in a lane with fewer people and a slower start.",
          },
          {
            name: "Coffee along Via Rizzoli",
            kind: "coffee",
            neighborhood: "Centro Storico",
            summary:
              "The main shopping street fills up by mid-morning with people on their Saturday errands, and the counters turn out cappuccinos and pastries fast.",
            aesthetic: ["arcaded street", "stone paving"],
            coordinates: {
              lat: 44.4936,
              lng: 11.3459,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "busy",
              texture: "Shoppers streaming past, espresso machines hissing, a loud counter crowd.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "morning",
              note: "The porticoes shade the street all morning, so it stays evenly lit.",
            },
            reason: "The same quick coffee and pastry, on a wider street with a much busier crowd.",
          },
        ],
      },
      {
        stopIndex: 1,
        options: [
          {
            name: "Chiesa di Santo Stefano",
            kind: "sacred",
            neighborhood: "Via Santo Stefano",
            summary:
              "A cluster of linked old churches around a small cloister, a few minutes' walk from the main square, usually quieter than the big basilica.",
            aesthetic: ["brick", "pale stone"],
            coordinates: {
              lat: 44.4917,
              lng: 11.3504,
            },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Footsteps on stone, the odd bell, a few people in quiet corners.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "morning",
              note: "Daylight comes in sideways and low, so the inside is brightest in the middle of the morning.",
            },
            reason: "Another old church close by, a good deal quieter, with less to see at once.",
          },
          {
            name: "Piazza Maggiore",
            kind: "walk",
            neighborhood: "Piazza Maggiore",
            summary:
              "The main square beside the basilica, where on Saturday late morning people gather, sit on the steps and cross toward the cafes.",
            aesthetic: ["red brick", "stone paving"],
            coordinates: {
              lat: 44.4939,
              lng: 11.3427,
            },
            sensory: {
              energy: "social",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Voices bouncing off the palazzi, bikes crossing, groups on the steps.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "morning",
              note: "The sun reaches the middle of the square by late morning and warms the brick on the east side first.",
            },
            reason: "The same spot beside the basilica, outdoors and much more crowded.",
          },
        ],
      },
      {
        stopIndex: 2,
        options: [
          {
            name: "Tortellini in Via Santo Stefano",
            kind: "food",
            neighborhood: "Via Santo Stefano",
            summary:
              "A calmer street south of the market lanes where lunch is the same tortellini and tagliatelle at a slower pace, with plenty of tables by half past twelve.",
            aesthetic: ["arcaded street", "terracotta brick"],
            coordinates: {
              lat: 44.4908,
              lng: 11.3485,
            },
            sensory: {
              energy: "balanced",
              acoustic: "murmur",
              crowd: "steady",
              texture: "Plates and conversation, a few tables outdoors, little traffic.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "midday",
              note: "The porticoes keep the street shaded and evenly lit through the lunch hours.",
            },
            reason:
              "The same Bolognese pasta in a quieter street, giving up the market's noise and crowd.",
          },
          {
            name: "Pasta near Piazza Maggiore",
            kind: "food",
            neighborhood: "Piazza Maggiore",
            summary:
              "The restaurants around the square fill fast with Saturday lunchers, serving tortellini, lasagne and cutting boards of cured meat to big tables.",
            aesthetic: ["arcaded facades", "stone paving"],
            coordinates: {
              lat: 44.4932,
              lng: 11.3435,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Waiters weaving between tables, big groups, plates arriving constantly.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "midday",
              note: "Light reaches the tables under the arcades in bands as the sun crosses the square.",
            },
            reason:
              "The same pasta lunch, nearer the main square, with a louder and more crowded room.",
          },
        ],
      },
      {
        stopIndex: 3,
        options: [
          {
            name: "Giardini Margherita",
            kind: "garden",
            neighborhood: "Santo Stefano",
            summary:
              "A large park south-east of the centre with long paths and a pond, quiet in the early afternoon with a few walkers and joggers.",
            aesthetic: ["lawns", "old trees"],
            coordinates: {
              lat: 44.4829,
              lng: 11.3558,
            },
            sensory: {
              energy: "calm",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Gravel paths, bare branches, dogs and a few runners.",
            },
            light: {
              exposure: "dappled",
              orientation: "none",
              bestWindow: "afternoon",
              note: "In November the low sun gets through the thinning trees and lights the paths from early afternoon onward.",
            },
            reason:
              "A change from the food hall to open paths, a short distance away, at a slower pace.",
          },
          {
            name: "Wine along Via Pescherie Vecchie",
            kind: "bar",
            neighborhood: "Quadrilatero",
            summary:
              "The old fish street fills up on Saturday afternoon with friends over glasses of Pignoletto or Sangiovese and plates of salumi at the stand-up counters.",
            aesthetic: ["market stalls", "painted signs"],
            coordinates: {
              lat: 44.4943,
              lng: 11.3453,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture:
                "People two deep at counters, glasses held overhead, a crowd out into the lane.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "afternoon",
              note: "Daylight from above the stalls fades by four and the lane takes on the colour of the lamps.",
            },
            reason:
              "The same food-and-wine crowd as the market hall, in a narrower lane that is louder and tighter.",
          },
        ],
      },
      {
        stopIndex: 4,
        options: [
          {
            name: "Piazza Santo Stefano",
            kind: "walk",
            neighborhood: "Via Santo Stefano",
            summary:
              "A wide, quiet piazza with a long porticoed edge and a few benches, where late afternoon is slow and calm.",
            aesthetic: ["terracotta brick", "stone paving"],
            coordinates: {
              lat: 44.4915,
              lng: 11.3499,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "Footsteps, pigeons, a few conversations at the edge of the square.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "afternoon",
              note: "The late sun lights the church fronts on one side while the other stays in shadow.",
            },
            reason:
              "The same slow walk under the porticoes, in a quieter square with fewer people.",
          },
          {
            name: "Via Indipendenza",
            kind: "shop",
            neighborhood: "Centro Storico",
            summary:
              "The long straight street into the centre is full of Saturday shoppers by the end of the afternoon, with shop doors open and a continuous flow along the porticoes.",
            aesthetic: ["arcaded street", "shopfronts"],
            coordinates: {
              lat: 44.4986,
              lng: 11.3434,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture:
                "Crowds streaming both ways, bags and bikes, shop doors opening onto the pavement.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "afternoon",
              note: "The porticoes shade the walkway and the street lamps come on as the afternoon ends.",
            },
            reason:
              "The same walk under arcades, on a wider shopping street with a much heavier crowd.",
          },
        ],
      },
      {
        stopIndex: 5,
        options: [
          {
            name: "Wine on Via Santo Stefano",
            kind: "bar",
            neighborhood: "Via Santo Stefano",
            summary:
              "A few wine bars along the southern portico where a glass of local white and some salumi are served in a quieter setting before dinner.",
            aesthetic: ["arcaded street", "terracotta brick"],
            coordinates: {
              lat: 44.4905,
              lng: 11.3492,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "Glasses set down, low conversation, little traffic past the doors.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "sunset",
              note: "The street lamps come on around five and give the portico a warm tone through the early evening.",
            },
            reason: "The same aperitivo hour, in a slower street away from the student crowd.",
          },
          {
            name: "Beer around Via Zamboni",
            kind: "bar",
            neighborhood: "University Quarter",
            summary:
              "The main university street fills with students heading out for the evening, with cheap beer and music from the bars after six.",
            aesthetic: ["graffiti", "worn stone"],
            coordinates: {
              lat: 44.4969,
              lng: 11.3536,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture:
                "Crowds on the pavement, bars blasting music, bicycles locked to every pole.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "after-dark",
              note: "The street goes dark early under the porticoes and is lit by signs and shop windows.",
            },
            reason: "The same student aperitivo scene, one street over, louder and denser.",
          },
        ],
      },
      {
        stopIndex: 6,
        options: [
          {
            name: "Dinner in Via Santo Stefano",
            kind: "food",
            neighborhood: "Via Santo Stefano",
            summary:
              "A calmer row of restaurants south of the centre where dinner is tortellini, cutlets and local wine at a slower pace, with tables free later in the evening.",
            aesthetic: ["arcaded street", "terracotta brick"],
            coordinates: {
              lat: 44.4906,
              lng: 11.3488,
            },
            sensory: {
              energy: "balanced",
              acoustic: "murmur",
              crowd: "steady",
              texture:
                "Conversation at neighbouring tables, a waiter passing, little street noise.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "after-dark",
              note: "The street is lit by lamps and restaurant windows after dark, a warm and low light.",
            },
            reason:
              "The same Bolognese dinner of pasta and wine, in a calmer street away from the Pratello crowds.",
          },
          {
            name: "Osteria along Via Mascarella",
            kind: "food",
            neighborhood: "University Quarter",
            summary:
              "A street of student osterie where long Saturday dinners of tagliatelle, tortellini and carafes of wine get loud and cheap.",
            aesthetic: ["painted walls", "worn stone"],
            coordinates: {
              lat: 44.4989,
              lng: 11.3478,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Packed benches, shouted orders, carafes passed down the table.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "The rooms are lit by warm bulbs after dark, with little daylight at this hour anyway.",
            },
            reason:
              "The same pasta-and-wine dinner in a student street, louder and more packed than Pratello.",
          },
        ],
      },
      {
        stopIndex: 7,
        options: [
          {
            name: "Wine in Piazza Santo Stefano",
            kind: "bar",
            neighborhood: "Via Santo Stefano",
            summary:
              "A few wine bars around the quiet square keep serving late, with a glass of local wine and a slower end to the night.",
            aesthetic: ["terracotta brick", "stone paving"],
            coordinates: {
              lat: 44.4913,
              lng: 11.3497,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "Low voices, glasses on the table, the square mostly empty.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Street lamps light the square dimly after dark, with warm light from the open doors.",
            },
            reason: "The same late wine, in a much quieter square away from the Pratello crowds.",
          },
          {
            name: "Beer along Via Mascarella",
            kind: "bar",
            neighborhood: "University Quarter",
            summary:
              "The student bars here stay full past midnight on Saturdays, with beer, spritz and music pouring onto the pavement.",
            aesthetic: ["graffiti", "worn stone"],
            coordinates: {
              lat: 44.4992,
              lng: 11.3482,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture:
                "Music from every doorway, a crowd spilling onto the road, bottles and glasses everywhere.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Neon and bar signs light the street, and nothing about it changes between midnight and closing.",
            },
            reason:
              "The same late drinking crowd, in the university streets, louder and denser than Pratello.",
          },
        ],
      },
    ],
  },
};
