import type { WrittenDay } from "./written-day";
import { SEOUL_REQUEST } from "./city-days";

/**
 * Seoul, as claude-sonnet-5-5 wrote it on 2026-11-12 under day-v11 with the undated rule
 * (`EVAL_DAY_RULE`), for its own address (generation d595f0fc-06cb-4e5a-b7dd-cc69a648c97f). Kept as
 * written, letters escaped twice read as the reader reads them, so the address opens a day the
 * product really wrote, slips and all; the normalizer repairs what it repairs for any live day.
 */
export const SEOUL_DAY: WrittenDay = {
  request: SEOUL_REQUEST,
  day: {
    assumptions: {
      travel: "on-foot",
      start: "slow",
      dinner: "late",
      end: null,
      company: null,
    },
    dek: "A mid-morning start in the Bukchon lanes and the palace grounds beside them, a long afternoon through Insadong and Ikseon-dong, then dinner and drinks in Euljiro's back alleys that run past midnight.",
    stops: [
      {
        startTime: "09:45",
        durationMinutes: 45,
        place: {
          name: "Coffee on Samcheong-ro",
          kind: "coffee",
          neighborhood: "Samcheong-dong",
          coordinates: {
            lat: 37.5866,
            lng: 126.9815,
          },
          sensory: {
            energy: "calm",
            acoustic: "murmur",
            crowd: "sparse",
            texture:
              "Espresso machines through open doors, a few joggers, buses idling at the corner.",
          },
          light: {
            exposure: "open",
            orientation: "e",
            bestWindow: "morning",
            note: "The street runs north-south, so the sun comes down it in the morning and the west side stays in shade until later.",
          },
          summary:
            "Coffee shops here open around ten, and the street is still quiet before the gallery crowd arrives, so a first coffee is easy to find.",
          aesthetic: ["glass storefronts", "raw concrete"],
        },
        dependsOn: ["start"],
      },
      {
        startTime: "10:45",
        durationMinutes: 90,
        place: {
          name: "Bukchon Hanok Village",
          kind: "walk",
          neighborhood: "Bukchon",
          coordinates: {
            lat: 37.5826,
            lng: 126.9836,
          },
          sensory: {
            energy: "balanced",
            acoustic: "murmur",
            crowd: "steady",
            texture:
              "Slope underfoot, tile roofs on both sides, low voices because residents live behind the gates.",
          },
          light: {
            exposure: "open",
            orientation: "s",
            bestWindow: "morning",
            note: "Mid-morning sun reaches the lower lanes and lights the tile roofs; the upper alleys keep some shade.",
          },
          summary:
            "The lanes are quieter before the afternoon tour groups, and the uphill walk is easier before lunch.",
          aesthetic: ["grey roof tile", "timber gates", "stone walls"],
        },
        dependsOn: ["start", "travel"],
      },
      {
        startTime: "12:30",
        durationMinutes: 75,
        place: {
          name: "Mandu and noodles near Anguk Station",
          kind: "food",
          neighborhood: "Anguk",
          coordinates: {
            lat: 37.576,
            lng: 126.9855,
          },
          sensory: {
            energy: "balanced",
            acoustic: "chatter",
            crowd: "busy",
            texture:
              "Steam from kitchen doors, trays set down on metal tables, office workers at the counters.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "none",
            note: "Indoor rooms with fluorescent light, so the hour does not change much inside.",
          },
          summary:
            "Lunch hour fills these streets with local office workers, and dumplings or hot noodles are the quick, filling meal at that time.",
          aesthetic: ["steel counters", "tiled floors"],
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "14:00",
        durationMinutes: 105,
        place: {
          name: "Changdeokgung Palace and Huwon",
          kind: "garden",
          neighborhood: "Waryong-dong",
          coordinates: {
            lat: 37.5794,
            lng: 126.991,
          },
          sensory: {
            energy: "calm",
            acoustic: "hushed",
            crowd: "steady",
            texture: "Gravel paths, guide voices at the pavilions, wind in the old trees.",
          },
          light: {
            exposure: "dappled",
            orientation: "s",
            bestWindow: "afternoon",
            note: "Low afternoon sun slants through the trees and warms the pavilion walls; the rear garden stays in patchy shade.",
          },
          summary:
            "The palace is closed on Mondays and open on Fridays, and the afternoon is the time when the low sun lights the courtyard buildings and the rear garden. The rear garden is visited by guided tour only, so book it ahead or check the tour times at the ticket office.",
          aesthetic: ["painted timber eaves", "stone courtyards"],
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "16:15",
        durationMinutes: 75,
        place: {
          name: "Ikseon-dong Hanok Alleys",
          kind: "walk",
          neighborhood: "Ikseon-dong",
          coordinates: {
            lat: 37.5748,
            lng: 126.9893,
          },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture:
              "Narrow alleys, small shop doors opening onto them, people stopping every few steps.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "sunset",
            note: "Low sun reaches only the top of the alley walls, then the lanes fall into shade and the shop lights take over.",
          },
          summary:
            "The alleys fill up toward the end of the afternoon, and this is the hour when the small tea and dessert counters are open and the light on the walls turns warm.",
          aesthetic: ["low tile roofs", "narrow brick lanes"],
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "17:45",
        durationMinutes: 75,
        place: {
          name: "Insadong-gil",
          kind: "walk",
          neighborhood: "Insadong",
          coordinates: {
            lat: 37.5743,
            lng: 126.9857,
          },
          sensory: {
            energy: "balanced",
            acoustic: "chatter",
            crowd: "busy",
            texture:
              "Shop doors opening onto the street, street vendors calling, steady foot traffic.",
          },
          light: {
            exposure: "open",
            orientation: "none",
            bestWindow: "sunset",
            note: "The street lights and shop lights come on as the daylight goes, so the same lane looks different within the hour.",
          },
          summary:
            "Craft and paper shops stay open into the evening on this street, so the early evening is a good hour for browsing before dinner.",
          aesthetic: ["paper lanterns", "timber shopfronts"],
        },
        dependsOn: ["travel"],
      },
      {
        startTime: "19:15",
        durationMinutes: 60,
        place: {
          name: "Tea on Insadong-gil side alleys",
          kind: "coffee",
          neighborhood: "Insadong",
          coordinates: {
            lat: 37.5738,
            lng: 126.9862,
          },
          sensory: {
            energy: "calm",
            acoustic: "murmur",
            crowd: "steady",
            texture: "Low tables, the clink of cups, the street muffled behind the door.",
          },
          light: {
            exposure: "interior",
            orientation: "none",
            bestWindow: "after-dark",
            note: "Warm lamp light inside, so the room looks the same at any evening hour.",
          },
          summary:
            "The traditional tea rooms in the side alleys serve hot jujube and citron tea, which suits a break before a late dinner on a cold evening.",
          aesthetic: ["warm timber", "paper screens"],
        },
        dependsOn: ["dinner"],
      },
      {
        startTime: "20:45",
        durationMinutes: 100,
        place: {
          name: "Grilled pork along Euljiro 3-ga",
          kind: "food",
          neighborhood: "Euljiro",
          coordinates: {
            lat: 37.5663,
            lng: 126.9917,
          },
          sensory: {
            energy: "lively",
            acoustic: "chatter",
            crowd: "busy",
            texture: "Smoke from the grills, plastic stools, plates and glasses set down loudly.",
          },
          light: {
            exposure: "covered",
            orientation: "none",
            bestWindow: "after-dark",
            note: "Lit by signs and kitchen bulbs, so the look of the street is the same through the whole evening.",
          },
          summary:
            "The Euljiro alleys fill after eight with groups at the grills, and a late dinner here is at its busiest and best around nine.",
          aesthetic: ["tin awnings", "neon signs"],
        },
        dependsOn: ["dinner", "end"],
      },
      {
        startTime: "22:45",
        durationMinutes: 105,
        place: {
          name: "Beer along Euljiro Nogari Alley",
          kind: "bar",
          neighborhood: "Euljiro",
          coordinates: {
            lat: 37.5668,
            lng: 126.9939,
          },
          sensory: {
            energy: "social",
            acoustic: "loud",
            crowd: "packed",
            texture:
              "Plastic tables out in the alley, crates of beer, dried pollack snacks and loud talk.",
          },
          light: {
            exposure: "covered",
            orientation: "none",
            bestWindow: "after-dark",
            note: "Strings of bulbs and shop signs light the alley, with no daylight to change it after dark.",
          },
          summary:
            "The Nogari alley is at its fullest late at night, with tables out and beer with dried snacks the usual order, so it is the right place for the last hours of a late day.",
          aesthetic: ["plastic stools", "tin signs"],
        },
        dependsOn: ["end"],
      },
    ],
    alternatives: [
      {
        stopIndex: 0,
        options: [
          {
            name: "Hangang View Cafe Street at Bukchon Lane",
            kind: "coffee",
            neighborhood: "Bukchon",
            coordinates: {
              lat: 37.5847,
              lng: 126.9832,
            },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "empty",
              texture: "A few cafes behind wooden doors, quiet lanes, very little traffic.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "morning",
              note: "Morning light reaches the small front rooms through low windows.",
            },
            summary:
              "A few cafes along the lanes below Bukchon open early, and the lanes are almost empty at that hour.",
            aesthetic: ["raw timber", "white plaster"],
            reason:
              "Same neighbourhood and hour for a first coffee, trading the main street's passing buses for hushed lanes.",
          },
          {
            name: "Coffee on Samcheong-dong Gallery Street",
            kind: "coffee",
            neighborhood: "Samcheong-dong",
            coordinates: {
              lat: 37.5841,
              lng: 126.9822,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture:
                "Many cafe doors in a row, people with cups in hand, galleries opening next door.",
            },
            light: {
              exposure: "open",
              orientation: "e",
              bestWindow: "morning",
              note: "The street faces the morning sun and its terraces fill first.",
            },
            summary:
              "The row of cafes fills up as the galleries open at ten, so coffee here comes with more people and more talk.",
            aesthetic: ["glass storefronts", "painted brick"],
            reason:
              "Same street and coffee at the same hour, trading the quiet for a fuller, more social row.",
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
              lat: 37.5801,
              lng: 126.9722,
            },
            sensory: {
              energy: "calm",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Narrow lanes with small workshops, few visitors, doors left open.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "morning",
              note: "Morning sun reaches the low roofs and the lanes warm slowly.",
            },
            summary:
              "A neighbourhood of old lanes west of the palace with the same tile roofs and far fewer visitors.",
            aesthetic: ["grey roof tile", "timber gates"],
            reason:
              "Same hanok lanes and morning hour, trading the hillside views for a quieter, more lived-in neighbourhood.",
          },
          {
            name: "Gahoe-dong Alleys",
            kind: "walk",
            neighborhood: "Bukchon",
            coordinates: {
              lat: 37.5835,
              lng: 126.985,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "packed",
              texture: "Groups on the slope, cameras out, guide voices at every turn.",
            },
            light: {
              exposure: "open",
              orientation: "s",
              bestWindow: "midday",
              note: "The slope gets full sun late in the morning, and the upper lanes are lit from midday.",
            },
            summary:
              "The best-known slope of the same lanes, where the view down over the roofs is the reason people queue.",
            aesthetic: ["grey roof tile", "stone steps"],
            reason:
              "Same village and the same roofs, trading the quiet side streets for the busiest viewpoint.",
          },
        ],
      },
      {
        stopIndex: 2,
        options: [
          {
            name: "Tea and rice on Anguk side lanes",
            kind: "food",
            neighborhood: "Anguk",
            coordinates: {
              lat: 37.5772,
              lng: 126.9868,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "steady",
              texture: "Small rooms, quiet tables, rice bowls and side dishes set down one by one.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "none",
              note: "Indoor rooms with soft light, so the hour does not matter.",
            },
            summary:
              "Set-meal rooms on the lanes behind Anguk serve rice with soup and side dishes, a slower lunch than the noodle counters.",
            aesthetic: ["warm timber", "paper screens"],
            reason:
              "Same lunch hour and neighbourhood, trading the quick counters for a slower set meal.",
          },
          {
            name: "Street snacks at Gwangjang Market",
            kind: "market",
            neighborhood: "Jongno",
            coordinates: {
              lat: 37.5701,
              lng: 126.9996,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture:
                "Stalls shoulder to shoulder, mung bean pancakes on griddles, stools pulled in close.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "none",
              note: "A roofed market under strip lights, so the hour barely changes it.",
            },
            summary:
              "The lunch crowd is thickest here at midday, with pancakes and tteokbokki eaten standing or on shared stools.",
            aesthetic: ["steel stalls", "strip lighting"],
            reason:
              "Same lunch hour and street-food spirit, trading Anguk's calm for a packed, shoulder-to-shoulder market.",
          },
        ],
      },
      {
        stopIndex: 3,
        options: [
          {
            name: "Jongmyo Shrine",
            kind: "sacred",
            neighborhood: "Jongno",
            coordinates: {
              lat: 37.5744,
              lng: 126.9942,
            },
            sensory: {
              energy: "reflective",
              acoustic: "silent",
              crowd: "sparse",
              texture: "Long stone paths, a long low hall, almost no talking.",
            },
            light: {
              exposure: "open",
              orientation: "s",
              bestWindow: "afternoon",
              note: "Afternoon sun runs low along the open paved court and the hall's wooden columns.",
            },
            summary:
              "A long, quiet shrine complex with wide stone courts, open to the public only on certain days, so check the entry times before going.",
            aesthetic: ["grey stone", "painted timber"],
            reason:
              "Same royal grounds in the same afternoon, trading the garden for a still, open stone court.",
          },
          {
            name: "Changgyeonggung Palace",
            kind: "garden",
            neighborhood: "Waryong-dong",
            coordinates: {
              lat: 37.5788,
              lng: 126.9948,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Courtyards with groups, a greenhouse, ponds and paths busy with walkers.",
            },
            light: {
              exposure: "dappled",
              orientation: "s",
              bestWindow: "afternoon",
              note: "Afternoon sun reaches the pond edge and the courtyard walls.",
            },
            summary:
              "The palace next door has a pond and a glasshouse, with more local visitors than Changdeokgung in the afternoon.",
            aesthetic: ["painted timber eaves", "stone courtyards"],
            reason:
              "Same palace afternoon a short walk away, trading the guided garden for a busier pond and glasshouse.",
          },
        ],
      },
      {
        stopIndex: 4,
        options: [
          {
            name: "Tea at Ikseon-dong Courtyard Rooms",
            kind: "coffee",
            neighborhood: "Ikseon-dong",
            coordinates: {
              lat: 37.5745,
              lng: 126.9899,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "steady",
              texture: "Small courtyard rooms, low tables, cups set down quietly.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "afternoon",
              note: "Light comes in through the courtyard roof and low windows, soft at this hour.",
            },
            summary:
              "The small tea rooms in the hanok courtyards give a seat out of the alley crowd late in the afternoon.",
            aesthetic: ["warm timber", "paper screens"],
            reason: "Same alleys and hour, trading the walking crowd for a seat indoors.",
          },
          {
            name: "Dessert along Ikseon-dong Main Alley",
            kind: "food",
            neighborhood: "Ikseon-dong",
            coordinates: {
              lat: 37.5751,
              lng: 126.989,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Queues at shop doors, plates passed across counters, voices overlapping.",
            },
            light: {
              exposure: "open",
              orientation: "none",
              bestWindow: "sunset",
              note: "The alley goes into shade as the sun drops, with the shop lights taking over.",
            },
            summary:
              "The main alley's dessert counters are at their fullest in the late afternoon, with shaved ice and sweet pastries.",
            aesthetic: ["low tile roofs", "painted signs"],
            reason: "Same alleys and hour, trading the wandering for the busiest dessert row.",
          },
        ],
      },
      {
        stopIndex: 5,
        options: [
          {
            name: "Jogyesa Temple Grounds",
            kind: "sacred",
            neighborhood: "Insadong",
            coordinates: {
              lat: 37.5744,
              lng: 126.9834,
            },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "Gravel court, an old tree, prayer from the hall.",
            },
            light: {
              exposure: "open",
              orientation: "s",
              bestWindow: "sunset",
              note: "Evening light fades off the hall roof while lanterns and hall lights come on.",
            },
            summary:
              "A temple one block from the shopping street, open in the evening, with a quiet courtyard behind the main hall.",
            aesthetic: ["painted timber", "grey stone"],
            reason: "Same neighbourhood and hour, trading the shop crowds for a quiet courtyard.",
          },
          {
            name: "Street food in Insadong Ssamziegil Courtyard",
            kind: "shop",
            neighborhood: "Insadong",
            coordinates: {
              lat: 37.5741,
              lng: 126.9853,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "A spiral ramp of small shops, people on every level, snacks in hand.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Open to the sky in the middle, with shop lights on the walkway at dusk.",
            },
            summary:
              "A spiral of small craft and gift shops with snack stalls on the ramp, busier at this hour than the main street.",
            aesthetic: ["timber ramps", "painted shopfronts"],
            reason:
              "Same shopping street and hour, trading the open street for a busier covered courtyard.",
          },
        ],
      },
      {
        stopIndex: 6,
        options: [
          {
            name: "Tea at Jogyesa Gate Lane",
            kind: "coffee",
            neighborhood: "Insadong",
            coordinates: {
              lat: 37.5746,
              lng: 126.984,
            },
            sensory: {
              energy: "reflective",
              acoustic: "hushed",
              crowd: "sparse",
              texture: "A quiet lane by the temple wall, few tables, the street far off.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Lamp light inside, steady at any hour after dark.",
            },
            summary:
              "Tea rooms by the temple gate stay open into the evening and are the quietest of the tea rooms nearby.",
            aesthetic: ["warm timber", "paper screens"],
            reason:
              "Same tea at the same hour, trading the main alley for the quiet by the temple wall.",
          },
          {
            name: "Makgeolli on Insadong Back Lane",
            kind: "bar",
            neighborhood: "Insadong",
            coordinates: {
              lat: 37.5732,
              lng: 126.9862,
            },
            sensory: {
              energy: "lively",
              acoustic: "chatter",
              crowd: "busy",
              texture: "Low tables, brass kettles of rice wine, pancakes shared between friends.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Warm lamp light, unchanging through the evening.",
            },
            summary:
              "Early evening fills the rice wine rooms of the back lanes, with makgeolli and savoury pancakes at every table.",
            aesthetic: ["warm timber", "low tables"],
            reason: "Same neighbourhood and hour, trading tea for rice wine and a louder table.",
          },
        ],
      },
      {
        stopIndex: 7,
        options: [
          {
            name: "Noodles on Euljiro Alley",
            kind: "food",
            neighborhood: "Euljiro",
            coordinates: {
              lat: 37.5659,
              lng: 126.991,
            },
            sensory: {
              energy: "balanced",
              acoustic: "murmur",
              crowd: "steady",
              texture: "Small counters, bowls of hot broth, a few regulars eating alone.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Kitchen light inside, unchanging through the evening.",
            },
            summary:
              "Old noodle counters in the same alleys stay open late, and a bowl of hot broth is a quieter way to eat at this hour.",
            aesthetic: ["steel counters", "tiled floors"],
            reason: "Same alleys and hour, trading the grill smoke for a quiet counter.",
          },
          {
            name: "Chicken and beer along Euljiro Ho-Hoo Alley",
            kind: "food",
            neighborhood: "Euljiro",
            coordinates: {
              lat: 37.5666,
              lng: 126.9925,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture:
                "Fried chicken in paper trays, beer glasses clinking, groups talking over each other.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Sign light and bulbs, unchanging after dark.",
            },
            summary:
              "The beer-and-chicken stretch is at its fullest around nine, with groups at every outdoor table.",
            aesthetic: ["tin awnings", "neon signs"],
            reason: "Same alleys and hour, trading the grill for a louder, more crowded table.",
          },
        ],
      },
      {
        stopIndex: 8,
        options: [
          {
            name: "Wine on Euljiro Quiet Lane",
            kind: "bar",
            neighborhood: "Euljiro",
            coordinates: {
              lat: 37.5655,
              lng: 126.993,
            },
            sensory: {
              energy: "calm",
              acoustic: "murmur",
              crowd: "sparse",
              texture: "Small rooms behind unmarked doors, low music, few people.",
            },
            light: {
              exposure: "interior",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Dim lamp light inside, unchanging at any late hour.",
            },
            summary:
              "A few small bars tucked behind printing shops stay open late, and a quiet glass is an easier way to end the night.",
            aesthetic: ["dark timber", "brick"],
            reason: "Same alleys and hour, trading the crowded beer tables for a quiet room.",
          },
          {
            name: "Soju along Euljiro Pocha Street",
            kind: "bar",
            neighborhood: "Euljiro",
            coordinates: {
              lat: 37.5671,
              lng: 126.9948,
            },
            sensory: {
              energy: "social",
              acoustic: "loud",
              crowd: "packed",
              texture: "Tarp-covered tents, soju bottles on every table, singing from the back.",
            },
            light: {
              exposure: "covered",
              orientation: "none",
              bestWindow: "after-dark",
              note: "Tent lights and street bulbs, unchanging through the night.",
            },
            summary:
              "Tent bars on the same streets are busiest after midnight, with soju and hot soups on every table.",
            aesthetic: ["plastic tarps", "neon signs"],
            reason:
              "Same alleys and hour, trading beer on the street for the loudest tents of the night.",
          },
        ],
      },
    ],
  },
};
