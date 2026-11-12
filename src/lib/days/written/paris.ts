import type { WrittenDay } from "./written-day";
import { PARIS_REQUEST } from "./city-days";

/**
 * Paris, as claude-sonnet-5-5 wrote it on 2026-11-12 under day-v11 with the undated rule
 * (`EVAL_DAY_RULE`), for its own address (generation 74b93e4e-4eee-45c4-9556-216b5b5b81c7). Kept as
 * written, letters escaped twice read as the reader reads them, so the address opens a day the
 * product really wrote, slips and all; the normalizer repairs what it repairs for any live day.
 */
export const PARIS_DAY: WrittenDay = {
  request: PARIS_REQUEST,
  day: {
    assumptions: {
      travel: "on-foot",
      start: null,
      dinner: "early",
      end: "early",
      company: null,
    },
    dek: "A slow Sunday that starts with coffee along the Canal Saint-Martin, drifts through the Buttes-Chaumont park, then crosses into the calm streets of the Marais for an early dinner and a quiet bar.",
    stops: [
      {
        startTime: "10:00",
        durationMinutes: 60,
        place: {
          name: "Coffee along Quai de Valmy",
          kind: "coffee",
          neighborhood: "Canal Saint-Martin",
          coordinates: {
            lat: 48.8718,
            lng: 2.3641,
          },
          sensory: {
            energy: "calm",
            acoustic: "murmur",
            crowd: "steady",
            texture: "Cups on zinc, bicycles ticking past, canal water below the quay.",
          },
          light: {
            exposure: "open",
            orientation: "w",
            bestWindow: "morning",
            note: "The quay runs north to south, so mid-morning sun slants low through the plane trees and lands on the canal side.",
          },
          summary:
            "On Sunday the quay fills slowly from ten, with flat whites and croissants served at tables facing the water; it is the easy way into a late start.",
          aesthetic: ["zinc counters", "plane trees", "iron footbridges"],
        },
        dependsOn: ["start", "company"],
      },
      {
        startTime: "11:15",
        durationMinutes: 60,
        place: {
          name: "Canal Saint-Martin",
          kind: "walk",
          neighborhood: "Canal Saint-Martin",
          coordinates: {
            lat: 48.8686,
            lng: 2.3646,
          },
          sensory: {
            energy: "calm",
            acoustic: "murmur",
            crowd: "steady",
            texture:
              "Footsteps on the quay, bells from the footbridges, voices drifting from benches.",
          },
          light: {
            exposure: "dappled",
            orientation: "none",
            bestWindow: "morning",
            note: "Bare and leafy stretches alternate along the quay, so the light shifts from shade to open sky every few hundred metres.",
          },
          summary:
            "A flat stroll north along the water on a Sunday morning, when locals sit on the quay edge and the iron footbridges are quiet.",
          aesthetic: ["iron footbridges", "stone quays", "plane trees"],
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "12:30",
        durationMinutes: 90,
        place: {
          name: "Parc des Buttes-Chaumont",
          kind: "garden",
          neighborhood: "Buttes-Chaumont",
          coordinates: {
            lat: 48.8809,
            lng: 2.3828,
          },
          sensory: {
            energy: "calm",
            acoustic: "murmur",
            crowd: "steady",
            texture: "Gravel paths, a waterfall, dogs and families on the slopes.",
          },
          light: {
            exposure: "dappled",
            orientation: "none",
            bestWindow: "midday",
            note: "The slopes face every direction, so the sun reaches different paths through the hour; the lake side is bright, the wooded side shaded.",
          },
          summary:
            "Sunday midday is when the park is fullest and friendliest, and the paths up to the cliff-top temple give a view over northern Paris.",
          aesthetic: ["hillside paths", "rock cliffs", "iron bridges"],
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "14:15",
        durationMinutes: 60,
        place: {
          name: "Lunch around Rue Rébeval",
          kind: "food",
          neighborhood: "Belleville",
          coordinates: {
            lat: 48.8758,
            lng: 2.3795,
          },
          sensory: {
            energy: "balanced",
            acoustic: "chatter",
            crowd: "busy",
            texture:
              "Plates clinking, kitchen doors open to the street, a steady hum of neighbours.",
          },
          light: {
            exposure: "covered",
            orientation: "none",
            bestWindow: "none",
            note: "Mostly shaded street-front tables and interior rooms, so the light hardly changes through the afternoon.",
          },
          summary:
            "Sunday lunch runs long here and the street fills with neighbours at around two, with set-menu plates of grilled meat, couscous and bistro classics.",
          aesthetic: ["zinc counters", "tiled floors", "painted shopfronts"],
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "15:45",
        durationMinutes: 90,
        place: {
          name: "Musée Cernuschi",
          kind: "museum",
          neighborhood: "Parc Monceau",
          coordinates: {
            lat: 48.8791,
            lng: 2.3095,
          },
          sensory: {
            energy: "reflective",
            acoustic: "hushed",
            crowd: "sparse",
            texture: "Soft footsteps on parquet, one large bronze Buddha, long quiet rooms.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "Lit mostly by controlled gallery light, so the room looks the same at any hour.",
          },
          summary:
            "A small Asian art museum open on Sunday afternoons, with rooms that stay quiet when the larger museums are crowded.",
          aesthetic: ["parquet floors", "bronze", "quiet rooms"],
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "17:30",
        durationMinutes: 60,
        place: {
          name: "Parc Monceau",
          kind: "garden",
          neighborhood: "Parc Monceau",
          coordinates: {
            lat: 48.8797,
            lng: 2.3089,
          },
          sensory: {
            energy: "calm",
            acoustic: "hushed",
            crowd: "steady",
            texture: "Gravel underfoot, joggers on the outer path, a few families heading home.",
          },
          light: {
            exposure: "dappled",
            orientation: "none",
            bestWindow: "sunset",
            note: "Low sun comes through the trees and lights the colonnade and pond from the side as the afternoon ends.",
          },
          summary:
            "Right next to the museum, the park is the place to end the afternoon with a loop around the pond and its colonnade.",
          aesthetic: ["stone colonnade", "gravel paths", "old trees"],
        },
        dependsOn: ["end"],
      },
      {
        startTime: "18:45",
        durationMinutes: 105,
        place: {
          name: "Bistrot Dinner on Rue de Lévis",
          kind: "food",
          neighborhood: "Batignolles",
          coordinates: {
            lat: 48.8826,
            lng: 2.3102,
          },
          sensory: {
            energy: "balanced",
            acoustic: "chatter",
            crowd: "busy",
            texture: "Market street quiet after the stalls, plates and glasses from open doors.",
          },
          light: {
            exposure: "covered",
            orientation: "none",
            bestWindow: "after-dark",
            note: "Shopfronts and awnings light the pavement as the sky darkens, so the street glows warm from windows.",
          },
          summary:
            "An early Sunday dinner on a street where the market stalls have long been packed away and bistros start serving by half past six, with steak-frites, roast chicken and a glass of wine.",
          aesthetic: ["glowing shopfronts", "stone facades", "awnings"],
        },
        dependsOn: ["dinner", "company"],
      },
      {
        startTime: "20:45",
        durationMinutes: 75,
        place: {
          name: "Wine along Rue des Dames",
          kind: "bar",
          neighborhood: "Batignolles",
          coordinates: {
            lat: 48.8836,
            lng: 2.318,
          },
          sensory: {
            energy: "calm",
            acoustic: "murmur",
            crowd: "steady",
            texture:
              "Low voices over wine glasses, doors cracked open, a few smokers on the pavement.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "after-dark",
            note: "Candle and lamp light behind steamed windows, with the street lamps outside a dim yellow.",
          },
          summary:
            "A neighbourhood street where wine bars stay open on Sunday evening, pouring natural wines and sharing plates until about eleven.",
          aesthetic: ["candlelight", "zinc", "wood"],
        },
        dependsOn: ["end", "company"],
      },
    ],
    alternatives: [
      {
        stopIndex: 0,
        options: [
          {
            name: "Coffee around Rue des Vinaigriers",
            kind: "coffee",
            neighborhood: "Canal Saint-Martin",
            coordinates: {
              lat: 48.8716,
              lng: 2.3611,
            },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "A few tables, a grinder, a back street away from the quay.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "morning",
              note: "Small windows facing the street give soft light that stays much the same through the morning.",
            },
            summary:
              "A back street one block from the quay with coffee at slower tables and fewer people on a Sunday morning.",
            aesthetic: ["bare wood", "small rooms", "plain walls"],
            reason:
              "Same coffee and canal neighbourhood, but a back street where the crowd and sound are lower than on the quay.",
          },
          {
            name: "Brunch on Rue du Faubourg Saint-Martin",
            kind: "food",
            neighborhood: "Canal Saint-Martin",
            coordinates: {
              lat: 48.8725,
              lng: 2.3565,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Full tables, trays of eggs and pastries, a queue by the door.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "none",
              note: "Mostly indoor rooms and awnings, so the light does not change much by hour.",
            },
            summary:
              "A busier street for a Sunday brunch of eggs, pastries and coffee, with the crowd filling in from ten.",
            aesthetic: ["tiled floors", "zinc", "painted signs"],
            reason:
              "Same morning meal in the same quarter, trading the quiet quay for a fuller, noisier street.",
          },
        ],
      },
      {
        stopIndex: 1,
        options: [
          {
            name: "Square des Récollets",
            kind: "garden",
            neighborhood: "Canal Saint-Martin",
            coordinates: {
              lat: 48.8748,
              lng: 2.3622,
            },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Gravel, a few benches, children's voices far off.",
            },
            light: {
              exposure: "dappled",
              orientation: "none",
              bestWindow: "morning",
              note: "Tree cover filters the light so the paths stay softly shaded through the late morning.",
            },
            summary:
              "A small garden a few minutes from the canal, where Sunday mornings are quiet and the benches are mostly empty.",
            aesthetic: ["gravel paths", "old trees", "low walls"],
            reason:
              "Same walk and neighbourhood, but a small enclosed garden instead of the open quay, quieter and shaded.",
          },
          {
            name: "Place de la République",
            kind: "walk",
            neighborhood: "République",
            coordinates: {
              lat: 48.8674,
              lng: 2.3636,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Skateboards, cyclists, groups crossing the wide square.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "midday",
              note: "A wide open square in full sky, so it is bright and exposed through the middle of the day.",
            },
            summary:
              "A short walk south, the big square is where Sunday crowds gather, with skaters and cafés on every side.",
            aesthetic: ["open pavement", "stone facades", "statue"],
            reason:
              "Same stroll end of the canal, trading the water's quiet for a wide open square full of people.",
          },
        ],
      },
      {
        stopIndex: 2,
        options: [
          {
            name: "Rue Georges Lardennois",
            kind: "walk",
            neighborhood: "Buttes-Chaumont",
            coordinates: {
              lat: 48.8805,
              lng: 2.379,
            },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Quiet residential street, a few doors, trees along the pavement.",
            },
            light: {
              exposure: "dappled",
              orientation: "none",
              bestWindow: "midday",
              note: "Street trees and low buildings give broken light along the pavement at midday.",
            },
            summary:
              "A residential street beside the park gates, quiet on Sunday midday and good for a slow loop.",
            aesthetic: ["street trees", "stone facades", "quiet pavements"],
            reason:
              "Same neighbourhood as the park, but a calm street walk instead of the full lawns and paths.",
          },
          {
            name: "Rue Manin",
            kind: "walk",
            neighborhood: "Buttes-Chaumont",
            coordinates: {
              lat: 48.883,
              lng: 2.3816,
            },
            sensory: {
              energy: "balanced",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Dogs, strollers, people by the park railing.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "midday",
              note: "Open pavement next to the park, with midday light along the railings.",
            },
            summary:
              "The street along the park edge on Sunday midday, where families and dog walkers line the railing.",
            aesthetic: ["park railings", "stone facades", "wide pavements"],
            reason:
              "Same park and neighbourhood, trading the quiet paths for a busier street edge with more people.",
          },
        ],
      },
      {
        stopIndex: 3,
        options: [
          {
            name: "Tea around Rue des Pyrénées",
            kind: "coffee",
            neighborhood: "Belleville",
            coordinates: {
              lat: 48.8717,
              lng: 2.3868,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "Teapots, low talk, a few tables by the window.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "afternoon",
              note: "Window light in the afternoon is soft and even across the tables.",
            },
            summary:
              "A calmer stretch for tea and a light plate in the early afternoon after the lunch rush.",
            aesthetic: ["small tables", "wood", "tiles"],
            reason:
              "Same afternoon in Belleville but a lighter, quieter meal than a full lunch street.",
          },
          {
            name: "Street food on Rue de Belleville",
            kind: "food",
            neighborhood: "Belleville",
            coordinates: {
              lat: 48.8725,
              lng: 2.3846,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Steam, shouted orders, shoulders brushing in the doorways.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "none",
              note: "Awnings and narrow doorways keep the light dim and uniform all afternoon.",
            },
            summary:
              "A crowded street of noodle and dumpling counters on Sunday afternoon, eaten standing or at crowded tables.",
            aesthetic: ["steamed windows", "painted signs", "tiled counters"],
            reason:
              "Same neighbourhood and meal, trading the slower lunch for a louder, faster street of counters.",
          },
        ],
      },
      {
        stopIndex: 4,
        options: [
          {
            name: "Musée Nissim de Camondo",
            kind: "museum",
            neighborhood: "Parc Monceau",
            coordinates: {
              lat: 48.8791,
              lng: 2.3112,
            },
            sensory: {
              energy: "reflective",
              acoustic: "silent",
              crowd: "sparse",
              texture: "Creaking parquet, quiet rooms, very few visitors.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Lit by controlled indoor light, so the rooms look the same at any hour.",
            },
            summary:
              "A small house museum a few steps from the park, quieter than the larger museums on Sunday afternoon.",
            aesthetic: ["parquet", "gilt", "period rooms"],
            reason:
              "Same museum quarter and a similar hush, but a house museum that is quieter and smaller.",
          },
          {
            name: "Musée Jacquemart-André",
            kind: "museum",
            neighborhood: "Parc Monceau",
            coordinates: {
              lat: 48.8756,
              lng: 2.3109,
            },
            sensory: {
              energy: "balanced",
              acoustic: "murmur",
              crowd: "busy",
              texture: "Quiet voices, a queue at the door, a tearoom with full tables.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Mostly indoor light, with the tearoom the brightest room.",
            },
            summary:
              "A busier house museum with a tearoom, popular on Sunday afternoons and good for a slower pace.",
            aesthetic: ["gilt", "marble", "tapestries"],
            reason:
              "Same area and kind of afternoon, trading the hush for a busier museum with a tearoom.",
          },
        ],
      },
      {
        stopIndex: 5,
        options: [
          {
            name: "Square des Batignolles",
            kind: "garden",
            neighborhood: "Batignolles",
            coordinates: {
              lat: 48.8838,
              lng: 2.3187,
            },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "empty",
              texture: "Gravel paths, a quiet pond, a few benches.",
            },
            light: {
              exposure: "dappled",
              orientation: "none",
              bestWindow: "sunset",
              note: "Low sun comes through the trees and lights the pond edge as the evening begins.",
            },
            summary: "A small park a few streets from dinner, nearly empty as the afternoon ends.",
            aesthetic: ["pond", "gravel paths", "old trees"],
            reason: "Same park-at-dusk idea, in a smaller and emptier square nearer to dinner.",
          },
          {
            name: "Rue Cardinet",
            kind: "walk",
            neighborhood: "Batignolles",
            coordinates: {
              lat: 48.886,
              lng: 2.314,
            },
            sensory: {
              energy: "balanced",
              acoustic: "chatter",
              crowd: "steady",
              texture: "Cafe terraces, passing families, shop windows lit up.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "sunset",
              note: "A broad street where the last sunlight reaches the facades before the lamps take over.",
            },
            summary:
              "A lived-in street with café terraces and families heading home, livelier than the park at this hour.",
            aesthetic: ["stone facades", "terraces", "lit shopfronts"],
            reason:
              "Same end-of-afternoon walk, trading the park's quiet for a street with terraces and passers-by.",
          },
        ],
      },
      {
        stopIndex: 6,
        options: [
          {
            name: "Soup and bread on Rue Truffaut",
            kind: "food",
            neighborhood: "Batignolles",
            coordinates: {
              lat: 48.8845,
              lng: 2.321,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "Small rooms, low talk, a few tables for two.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Lamp light in small rooms keeps the evening warm and steady.",
            },
            summary:
              "A quieter side street for a simple early dinner of soup, bread and a glass of wine.",
            aesthetic: ["small rooms", "lamplight", "wood tables"],
            reason:
              "Same neighbourhood and early dinner, trading the busier bistro street for a quieter side street.",
          },
          {
            name: "Dinner on Rue des Batignolles",
            kind: "food",
            neighborhood: "Batignolles",
            coordinates: {
              lat: 48.883,
              lng: 2.32,
            },
            sensory: {
              energy: "lively",
              acoustic: "loud",
              crowd: "packed",
              texture: "Packed terraces, clinking glasses, servers calling orders.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Terrace heaters and shop lights make the street glow after the sun is gone.",
            },
            summary:
              "The livelier main street of the quarter, with bistro terraces full by seven on a Sunday.",
            aesthetic: ["terraces", "lit shopfronts", "stone facades"],
            reason:
              "Same neighbourhood and meal, trading the quieter bistro street for a louder main street.",
          },
        ],
      },
      {
        stopIndex: 7,
        options: [
          {
            name: "Tea along Rue Legendre",
            kind: "coffee",
            neighborhood: "Batignolles",
            coordinates: {
              lat: 48.886,
              lng: 2.318,
            },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Teapots, a few couples, almost no street noise.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Lamp light indoors with the street lamps dim outside.",
            },
            summary:
              "A quieter street for a last hot drink after dinner, with few tables taken on a Sunday evening.",
            aesthetic: ["lamplight", "wood", "small tables"],
            reason: "Same closing hour and quarter, trading wine for a quieter hot drink.",
          },
          {
            name: "Cocktails around Rue Lemercier",
            kind: "bar",
            neighborhood: "Batignolles",
            coordinates: {
              lat: 48.8853,
              lng: 2.325,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Shakers behind bars, music, groups at the counter.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Warm bar lighting spills onto the pavement after dark.",
            },
            summary: "A livelier street where cocktail bars are open on Sunday and fill by nine.",
            aesthetic: ["dark wood", "brass", "candlelight"],
            reason:
              "Same evening and neighbourhood, trading the calm wine street for louder cocktail bars.",
          },
        ],
      },
    ],
  },
};
