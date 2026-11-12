import type { WrittenDay } from "./written-day";
import { PORTO_START_REQUEST } from "./quick-starts";

/**
 * Porto, as claude-sonnet-5-5 wrote it on 2026-10-31 under day-v8, for the
 * start that offers it (generation 08c69745-9337-4b67-b267-8ffb1daff6db). Kept as written, letters
 * escaped twice read as the reader reads them, so the start opens a day the product really
 * wrote, slips and all; the normalizer repairs what it repairs for any live day.
 */
export const PORTO_START_DAY: WrittenDay = {
  request: PORTO_START_REQUEST,
  day: {
    assumptions: {
      travel: "on-foot",
      start: null,
      dinner: "early",
      end: "early",
      company: null,
    },
    dek: "A slow Sunday that starts with coffee on Rua das Flores at ten, passes through the Palácio da Bolsa and the cloister of São Francisco, crosses the river for port-cellar lanes in the afternoon, and ends with an early supper and a sunset on the Jardim do Morro.",
    stops: [
      {
        startTime: "10:00",
        durationMinutes: 60,
        place: {
          name: "Coffee on Rua das Flores",
          kind: "coffee",
          neighborhood: "Sé",
          summary:
            "A late-morning start suits this pedestrian street: the cafés fill slowly on a Sunday and the usual order is a bica and a pastel de nata at a table or the counter.",
          aesthetic: ["granite facades", "tiled fronts"],
          coordinates: {
            lat: 41.1432,
            lng: -8.6119,
          },
          sensory: {
            energy: "calm",
            acoustic: "murmur",
            crowd: "sparse",
            texture: "Espresso machines, a few voices, footsteps on cobbles.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "morning",
            note: "The street is narrow, so direct sun only reaches the stones around midday; at ten it is even and soft.",
          },
        },
        dependsOn: [],
      },
      {
        startTime: "11:15",
        durationMinutes: 75,
        place: {
          name: "Palácio da Bolsa",
          kind: "architecture",
          neighborhood: "Ribeira",
          summary:
            "Visits go by guided tour, and the late-morning slot comes before the lunchtime crowds reach the Ribeira; you walk through the stone staircase and the gilded Arab Room.",
          aesthetic: ["gilded plaster", "carved wood", "marble"],
          coordinates: {
            lat: 41.1409,
            lng: -8.6153,
          },
          sensory: {
            energy: "reflective",
            acoustic: "hushed",
            crowd: "steady",
            texture: "A guide's voice, creaking parquet, shuffling in small groups.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "The rooms are lit by lamps and skylights, so the hour hardly changes them.",
          },
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "12:45",
        durationMinutes: 60,
        place: {
          name: "Igreja de São Francisco",
          kind: "sacred",
          neighborhood: "Ribeira",
          summary:
            "A short walk from the Bolsa, the gilded interior is best before the afternoon tour groups; the museum entrance and the church are done in one visit.",
          aesthetic: ["gilded wood", "dark stone"],
          coordinates: {
            lat: 41.1414,
            lng: -8.6159,
          },
          sensory: {
            energy: "reflective",
            acoustic: "hushed",
            crowd: "steady",
            texture: "Low voices, coins in a box, cool air that smells of wax.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "Little daylight gets in, so the gold looks the same at any hour.",
          },
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "14:00",
        durationMinutes: 75,
        place: {
          name: "Petiscos along Rua de São João",
          kind: "food",
          neighborhood: "Ribeira",
          summary:
            "Sunday lunch here runs long and into the afternoon; the usual order is a plate of cured ham and cheese, grilled sardines or bacalhau, and a glass of vinho verde.",
          aesthetic: ["granite", "azulejo"],
          coordinates: {
            lat: 41.1405,
            lng: -8.6148,
          },
          sensory: {
            energy: "balanced",
            acoustic: "chatter",
            crowd: "busy",
            texture: "Plates set down, families at long tables, the river just downhill.",
          },
          light: {
            exposure: "open",
            orientation: "s",
            bestWindow: "midday",
            note: "The street is steep and narrow, so the sun lies on the upper end around two and leaves the lower end in shade.",
          },
        },
        dependsOn: ["dinner"],
      },
      {
        startTime: "15:45",
        durationMinutes: 90,
        place: {
          name: "Port cellar lanes in Vila Nova de Gaia",
          kind: "walk",
          neighborhood: "Vila Nova de Gaia",
          summary:
            "Cross the Dom Luís I bridge on the lower deck and wander the cellar lanes on the south bank; most lodges open for tastings on Sunday afternoon and close around six.",
          aesthetic: ["whitewashed walls", "barrel storage"],
          coordinates: {
            lat: 41.1384,
            lng: -8.6168,
          },
          sensory: {
            energy: "calm",
            acoustic: "murmur",
            crowd: "steady",
            texture: "Cooper's wood, a guide's patter, water slapping at the quay.",
          },
          light: {
            exposure: "open",
            orientation: "n",
            bestWindow: "afternoon",
            note: "The south bank faces the old town across the river, which the low afternoon sun lights up while the lanes themselves fall into shade.",
          },
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "17:30",
        durationMinutes: 60,
        place: {
          name: "Jardim do Morro",
          kind: "viewpoint",
          neighborhood: "Vila Nova de Gaia",
          summary:
            "The grass terrace above the bridge is where people gather to watch the sun go behind the Douro, so arrive before it sets in mid-November, around half past five.",
          aesthetic: ["open lawn", "river view"],
          coordinates: {
            lat: 41.1397,
            lng: -8.6094,
          },
          sensory: {
            energy: "balanced",
            acoustic: "murmur",
            crowd: "busy",
            texture: "A busker, the tram on the bridge, people on the lawn talking quietly.",
          },
          light: {
            exposure: "open",
            orientation: "w",
            bestWindow: "sunset",
            note: "The terrace faces west down the river, so the last hour before sunset turns the opposite bank gold.",
          },
        },
        dependsOn: [],
      },
      {
        startTime: "18:45",
        durationMinutes: 75,
        place: {
          name: "Francesinha in Cedofeita",
          kind: "food",
          neighborhood: "Cedofeita",
          summary:
            "A Sunday supper of the city's own sandwich, the francesinha, in the streets around Rua de Cedofeita, where kitchens start serving early evening and tables are easy to find before eight.",
          aesthetic: ["tile", "dark wood"],
          coordinates: {
            lat: 41.1527,
            lng: -8.6174,
          },
          sensory: {
            energy: "balanced",
            acoustic: "chatter",
            crowd: "steady",
            texture: "Cutlery on plates, a football match on a screen somewhere, warm kitchens.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "after-dark",
            note: "The streets are lit by shop windows and street lamps after dark, so the evening look is the same as any winter night here.",
          },
        },
        dependsOn: ["dinner", "end"],
      },
    ],
    alternatives: [
      {
        stopIndex: 0,
        options: [
          {
            name: "Igreja do Carmo",
            kind: "sacred",
            neighborhood: "Cedofeita",
            summary:
              "A quiet church with a tiled facade, open on Sunday morning, a few minutes from the coffee street.",
            aesthetic: ["blue azulejo", "granite"],
            coordinates: {
              lat: 41.1469,
              lng: -8.6159,
            },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Soft footsteps, a distant bell, cool stone.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "morning",
              note: "The tiled side wall is lit best in the morning when the sun hits the facade.",
            },
            reason:
              "It shares the same part of the old town at the same hour, and trades the café table for a silent bench.",
          },
          {
            name: "Cafés on Praça de Carlos Alberto",
            kind: "coffee",
            neighborhood: "Cedofeita",
            summary:
              "A square with outdoor tables where Sunday brunch fills up from around eleven.",
            aesthetic: ["plane trees", "stucco"],
            coordinates: {
              lat: 41.1469,
              lng: -8.6157,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Chairs scraping, brunch plates, students and families mixing.",
            },
            light: {
              exposure: "dappled",
              orientation: "none",
              bestWindow: "morning",
              note: "Plane trees break the morning sun into patches on the paving.",
            },
            reason:
              "It keeps the coffee and pastry, and trades the narrow street for a livelier open square.",
          },
        ],
      },
      {
        stopIndex: 1,
        options: [
          {
            name: "Jardim do Palácio de Cristal",
            kind: "garden",
            neighborhood: "Massarelos",
            summary:
              "A hillside garden with peacocks and river views; the paths are quiet on a Sunday morning.",
            aesthetic: ["box hedges", "old trees"],
            coordinates: {
              lat: 41.1473,
              lng: -8.6256,
            },
            sensory: {
              energy: "reflective",
              acoustic: "silent",
              crowd: "sparse",
              texture: "Gravel paths, peacock calls, wind in the trees.",
            },
            light: {
              exposure: "dappled",
              orientation: "sw",
              bestWindow: "midday",
              note: "Tall trees filter the sun; the river terrace is open and brightest around midday.",
            },
            reason:
              "It keeps the unhurried, indoor-outdoor pace, and trades the guided tour for open paths, a longer walk away.",
          },
          {
            name: "Mercado Ferreira Borges",
            kind: "market",
            neighborhood: "Ribeira",
            summary:
              "A glass-and-iron hall used for events and drinks, a few minutes from the Bolsa.",
            aesthetic: ["cast iron", "glass roof"],
            coordinates: {
              lat: 41.1411,
              lng: -8.6144,
            },
            sensory: {
              energy: "social",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Glasses, a speaker, a crowd under a high iron roof.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "none",
              note: "The glass roof gives even light at any hour.",
            },
            reason:
              "It shares the Ribeira setting and its grand interior, and trades the guided quiet for a noisier room.",
          },
        ],
      },
      {
        stopIndex: 2,
        options: [
          {
            name: "Igreja de Santa Clara",
            kind: "sacred",
            neighborhood: "Ribeira",
            summary:
              "A smaller church beside the old wall, with carved and gilded wood and fewer visitors.",
            aesthetic: ["gilded wood", "granite"],
            coordinates: {
              lat: 41.1428,
              lng: -8.6112,
            },
            sensory: {
              energy: "reflective",
              acoustic: "silent",
              crowd: "empty",
              texture: "Almost no sound, cool air, a few lit candles.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Light is low and warm from lamps whatever the hour.",
            },
            reason:
              "It shares the carved gold interior, and trades the larger crowd for near silence, a short walk uphill.",
          },
          {
            name: "Cais da Ribeira",
            kind: "walk",
            neighborhood: "Ribeira",
            summary:
              "The riverfront promenade, where street musicians and terrace tables fill up on Sunday afternoon.",
            aesthetic: ["quay stone", "colored facades"],
            coordinates: {
              lat: 41.1406,
              lng: -8.6137,
            },
            sensory: {
              energy: "social",
              acoustic: "chatter",
              crowd: "packed",
              texture: "Musicians, plates, gulls over the water.",
            },
            light: {
              exposure: "open",
              orientation: "s",
              bestWindow: "midday",
              note: "Open to the river and sky, it is brightest around midday.",
            },
            reason:
              "It stays in the same quarter and trades the church's quiet for the busiest stretch of the riverbank.",
          },
        ],
      },
      {
        stopIndex: 3,
        options: [
          {
            name: "Cafés on Rua das Taipas",
            kind: "coffee",
            neighborhood: "Sé",
            summary:
              "A quieter steep street uphill from the river, with a few tables for a slow tea and pastry.",
            aesthetic: ["granite", "wrought iron"],
            coordinates: {
              lat: 41.1444,
              lng: -8.6166,
            },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "A kettle, a slow street, a few quiet customers.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "afternoon",
              note: "Tall facades shade the street, with afternoon sun only at the upper end.",
            },
            reason:
              "It keeps the same hour and area and trades the full lunch for a lighter, quieter snack.",
          },
          {
            name: "Tapas along Rua da Alfândega",
            kind: "food",
            neighborhood: "Ribeira",
            summary:
              "A riverside street where Sunday lunch crowds linger over wine and grilled fish.",
            aesthetic: ["quay stone", "tile"],
            coordinates: {
              lat: 41.1417,
              lng: -8.6176,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Loud tables, waiters threading through, river air.",
            },
            light: {
              exposure: "open",
              orientation: "s",
              bestWindow: "afternoon",
              note: "The sun lies along the river in the afternoon, and the terraces are bright.",
            },
            reason:
              "It keeps the Ribeira meal and trades the side street for the busiest riverside terraces.",
          },
        ],
      },
      {
        stopIndex: 4,
        options: [
          {
            name: "Jardins do Palácio de Cristal",
            kind: "garden",
            neighborhood: "Massarelos",
            summary: "A quiet park walk with river views across the water, away from the cellars.",
            aesthetic: ["old trees", "gravel"],
            coordinates: {
              lat: 41.1473,
              lng: -8.6256,
            },
            sensory: {
              energy: "reflective",
              acoustic: "silent",
              crowd: "sparse",
              texture: "Wind, gravel, birds.",
            },
            light: {
              exposure: "dappled",
              orientation: "sw",
              bestWindow: "afternoon",
              note: "Tall trees give shade, with open terraces catching the late sun.",
            },
            reason:
              "It shares the unhurried afternoon walk and trades the cellars for green paths.",
          },
          {
            name: "Cais de Gaia",
            kind: "walk",
            neighborhood: "Vila Nova de Gaia",
            summary:
              "The riverfront at the foot of the cellars, with terraces and a crowd by late afternoon.",
            aesthetic: ["quay stone", "moored boats"],
            coordinates: {
              lat: 41.1378,
              lng: -8.6155,
            },
            sensory: {
              energy: "social",
              acoustic: "chatter",
              crowd: "packed",
              texture: "Terrace talk, boat engines, music.",
            },
            light: {
              exposure: "open",
              orientation: "n",
              bestWindow: "afternoon",
              note: "Facing the old town across the water, it catches the afternoon sun.",
            },
            reason:
              "It stays on the south bank and trades the quiet lanes for the busy riverfront.",
          },
        ],
      },
      {
        stopIndex: 5,
        options: [
          {
            name: "Mosteiro da Serra do Pilar",
            kind: "sacred",
            neighborhood: "Vila Nova de Gaia",
            summary:
              "A round-cloister monastery above the bridge, with a view that is quieter than the lawn.",
            aesthetic: ["granite", "circular cloister"],
            coordinates: {
              lat: 41.1383,
              lng: -8.6091,
            },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Wind, distant traffic, a few visitors.",
            },
            light: {
              exposure: "open",
              orientation: "w",
              bestWindow: "sunset",
              note: "The terrace faces the river west and holds the last light.",
            },
            reason:
              "It shares the sunset view, and trades the crowd on the lawn for a quieter terrace a few minutes up the hill.",
          },
          {
            name: "Miradouro da Vitória",
            kind: "viewpoint",
            neighborhood: "Sé",
            summary:
              "A small terrace on the north bank with a view of the bridge and the cellars across the water.",
            aesthetic: ["old stone", "terrace"],
            coordinates: {
              lat: 41.1423,
              lng: -8.6128,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Conversation, a guitar, sunset watchers.",
            },
            light: {
              exposure: "open",
              orientation: "s",
              bestWindow: "sunset",
              note: "It faces south across the river, so the low sun lights the opposite bank.",
            },
            reason:
              "It keeps the sunset view over the Douro and trades the lawn for a busier terrace.",
          },
        ],
      },
      {
        stopIndex: 6,
        options: [
          {
            name: "Caldo verde along Rua do Almada",
            kind: "food",
            neighborhood: "Cedofeita",
            summary:
              "A calmer supper of soup, grilled fish and wine on a street of small family restaurants.",
            aesthetic: ["tile", "wood"],
            coordinates: {
              lat: 41.1491,
              lng: -8.6144,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "Soup spoons, quiet couples, a television low.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Warm lamp light after dark, the same at any evening hour.",
            },
            reason:
              "It shares the neighbourhood supper and trades the francesinha for a lighter, quieter meal.",
          },
          {
            name: "Wine bars on Rua de Cândido dos Reis",
            kind: "bar",
            neighborhood: "Sé",
            summary:
              "A short street of wine bars where Sunday evening glasses and cheese plates fill the tables.",
            aesthetic: ["stone", "dark wood"],
            coordinates: {
              lat: 41.1457,
              lng: -8.6107,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Glasses, laughter, music inside.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Candles and lamps give the evening light, the same all night.",
            },
            reason:
              "It keeps the evening drink and trades the sandwich for glasses and small plates in a livelier street.",
          },
        ],
      },
    ],
  },
};
