import type { WrittenDay } from "@/lib/days/written/written-day";
import { ALICANTE_REQUEST } from "./requests";

/**
 * A calm Saturday in Alicante, from the first lab concepts of the chart, rewritten to
 * the voice rubric. A Spanish day runs late, with lunch at two and dinner after nine, so it
 * stretches the layout further than a day in Kyoto. Coordinates are approximate entrances.
 */
export const ALICANTE_DAY: WrittenDay = {
  request: ALICANTE_REQUEST,
  day: {
    assumptions: { travel: "on-foot", start: "early", dinner: "late", end: "early", company: null },
    dek: "Sunrise from the beach under the castle, the old town before it wakes, rice on the marina, and tapas standing up after nine.",
    stops: [
      {
        startTime: "07:30",
        durationMinutes: 45,
        place: {
          name: "Playa del Postiguet",
          kind: "viewpoint",
          neighborhood: "Postiguet",
          summary:
            "The city beach below the castle cliff, before anyone has put a towel down. The sun comes up out of the bay.",
          aesthetic: ["pale sand", "palms", "open sea"],
          coordinates: { lat: 38.3459, lng: -0.4776 },
          sensory: {
            energy: "reflective",
            acoustic: "hushed",
            crowd: "empty",
            texture: "Small waves, a beach rake, gulls.",
          },
          light: {
            exposure: "open",
            orientation: "e",
            bestWindow: "sunrise",
            note: "The sun rises straight out of the sea; the castle rock above turns pink first.",
          },
        },
        dependsOn: ["start"],
      },
      {
        startTime: "08:30",
        durationMinutes: 60,
        place: {
          name: "Barrio de Santa Cruz",
          kind: "walk",
          neighborhood: "Casco Antiguo",
          summary:
            "The lanes up the castle hill while they are still cool and quiet, as residents water the geraniums on their steps.",
          aesthetic: ["whitewash", "geraniums", "stone steps"],
          coordinates: { lat: 38.3468, lng: -0.4797 },
          sensory: {
            energy: "calm",
            acoustic: "hushed",
            crowd: "sparse",
            texture: "Your own steps, a radio through a window, a cat on a doorstep.",
          },
          light: {
            exposure: "open",
            orientation: "s",
            bestWindow: "morning",
            note: "Low morning sun warms the whitewash; by noon the lanes glare.",
          },
        },
        dependsOn: ["start"],
      },
      {
        startTime: "10:00",
        durationMinutes: 90,
        place: {
          name: "Castillo de Santa Bárbara",
          kind: "architecture",
          neighborhood: "Benacantil",
          summary:
            "Up on the ramparts soon after the gates open, before the lift queue builds and the terraces fill with families.",
          aesthetic: ["limestone", "ramparts", "bay view"],
          coordinates: { lat: 38.3456, lng: -0.4784 },
          sensory: {
            energy: "balanced",
            acoustic: "murmur",
            crowd: "steady",
            texture: "Wind at the top, steps echoing in the stone passages, the port far below.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "morning",
            note: "Morning air is clearest; haze softens the far coast by midday.",
          },
        },
        dependsOn: ["start"],
      },
      {
        startTime: "12:00",
        durationMinutes: 75,
        place: {
          name: "Mercado Central",
          kind: "market",
          neighborhood: "Centro",
          summary:
            "Late on a Saturday morning the hall is at its fullest, and the stall bars pour vermouth for people on their way to lunch. Have one standing at the counter.",
          aesthetic: ["modernist hall", "fish counters", "tiled stalls"],
          coordinates: { lat: 38.3479, lng: -0.4875 },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture: "Fishmongers calling prices, knives on boards, ice shovelled onto the trays.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "Daylight from the high windows; the hall is brightest around noon.",
          },
        },
        dependsOn: [],
      },
      {
        startTime: "14:00",
        durationMinutes: 105,
        place: {
          name: "Paella on the marina",
          kind: "food",
          neighborhood: "Puerto",
          summary:
            "A long Saturday lunch on the marina, where rice cooked thin in the pan is the point. Order one for the table and take your time.",
          aesthetic: ["paella pans", "marina", "white tablecloths"],
          coordinates: { lat: 38.3412, lng: -0.48 },
          sensory: {
            energy: "calm",
            acoustic: "murmur",
            crowd: "steady",
            texture: "Spoons on pans, unhurried talk, halyards ringing on the masts.",
          },
          light: {
            exposure: "covered",
            orientation: "s",
            bestWindow: "midday",
            note: "Early in the afternoon the sun is out over the marina, in front of the tables; the awnings take the glare and the water does the glittering.",
          },
        },
        dependsOn: [],
      },
      {
        startTime: "16:15",
        durationMinutes: 60,
        place: {
          name: "MACA",
          kind: "museum",
          neighborhood: "Casco Antiguo",
          summary:
            "White rooms of geometric art that seems to move as you walk past it, at their emptiest in the lull after a Spanish lunch.",
          aesthetic: ["baroque façade", "white galleries", "op art"],
          coordinates: { lat: 38.3453, lng: -0.4808 },
          sensory: {
            energy: "reflective",
            acoustic: "hushed",
            crowd: "sparse",
            texture: "Soft steps on stone, a guard's chair creaking, nothing else.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "Gallery light inside; the square outside turns gold after five.",
          },
        },
        dependsOn: [],
      },
      {
        startTime: "17:20",
        durationMinutes: 45,
        place: {
          name: "Explanada de España",
          kind: "walk",
          neighborhood: "Centro",
          summary:
            "The seafront promenade, paved in a rippling mosaic of marble tiles under rows of palms. It fills with families at dusk.",
          aesthetic: ["marble mosaic", "palms", "seafront"],
          coordinates: { lat: 38.3421, lng: -0.484 },
          sensory: {
            energy: "balanced",
            acoustic: "murmur",
            crowd: "busy",
            texture: "A busker, palm fronds in the wind, scooters and prams going by.",
          },
          light: {
            exposure: "open",
            orientation: "s",
            bestWindow: "sunset",
            note: "The last sun comes in low along the palms; once it sets, the lamps come on by the sea.",
          },
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "21:00",
        durationMinutes: 120,
        place: {
          name: "Tapas on Calle Villegas",
          kind: "bar",
          neighborhood: "Centro",
          summary:
            "After nine the counters along the street fill with locals ordering for the table. Point at what looks good and keep ordering.",
          aesthetic: ["marble counters", "wood panelling", "tapas"],
          coordinates: { lat: 38.3462, lng: -0.4869 },
          sensory: {
            energy: "social",
            acoustic: "loud",
            crowd: "packed",
            texture: "Shouted orders, glasses clinking, ham slicers going behind the bars.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "after-dark",
            note: "Lamps low over the marble counters, warm against a street that is dark by nine.",
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
            name: "Paseo de Gomiz",
            kind: "walk",
            neighborhood: "Raval Roig",
            summary:
              "The promenade past the end of the beach at sunrise, shared with the early runners and dog walkers.",
            aesthetic: ["seafront promenade", "rocky shore"],
            coordinates: { lat: 38.3489, lng: -0.4713 },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "Running shoes on the paving, waves on the rocks below, gulls.",
            },
            light: {
              exposure: "open",
              orientation: "se",
              bestWindow: "sunrise",
              note: "The sun comes up ahead of you over the bay; by nine the paving is in full glare.",
            },
            reason:
              "Still the sea at sunrise, on a promenade with the runners instead of on the empty sand.",
          },
        ],
      },
      {
        stopIndex: 1,
        options: [
          {
            name: "Parque de la Ereta",
            kind: "garden",
            neighborhood: "Casco Antiguo",
            summary:
              "Terraced paths further up the same hill, empty this early, with the old town's roofs below.",
            aesthetic: ["terraced paths", "pines", "white concrete"],
            coordinates: { lat: 38.3481, lng: -0.4801 },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "empty",
              texture: "Gravel on the paths, wind in the pines, a dog barking down in the lanes.",
            },
            light: {
              exposure: "dappled",
              orientation: "w",
              bestWindow: "sunset",
              note: "In the hill's shadow until mid-morning; the terraces face the sunset over the city.",
            },
            reason: "The same hill, on garden paths above the houses instead of between them.",
          },
          {
            name: "Calle Mayor",
            kind: "walk",
            neighborhood: "Casco Antiguo",
            summary: "The old town's main street as the cafés put their tables out.",
            aesthetic: ["stone paving", "café tables", "iron balconies"],
            coordinates: { lat: 38.3449, lng: -0.4823 },
            sensory: {
              energy: "balanced",
              acoustic: "chatter",
              crowd: "steady",
              texture: "Shutters rolling up, coffee cups, a delivery van.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "midday",
              note: "A narrow street: the sun reaches the paving only around noon.",
            },
            reason: "Still the old town, on its busiest street instead of its quietest.",
          },
        ],
      },
      {
        stopIndex: 2,
        options: [
          {
            name: "MUBAG",
            kind: "museum",
            neighborhood: "Casco Antiguo",
            summary:
              "Paintings in cool, quiet rooms at the foot of the castle hill, where at ten you can have a gallery to yourself.",
            aesthetic: ["palace rooms", "oil paintings"],
            coordinates: { lat: 38.3449, lng: -0.4814 },
            sensory: {
              energy: "calm",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Parquet floors, low voices, an attendant's footsteps two rooms away.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Gallery light; the courtyard gets sun late in the morning.",
            },
            reason:
              "The same castle hill, in quiet galleries at its foot instead of up on the windy walls.",
          },
          {
            name: "Rambla de Méndez Núñez",
            kind: "walk",
            neighborhood: "Centro",
            summary:
              "The main avenue below the hill as its shops open at ten, full of Saturday shoppers by eleven.",
            aesthetic: ["wide avenue", "kiosks"],
            coordinates: { lat: 38.3455, lng: -0.4858 },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Buses, shop doors, a busker near the corner.",
            },
            light: {
              exposure: "open",
              orientation: "s",
              bestWindow: "morning",
              note: "It runs north to south, so the sun reaches the middle by mid-morning.",
            },
            reason: "Still a walk with the castle above you, in the crowd instead of over it.",
          },
        ],
      },
      {
        stopIndex: 3,
        options: [
          {
            name: "Pastries around Luceros",
            kind: "coffee",
            neighborhood: "Centro",
            summary:
              "Café terraces around the big fountain in the noon sun, with pastries and the Saturday errands going round the square.",
            aesthetic: ["fountain", "café terraces"],
            coordinates: { lat: 38.3466, lng: -0.4905 },
            sensory: {
              energy: "balanced",
              acoustic: "murmur",
              crowd: "steady",
              texture: "The fountain, buses braking, cups on saucers.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "midday",
              note: "Full sun in the middle of the day; the terraces have umbrellas.",
            },
            reason: "The same Saturday centre, watched from a terrace instead of from the crowd.",
          },
          {
            name: "Vermouth on Calle Castaños",
            kind: "bar",
            neighborhood: "Centro",
            summary: "The tapas street filling up for the Saturday vermouth.",
            aesthetic: ["tapas bars", "terraces"],
            coordinates: { lat: 38.3457, lng: -0.4864 },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture:
                "Glasses on barrels, orders called over the crowd, plates passed out to the street.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "midday",
              note: "A narrow street, in shade by early afternoon.",
            },
            reason:
              "Still eating your way through the centre, in the street instead of the stalls.",
          },
        ],
      },
      {
        stopIndex: 4,
        options: [
          {
            name: "Arroz a banda by the port",
            kind: "food",
            neighborhood: "Puerto",
            summary:
              "Arroz a banda and local wine at two, the hour Alicante sits down to eat, in the quieter dining rooms along the port.",
            aesthetic: ["white linen", "harbour view"],
            coordinates: { lat: 38.3405, lng: -0.4825 },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Cutlery, low talk, the harbour behind glass.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "midday",
              note: "At lunch the sun stands over the harbour in front of the windows along the port, and the water throws its light up onto the ceilings.",
            },
            reason:
              "Rice by the port again, slower and quieter, behind glass instead of under an awning.",
          },
          {
            name: "Tapas on San Fernando",
            kind: "food",
            neighborhood: "Centro",
            summary:
              "Lunch at the counters along the street at two on a Saturday, when the stools fill and plates come out faster than at a table.",
            aesthetic: ["long counters", "wine shelves"],
            coordinates: { lat: 38.3447, lng: -0.4842 },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Full counters, plates landing, everyone talking at once.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Warm indoor light; the street outside is in shade.",
            },
            reason: "Lunch at two still, at a crowded counter instead of a table on the water.",
          },
        ],
      },
      {
        stopIndex: 5,
        options: [
          {
            name: "Horchata by Santa María",
            kind: "coffee",
            neighborhood: "Casco Antiguo",
            summary:
              "Horchata at the café tables on the square outside the museum, in the late sun.",
            aesthetic: ["baroque facade", "café tables"],
            coordinates: { lat: 38.3457, lng: -0.4799 },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "Pigeons, a guitar from a doorway, cups on a tray.",
            },
            light: {
              exposure: "open",
              orientation: "w",
              bestWindow: "afternoon",
              note: "The basilica's front catches the low sun after four.",
            },
            reason:
              "The same corner of the old town, outside in the sun instead of in the galleries.",
          },
        ],
      },
      {
        stopIndex: 6,
        options: [
          {
            name: "Parque de Canalejas",
            kind: "garden",
            neighborhood: "Centro",
            summary:
              "Benches under old ficus trees at the quiet end of the promenade, away from the crowd walking the Explanada at sunset.",
            aesthetic: ["ficus roots", "stone benches"],
            coordinates: { lat: 38.3412, lng: -0.4878 },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "Leaves, a dog walker, ropes knocking in the port.",
            },
            light: {
              exposure: "dappled",
              orientation: "w",
              bestWindow: "sunset",
              note: "Low sun comes through the ficus canopy in long stripes.",
            },
            reason: "Still by the sea at sunset, under the trees instead of on the promenade.",
          },
          {
            name: "Ice cream on the Explanada",
            kind: "food",
            neighborhood: "Centro",
            summary:
              "The ice cream counters along the promenade, where queues form as the sun goes down.",
            aesthetic: ["ice cream counters", "awnings"],
            coordinates: { lat: 38.3427, lng: -0.4845 },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "A queue, the scoop on the tub, children deciding.",
            },
            light: {
              exposure: "covered",
              orientation: "s",
              bestWindow: "sunset",
              note: "Under the awnings, with the promenade in full sunset in front of you.",
            },
            reason: "The same promenade at sunset, in the ice cream queue instead of on a stroll.",
          },
        ],
      },
      {
        stopIndex: 7,
        options: [
          {
            name: "Rice dishes on Óscar Esplá",
            kind: "food",
            neighborhood: "Ensanche",
            summary:
              "Dining rooms of rice and grilled fish along the avenue, still filling at nine, early for an Alicante dinner, so a table comes without a long wait.",
            aesthetic: ["wood panelling", "white tablecloths"],
            coordinates: { lat: 38.3448, lng: -0.4935 },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Full rooms, but you can hear your own table.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Warm lamps; the street is dark by now.",
            },
            reason:
              "Dinner at nine again, sitting at a table instead of standing three deep at the counter.",
          },
        ],
      },
    ],
  },
};
