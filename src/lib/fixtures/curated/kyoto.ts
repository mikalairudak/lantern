import type { WrittenDay } from "@/lib/days/written/written-day";
import { KYOTO_REQUEST } from "./requests";

/**
 * A calm Saturday in Kyoto in leaf season, routed around the crowds: the northern
 * Higashiyama temples before ten, a booked garden and an early lunch by Nanzen-ji, the
 * Okazaki museums through the busiest hours, and Gion from the late afternoon. Hours were
 * checked against the places' own or listing pages in October 2026. Coordinates are
 * entrances, or the starting point of a walk, mostly from OpenStreetMap; the Daimonji
 * trailhead and the counters by Tatsumi bridge are estimated from nearby landmarks.
 */
export const KYOTO_DAY: WrittenDay = {
  request: KYOTO_REQUEST,
  day: {
    assumptions: {
      travel: "on-foot",
      start: "early",
      dinner: "early",
      // Its last stop ends at 19:30: home by eight, the end its hours keep.
      end: "evening",
      company: null,
    },
    dek: "Honen-in before eight, the canal path down to Nanzen-ji and a booked hour in Murin-an's garden. Tofu at eleven, kuzukiri at three, and the Shirakawa as the teahouses light up.",
    stops: [
      {
        startTime: "07:30",
        durationMinutes: 45,
        place: {
          name: "Honen-in",
          kind: "sacred",
          neighborhood: "Shishigatani",
          summary:
            "The grounds open at six and cost nothing, so at half past seven you have the thatched gate and the two sand mounds nearly to yourself.",
          aesthetic: ["thatch", "moss", "raked sand"],
          coordinates: { lat: 35.0234, lng: 135.7974 },
          sensory: {
            energy: "reflective",
            acoustic: "hushed",
            crowd: "empty",
            texture: "Brooms on the stone path, a crow up the hill, no voices.",
          },
          light: {
            exposure: "dappled",
            orientation: "none",
            bestWindow: "morning",
            note: "The hill behind holds the sun back until around eight, so the moss starts in soft shade and then takes the light in patches through the maples.",
          },
        },
        dependsOn: ["start"],
      },
      {
        startTime: "08:25",
        durationMinutes: 75,
        place: {
          name: "Philosopher's Path",
          kind: "walk",
          neighborhood: "Shishigatani",
          summary:
            "The canal path south from Honen-in to Nyakuoji bridge and on through Nanzen-ji's grounds, walked before ten, ahead of the tour groups.",
          aesthetic: ["stone canal", "cherry trees", "gravel path"],
          coordinates: { lat: 35.0234, lng: 135.7961 },
          sensory: {
            energy: "calm",
            acoustic: "hushed",
            crowd: "sparse",
            texture: "Water running beside you, gravel underfoot, a jogger coming up behind.",
          },
          light: {
            exposure: "dappled",
            orientation: "none",
            bestWindow: "morning",
            note: "Low sun over the hills comes through the cherry trunks in strips; by noon it is high and flat.",
          },
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "10:00",
        durationMinutes: 60,
        place: {
          name: "Murin-an",
          kind: "garden",
          neighborhood: "Nanzen-ji",
          summary:
            "Book the ten o'clock entry ahead: visits are capped by the hour, so the lawn stays quiet while Nanzen-ji up the road fills.",
          aesthetic: ["lawn", "stream", "borrowed hills"],
          coordinates: { lat: 35.0116, lng: 135.7866 },
          sensory: {
            energy: "calm",
            acoustic: "hushed",
            crowd: "sparse",
            texture:
              "Water running through the garden, stepping stones underfoot, low voices from the tatami room.",
          },
          light: {
            exposure: "open",
            orientation: "e",
            bestWindow: "morning",
            note: "The view runs east to the hills, so the morning sun comes toward you across the lawn and backlights the maples; after lunch the light is flat.",
          },
        },
        dependsOn: [],
      },
      {
        startTime: "11:15",
        durationMinutes: 75,
        place: {
          name: "Simmered tofu by Nanzen-ji",
          kind: "food",
          neighborhood: "Nanzen-ji",
          summary:
            "The houses around the temple serve simmered tofu, and at a quarter past eleven there are tables before the noon queues form at their gates.",
          aesthetic: ["tatami", "paper screens", "garden"],
          coordinates: { lat: 35.0124, lng: 135.7931 },
          sensory: {
            energy: "calm",
            acoustic: "murmur",
            crowd: "steady",
            texture: "Low talk across the tatami, steam off the pots, socks on polished boards.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "Midday light comes in off the gardens the rooms look onto; away from the windows it stays dim.",
          },
        },
        dependsOn: [],
      },
      {
        startTime: "13:00",
        durationMinutes: 90,
        place: {
          name: "National Museum of Modern Art, Kyoto",
          kind: "museum",
          neighborhood: "Okazaki",
          summary:
            "The early afternoon indoors, while the temples are at their busiest, with the collection rooms on the top floor.",
          aesthetic: ["glass facade", "white galleries"],
          coordinates: { lat: 35.0124, lng: 135.7824 },
          sensory: {
            energy: "calm",
            acoustic: "hushed",
            crowd: "sparse",
            texture: "Footsteps on hard floors, whispers at the cases, the lift's chime.",
          },
          light: {
            exposure: "interior",
            orientation: "e",
            bestWindow: "none",
            note: "Gallery light is the same all day; the east-facing windows show the torii and the hills lit by the afternoon sun from behind you.",
          },
        },
        dependsOn: [],
      },
      {
        startTime: "15:00",
        durationMinutes: 50,
        place: {
          name: "Matcha and sweets on Shijo",
          kind: "coffee",
          neighborhood: "Gion",
          summary:
            "The old sweet shops along Shijo serve matcha with cold sweets such as kuzukiri, Kyoto's break at three; the wait is a name on a list, not a queue in the street.",
          aesthetic: ["black lacquer", "dark wood"],
          coordinates: { lat: 35.004, lng: 135.7747 },
          sensory: {
            energy: "balanced",
            acoustic: "murmur",
            crowd: "busy",
            texture:
              "Ice knocking in lacquer boxes, names read off the waiting list, the street through the door curtain.",
          },
          light: {
            exposure: "interior",
            orientation: "s",
            bestWindow: "none",
            note: "Mid-afternoon sun comes down Shijo onto the shopfronts; the tea rooms behind them stay dim.",
          },
        },
        dependsOn: [],
      },
      {
        startTime: "16:05",
        durationMinutes: 70,
        place: {
          name: "Gion Shirakawa",
          kind: "walk",
          neighborhood: "Gion",
          summary:
            "The stone lane along the Shirakawa canal for the last hour of daylight, a few minutes from the tea room and on the way to dinner across the river.",
          aesthetic: ["stone paving", "willows", "wooden teahouses"],
          coordinates: { lat: 35.0056, lng: 135.7745 },
          sensory: {
            energy: "balanced",
            acoustic: "murmur",
            crowd: "steady",
            texture:
              "Shallow water over stones, cameras clicking at Tatsumi bridge, wooden sandals on the paving.",
          },
          light: {
            exposure: "open",
            orientation: "s",
            bestWindow: "sunset",
            note: "The sun is off the lane before five; the teahouse lanterns come on as the sky goes blue.",
          },
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "18:00",
        durationMinutes: 90,
        place: {
          name: "Obanzai along Pontocho",
          kind: "food",
          neighborhood: "Pontocho",
          summary:
            "By six the counters along the alley have their platters of Kyoto home cooking out: point at what you want before the seats fill.",
          aesthetic: ["wooden counters", "big platters", "narrow alley"],
          coordinates: { lat: 35.0058, lng: 135.7711 },
          sensory: {
            energy: "balanced",
            acoustic: "chatter",
            crowd: "busy",
            texture:
              "Each dish named as it is plated, sake being poured, regulars talking in Kyoto dialect.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "Warm, low light at the counters; by six the alley is dark apart from lit doorways.",
          },
        },
        dependsOn: ["dinner", "end", "company"],
      },
    ],
    alternatives: [
      {
        stopIndex: 0,
        options: [
          {
            name: "Shinnyo-do",
            kind: "sacred",
            neighborhood: "Jodoji",
            summary:
              "Free, open grounds on the next hill, with a three-storey pagoda among the maples to walk around before the hall opens at nine.",
            aesthetic: ["wooden pagoda", "maples", "stone paving"],
            coordinates: { lat: 35.0211, lng: 135.7907 },
            sensory: {
              energy: "calm",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Dog walkers on the paving, pigeons on the hall roof, the odd good morning.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "morning",
              note: "Few tall trees on the open ground, so the morning sun reaches it as soon as it clears the hills.",
            },
            reason:
              "Still a temple before the crowds, on open grounds with neighbours passing through instead of a mossy enclosure in the woods.",
          },
        ],
      },
      {
        stopIndex: 1,
        options: [
          {
            name: "Daimonji Trail",
            kind: "walk",
            neighborhood: "Ginkakuji",
            summary:
              "The forest climb from beside Ginkaku-ji to the bonfire site, about forty minutes up, so you reach the view over the city by nine.",
            aesthetic: ["cedar forest", "timber steps", "open hillside"],
            coordinates: { lat: 35.0284, lng: 135.7985 },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "sparse",
              texture:
                "Roots and timber steps, your own breathing, a hello from hikers on the way down.",
            },
            light: {
              exposure: "open",
              orientation: "w",
              bestWindow: "morning",
              note: "With the sun behind you in the morning, the city and the western hills are lit head-on; in the afternoon you look into the glare.",
            },
            reason:
              "The same hill, climbed through the woods to a view instead of walked along at its foot.",
          },
          {
            name: "Ginkaku-ji Approach",
            kind: "walk",
            neighborhood: "Ginkakuji",
            summary:
              "The shop street from the canal up to Ginkaku-ji's gate, which opens at half past eight with the first groups already waiting.",
            aesthetic: ["wooden shopfronts", "uphill lane"],
            coordinates: { lat: 35.0272, lng: 135.7951 },
            sensory: {
              energy: "balanced",
              acoustic: "murmur",
              crowd: "steady",
              texture: "Shutters rolling up, a guide counting heads, coins at the ticket window.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "morning",
              note: "Low sun from the south-east lights one side of the street and leaves the other in shade until mid-morning.",
            },
            reason:
              "A morning stroll again, up a shop street with the first crowd instead of beside the water.",
          },
        ],
      },
      {
        stopIndex: 2,
        options: [
          {
            name: "Konchi-in",
            kind: "garden",
            neighborhood: "Nanzen-ji",
            summary:
              "A dry garden with a crane and a turtle laid out in rocks and clipped shrubs, seen from a veranda that stays quiet at ten while the crowds walk on to Nanzen-ji.",
            aesthetic: ["raked gravel", "clipped shrubs", "temple veranda"],
            coordinates: { lat: 35.0109, lng: 135.7911 },
            sensory: {
              energy: "reflective",
              acoustic: "silent",
              crowd: "sparse",
              texture: "Floorboards under your socks, birds in the pines, nobody talking.",
            },
            light: {
              exposure: "open",
              orientation: "s",
              bestWindow: "morning",
              note: "The gravel lies south of the hall, so late-morning sun turns it white and throws the rocks' shadows toward you.",
            },
            reason:
              "The same corner of Nanzen-ji, a gravel garden you sit and look at instead of a lawn you walk through.",
          },
          {
            name: "Nanzen-ji Hojo Garden",
            kind: "garden",
            neighborhood: "Nanzen-ji",
            summary:
              "The temple's own dry garden, seen from the abbot's quarters, whose tatami rooms fill with Saturday visitors by ten.",
            aesthetic: ["white gravel", "tatami corridors", "earthen wall"],
            coordinates: { lat: 35.0112, lng: 135.7942 },
            sensory: {
              energy: "balanced",
              acoustic: "murmur",
              crowd: "busy",
              texture:
                "Socks on polished boards, whispered talk, a slow line moving past the screens.",
            },
            light: {
              exposure: "open",
              orientation: "s",
              bestWindow: "morning",
              note: "Deep eaves keep the veranda in shade while the gravel takes the full late-morning sun.",
            },
            reason:
              "Still a Nanzen-ji garden, inside the main temple with the Saturday crowd instead of down the road without it.",
          },
        ],
      },
      {
        stopIndex: 3,
        options: [
          {
            name: "Tofu on the approach road",
            kind: "food",
            neighborhood: "Nanzen-ji",
            summary:
              "The inns along the approach serve the same tofu lunch at low tables and take bookings, so there is no queue at eleven.",
            aesthetic: ["garden pond", "tatami", "low tables"],
            coordinates: { lat: 35.011, lng: 135.7889 },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Quiet rooms, lids lifted off the pots, chopsticks on trays.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Soft midday light off the garden ponds through the windows; the gardens fall into shade by mid-afternoon.",
            },
            reason:
              "The same tofu lunch by the temple, booked at a low table instead of queued for.",
          },
          {
            name: "Tofu courses near Keage",
            kind: "food",
            neighborhood: "Nanzen-ji",
            summary:
              "Big tofu houses in strolling gardens towards Keage, whose halls fill with tour groups from eleven.",
            aesthetic: ["strolling garden", "tatami halls"],
            coordinates: { lat: 35.0114, lng: 135.7899 },
            sensory: {
              energy: "balanced",
              acoustic: "chatter",
              crowd: "busy",
              texture:
                "Names called from the waiting board, talk over the pots, shoes lined up at the step.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Late-morning sun crosses the garden into the halls; by mid-afternoon the hill behind puts them in shade.",
            },
            reason:
              "Tofu by Nanzen-ji again, in big garden halls full of groups instead of a quieter room.",
          },
        ],
      },
      {
        stopIndex: 4,
        options: [
          {
            name: "Kyoto Museum of Crafts and Design",
            kind: "museum",
            neighborhood: "Okazaki",
            summary:
              "The city's crafts, from lacquer and fans to woven silk, in a basement gallery under the exhibition hall, with room to look closely after lunch.",
            aesthetic: ["lacquer", "woven silk", "basement gallery"],
            coordinates: { lat: 35.0129, lng: 135.781 },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "empty",
              texture:
                "The hum of the air conditioning, your own footsteps, the odd whisper at a case.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "No daylight reaches the cases, so nothing is lost by coming at the flattest hour outside.",
            },
            reason:
              "Still craft and art indoors, in a basement next door with fewer people instead of the main galleries.",
          },
          {
            name: "Kyoto City KYOCERA Museum of Art",
            kind: "museum",
            neighborhood: "Okazaki",
            summary:
              "The big museum across the street, where the Saturday special shows put a line at the ticket desk in the early afternoon.",
            aesthetic: ["tiled roof", "glass entrance", "grand staircase"],
            coordinates: { lat: 35.0129, lng: 135.783 },
            sensory: {
              energy: "balanced",
              acoustic: "murmur",
              crowd: "busy",
              texture:
                "Footsteps echoing under the high ceiling, families on the stairs, a guard pointing the way.",
            },
            light: {
              exposure: "interior",
              orientation: "w",
              bestWindow: "none",
              note: "The glass entrance takes the low sun late in the afternoon; inside, the galleries are lit the same all day.",
            },
            reason:
              "The same block of museums, at the bigger one across the street with a Saturday crowd instead of the quieter collection rooms.",
          },
        ],
      },
      {
        stopIndex: 5,
        options: [
          {
            name: "Sweets south of Shijo",
            kind: "coffee",
            neighborhood: "Gion",
            summary:
              "The small cafés in the lanes south of Shijo, with seasonal fruit and café au lait, have a seat at three while the sweet shops on the main street have queues.",
            aesthetic: ["minimal interiors", "counter seats"],
            coordinates: { lat: 35.003, lng: 135.7734 },
            sensory: {
              energy: "calm",
              acoustic: "hushed",
              crowd: "steady",
              texture: "Cups set down on the counter, low talk, no street noise.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Little direct sun reaches the lanes by mid-afternoon; inside, the rooms run on soft lamp light.",
            },
            reason:
              "Still a sit-down with something sweet at three, at a quiet counter down a lane instead of a full shop on Shijo.",
          },
          {
            name: "Warabimochi on Hanamikoji",
            kind: "coffee",
            neighborhood: "Gion",
            summary:
              "The sweet shops on Hanamikoji serve warabimochi dusted with soybean flour, and by three their queues reach the street.",
            aesthetic: ["lattice fronts", "machiya"],
            coordinates: { lat: 35.0025, lng: 135.7749 },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture:
                "The door sliding open and shut, plates set down on ice, talk at every table.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Afternoon light comes through the lattice fronts; the street lamps are on before the shops close.",
            },
            reason:
              "A Gion sweet at three again, after a street queue on Hanamikoji instead of a waiting list on Shijo.",
          },
        ],
      },
      {
        stopIndex: 6,
        options: [
          {
            name: "Ishibe-koji",
            kind: "walk",
            neighborhood: "Higashiyama",
            summary:
              "A short paved lane of inns behind high walls near Kodai-ji, with few people in it at dusk.",
            aesthetic: ["stone paving", "plastered walls", "inn entrances"],
            coordinates: { lat: 35.001, lng: 135.7787 },
            sensory: {
              energy: "calm",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Your steps on the stones, a door sliding shut, a kitchen fan somewhere.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "after-dark",
              note: "The walls cut off the low sun early; the inns light their entrances by five.",
            },
            reason: "Still old paving at dusk, in a quiet walled lane instead of along the canal.",
          },
          {
            name: "Hanamikoji",
            kind: "walk",
            neighborhood: "Gion",
            summary:
              "Gion's main teahouse street south of Shijo, busy at dusk as the restaurants open and taxis drop off their guests.",
            aesthetic: ["lattice fronts", "stone paving"],
            coordinates: { lat: 35.0037, lng: 135.7752 },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "packed",
              texture: "Crowds at the corners, phones held up, taxis edging through.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Lamps over the doorways take over from the daylight around five, and the street is brighter after dark than at dusk.",
            },
            reason:
              "The same teahouse district at dusk, on its busiest street instead of beside the water.",
          },
        ],
      },
      {
        stopIndex: 7,
        options: [
          {
            name: "Japanese cooking on Sanjo",
            kind: "food",
            neighborhood: "Teramachi",
            summary:
              "The old dining houses where Sanjo meets the Teramachi arcade, a short walk west, have tatami rooms of their own free for an early dinner at six.",
            aesthetic: ["private tatami rooms", "covered arcade"],
            coordinates: { lat: 35.0084, lng: 135.7671 },
            sensory: {
              energy: "calm",
              acoustic: "hushed",
              crowd: "steady",
              texture:
                "Pans hissing behind paper doors, footsteps in the corridors, the arcade's music far off.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Lamp light in a closed room; by six there is no daylight left to miss.",
            },
            reason:
              "Still Kyoto cooking at six, in a tatami room of your own instead of shoulder to shoulder at a counter.",
          },
          {
            name: "Small plates in Gion",
            kind: "food",
            neighborhood: "Gion",
            summary:
              "The narrow counters by Tatsumi bridge fry gyoza and grill skewers from five, and by six most of them have a wait outside.",
            aesthetic: ["narrow counters", "steel griddles"],
            coordinates: { lat: 35.0051, lng: 135.7749 },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "packed",
              texture:
                "Gyoza spitting on the griddle, beer glasses knocked together, elbows touching.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Bright, plain light inside; outside it is dark by six.",
            },
            reason:
              "A counter supper again, back across the river, with gyoza and beer instead of obanzai and sake.",
          },
        ],
      },
    ],
  },
};
