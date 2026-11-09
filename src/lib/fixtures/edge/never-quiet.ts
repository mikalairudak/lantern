import type {
  DayRequest,
  EnergyLevel,
  GeneratedAlternative,
  GeneratedDay,
  GeneratedLightProfile,
  GeneratedPlace,
  PlaceKind,
} from "@/lib/schema/itinerary.schema";
import type { EdgeDay } from "./edge-day";

/** The few facts that tell one of the day's places from another; the rest follow its energy. */
interface Sketch {
  name: string;
  kind: PlaceKind;
  neighborhood: string;
  summary: string;
  texture: string;
  aesthetic: string[];
  at: [lat: number, lng: number];
  energy: EnergyLevel;
  light?: Partial<GeneratedLightProfile>;
}

/** How loud and how full a place is at each energy, as the model writes them together. */
const SOUND_AND_CROWD: Readonly<
  Record<EnergyLevel, Pick<GeneratedPlace["sensory"], "acoustic" | "crowd">>
> = {
  reflective: { acoustic: "hushed", crowd: "sparse" },
  calm: { acoustic: "murmur", crowd: "sparse" },
  balanced: { acoustic: "chatter", crowd: "steady" },
  lively: { acoustic: "chatter", crowd: "busy" },
  social: { acoustic: "loud", crowd: "packed" },
};

const STREET_LIGHT: GeneratedLightProfile = {
  exposure: "open",
  orientation: "none",
  bestWindow: "none",
  note: "Tall buildings either side keep the street in shade for most of the day.",
};

function placeOf(sketch: Sketch): GeneratedPlace {
  return {
    name: sketch.name,
    kind: sketch.kind,
    neighborhood: sketch.neighborhood,
    summary: sketch.summary,
    aesthetic: sketch.aesthetic,
    coordinates: { lat: sketch.at[0], lng: sketch.at[1] },
    sensory: {
      energy: sketch.energy,
      ...SOUND_AND_CROWD[sketch.energy],
      texture: sketch.texture,
    },
    light: { ...STREET_LIGHT, ...sketch.light },
  };
}

function versionOf(sketch: Sketch, reason: string): GeneratedAlternative {
  return { ...placeOf(sketch), reason };
}

/**
 * A lively Saturday in New York as a live generation wrote one (a production day, rebuilt from its
 * screenshot): no stop and no version is reflective, so the scale's quietest lane stands empty from
 * top to bottom, and the model gave three stops a version at their own energy where the schema asks
 * for one quieter and one livelier, so the shown bead and a hollow one share a lane. The lunch's
 * and the last bar's twins sit beside a quieter version; the afternoon's park has its twin alone.
 */
const NEVER_QUIET: GeneratedDay = {
  assumptions: {
    travel: "on-foot",
    start: null,
    dinner: "late",
    end: "late",
    company: null,
  },
  dek: "A lively Saturday that starts with bagels on the Lower East Side, crosses Chinatown at its busiest hour, slows for books and coffee in the Village, and ends with beer on MacDougal Street.",
  stops: [
    {
      startTime: "08:00",
      durationMinutes: 45,
      place: placeOf({
        name: "Bagels on Essex Street",
        kind: "coffee",
        neighborhood: "Lower East Side",
        summary:
          "The blocks of Essex Street where bagel counters open early, a hot bagel and coffee to carry before the shops lift their shutters.",
        texture: "Toasters, paper bags folded shut, a short queue on the pavement.",
        aesthetic: ["tiled counters", "steel shutters"],
        at: [40.7203, -73.9879],
        energy: "balanced",
      }),
      dependsOn: ["start"],
    },
    {
      startTime: "09:00",
      durationMinutes: 75,
      place: placeOf({
        name: "Orchard Street",
        kind: "walk",
        neighborhood: "Lower East Side",
        summary:
          "Tenement blocks of small shops and fire escapes, the old garment street, with its stalls opening on a Saturday morning.",
        texture: "Shutters going up, music from doorways, delivery trucks idling.",
        aesthetic: ["fire escapes", "brick tenements"],
        at: [40.7187, -73.9898],
        energy: "lively",
      }),
      dependsOn: [],
    },
    {
      startTime: "10:30",
      durationMinutes: 60,
      place: placeOf({
        name: "Doyers Street",
        kind: "walk",
        neighborhood: "Chinatown",
        summary:
          "The crooked lane at the heart of old Chinatown, its one bend once the busiest corner of the quarter.",
        texture: "Footsteps on the bend, shop radios, Cantonese called between doors.",
        aesthetic: ["painted signs", "narrow lane"],
        at: [40.7143, -73.9981],
        energy: "lively",
      }),
      dependsOn: [],
    },
    {
      startTime: "12:00",
      durationMinutes: 60,
      place: placeOf({
        name: "Dumplings on Mott Street",
        kind: "food",
        neighborhood: "Chinatown",
        summary:
          "Mott Street at noon, where dumplings come by the plate or the dozen and most tables are shared.",
        texture: "Steam, plates set down hard, orders called over the street.",
        aesthetic: ["steamers", "shared tables"],
        at: [40.7148, -73.9982],
        energy: "social",
      }),
      dependsOn: ["company"],
    },
    {
      startTime: "13:30",
      durationMinutes: 90,
      place: placeOf({
        name: "Union Square Park",
        kind: "garden",
        neighborhood: "Union Square",
        summary:
          "The square where downtown meets itself on a Saturday: chess tables, skaters on the south steps, a crowd around whoever is playing.",
        texture: "Skateboards on stone, a drum circle, chess clocks slapped.",
        aesthetic: ["granite steps", "plane trees"],
        at: [40.7359, -73.9906],
        energy: "social",
        light: {
          exposure: "dappled",
          orientation: "s",
          bestWindow: "midday",
          note: "The plaza opens to the south, so the midday sun reaches the steps over the traffic.",
        },
      }),
      dependsOn: [],
    },
    {
      startTime: "15:30",
      durationMinutes: 60,
      place: placeOf({
        name: "Strand Book Store",
        kind: "shop",
        neighborhood: "East Village",
        summary:
          "Eighteen miles of books on Broadway, the dollar carts outside and three floors of used and new inside.",
        texture: "Pages turned, the creak of old floors, a till ringing now and then.",
        aesthetic: ["dollar carts", "wooden shelves"],
        at: [40.7332, -73.9907],
        energy: "balanced",
        light: {
          exposure: "interior",
          note: "Overhead light between tall shelves; the carts outside catch the afternoon.",
        },
      }),
      dependsOn: [],
    },
    {
      startTime: "17:00",
      durationMinutes: 75,
      place: placeOf({
        name: "Coffee on Bleecker Street",
        kind: "coffee",
        neighborhood: "West Village",
        summary:
          "The stretch of Bleecker where coffee counters spill onto the pavement, for a cup in the last light before dinner.",
        texture: "Milk steamed, the door swinging, talk on the benches outside.",
        aesthetic: ["sidewalk benches", "awnings"],
        at: [40.7303, -74.0027],
        energy: "lively",
        light: {
          exposure: "open",
          orientation: "w",
          bestWindow: "sunset",
          note: "Bleecker runs west here, and the low sun comes straight down it before it sets.",
        },
      }),
      dependsOn: [],
    },
    {
      startTime: "20:30",
      durationMinutes: 90,
      place: placeOf({
        name: "Pasta on Carmine Street",
        kind: "food",
        neighborhood: "West Village",
        summary:
          "Carmine Street's run of small Italian kitchens, fresh pasta and wine by the carafe at the late hour the Village eats.",
        texture: "Close tables, glasses filled, the street's talk through open doors.",
        aesthetic: ["candlelit tables", "brick walls"],
        at: [40.7299, -74.0034],
        energy: "lively",
        light: {
          exposure: "covered",
          bestWindow: "after-dark",
          note: "Candles and window light on the pavement once it is dark.",
        },
      }),
      dependsOn: ["dinner"],
    },
    {
      startTime: "22:30",
      durationMinutes: 90,
      place: placeOf({
        name: "Beer on MacDougal Street",
        kind: "bar",
        neighborhood: "Greenwich Village",
        summary:
          "MacDougal Street after ten, its basement bars and pint counters full of students and friends out late.",
        texture: "Music up the stairwells, glasses on the bars, a crowd on the steps.",
        aesthetic: ["neon signs", "basement stairs"],
        at: [40.7298, -74.0004],
        energy: "social",
        light: {
          exposure: "interior",
          bestWindow: "after-dark",
          note: "Neon in the windows and the street lamps; the street wakes after dark.",
        },
      }),
      dependsOn: ["end", "company"],
    },
  ],
  alternatives: [
    {
      stopIndex: 0,
      options: [
        versionOf(
          {
            name: "Coffee on Ludlow Street",
            kind: "coffee",
            neighborhood: "Lower East Side",
            summary: "Ludlow's quieter coffee counters a block over, with a seat by the window.",
            texture: "A grinder, low talk, the street still asleep.",
            aesthetic: ["window seats", "bare brick"],
            at: [40.7214, -73.9878],
            energy: "calm",
          },
          "Coffee a block over, with a seat instead of a bag to carry.",
        ),
        versionOf(
          {
            name: "Bagels on East Houston",
            kind: "coffee",
            neighborhood: "Lower East Side",
            summary:
              "East Houston's appetizing counters, smoked fish and bagels with a queue out the door by nine.",
            texture: "Numbers called, paper torn, the queue talking.",
            aesthetic: ["deli counters", "neon script"],
            at: [40.7226, -73.9884],
            energy: "social",
          },
          "Bagels again, with smoked fish and the morning's longest queue.",
        ),
      ],
    },
    {
      stopIndex: 1,
      options: [
        versionOf(
          {
            name: "Seward Park",
            kind: "garden",
            neighborhood: "Lower East Side",
            summary: "A small park of old plane trees and chess tables a few blocks south.",
            texture: "Pigeons, a basketball some way off, benches mostly free.",
            aesthetic: ["plane trees", "iron benches"],
            at: [40.7144, -73.9886],
            energy: "calm",
          },
          "The same blocks seen from a bench, instead of walked through.",
        ),
        versionOf(
          {
            name: "Essex Market",
            kind: "market",
            neighborhood: "Lower East Side",
            summary: "The neighbourhood's covered market, stalls of cheese, fish and spices.",
            texture: "Knives on boards, stallholders calling, a full hall.",
            aesthetic: ["market stalls", "steel and glass"],
            at: [40.7184, -73.9877],
            energy: "social",
          },
          "The neighbourhood indoors, its stalls packed on a Saturday.",
        ),
      ],
    },
    {
      stopIndex: 2,
      options: [
        versionOf(
          {
            name: "Columbus Park",
            kind: "garden",
            neighborhood: "Chinatown",
            summary:
              "Chinatown's park, where the old men play cards and Chinese chess under the trees.",
            texture: "Cards slapped on tables, low talk, an erhu now and then.",
            aesthetic: ["card tables", "old trees"],
            at: [40.7155, -74.0001],
            energy: "calm",
          },
          "Chinatown still, watched from a bench instead of walked.",
        ),
        versionOf(
          {
            name: "Canal Street",
            kind: "walk",
            neighborhood: "Chinatown",
            summary: "The quarter's loudest street, fruit stalls and traffic at every corner.",
            texture: "Horns, hawkers, the crowd moving in both directions.",
            aesthetic: ["fruit stalls", "shop awnings"],
            at: [40.7172, -73.9986],
            energy: "social",
          },
          "The same quarter on its main road, at full volume.",
        ),
      ],
    },
    {
      stopIndex: 3,
      options: [
        versionOf(
          {
            name: "Noodles on Bayard Street",
            kind: "food",
            neighborhood: "Chinatown",
            summary: "Bayard Street's hand-pulled noodle counters, a bowl a block away.",
            texture: "Dough slapped on steel, slurping, a line out the door.",
            aesthetic: ["steel counters", "steam"],
            at: [40.716, -73.9985],
            energy: "social",
          },
          "Noodles a block up, as loud, at a counter shoulder to shoulder.",
        ),
        versionOf(
          {
            name: "Dim sum on East Broadway",
            kind: "food",
            neighborhood: "Chinatown",
            summary: "East Broadway's dim sum halls, trolleys between big round tables at noon.",
            texture: "Trolleys rattling, a hall of talk, tea poured all round.",
            aesthetic: ["round tables", "trolleys"],
            at: [40.7137, -73.9945],
            energy: "social",
          },
          "Dim sum instead of dumplings, as loud and as shared.",
        ),
      ],
    },
    {
      stopIndex: 4,
      options: [
        versionOf(
          {
            name: "Union Square Greenmarket",
            kind: "market",
            neighborhood: "Union Square",
            summary:
              "The Saturday farmers' market along the square, apples and cider from upstate.",
            texture: "Crates set down, prices called, a crowd between the stalls.",
            aesthetic: ["farm stands", "canvas tents"],
            at: [40.7359, -73.9911],
            energy: "social",
          },
          "The same square at its market, as full as the park beside it.",
        ),
      ],
    },
    {
      stopIndex: 5,
      options: [
        versionOf(
          {
            name: "Grace Church",
            kind: "sacred",
            neighborhood: "Greenwich Village",
            summary:
              "A white Gothic church on Broadway a block from the books, open for a quiet look.",
            texture: "Stone hush, footsteps, the traffic gone behind the doors.",
            aesthetic: ["gothic revival", "white marble"],
            at: [40.7323, -73.9912],
            energy: "calm",
            light: {
              exposure: "interior",
              note: "Coloured glass lights the nave through the afternoon.",
            },
          },
          "A block away from the books, for an hour out of the noise.",
        ),
        versionOf(
          {
            name: "St Marks Place",
            kind: "walk",
            neighborhood: "East Village",
            summary: "The East Village's loudest block, record shops and noodle bars end to end.",
            texture: "Music from every door, a crowd on the stoops.",
            aesthetic: ["stoops", "painted shopfronts"],
            at: [40.729, -73.9876],
            energy: "social",
          },
          "The neighbourhood's busiest street instead of its biggest shop.",
        ),
      ],
    },
    {
      stopIndex: 6,
      options: [
        versionOf(
          {
            name: "Tea on Christopher Street",
            kind: "coffee",
            neighborhood: "West Village",
            summary: "The tea rooms of Christopher Street, a pot and a slow hour before dinner.",
            texture: "Kettles, quiet talk, steam on the windows.",
            aesthetic: ["teapots", "wood benches"],
            at: [40.7335, -74.0043],
            energy: "calm",
            light: {
              exposure: "interior",
              bestWindow: "after-dark",
              note: "Warm window light shows up on the street as it goes dark.",
            },
          },
          "A hot drink a few blocks away, in a quieter room than the counters.",
        ),
        versionOf(
          {
            name: "Espresso on MacDougal",
            kind: "coffee",
            neighborhood: "Greenwich Village",
            summary: "MacDougal's old espresso houses, full of talk from the afternoon on.",
            texture: "The machine hissing, a full room, chairs scraped back.",
            aesthetic: ["marble tables", "old paintings"],
            at: [40.73, -74.0006],
            energy: "social",
          },
          "Coffee again, in the Village's oldest and loudest rooms.",
        ),
      ],
    },
    {
      stopIndex: 7,
      options: [
        versionOf(
          {
            name: "Pasta on Grove Street",
            kind: "food",
            neighborhood: "West Village",
            summary:
              "The Italian kitchens of the quieter side streets, a booking and a slow dinner.",
            texture: "Low talk, cutlery, wine poured at the table.",
            aesthetic: ["linen tables", "townhouses"],
            at: [40.7333, -74.0045],
            energy: "calm",
          },
          "Pasta again on a side street, with room between tables.",
        ),
        versionOf(
          {
            name: "Pizza on Bleecker Street",
            kind: "food",
            neighborhood: "West Village",
            summary: "Bleecker's slice counters and pizzerias, eaten standing or squeezed in.",
            texture: "Ovens opening, the counter crowded, the street at the door.",
            aesthetic: ["slice counters", "tiled ovens"],
            at: [40.7299, -74.0016],
            energy: "social",
          },
          "Pizza instead of pasta, quicker and louder, a block away.",
        ),
      ],
    },
    {
      stopIndex: 8,
      options: [
        versionOf(
          {
            name: "Wine on Cornelia Street",
            kind: "bar",
            neighborhood: "West Village",
            summary: "Cornelia Street's small wine rooms, a glass and a table out of the crowd.",
            texture: "Low music, glasses touched, talk you can hear.",
            aesthetic: ["candle jars", "bare wood"],
            at: [40.7311, -74.0025],
            energy: "calm",
          },
          "A glass a few doors off, at a table instead of a crowd.",
        ),
        versionOf(
          {
            name: "Beer on Bleecker Street",
            kind: "bar",
            neighborhood: "Greenwich Village",
            summary: "Bleecker's music bars around the corner, a band most nights from ten.",
            texture: "A band through the door, pints on the bar, a packed room.",
            aesthetic: ["stage lights", "beer taps"],
            at: [40.7289, -73.999],
            energy: "social",
          },
          "Beer around the corner, with a band instead of the stairwells.",
        ),
      ],
    },
  ],
};

const NEVER_QUIET_REQUEST: DayRequest = {
  city: "New York",
  date: "2026-10-31",
  timezone: "America/New_York",
  citySource: "chosen",
  energy: "lively",
  energySource: "chosen",
  travel: null,
  start: null,
  dinner: null,
  end: null,
  company: "friends",
};

export const NEVER_QUIET_DAY: EdgeDay = {
  edge: "a lively day that is never quiet, its twins at one energy, and a lunch whose three versions share one",
  request: NEVER_QUIET_REQUEST,
  day: NEVER_QUIET,
};
