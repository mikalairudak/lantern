import type { WrittenDay } from "./written-day";
import { PARIS_REQUEST } from "./city-days";

/**
 * Paris, as claude-sonnet-5-5 wrote it on 2026-11-11 under day-v11, for its own address (generation
 * 3f89d5cf-0129-46dd-90c2-22c0cf23129e). Kept as written, letters escaped twice read as the reader
 * reads them, so the address opens a day the product really wrote, slips and all; the normalizer
 * repairs what it repairs for any live day.
 */
export const PARIS_DAY: WrittenDay = {
  request: PARIS_REQUEST,
  day: {
    assumptions: {
      travel: "on-foot",
      start: null,
      dinner: "early",
      end: "evening",
      company: null,
    },
    dek: "A slow Sunday in the Marais and along the Seine: coffee on Rue des Francs-Bourgeois, a quiet museum hour, a long lunch near Place des Vosges, the Île Saint-Louis in afternoon light, and an early supper in the Latin Quarter.",
    stops: [
      {
        startTime: "10:00",
        durationMinutes: 60,
        place: {
          name: "Coffee on Rue des Francs-Bourgeois",
          kind: "coffee",
          neighborhood: "Le Marais",
          coordinates: {
            lat: 48.8571,
            lng: 2.3589,
          },
          sensory: {
            energy: "calm",
            acoustic: "murmur",
            crowd: "sparse",
            texture:
              "Shutters still half down, cups on small round tables, a few bakery bags passing.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "morning",
            note: "The street runs east to west, so the low November sun reaches the pavement tables after ten and the north side stays in shade.",
          },
          summary:
            "Many shops here stay shut until later on Sundays, so at ten you have a flat white or a noisette and a croissant at a table without waiting for one.",
          aesthetic: ["cream stone", "zinc counters"],
        },
        dependsOn: ["start"],
      },
      {
        startTime: "11:15",
        durationMinutes: 90,
        place: {
          name: "Musée Carnavalet",
          kind: "museum",
          neighborhood: "Le Marais",
          coordinates: {
            lat: 48.857,
            lng: 2.3626,
          },
          sensory: {
            energy: "reflective",
            acoustic: "hushed",
            crowd: "steady",
            texture:
              "Parquet creaking, soft footsteps through panelled rooms, a garden courtyard to step out into.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "Daylight comes in at the tall windows and the hour hardly matters; the garden courtyard is best in the late morning.",
          },
          summary:
            "The permanent collection is free and the museum is open on Sundays, a good indoor hour for a cold morning, and it is a five-minute walk from the coffee.",
          aesthetic: ["panelled rooms", "gilded wood"],
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "13:15",
        durationMinutes: 90,
        place: {
          name: "Lunch around Place des Vosges",
          kind: "food",
          neighborhood: "Le Marais",
          coordinates: {
            lat: 48.8556,
            lng: 2.3655,
          },
          sensory: {
            energy: "balanced",
            acoustic: "chatter",
            crowd: "busy",
            texture:
              "Arcade tables, plates of onion soup and roast chicken, couples lingering over coffee.",
          },
          light: {
            exposure: "covered",
            orientation: "none",
            bestWindow: "midday",
            note: "The arcades keep the table in shade while the square outside takes the full midday sun.",
          },
          summary:
            "Sunday lunch is the main meal here, and the arcade restaurants fill by half past one with duck, steak frites and tarts, so a table before two keeps it unhurried.",
          aesthetic: ["red brick", "arcaded stone"],
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "15:15",
        durationMinutes: 60,
        place: {
          name: "Place des Vosges",
          kind: "garden",
          neighborhood: "Le Marais",
          coordinates: {
            lat: 48.8559,
            lng: 2.3656,
          },
          sensory: {
            energy: "calm",
            acoustic: "murmur",
            crowd: "steady",
            texture: "Gravel paths, bare chestnut branches, children by the fountains.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "afternoon",
            note: "In November the sun sits low by three and turns the brick facades orange along the west side.",
          },
          summary:
            "A slow lap of the square after lunch, with benches under the chestnuts for sitting out the first part of the afternoon.",
          aesthetic: ["red brick", "gravel paths"],
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "16:30",
        durationMinutes: 60,
        place: {
          name: "Walk along the Île Saint-Louis",
          kind: "walk",
          neighborhood: "Île Saint-Louis",
          coordinates: {
            lat: 48.8517,
            lng: 2.3567,
          },
          sensory: {
            energy: "calm",
            acoustic: "hushed",
            crowd: "steady",
            texture: "Cobbles, river water against stone, the occasional barge horn.",
          },
          light: {
            exposure: "open",
            orientation: "s",
            bestWindow: "sunset",
            note: "Sunset is around half past five in mid-November, and the quays on the south bank hold the last light on the water.",
          },
          summary:
            "The island is small and quiet on a Sunday afternoon, and the quai de Béthune on its south side is where the late light stays longest.",
          aesthetic: ["limestone quays", "wrought iron"],
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "18:00",
        durationMinutes: 90,
        place: {
          name: "Dinner on Rue Mouffetard",
          kind: "food",
          neighborhood: "Latin Quarter",
          coordinates: {
            lat: 48.8431,
            lng: 2.3503,
          },
          sensory: {
            energy: "balanced",
            acoustic: "chatter",
            crowd: "busy",
            texture: "Cobbles, steamed-up windows, plates of crêpes and cassoulet going past.",
          },
          light: {
            exposure: "covered",
            orientation: "none",
            bestWindow: "after-dark",
            note: "Warm window light and string lights take over once it is dark by six.",
          },
          summary:
            "Kitchens here open by six on a Sunday evening, so an early table is easy, and the cold-weather menu of cassoulet, onion soup and crêpes suits November.",
          aesthetic: ["cobblestones", "warm lamplight"],
        },
        dependsOn: ["dinner", "travel"],
      },
    ],
    alternatives: [
      {
        stopIndex: 0,
        options: [
          {
            name: "Rue de Bretagne market coffee",
            kind: "coffee",
            neighborhood: "Le Marais",
            coordinates: {
              lat: 48.8636,
              lng: 2.3613,
            },
            sensory: {
              energy: "balanced",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Market stalls, scooter bells, cups passed over a counter.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "morning",
              note: "Early on, the street takes light along its length from the east.",
            },
            summary:
              "A livelier stretch where the Sunday market crowd stops for a coffee and a pastry at the counter.",
            aesthetic: ["market stalls", "painted shopfronts"],
            reason:
              "Same coffee and pastry, but standing at a counter next to a market instead of sitting on a quiet street.",
          },
        ],
      },
      {
        stopIndex: 1,
        options: [
          {
            name: "Hôtel de Sully garden",
            kind: "garden",
            neighborhood: "Le Marais",
            coordinates: {
              lat: 48.8548,
              lng: 2.3647,
            },
            sensory: {
              energy: "reflective",
              acoustic: "silent",
              crowd: "empty",
              texture: "Gravel and clipped hedges behind stone walls, almost no one.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "morning",
              note: "Morning light falls across the stone, and the garden stays quiet all day.",
            },
            summary:
              "A walled courtyard and garden that is calmer than the museum, reached through a passage from Rue Saint-Antoine.",
            aesthetic: ["stone", "gravel"],
            reason:
              "Both are a quiet hour in the same quarter, but this one is outdoors and nearly silent.",
          },
          {
            name: "Centre Pompidou",
            kind: "museum",
            neighborhood: "Beaubourg",
            coordinates: {
              lat: 48.8607,
              lng: 2.3525,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Escalators, school groups, echoing galleries.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Glass and steel galleries; the hour hardly changes the light.",
            },
            summary:
              "A bigger, busier museum a 10-minute walk away, with Sunday crowds in the modern art rooms.",
            aesthetic: ["exposed pipes", "glass"],
            reason: "Same indoor museum hour, but busier and much louder.",
          },
        ],
      },
      {
        stopIndex: 2,
        options: [
          {
            name: "Tea and tarts on Rue de Turenne",
            kind: "coffee",
            neighborhood: "Le Marais",
            coordinates: {
              lat: 48.8587,
              lng: 2.3625,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "Small tables, tea cups, quiet talk.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "midday",
              note: "Windows face the street and take even light through the middle of the day.",
            },
            summary:
              "A lighter lunch of savoury tarts and tea on a quieter street one block off the square.",
            aesthetic: ["wood tables", "pale walls"],
            reason:
              "Same neighbourhood and same hour, a lighter and quieter table than the arcade restaurants.",
          },
          {
            name: "Falafel on Rue des Rosiers",
            kind: "food",
            neighborhood: "Le Marais",
            coordinates: {
              lat: 48.8573,
              lng: 2.3597,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Queues on the pavement, paper wrappers, shouted orders.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "midday",
              note: "A narrow street, bright at midday and shaded either side.",
            },
            summary:
              "Sunday is one of the busiest days on this street, and falafel eaten standing or on a bench nearby is the quick lunch.",
            aesthetic: ["painted shopfronts", "paper wrappers"],
            reason:
              "Same quarter and the same lunch hour, but standing in a queue instead of sitting under an arcade.",
          },
        ],
      },
      {
        stopIndex: 3,
        options: [
          {
            name: "Jardin des Archives Nationales",
            kind: "garden",
            neighborhood: "Le Marais",
            coordinates: {
              lat: 48.8605,
              lng: 2.3604,
            },
            sensory: {
              energy: "reflective",
              acoustic: "silent",
              crowd: "empty",
              texture: "Raked gravel, a few benches, almost no one.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "afternoon",
              note: "Afternoon sun falls on the courtyard walls through the bare trees.",
            },
            summary:
              "A small, quiet garden behind the archives that is usually nearly empty on a Sunday.",
            aesthetic: ["gravel", "clipped hedges"],
            reason: "Same afternoon outdoors in the Marais, quieter than the busy square.",
          },
          {
            name: "Rue Vieille du Temple",
            kind: "walk",
            neighborhood: "Le Marais",
            coordinates: {
              lat: 48.8588,
              lng: 2.3606,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Open shops, crowded pavements, cafe terraces.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "afternoon",
              note: "A narrow street where the low sun slips between the buildings for part of the afternoon.",
            },
            summary: "Many shops open on Sundays here, so the street is a busy afternoon walk.",
            aesthetic: ["painted shopfronts", "cobbles"],
            reason: "Same neighbourhood and hour, a busy street instead of a calm square.",
          },
        ],
      },
      {
        stopIndex: 4,
        options: [
          {
            name: "Square du Vert-Galant",
            kind: "garden",
            neighborhood: "Île de la Cité",
            coordinates: {
              lat: 48.8571,
              lng: 2.3414,
            },
            sensory: {
              energy: "calm",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Water at the tip of the island, willows, a few couples on benches.",
            },
            light: {
              exposure: "open",
              orientation: "w",
              bestWindow: "sunset",
              note: "At the west point of the island, the sun sets straight down the river.",
            },
            summary:
              "The tip of the neighbouring island, where the sunset is wide open over the water.",
            aesthetic: ["willows", "river stone"],
            reason: "Same river and the same sunset hour, from the open point of the next island.",
          },
          {
            name: "Quai de Montebello",
            kind: "walk",
            neighborhood: "Latin Quarter",
            coordinates: {
              lat: 48.8528,
              lng: 2.3481,
            },
            sensory: {
              energy: "balanced",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Green bookstalls, passing cyclists, Notre-Dame across the water.",
            },
            light: {
              exposure: "open",
              orientation: "n",
              bestWindow: "afternoon",
              note: "Facing north across the river, it holds soft even light for most of the afternoon.",
            },
            summary: "A busier riverside stretch of bookstalls with Notre-Dame across the water.",
            aesthetic: ["green bookstalls", "limestone"],
            reason: "Same river and hour, with more people and the bookstalls.",
          },
        ],
      },
      {
        stopIndex: 5,
        options: [
          {
            name: "Quiet wine bars on Rue de Lanneau",
            kind: "bar",
            neighborhood: "Latin Quarter",
            coordinates: {
              lat: 48.8503,
              lng: 2.3489,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "Narrow lane, low voices, small glasses of wine.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Lit mostly by lamps once it is dark.",
            },
            summary:
              "A quieter lane near the Sorbonne where small wine bars serve cheese and charcuterie boards early in the evening.",
            aesthetic: ["old stone", "lamplight"],
            reason: "Same Latin Quarter evening, a lighter and quieter meal of wine and cheese.",
          },
          {
            name: "Crêperies on Rue Saint-Séverin",
            kind: "food",
            neighborhood: "Latin Quarter",
            coordinates: {
              lat: 48.8522,
              lng: 2.3469,
            },
            sensory: {
              energy: "lively",
              acoustic: "loud",
              crowd: "packed",
              texture: "Crowded terraces, heat lamps, hawkers calling.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Neon signs and heat lamps light the street after dark.",
            },
            summary:
              "A lively, crowded street of crêperies and Greek restaurants with terrace tables under heaters.",
            aesthetic: ["neon signs", "medieval stone"],
            reason: "Same Latin Quarter dinner hour, noisier and busier.",
          },
        ],
      },
    ],
  },
};
