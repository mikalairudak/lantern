import type { WrittenDay } from "./written-day";
import { SEOUL_REQUEST } from "./city-days";

/**
 * Seoul, as claude-sonnet-5-5 wrote it on 2026-11-11 under day-v11, for its own address (generation
 * 59e63a5c-3ae5-4bab-bdbb-9e917fb1cd8f). Kept as written, letters escaped twice read as the reader
 * reads them, so the address opens a day the product really wrote, slips and all; the normalizer
 * repairs what it repairs for any live day.
 */
export const SEOUL_DAY: WrittenDay = {
  request: SEOUL_REQUEST,
  day: {
    assumptions: {
      travel: "transit",
      start: "slow",
      dinner: "late",
      end: null,
      company: null,
    },
    dek: "A mid-morning start in the Seochon lanes, then Gyeongbokgung's grounds in the afternoon light, Insadong's tea streets at dusk, and a long Friday night between Jongno's grilled-meat alleys and the bars of Euljiro.",
    stops: [
      {
        startTime: "10:00",
        durationMinutes: 60,
        place: {
          name: "Coffee on Jahamun-ro 7-gil",
          kind: "coffee",
          neighborhood: "Seochon",
          coordinates: {
            lat: 37.5795,
            lng: 126.9712,
          },
          sensory: {
            energy: "calm",
            acoustic: "murmur",
            crowd: "sparse",
            texture:
              "Espresso machines through open doors, delivery scooters in the lane, low voices.",
          },
          light: {
            exposure: "covered",
            orientation: "none",
            bestWindow: "morning",
            note: "The lane is narrow and shaded by low houses, so the light stays soft through the morning.",
          },
          summary:
            "Seochon's lanes fill slowly on a weekday morning, and mid-morning is when the small coffee counters here are open and still quiet. Order a flat white and sit by the window.",
          aesthetic: ["hanok timber", "exposed concrete"],
        },
        dependsOn: ["start", "travel"],
      },
      {
        startTime: "11:15",
        durationMinutes: 150,
        place: {
          name: "Gyeongbokgung Palace",
          kind: "architecture",
          neighborhood: "Sajik-ro",
          coordinates: {
            lat: 37.5796,
            lng: 126.977,
          },
          sensory: {
            energy: "balanced",
            acoustic: "murmur",
            crowd: "steady",
            texture:
              "Gravel underfoot, guides' voices in several languages, wind across the open courtyards.",
          },
          light: {
            exposure: "open",
            orientation: "s",
            bestWindow: "afternoon",
            note: "The main courtyards face south and take full sun from late morning, with the palace roofs lit against the mountain behind.",
          },
          summary:
            "The palace is open Friday and mid-morning is when the first tour groups clear out of the main gate. Walk past the throne hall to the quieter pavilions at the back.",
          aesthetic: ["painted timber", "granite paving"],
        },
        dependsOn: ["start"],
      },
      {
        startTime: "14:15",
        durationMinutes: 75,
        place: {
          name: "Mandu and noodles along Insadong-gil",
          kind: "food",
          neighborhood: "Insadong",
          coordinates: {
            lat: 37.5741,
            lng: 126.9857,
          },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture:
              "Steam from dumpling pots, shopkeepers calling, the shuffle of a crowd on the main street.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "midday",
            note: "The main street is open to the sky and flat-lit at this hour, while the side courtyards stay in shade.",
          },
          summary:
            "The lunch rush has thinned by a quarter past two, which is when dumplings and hand-cut noodles in the side courtyards are easy to sit down for. Duck into an alley courtyard rather than eating on the main street.",
          aesthetic: ["tiled roofs", "wooden signs"],
        },
        dependsOn: ["start"],
      },
      {
        startTime: "15:45",
        durationMinutes: 120,
        place: {
          name: "Ikseon-dong Hanok Village",
          kind: "walk",
          neighborhood: "Ikseon-dong",
          coordinates: {
            lat: 37.5744,
            lng: 126.9888,
          },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture:
              "Narrow lanes, low tiled roofs, small cafes and shops with the door open onto the alley.",
          },
          light: {
            exposure: "dappled",
            orientation: "none",
            bestWindow: "afternoon",
            note: "The alleys run between low rooftops, so afternoon sun comes in at an angle and picks out the tiles and wooden eaves.",
          },
          summary:
            "The alleys are most photogenic when the afternoon sun slants in, and most of the shops are open by now. Take the side lanes off the main stretch; they have fewer people.",
          aesthetic: ["hanok timber", "tiled roofs"],
        },
        dependsOn: ["start", "travel"],
      },
      {
        startTime: "18:00",
        durationMinutes: 60,
        place: {
          name: "Cheonggyecheon Stream",
          kind: "walk",
          neighborhood: "Jongno",
          coordinates: {
            lat: 37.5691,
            lng: 126.9788,
          },
          sensory: {
            energy: "calm",
            acoustic: "murmur",
            crowd: "steady",
            texture:
              "Water running over stepping stones, traffic muffled above street level, people strolling at an easy pace.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "sunset",
            note: "Sunset is around half past five in mid-November, so the walk starts in the last light and the stream's lamps come on.",
          },
          summary:
            "The stream sits below street level, so the city's noise drops away as the evening light goes. Walk east from Cheonggye Plaza as the lamps turn on, with the stepping stones and the bridges lit.",
          aesthetic: ["granite embankment", "water"],
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "19:15",
        durationMinutes: 135,
        place: {
          name: "Grilled pork along Jongno 3-ga alleys",
          kind: "food",
          neighborhood: "Jongno 3-ga",
          coordinates: {
            lat: 37.5714,
            lng: 126.9916,
          },
          sensory: {
            energy: "social",
            acoustic: "loud",
            crowd: "packed",
            texture:
              "Charcoal smoke, soju glasses clinking, plastic stools on the pavement, office groups at long tables.",
          },
          light: {
            exposure: "covered",
            orientation: "none",
            bestWindow: "after-dark",
            note: "After dark the alleys are lit by neon signs and the glow from grills, which suits the street.",
          },
          summary:
            "On a Friday night these alleys fill from seven, and by half past nine the tables are fully packed. Order a portion of pork and a bottle of soju, and expect to be asked to share the table.",
          aesthetic: ["plastic stools", "neon signage"],
        },
        dependsOn: ["dinner", "company"],
      },
      {
        startTime: "21:45",
        durationMinutes: 120,
        place: {
          name: "Euljiro Hip-jiro Alleys",
          kind: "bar",
          neighborhood: "Euljiro",
          coordinates: {
            lat: 37.5663,
            lng: 126.9919,
          },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture:
              "Small bars up narrow stairs, craft beer and highballs, printing-workshop shutters still half down.",
          },
          light: {
            exposure: "covered",
            orientation: "none",
            bestWindow: "after-dark",
            note: "The alleys are lit by hanging bulbs and shop signs, dim between one bar and the next.",
          },
          summary:
            "Friday night is when the bars tucked among Euljiro's old printing workshops fill up, and a seat at the counter is the easiest way to drink alone here. Walk the alleys first and pick the room that is half full.",
          aesthetic: ["raw concrete", "neon signage"],
        },
        dependsOn: ["end", "company"],
      },
      {
        startTime: "23:55",
        durationMinutes: 90,
        place: {
          name: "Late-night tteokbokki by Myeongdong Gil",
          kind: "food",
          neighborhood: "Myeongdong",
          coordinates: {
            lat: 37.5636,
            lng: 126.9853,
          },
          sensory: {
            energy: "balanced",
            acoustic: "chatter",
            crowd: "steady",
            texture:
              "Steaming trays of rice cake in red sauce, clipped orders at the counter, shoes scuffing on the pavement.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "after-dark",
            note: "The main street is lit like day by shop signs until the last stalls shut.",
          },
          summary:
            "After a night of drinking, a tray of tteokbokki hot enough to steam your glasses is what the street does at this hour. Eat standing at the counter and move on.",
          aesthetic: ["neon signage", "steel counters"],
        },
        dependsOn: ["end"],
      },
    ],
    alternatives: [
      {
        stopIndex: 0,
        options: [
          {
            name: "Tongin Market",
            kind: "market",
            neighborhood: "Seochon",
            coordinates: {
              lat: 37.5805,
              lng: 126.9696,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Vendors calling, coins clinking in trays, the smell of frying oil.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "morning",
              note: "The market lane is roofed, so the light is the same all day.",
            },
            summary: "A covered market a short walk away that is open and busy from mid-morning.",
            aesthetic: ["steel roofing", "wooden stalls"],
            reason:
              "It keeps the Seochon setting and the morning hour, but swaps a quiet coffee counter for a busy market lane.",
          },
        ],
      },
      {
        stopIndex: 1,
        options: [
          {
            name: "Seochon Hanok Lanes",
            kind: "walk",
            neighborhood: "Seochon",
            coordinates: {
              lat: 37.5805,
              lng: 126.9726,
            },
            sensory: {
              energy: "calm",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Low tiled roofs, quiet lanes, the odd cat on a wall.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "afternoon",
              note: "The lanes run between low houses, so the sun comes in at an angle through the afternoon.",
            },
            summary: "A quiet walk through the lanes of old houses just west of the palace.",
            aesthetic: ["hanok timber", "tiled roofs"],
            reason:
              "It stays beside the palace and in the same afternoon light, but trades the courtyards for quiet residential lanes.",
          },
          {
            name: "Gwanghwamun Square",
            kind: "walk",
            neighborhood: "Sejong-ro",
            coordinates: {
              lat: 37.5724,
              lng: 126.9769,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Fountains, wide paving, groups gathering by the statues.",
            },
            light: {
              exposure: "open",
              orientation: "s",
              bestWindow: "midday",
              note: "The square is fully open to the sky, so the sun is strongest at midday.",
            },
            summary: "A broad open square at the palace's front gate, always in use by walkers.",
            aesthetic: ["granite paving", "wide plaza"],
            reason:
              "It sits at the same palace gate but is open, wide and busy rather than courtyard-scale.",
          },
        ],
      },
      {
        stopIndex: 2,
        options: [
          {
            name: "Tea houses along Insadong Tea Alley",
            kind: "coffee",
            neighborhood: "Insadong",
            coordinates: {
              lat: 37.5747,
              lng: 126.9847,
            },
            sensory: {
              energy: "calm",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Low tables, steam from teapots, soft talk and a creaking floorboard.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Inside the tea houses the light is the same at any hour.",
            },
            summary: "Courtyard tea houses a few steps off the main street, quiet at this hour.",
            aesthetic: ["hanok timber", "paper screens"],
            reason:
              "It stays on Insadong at the same hour, but swaps a lunch stop for a seat with tea and a quieter room.",
          },
          {
            name: "Gwangjang Market",
            kind: "market",
            neighborhood: "Jongno 5-ga",
            coordinates: {
              lat: 37.5701,
              lng: 127.0013,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Mung bean pancakes frying, tightly packed stools, vendors shouting.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "none",
              note: "The market is roofed, so the light is the same all day.",
            },
            summary:
              "A crowded food market where pancakes and raw beef are eaten at shared counters.",
            aesthetic: ["steel roofing", "plastic stools"],
            reason:
              "It keeps the food at the same hour, but is a market rather than a lane and much louder.",
          },
        ],
      },
      {
        stopIndex: 3,
        options: [
          {
            name: "Jogyesa Temple",
            kind: "sacred",
            neighborhood: "Insadong",
            coordinates: {
              lat: 37.5744,
              lng: 126.9832,
            },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Incense smoke, a low drum, monks' footsteps on stone.",
            },
            light: {
              exposure: "open",
              orientation: "s",
              bestWindow: "afternoon",
              note: "The courtyard faces south and the paper lanterns are lit by the afternoon sun.",
            },
            summary:
              "A working temple a few minutes' walk from Ikseon-dong, quiet through the afternoon.",
            aesthetic: ["painted timber", "paper lanterns"],
            reason:
              "It is a short walk away in the same afternoon light, but a temple courtyard instead of a crowded lane.",
          },
          {
            name: "Nakwon Instrument Arcade",
            kind: "shop",
            neighborhood: "Nakwon-dong",
            coordinates: {
              lat: 37.5719,
              lng: 126.9889,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "busy",
              texture:
                "Shopfronts side by side, people trying out instruments, a crowd moving through.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "The arcade is indoors, so the light stays the same through the afternoon.",
            },
            summary: "A multi-floor arcade of musical instrument shops open all afternoon.",
            aesthetic: ["fluorescent light", "concrete"],
            reason:
              "It sits beside Ikseon-dong and is open at the same hour, but is a noisy indoor arcade rather than an outdoor lane.",
          },
        ],
      },
      {
        stopIndex: 4,
        options: [
          {
            name: "Jongmyo Shrine Grounds",
            kind: "sacred",
            neighborhood: "Jongno",
            coordinates: {
              lat: 37.5744,
              lng: 126.9941,
            },
            sensory: {
              energy: "reflective",
              acoustic: "silent",
              crowd: "empty",
              texture: "Gravel paths, tall pines, a distant city hum.",
            },
            light: {
              exposure: "dappled",
              orientation: "none",
              bestWindow: "afternoon",
              note: "The pines throw long shadows across the paths by late afternoon.",
            },
            summary: "A royal shrine in a pine wood, quiet in the late afternoon.",
            aesthetic: ["old pine", "gravel"],
            reason:
              "It is a short walk away and fits the same early evening, but is a silent wood instead of a stream.",
          },
          {
            name: "Euljiro Alley by Cheonggyecheon",
            kind: "bar",
            neighborhood: "Euljiro",
            coordinates: {
              lat: 37.5668,
              lng: 126.9905,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Plastic tables out on the pavement, beer cans, people stopping after work.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "sunset",
              note: "The street lights come on as the sun goes down.",
            },
            summary: "Pavement tables open early on Friday and filling with after-work drinkers.",
            aesthetic: ["plastic tables", "neon signage"],
            reason:
              "It is a short walk from the stream and the same hour, but is a street of drinkers instead of a quiet path.",
          },
        ],
      },
      {
        stopIndex: 5,
        options: [
          {
            name: "Bibimbap and soup near Jongno 3-ga",
            kind: "food",
            neighborhood: "Jongno 3-ga",
            coordinates: {
              lat: 37.5709,
              lng: 126.9906,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "steady",
              texture: "Hot stone bowls, low talk, a steady stream of single diners.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Inside, the light is the same at any hour.",
            },
            summary:
              "Quiet rooms serving bowls and soups to single diners, a few streets from the grill alleys.",
            aesthetic: ["steel counters", "wood tables"],
            reason:
              "It stays in Jongno 3-ga at dinner time but trades the grill smoke for a quiet counter meal.",
          },
          {
            name: "Pojangmacha along Jongno 3-ga",
            kind: "bar",
            neighborhood: "Jongno 3-ga",
            coordinates: {
              lat: 37.5717,
              lng: 126.9921,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Tarp tents, plastic stools, soju bottles on every table.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Tent lamps and neon signs are the only light after dark.",
            },
            summary: "Tent bars on the street where tables fill up by eight on a Friday.",
            aesthetic: ["plastic tarp", "neon signage"],
            reason:
              "It shares the street and the hour, but is louder and drink-focused rather than a grill meal.",
          },
        ],
      },
      {
        stopIndex: 6,
        options: [
          {
            name: "Wine bars along Euljiro 3-ga",
            kind: "bar",
            neighborhood: "Euljiro",
            coordinates: {
              lat: 37.5668,
              lng: 126.9918,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "Counter seats, low music, a few people on their own.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Rooms are dimly lit by candles and small lamps.",
            },
            summary:
              "Small counter bars with seats for solo drinkers, quieter than the main alleys.",
            aesthetic: ["raw concrete", "dim lamps"],
            reason:
              "It stays in Euljiro at the same hour, but is a quiet counter rather than a crowded alley.",
          },
          {
            name: "Noraebang along Myeongdong Gil",
            kind: "bar",
            neighborhood: "Myeongdong",
            coordinates: {
              lat: 37.5632,
              lng: 126.9852,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture:
                "Private rooms, amplified singing through the walls, groups going in and out.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Rooms are lit by screens and coloured bulbs.",
            },
            summary: "Karaoke rooms that run well past midnight on a Friday.",
            aesthetic: ["neon signage", "mirrors"],
            reason:
              "It is in Myeongdong at the same hour, but swaps a quiet counter for a loud room.",
          },
        ],
      },
      {
        stopIndex: 7,
        options: [
          {
            name: "Convenience-store noodles near Myeongdong Station",
            kind: "food",
            neighborhood: "Myeongdong",
            coordinates: {
              lat: 37.5609,
              lng: 126.9863,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "Cup noodles, plastic stools by the window, a quiet street at night.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Shops are lit with bright white light all night.",
            },
            summary: "Hot-water stations and window seats for a late quiet snack, open all night.",
            aesthetic: ["fluorescent light", "plastic stools"],
            reason:
              "It is a short walk from the street food at the same late hour, but is a quiet seat instead of a standing counter.",
          },
          {
            name: "Late supper along Myeongdong Gil",
            kind: "food",
            neighborhood: "Myeongdong",
            coordinates: {
              lat: 37.5638,
              lng: 126.9849,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Grills and fryers, tourists and night workers, a busy pavement.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Shop signs light the street like day until the stalls close.",
            },
            summary:
              "Stalls and fast-food counters on the main street still serving after midnight.",
            aesthetic: ["neon signage", "steel counters"],
            reason: "It is the same street at the same hour, but livelier, with more stalls open.",
          },
        ],
      },
    ],
  },
};
