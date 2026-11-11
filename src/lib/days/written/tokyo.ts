import type { WrittenDay } from "./written-day";
import { TOKYO_REQUEST } from "./city-days";

/**
 * Tokyo, as claude-sonnet-5-5 wrote it on 2026-11-11 under day-v11, for its own address (generation
 * 617b5ccd-9bc9-486f-9b9e-2f9f7f93a859). Kept as written, letters escaped twice read as the reader
 * reads them, so the address opens a day the product really wrote, slips and all; the normalizer
 * repairs what it repairs for any live day.
 */
export const TOKYO_DAY: WrittenDay = {
  request: TOKYO_REQUEST,
  day: {
    assumptions: {
      travel: "transit",
      start: null,
      dinner: "late",
      end: "early",
      company: null,
    },
    dek: "An early start at the Tsukiji outer market, then Asakusa and the Sumida riverside through the afternoon, and a long evening of izakaya in Yurakucho under the tracks, with the last stop done by eleven.",
    stops: [
      {
        startTime: "07:30",
        durationMinutes: 75,
        place: {
          name: "Tsukiji Outer Market",
          kind: "market",
          neighborhood: "Tsukiji",
          coordinates: {
            lat: 35.6655,
            lng: 139.7707,
          },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture:
              "Narrow lanes, stall calls, the smell of grilled egg and soy, shoulders brushing in the aisles.",
          },
          light: {
            exposure: "covered",
            orientation: "none",
            bestWindow: "morning",
            note: "Awnings keep the lanes in even shade all morning; the light only matters at the lane ends, where it comes in low from the east.",
          },
          summary:
            "Most stalls are open by seven and the crowd is thin until around nine, so this is the hour to walk the lanes and eat standing up. Many stalls close by early afternoon.",
          aesthetic: ["stainless steel", "tarpaulin awnings", "wet concrete"],
        },
        dependsOn: ["start"],
      },
      {
        startTime: "09:00",
        durationMinutes: 40,
        place: {
          name: "Coffee on Harumi-dori",
          kind: "coffee",
          neighborhood: "Tsukiji",
          coordinates: {
            lat: 35.6703,
            lng: 139.7667,
          },
          sensory: {
            energy: "balanced",
            acoustic: "murmur",
            crowd: "steady",
            texture:
              "Traffic on the wide avenue, cups on saucers, short conversations at small tables.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "morning",
            note: "Street-facing glass gives flat, even light through the morning; it makes no difference to the coffee.",
          },
          summary:
            "Kissaten-style coffee and thick toast are the usual order at this hour, and it is a short walk from the market lanes. Good for a sit-down before the train.",
          aesthetic: ["dark wood", "glass storefronts"],
        },
        dependsOn: ["start", "travel"],
      },
      {
        startTime: "10:15",
        durationMinutes: 120,
        place: {
          name: "Senso-ji",
          kind: "sacred",
          neighborhood: "Asakusa",
          coordinates: {
            lat: 35.7148,
            lng: 139.7967,
          },
          sensory: {
            energy: "social",
            acoustic: "chatter",
            crowd: "packed",
            texture:
              "Incense smoke, coins dropping into the offering box, a steady crush through the gate.",
          },
          light: {
            exposure: "open",
            orientation: "s",
            bestWindow: "morning",
            note: "The main hall faces south, so by late morning the vermilion takes full sun; the courtyard is bright and flat from noon.",
          },
          summary:
            "On a Saturday in mid-November the approach is crowded by ten, and shichi-go-san families in kimono add to it. Walk past the main hall to the quieter side shrines behind it.",
          aesthetic: ["vermilion lacquer", "stone paving", "incense smoke"],
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "12:30",
        durationMinutes: 60,
        place: {
          name: "Soba and tempura on Kappabashi-dori",
          kind: "food",
          neighborhood: "Asakusa",
          coordinates: {
            lat: 35.7143,
            lng: 139.7889,
          },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture:
              "Clatter of bowls, fryer hiss through open kitchens, short queues on the pavement.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "Mostly indoors under strip lighting, so the hour makes no difference to the light.",
          },
          summary:
            "Lunch counters on the streets around the kitchenware district serve soba and tempura sets at midday, and a lone diner usually gets a counter seat fast.",
          aesthetic: ["steel counters", "paper menus"],
        },
        dependsOn: ["travel", "company"],
      },
      {
        startTime: "14:00",
        durationMinutes: 90,
        place: {
          name: "Sumida Park",
          kind: "walk",
          neighborhood: "Asakusa",
          coordinates: {
            lat: 35.7137,
            lng: 139.8009,
          },
          sensory: {
            energy: "calm",
            acoustic: "murmur",
            crowd: "steady",
            texture: "River wind, runners on the path, boats under the bridges, the odd busker.",
          },
          light: {
            exposure: "open",
            orientation: "w",
            bestWindow: "afternoon",
            note: "The path runs along the west bank, so the afternoon sun sits low over the water and Skytree stands lit across the river.",
          },
          summary:
            "The riverside path is the flat stretch to slow down after the temple, and the afternoon light on the water is best from about three. Cross toward Skytree if your legs want more.",
          aesthetic: ["river stone", "painted steel bridges"],
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "16:00",
        durationMinutes: 90,
        place: {
          name: "Ameyoko Shopping Street",
          kind: "market",
          neighborhood: "Ueno",
          coordinates: {
            lat: 35.7108,
            lng: 139.7746,
          },
          sensory: {
            energy: "social",
            acoustic: "loud",
            crowd: "packed",
            texture:
              "Vendors shouting prices, the rattle of the trains overhead, dried fish and candy at elbow height.",
          },
          light: {
            exposure: "covered",
            orientation: "none",
            bestWindow: "after-dark",
            note: "The railway arches shade the street in the afternoon and the shop signs take over as the light drops.",
          },
          summary:
            "The lane under the Yamanote tracks peaks late on a Saturday afternoon, with stalls calling out prices and the crowd moving slowly. Good for a lap before dinner.",
          aesthetic: ["railway arches", "neon signs", "plastic crates"],
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "18:00",
        durationMinutes: 45,
        place: {
          name: "Beer by the Yurakucho Tracks",
          kind: "bar",
          neighborhood: "Yurakucho",
          coordinates: {
            lat: 35.6745,
            lng: 139.7633,
          },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture:
              "Trains rumbling overhead, standing drinkers, smoke from yakitori grills drifting across the lane.",
          },
          light: {
            exposure: "covered",
            orientation: "none",
            bestWindow: "after-dark",
            note: "Lanterns and bare bulbs under the arches come on at dusk, so the street looks best from about five-thirty.",
          },
          summary:
            "Salarymen and weekend crowds fill the lanes under the arches by six, and a first beer standing at a counter is the usual start. Order the small plates as they come.",
          aesthetic: ["railway arches", "lanterns", "plastic stools"],
        },
        dependsOn: ["dinner"],
      },
      {
        startTime: "19:30",
        durationMinutes: 120,
        place: {
          name: "Yakitori and izakaya under the Yurakucho arches",
          kind: "food",
          neighborhood: "Yurakucho",
          coordinates: {
            lat: 35.6741,
            lng: 139.7628,
          },
          sensory: {
            energy: "social",
            acoustic: "loud",
            crowd: "packed",
            texture: "Grill smoke, shouted orders, glasses set down hard on wooden tables.",
          },
          light: {
            exposure: "covered",
            orientation: "none",
            bestWindow: "after-dark",
            note: "Warm lantern light under the arches at night; the daytime hours do not matter here.",
          },
          summary:
            "A late Saturday dinner here is skewers, sashimi and highballs in a tight room, and counter seats for one open up as groups leave around nine. A long, loud meal that ends well before the last trains.",
          aesthetic: ["smoked wood", "lanterns", "brick arches"],
        },
        dependsOn: ["dinner", "end", "company"],
      },
    ],
    alternatives: [
      {
        stopIndex: 0,
        options: [
          {
            name: "Hamarikyu Gardens",
            kind: "garden",
            neighborhood: "Tsukiji",
            coordinates: {
              lat: 35.6597,
              lng: 139.7632,
            },
            sensory: {
              energy: "calm",
              acoustic: "hushed",
              crowd: "sparse",
              texture:
                "Gravel paths, a tidal pond, container ships beyond the trees, hardly any voices.",
            },
            light: {
              exposure: "open",
              orientation: "se",
              bestWindow: "morning",
              note: "The pond faces the morning sun and the skyscrapers behind it throw a long shadow by noon.",
            },
            summary:
              "The gardens open at nine and are a short walk from the market lanes, so this is the quiet option. Go if the lanes feel too loud.",
            aesthetic: ["pine trees", "tidal pond", "gravel paths"],
            reason:
              "Same neighbourhood and a morning slot, but it trades stalls and chatter for a pond and lawns.",
          },
          {
            name: "Toyosu Market viewing decks",
            kind: "market",
            neighborhood: "Toyosu",
            coordinates: {
              lat: 35.6454,
              lng: 139.7843,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture:
                "Forklifts below the glass, sushi counters with queues, a rush of visitors along the corridors.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Flat artificial light inside the halls all day, so the hour only changes the queue.",
            },
            summary:
              "A morning at the wholesale halls with the sushi counters lined up. Livelier than the outer lanes but a 15-minute train ride away.",
            aesthetic: ["steel halls", "glass walkways"],
            reason:
              "Still seafood and a morning crowd, but it trades the stall lanes for one big hall and a longer ride.",
          },
        ],
      },
      {
        stopIndex: 1,
        options: [
          {
            name: "Tea on Tsukiji Hongan-ji Temple Grounds",
            kind: "coffee",
            neighborhood: "Tsukiji",
            coordinates: {
              lat: 35.6671,
              lng: 139.7725,
            },
            sensory: {
              energy: "calm",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Stone steps, a cold wind through the forecourt, soft voices.",
            },
            light: {
              exposure: "open",
              orientation: "e",
              bestWindow: "morning",
              note: "The stone frontage takes the morning sun straight on and the forecourt is flat and bright by ten.",
            },
            summary:
              "A quieter sit-down a few blocks from the main lanes, where a hot drink is quiet and the courtyard is empty by mid-morning.",
            aesthetic: ["stone", "carved timber"],
            reason:
              "Same slot and same hour, but the temple forecourt trades the avenue noise for stone and hush.",
          },
          {
            name: "Breakfast Sets by Tsukiji Station",
            kind: "food",
            neighborhood: "Tsukiji",
            coordinates: {
              lat: 35.6679,
              lng: 139.7686,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Counters full of commuters, fryers going, orders shouted across the room.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Strip lights inside; the street light does not reach the counters.",
            },
            summary:
              "Rice-and-egg and miso breakfast sets near the station fill the counters by nine, and the street is busier than the avenue.",
            aesthetic: ["steel counters", "fluorescent light"],
            reason:
              "Same neighbourhood and meal, but it trades the quiet table for a faster, louder counter.",
          },
        ],
      },
      {
        stopIndex: 2,
        options: [
          {
            name: "Kinryuzan Garden Path",
            kind: "garden",
            neighborhood: "Asakusa",
            coordinates: {
              lat: 35.7152,
              lng: 139.7965,
            },
            sensory: {
              energy: "calm",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Stone lanterns, cold gravel, a few visitors quietly circling the pond.",
            },
            light: {
              exposure: "dappled",
              orientation: "none",
              bestWindow: "morning",
              note: "Maples throw broken shade across the path all morning, and the lanterns pick out the paths with a dim light by afternoon.",
            },
            summary:
              "A quieter corner of the temple grounds, away from the main approach. Good if the Nakamise crowd is too much.",
            aesthetic: ["stone lanterns", "maple trees"],
            reason:
              "Same grounds and slot, but it trades the main hall's crush for gravel and shade.",
          },
          {
            name: "Nakamise-dori",
            kind: "market",
            neighborhood: "Asakusa",
            coordinates: {
              lat: 35.712,
              lng: 139.7963,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture:
                "Stalls selling rice crackers and sweets, a shoulder-to-shoulder walk toward the gate.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "none",
              note: "Awnings keep the street in shade all day, so the hour only changes the crowd.",
            },
            summary:
              "The approach lane by the gate is at its most crowded late morning, with stalls grilling crackers and selling sweets along both sides.",
            aesthetic: ["awnings", "painted signs"],
            reason:
              "Same neighbourhood and hour, but it trades the shrine's grounds for stalls and a tighter crowd.",
          },
        ],
      },
      {
        stopIndex: 3,
        options: [
          {
            name: "Tea and Sweets near Kototoi-dori",
            kind: "coffee",
            neighborhood: "Asakusa",
            coordinates: {
              lat: 35.7128,
              lng: 139.7938,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "Hot tea in small cups, low chairs, voices kept down.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Mostly indoors in soft electric light all afternoon.",
            },
            summary:
              "A lighter option for those who want a sit-down with tea and sweets rather than a full meal. Quiet at this hour.",
            aesthetic: ["dark wood", "paper screens"],
            reason:
              "Same neighbourhood and midday slot, but it trades a bowl of noodles for tea and something sweet.",
          },
          {
            name: "Izakaya Lanes near Hoppy-dori",
            kind: "food",
            neighborhood: "Asakusa",
            coordinates: {
              lat: 35.7117,
              lng: 139.7933,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture:
                "Plastic tables out on the pavement, grilled beef and beer, loud voices already at noon.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "none",
              note: "Open to the street, so the sun sets the mood, though the hour matters little to the food.",
            },
            summary:
              "The open-air lane starts early on a Saturday, with grilled beef stew and beer on pavement tables by midday.",
            aesthetic: ["plastic tables", "beer crates"],
            reason:
              "Same neighbourhood and meal, but it trades the quiet counter for a loud outdoor table and beer.",
          },
        ],
      },
      {
        stopIndex: 4,
        options: [
          {
            name: "Mukojima Hyakkaen Garden",
            kind: "garden",
            neighborhood: "Mukojima",
            coordinates: {
              lat: 35.7209,
              lng: 139.8197,
            },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "empty",
              texture: "Gravel, bare plum trees, a tea house veranda, almost no voices.",
            },
            light: {
              exposure: "dappled",
              orientation: "none",
              bestWindow: "afternoon",
              note: "Low afternoon sun slants through the bare branches onto the paths from about three.",
            },
            summary:
              "A quiet garden across the river from the main path. A few minutes' train ride but a clear drop in noise.",
            aesthetic: ["plum trees", "gravel paths"],
            reason:
              "Same river, but it trades the open towpath for a walled garden and almost no crowd.",
          },
          {
            name: "Skytree Town Plaza",
            kind: "shop",
            neighborhood: "Oshiage",
            coordinates: {
              lat: 35.7101,
              lng: 139.8107,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture:
                "Shop-floor music, queues for the lifts, families crossing the plaza in a steady stream.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "after-dark",
              note: "The tower lights up after dusk, so the plaza looks best later in the afternoon.",
            },
            summary:
              "A short walk from the riverside across the bridge, with a mall at the foot and the tower lit by late afternoon. Loud and busy on a Saturday.",
            aesthetic: ["glass", "steel"],
            reason:
              "Same riverside and afternoon slot, but it trades the open path for a mall and a crowd.",
          },
        ],
      },
      {
        stopIndex: 5,
        options: [
          {
            name: "Ueno Park Paths",
            kind: "walk",
            neighborhood: "Ueno",
            coordinates: {
              lat: 35.7149,
              lng: 139.774,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "steady",
              texture:
                "Gingko leaves on the path, street performers in the distance, slow walkers.",
            },
            light: {
              exposure: "dappled",
              orientation: "none",
              bestWindow: "afternoon",
              note: "Late-afternoon sun comes through gingko and maple, turning the paths gold in mid-November.",
            },
            summary:
              "A calmer walk a few minutes from the arcade, with autumn colour at its best in the late afternoon.",
            aesthetic: ["gingko trees", "stone paths"],
            reason:
              "Same neighbourhood and hour, but it trades the stalls for tree-lined paths and a slower crowd.",
          },
          {
            name: "Standing Bars by Ueno Station",
            kind: "bar",
            neighborhood: "Ueno",
            coordinates: {
              lat: 35.7117,
              lng: 139.777,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture:
                "Shoulder-to-shoulder at the counter, cold beer, a roar of voices under the tracks.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Bare bulbs under the arches; the hour only matters for the crowd.",
            },
            summary:
              "The first beers go down early on a Saturday, with standing bars along the arches filling from four. A lively start to the evening.",
            aesthetic: ["railway arches", "plastic stools"],
            reason:
              "Same neighbourhood and hour, but it trades the market lane for a standing bar and a beer.",
          },
        ],
      },
      {
        stopIndex: 6,
        options: [
          {
            name: "Hibiya Park Paths",
            kind: "walk",
            neighborhood: "Hibiya",
            coordinates: {
              lat: 35.6738,
              lng: 139.7563,
            },
            sensory: {
              energy: "calm",
              acoustic: "hushed",
              crowd: "sparse",
              texture:
                "Lit paths, fountain hiss, benches with a few people, the city quiet past the hedges.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Park lamps and the lit towers beyond the trees take over at dusk.",
            },
            summary:
              "A quiet evening walk a few minutes from the tracks, well lit at this hour, before the dinner crowd takes the lanes.",
            aesthetic: ["lamp posts", "lawn", "stone"],
            reason:
              "Same neighbourhood and hour, but it trades the counter for a lit path and fewer voices.",
          },
          {
            name: "Beer Halls near Shimbashi",
            kind: "bar",
            neighborhood: "Shimbashi",
            coordinates: {
              lat: 35.6665,
              lng: 139.7583,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture:
                "Tables of office workers, beer by the pitcher, orders shouted across the room.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Warm indoor light; the street outside is dark by five-thirty.",
            },
            summary:
              "A louder, bigger room with beer by the pitcher, a short walk south along the tracks.",
            aesthetic: ["laminate tables", "paper lanterns"],
            reason:
              "Same stretch of the tracks and the same hour, but it trades a standing counter for a big room.",
          },
        ],
      },
      {
        stopIndex: 7,
        options: [
          {
            name: "Sushi Counters in Ginza",
            kind: "food",
            neighborhood: "Ginza",
            coordinates: {
              lat: 35.6717,
              lng: 139.764,
            },
            sensory: {
              energy: "calm",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "A few seats at a wooden counter, the chef's knife, low voices.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Warm lamplight over the counter all evening; the hour affects only the seating.",
            },
            summary:
              "A slower, quieter dinner a short walk away, with a counter and set courses. Book a seat early on a Saturday.",
            aesthetic: ["hinoki wood", "paper lamps"],
            reason:
              "Same part of town and a late dinner, but it trades the loud smoky room for a quiet counter.",
          },
          {
            name: "Ramen on Ginza Backstreets",
            kind: "food",
            neighborhood: "Ginza",
            coordinates: {
              lat: 35.6702,
              lng: 139.7621,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Slurping at a steamy counter, quick turnover, a line outside the door.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Strip lights inside, a lit sign outside; the hour makes no difference.",
            },
            summary:
              "A fast bowl of ramen on the back lanes, popular late on a Saturday. Quicker and louder than a full dinner.",
            aesthetic: ["steel counters", "paper menus"],
            reason:
              "Same neighbourhood and meal, but it trades the long grilled dinner for one fast bowl.",
          },
        ],
      },
    ],
  },
};
