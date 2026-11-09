import { LISBON_DAY } from "@/lib/fixtures/curated/lisbon";
import {
  isAreaKind,
  type GeneratedAlternative,
  type GeneratedDay,
  type GeneratedStop,
} from "@/lib/schema/itinerary.schema";
import type { EdgeDay } from "./edge-day";

/**
 * A place to eat or drink around, as the area kinds name it (`docs/decisions.md`, "Lantern
 * names no restaurant, café or bar", and "A place to eat is named by its food and where"):
 * what is eaten or drunk there and the street, square or quarter it is eaten in, and the
 * rest as a meal's stop says it, of the street and its food rather than one door.
 */
interface Around {
  name: string;
  summary: string;
  texture: string;
  /** For a version: what it shares with the stop's own and what it trades. */
  reason?: string;
}

/** Lisbon's lunch at one at the foot of Mouraria, and its two versions. */
const LUNCH: Around = {
  // Its name says its quarter, so its row says its meal alone.
  name: "Curry in lower Mouraria",
  summary:
    "The street at the foot of Mouraria where small rooms cook Bangladeshi and Indian food, a filling lunch at one after a morning on your feet at the market. Take the first free table.",
  texture: "Close tables, cutlery and talk, and cumin and chilli in the air from the kitchens.",
};
const QUIETER_LUNCH: Around = {
  name: "Curry on the castle slope",
  summary:
    "Dining rooms along the castle slope with the Baixa spread out below their windows, for a slower lunch two streets up from the market.",
  texture: "Low talk, cutlery, the city through the glass with no sound.",
  reason: "Curry again two streets up, at a table by the glass instead of in a full room.",
};
const LIVELIER_LUNCH: Around = {
  name: "Seafood on Almirante Reis",
  summary:
    "Big beer halls at the foot of Almirante Reis, where Saturday lunch means a queue on the pavement first.",
  texture: "Shells cracking, orders called across the tables, glasses landing hard.",
  reason: "Shellfish instead of curry, in halls louder still.",
};

/** Saturday dinner below Bairro Alto, and its two versions. */
const DINNER: Around = {
  // Its name says another quarter than its own, which its row still says.
  name: "Petiscos below Bairro Alto",
  summary:
    "Saturday dinner at the hour Lisbon eats it: tavern plates chalked on blackboards along the steep street just below Bairro Alto.",
  texture:
    "Small rooms talking over themselves, glasses, doors opening on people asking for a table.",
};
const QUIETER_DINNER: Around = {
  // Its quarter is the last word of a longer name.
  name: "Bacalhau on Largo do Chiado",
  summary:
    "Bistros around the square that take bookings, so a Saturday dinner at a quarter past eight starts on time.",
  texture: "A steady murmur, plates arriving in order, wine poured at the table.",
  reason:
    "Portuguese plates for dinner again, with room between tables instead of a crush at the door.",
};
const LIVELIER_DINNER: Around = {
  // As long as a name may run, its quarter of two words inside it.
  name: "Tinned sardines in Cais do Sodré",
  summary:
    "The pink-painted street by the river, where tinned sardines and a glass make a quick dinner as its bars start to fill.",
  texture: "Shoulder to shoulder at the tables, glasses of white wine, street noise in the door.",
  reason: "Small plates again, on the loudest street by the river instead of uphill.",
};

/** The livelier version of sunset at Santa Catarina: drinks on the roofs. */
const ROOFTOP_DRINKS: Around = {
  name: "Cocktails on the roofs",
  summary:
    "Bars on the roofs above Bairro Alto that are full well before the sun goes down on a Saturday.",
  texture: "Music over the crowd, ice in glasses, people pressing to the rail.",
};

function stopAround(stop: GeneratedStop, around: Around): GeneratedStop {
  const { place } = stop;
  return {
    ...stop,
    place: {
      ...place,
      name: around.name,
      summary: around.summary,
      sensory: { ...place.sensory, texture: around.texture },
    },
  };
}

function versionAround(version: GeneratedAlternative, around: Around): GeneratedAlternative {
  return {
    ...version,
    name: around.name,
    summary: around.summary,
    sensory: { ...version.sensory, texture: around.texture },
    reason: around.reason ?? version.reason,
  };
}

/**
 * A late supper after Bairro Alto's lanes, past midnight on the day's running clock: a meal
 * there is never the morning's breakfast. It has no versions.
 */
const LATE_SUPPER: GeneratedStop = {
  startTime: "00:30",
  durationMinutes: 30,
  place: {
    name: "Bifanas on Rua do Norte",
    kind: "food",
    neighborhood: "Bairro Alto",
    summary:
      "The counters along the lane that stay open past midnight, where a pork roll in garlic is eaten standing at the door once the bars have filled.",
    aesthetic: ["late counters", "standing room"],
    coordinates: { lat: 38.7128, lng: -9.1449 },
    sensory: {
      energy: "social",
      acoustic: "loud",
      crowd: "packed",
      texture: "Orders called over the counter, bottles on the steps, music from two bars at once.",
    },
    light: {
      exposure: "covered",
      orientation: "none",
      bestWindow: "none",
      note: "Strip lights over the counters and the street lamps; no daylight at this hour.",
    },
  },
  dependsOn: ["end"],
};

/** Lisbon's day with each place to eat or drink named by its food and where. */
function lisbonAround(): GeneratedDay {
  const { day } = LISBON_DAY;
  // By stop: its own place, then its versions in their set's order, quieter then livelier.
  const arounds: Readonly<Record<number, readonly [Around | null, Around, Around]>> = {
    2: [LUNCH, QUIETER_LUNCH, LIVELIER_LUNCH],
    4: [null, ROOFTOP_DRINKS, ROOFTOP_DRINKS],
    6: [DINNER, QUIETER_DINNER, LIVELIER_DINNER],
  };
  return {
    ...day,
    stops: [
      ...day.stops.map((stop, index) => {
        const own = arounds[index]?.[0];
        return own ? stopAround(stop, own) : stop;
      }),
      LATE_SUPPER,
    ],
    alternatives: day.alternatives.map((set) => {
      const around = arounds[set.stopIndex];
      if (!around) return set;
      return {
        ...set,
        options: set.options.map((version, at) => {
          const area = around[at + 1];
          return area && isAreaKind(version.kind) ? versionAround(version, area) : version;
        }),
      };
    }),
  };
}

/**
 * Lisbon's day with its lunch, its dinner and their versions, a rooftop's drinks and a late
 * supper past midnight, each named by its food and where: names that say their quarter,
 * once as the last word of a longer name, one that says another quarter than its own, one
 * that says none, and one as long as a name may run.
 */
export const AROUND_DAY: EdgeDay = {
  edge: "places to eat named by their food and where, and a late supper past midnight",
  request: LISBON_DAY.request,
  day: lisbonAround(),
};
