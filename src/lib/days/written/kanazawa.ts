import type { WrittenDay } from "./written-day";
import { KANAZAWA_START_REQUEST } from "./quick-starts";

/**
 * Kanazawa, as claude-sonnet-5-5 wrote it on 2026-10-31 under day-v8, for the
 * start that offers it (generation 1110d5c6-3041-4a54-81ba-fe3e63d06a67). Kept as written, letters
 * escaped twice read as the reader reads them, so the start opens a day the product really
 * wrote, slips and all; the normalizer repairs what it repairs for any live day.
 */
export const KANAZAWA_START_DAY: WrittenDay = {
  request: KANAZAWA_START_REQUEST,
  day: {
    assumptions: {
      travel: "on-foot",
      start: null,
      dinner: "early",
      end: "early",
      company: null,
    },
    dek: "A calm Saturday in Kanazawa that starts with the garden at opening and the Higashi Chaya lanes before the tour groups, then moves through Omicho for lunch, the castle grounds and a museum in the afternoon, and ends with early oden in Katamachi.",
    stops: [
      {
        startTime: "07:30",
        durationMinutes: 75,
        place: {
          name: "Kenroku-en",
          kind: "garden",
          neighborhood: "Kenrokumachi",
          summary:
            "The gates open early in the morning, well before the day crowd, and the paths are close to empty at half past seven. Early November is when the yukitsuri rope cones go up on the pines, so you may catch the gardeners at work.",
          aesthetic: ["moss", "pine", "still water"],
          coordinates: {
            lat: 36.5621,
            lng: 136.6627,
          },
          sensory: {
            energy: "reflective",
            acoustic: "hushed",
            crowd: "sparse",
            texture: "Gravel underfoot, water over the small falls, a few rakes and no music.",
          },
          light: {
            exposure: "dappled",
            orientation: "none",
            bestWindow: "morning",
            note: "Low sun comes through the maples and pines in the first hours, then flattens as the day crowd arrives.",
          },
        },
        dependsOn: ["start"],
      },
      {
        startTime: "09:15",
        durationMinutes: 60,
        place: {
          name: "Coffee in Kenrokumachi",
          kind: "coffee",
          neighborhood: "Kenrokumachi",
          summary:
            "Across the road from the garden a few small coffee rooms open by mid-morning, serving drip coffee and toast. It is a good place to sit down before walking on.",
          aesthetic: ["timber", "paper screens"],
          coordinates: {
            lat: 36.5632,
            lng: 136.6598,
          },
          sensory: {
            energy: "calm",
            acoustic: "murmur",
            crowd: "sparse",
            texture: "Cups on saucers, low talk, the street quiet outside.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "Mostly indoors, so the hour matters little; window seats get soft side light in the morning.",
          },
        },
        dependsOn: [],
      },
      {
        startTime: "10:30",
        durationMinutes: 75,
        place: {
          name: "Higashi Chaya District",
          kind: "walk",
          neighborhood: "Higashiyama",
          summary:
            "The wooden teahouse lanes are quiet until the day-trippers arrive, and the lattice fronts are clearest in the mid-morning. Shops open around ten, so you can step into the gold leaf and craft shops as you go.",
          aesthetic: ["lattice timber", "stone paving"],
          coordinates: {
            lat: 36.5726,
            lng: 136.6665,
          },
          sensory: {
            energy: "calm",
            acoustic: "murmur",
            crowd: "steady",
            texture: "Soft footsteps on stone, shop doors sliding, a few voices.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "morning",
            note: "The lanes are narrow, so light comes down at an angle in the morning and the shadow line crosses the lattice by noon.",
          },
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "12:00",
        durationMinutes: 75,
        place: {
          name: "Seafood Bowls at Omicho Market",
          kind: "market",
          neighborhood: "Omicho",
          summary:
            "Omicho is at its fullest around midday, with seafood bowls and grilled shellfish served in the small counters under the roof. Early November is crab season on the Kaga coast, so crab is on most boards.",
          aesthetic: ["covered arcade", "tiled floor"],
          coordinates: {
            lat: 36.5718,
            lng: 136.6577,
          },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture: "Vendors calling prices, ice being shovelled, shoes on wet floor.",
          },
          light: {
            exposure: "covered",
            orientation: "none",
            bestWindow: "none",
            note: "The arcade roof gives even light all day, so the hour matters for the crowd, not the light.",
          },
        },
        dependsOn: [],
      },
      {
        startTime: "13:30",
        durationMinutes: 70,
        place: {
          name: "Kanazawa Castle Park",
          kind: "walk",
          neighborhood: "Marunouchi",
          summary:
            "Wide lawns, white-walled storehouses and stone ramparts, a ten-minute walk from the market. By early afternoon the crowd spreads across the lawns and the paths stay easy to walk.",
          aesthetic: ["white plaster", "stone walls", "lawn"],
          coordinates: {
            lat: 36.5651,
            lng: 136.6594,
          },
          sensory: {
            energy: "calm",
            acoustic: "murmur",
            crowd: "steady",
            texture: "Gravel and grass, crows on the rooftops, distant traffic.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "afternoon",
            note: "The white walls take the afternoon sun and the lawns have no shade, so late autumn is the comfortable season for it.",
          },
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "15:15",
        durationMinutes: 90,
        place: {
          name: "21st Century Museum of Contemporary Art",
          kind: "museum",
          neighborhood: "Hirosaka",
          summary:
            "A round glass building you can walk through, with free public areas and ticketed exhibition rooms. It is a good indoor stop once the afternoon cools.",
          aesthetic: ["white walls", "glass", "concrete"],
          coordinates: {
            lat: 36.5608,
            lng: 136.6584,
          },
          sensory: {
            energy: "calm",
            acoustic: "hushed",
            crowd: "steady",
            texture: "Soft footsteps on polished floors, quiet gallery rooms.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "afternoon",
            note: "Daylight enters through the glass walls and shifts through the afternoon, so the hour changes the corridors more than the galleries.",
          },
        },
        dependsOn: [],
      },
      {
        startTime: "17:30",
        durationMinutes: 90,
        place: {
          name: "Oden in Katamachi",
          kind: "food",
          neighborhood: "Katamachi",
          summary:
            "Katamachi's side streets have small counters serving oden, simmered daikon, tofu and eggs in light broth, and Kanazawa's local styles with it. By half past five the counters are warm and seats are easy to find.",
          aesthetic: ["wood counters", "paper lanterns"],
          coordinates: {
            lat: 36.5612,
            lng: 136.6523,
          },
          sensory: {
            energy: "balanced",
            acoustic: "murmur",
            crowd: "steady",
            texture: "Pots simmering, chopsticks on bowls, low conversation.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "after-dark",
            note: "Lantern light after sundown; by 17:30 it is just turning dark outside.",
          },
        },
        dependsOn: ["dinner"],
      },
      {
        startTime: "19:15",
        durationMinutes: 60,
        place: {
          name: "Kazue-machi Chaya District",
          kind: "walk",
          neighborhood: "Kazue-machi",
          summary:
            "A quiet row of teahouses along the Asano River, lit softly after dark. It is a short, calm walk from Katamachi before heading home.",
          aesthetic: ["lattice timber", "river stone"],
          coordinates: {
            lat: 36.5688,
            lng: 136.6657,
          },
          sensory: {
            energy: "calm",
            acoustic: "hushed",
            crowd: "sparse",
            texture: "River running below, footsteps on stone, a few lamps.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "after-dark",
            note: "Lamps along the lattice fronts after dark give the lane a warm glow.",
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
            name: "Oyama Shrine",
            kind: "sacred",
            neighborhood: "Oyamacho",
            summary:
              "A shrine with a tall gate of stained glass and wood, a short walk from the garden. Few visitors arrive here in the early morning.",
            aesthetic: ["timber", "moss", "stone"],
            coordinates: {
              lat: 36.5647,
              lng: 136.6595,
            },
            sensory: {
              energy: "reflective",
              acoustic: "silent",
              crowd: "empty",
              texture: "Gravel paths, birdsong, almost no voices.",
            },
            light: {
              exposure: "dappled",
              orientation: "none",
              bestWindow: "morning",
              note: "Morning light filters through the trees onto the gate and the moss.",
            },
            reason:
              "It keeps the early-morning quiet and the trees, but trades the garden's water and open paths for a smaller shrine ground.",
          },
        ],
      },
      {
        stopIndex: 1,
        options: [
          {
            name: "Tea along Higashi Chaya",
            kind: "coffee",
            neighborhood: "Higashiyama",
            summary:
              "Teahouses near the lanes serve matcha and wagashi sweets from mid-morning. It is quieter and slower than a coffee room.",
            aesthetic: ["tatami", "paper screens"],
            coordinates: {
              lat: 36.5724,
              lng: 136.6668,
            },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Whisk against bowl, low voices.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Paper screens soften the daylight through the morning.",
            },
            reason:
              "It shares the sit-down pause and the morning hour but trades coffee for matcha, and is quieter, though a longer walk from the garden.",
          },
          {
            name: "Coffee near Hirosaka",
            kind: "coffee",
            neighborhood: "Hirosaka",
            summary:
              "Between the park and the museum a few coffee rooms serve drip coffee and toast, busier with locals by mid-morning.",
            aesthetic: ["concrete", "plants"],
            coordinates: {
              lat: 36.5625,
              lng: 136.6585,
            },
            sensory: {
              energy: "balanced",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Grinders running, steady talk.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Large windows give even daylight through the morning.",
            },
            reason:
              "It shares the coffee and the hour but trades the quiet for a busier room with more talk.",
          },
        ],
      },
      {
        stopIndex: 2,
        options: [
          {
            name: "Utatsuyama Craft Workshop Hill",
            kind: "walk",
            neighborhood: "Utatsuyama",
            summary:
              "A hillside of small craft workshops and temples above Higashi Chaya, quiet on a Saturday morning. Many studios open around ten.",
            aesthetic: ["timber", "stone steps"],
            coordinates: {
              lat: 36.5703,
              lng: 136.6714,
            },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "empty",
              texture: "Stone steps, wind in the trees, a few workshop doors.",
            },
            light: {
              exposure: "dappled",
              orientation: "none",
              bestWindow: "morning",
              note: "Tree cover keeps the hill shaded and soft in the morning.",
            },
            reason:
              "It keeps the old-town setting and the morning hour but trades the lattice lanes for quieter temple steps.",
          },
          {
            name: "Nagamachi Samurai District",
            kind: "walk",
            neighborhood: "Nagamachi",
            summary:
              "Earthen walls and narrow canals, with a few houses open to visit. Walking tours pass through by late morning.",
            aesthetic: ["earthen walls", "canal stone"],
            coordinates: {
              lat: 36.5636,
              lng: 136.6532,
            },
            sensory: {
              energy: "balanced",
              acoustic: "murmur",
              crowd: "steady",
              texture: "Water in the narrow canal, footsteps, tour group voices.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "morning",
              note: "Low walls and open lanes let the morning sun reach the earthen walls.",
            },
            reason:
              "It shares the old-town walk and the hour but trades the teahouse lanes for samurai streets with more visitors.",
          },
        ],
      },
      {
        stopIndex: 3,
        options: [
          {
            name: "Soba near Omicho",
            kind: "food",
            neighborhood: "Omicho",
            summary:
              "Soba and tempura counters around the market's edges serve lunch from eleven. Quieter than the market floor.",
            aesthetic: ["wood counters", "noren"],
            coordinates: {
              lat: 36.5712,
              lng: 136.6585,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "steady",
              texture: "Broth steaming, quiet orders.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Even indoor light, so the hour matters for the queue, not the light.",
            },
            reason:
              "It shares the lunch hour and the market neighbourhood but trades seafood bowls for soba and a quieter room.",
          },
          {
            name: "Seafood Grills in Omicho",
            kind: "food",
            neighborhood: "Omicho",
            summary: "Stalls grilling shellfish and crab legs to eat standing, busiest at midday.",
            aesthetic: ["steel", "ice", "tiled floor"],
            coordinates: {
              lat: 36.5719,
              lng: 136.6579,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Grills hissing, vendors calling, shoulders touching.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "none",
              note: "The arcade roof keeps the light even all day.",
            },
            reason:
              "It shares the market and the seafood but trades sitting down for eating standing in a louder crowd.",
          },
        ],
      },
      {
        stopIndex: 4,
        options: [
          {
            name: "Gyokusen-inmaru Garden",
            kind: "garden",
            neighborhood: "Marunouchi",
            summary:
              "A small, quiet garden below the castle with a pond and tea house. Fewer visitors than the main lawns.",
            aesthetic: ["pond", "stone", "maple"],
            coordinates: {
              lat: 36.5646,
              lng: 136.6613,
            },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Water, leaves, a few steps on stone.",
            },
            light: {
              exposure: "dappled",
              orientation: "none",
              bestWindow: "afternoon",
              note: "Afternoon sun comes in low through the maples onto the pond.",
            },
            reason:
              "It shares the castle setting and the afternoon hour but trades the open lawns for a smaller, quieter garden.",
          },
          {
            name: "Hirosaka Street",
            kind: "walk",
            neighborhood: "Hirosaka",
            summary:
              "A wide street between the castle and the museum lined with shops and cafés, busier on a Saturday afternoon.",
            aesthetic: ["concrete", "ginkgo"],
            coordinates: {
              lat: 36.5622,
              lng: 136.6588,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Shoppers, bicycles, ginkgo leaves underfoot.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "afternoon",
              note: "Ginkgo leaves turn yellow in November and the afternoon sun lights the street.",
            },
            reason:
              "It shares the afternoon stroll but trades the castle lawns for a busy shopping street.",
          },
        ],
      },
      {
        stopIndex: 5,
        options: [
          {
            name: "D.T. Suzuki Museum",
            kind: "museum",
            neighborhood: "Hirosaka",
            summary:
              "A small museum built around a shallow reflecting pool, very quiet inside. It is a few minutes' walk from the contemporary art museum.",
            aesthetic: ["white walls", "still water", "concrete"],
            coordinates: {
              lat: 36.5593,
              lng: 136.6597,
            },
            sensory: {
              energy: "reflective",
              acoustic: "silent",
              crowd: "sparse",
              texture: "Still water, soft footsteps, almost no talk.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "afternoon",
              note: "Afternoon light reflects off the pool onto the white walls.",
            },
            reason:
              "It shares the museum setting and the afternoon but trades larger galleries for a smaller, quieter space.",
          },
          {
            name: "Kanazawa Station Museum Area",
            kind: "shop",
            neighborhood: "Kanazawa Station",
            summary:
              "The station shopping halls under the Tsuzumi Gate sell sweets and crafts, busy on a Saturday afternoon.",
            aesthetic: ["glass", "timber", "steel"],
            coordinates: {
              lat: 36.578,
              lng: 136.6478,
            },
            sensory: {
              energy: "social",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Announcements, rolling cases, shop calls.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "none",
              note: "Glass roof gives even daylight, so the hour matters for crowds only.",
            },
            reason:
              "It shares the indoor afternoon hour but trades the galleries for crowded shops, and is a longer walk away.",
          },
        ],
      },
      {
        stopIndex: 6,
        options: [
          {
            name: "Soba in Katamachi",
            kind: "food",
            neighborhood: "Katamachi",
            summary:
              "Small soba counters in Katamachi open early for dinner, with warm broth and tempura. Quieter than oden counters.",
            aesthetic: ["wood counters", "noren"],
            coordinates: {
              lat: 36.5615,
              lng: 136.653,
            },
            sensory: {
              energy: "calm",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Steam, soft slurping, quiet orders.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Warm indoor light as evening falls.",
            },
            reason:
              "It shares the early dinner and the district but trades oden for soba and a quieter counter.",
          },
          {
            name: "Izakaya Alley in Katamachi",
            kind: "bar",
            neighborhood: "Katamachi",
            summary:
              "Lantern-lit alleys of small izakaya serving sake and grilled skewers. Busier as evening goes on.",
            aesthetic: ["lanterns", "wood", "neon"],
            coordinates: {
              lat: 36.5608,
              lng: 136.6518,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Laughter, glasses, skewers on the grill.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Lanterns and neon take over once the sun is down.",
            },
            reason:
              "It shares the district and the evening but trades a quiet counter meal for a louder drinking street.",
          },
        ],
      },
      {
        stopIndex: 7,
        options: [
          {
            name: "Asano River Bank Path",
            kind: "walk",
            neighborhood: "Kazue-machi",
            summary:
              "A path along the river with few people after dark and views of the lit bridges.",
            aesthetic: ["river stone", "iron bridges"],
            coordinates: {
              lat: 36.5675,
              lng: 136.664,
            },
            sensory: {
              energy: "reflective",
              acoustic: "silent",
              crowd: "empty",
              texture: "Water, footsteps, nothing else.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Bridge lamps reflect on the water after dark.",
            },
            reason:
              "It shares the river and the evening hour but trades the lit teahouse lane for a quieter riverbank.",
          },
          {
            name: "Korinbo Shopping Street",
            kind: "walk",
            neighborhood: "Korinbo",
            summary:
              "Lit shop fronts and cafés stay open into the evening and the street is busy on a Saturday.",
            aesthetic: ["neon", "glass", "concrete"],
            coordinates: {
              lat: 36.563,
              lng: 136.656,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Shoppers, shutters, café doors.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Shop signs and street lamps light the street after dark.",
            },
            reason:
              "It shares the evening walk but trades the quiet teahouse lane for a busy shopping street.",
          },
        ],
      },
    ],
  },
};
