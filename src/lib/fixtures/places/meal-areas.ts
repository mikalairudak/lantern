import { LISBON_DAY } from "@/lib/fixtures/curated/lisbon";
import type { WrittenDay } from "@/lib/days/written/written-day";
import { EARTH_RADIUS_METERS } from "@/lib/geo/distance";
import type { Lookup } from "@/lib/places/geoapify";
import type {
  Coordinates,
  GeneratedAlternative,
  GeneratedPlace,
} from "@/lib/schema/itinerary.schema";

/**
 * Places to eat around, for the area check and day-v4's names (`docs/decisions.md`, "Lantern names
 * no restaurant, café or bar"). Nothing here came from a live call: the Places API's answers are
 * written by hand in the shape Geoapify documents for `GET /v2/places`, a GeoJSON FeatureCollection
 * whose features carry their id, point and categories in `properties`, and the geocoder's in the
 * shape `coverage-responses.ts` rebuilds. The businesses around each point are made up; the streets
 * and squares are Lisbon's.
 */

/** Metres per degree of latitude on the sphere `distanceInMeters` measures on. */
const METERS_PER_DEGREE = (Math.PI * EARTH_RADIUS_METERS) / 180;

/** A place the Places API would list, set by its offset from the area's point. */
interface PlaceAround {
  name: string;
  categories: readonly string[];
  metersNorth: number;
  metersEast: number;
}

function slugOf(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

/** A Places API body for the places around a point, in the order given. */
export function placesBodyAround(center: Coordinates, places: readonly PlaceAround[]): unknown {
  const metersPerDegreeEast = METERS_PER_DEGREE * Math.cos((center.lat * Math.PI) / 180);
  return {
    type: "FeatureCollection",
    features: places.map(({ name, categories, metersNorth, metersEast }) => {
      const lat = center.lat + metersNorth / METERS_PER_DEGREE;
      const lon = center.lng + metersEast / metersPerDegreeEast;
      return {
        type: "Feature",
        properties: {
          name,
          city: "Lisbon",
          country: "Portugal",
          lat,
          lon,
          categories: [...categories],
          distance: Math.round(Math.hypot(metersNorth, metersEast)),
          place_id: `hand-${slugOf(name)}`,
        },
        geometry: { type: "Point", coordinates: [lon, lat] },
      };
    }),
  };
}

const RESTAURANT = ["catering", "catering.restaurant"];
const PORTUGUESE = [...RESTAURANT, "catering.restaurant.portuguese"];
const SEAFOOD = [...RESTAURANT, "catering.restaurant.seafood"];
const CAFE = ["catering", "catering.cafe"];

/** The lanes of Mouraria where the tascas stand, at the middle of the stretch. */
export const MOURARIA: Coordinates = { lat: 38.7149, lng: -9.1349 };
export const LARGO_DO_INTENDENTE: Coordinates = { lat: 38.7213, lng: -9.1351 };
export const PORTAS_DE_SANTO_ANTAO: Coordinates = { lat: 38.7155, lng: -9.1403 };
/** Cervejaria Ramiro's door, as the curated Lisbon day gives it. */
export const RAMIRO_DOOR: Coordinates = { lat: 38.7202, lng: -9.1357 };
/** A residential corner of Campo de Ourique, where a "street of cafés" would be one café. */
export const CAMPO_DE_OURIQUE_CORNER: Coordinates = { lat: 38.7171, lng: -9.1667 };

/**
 * Six tascas within the walk, a café the food count leaves out, and a restaurant past the
 * walk that a body for a wider circle would hold.
 */
export const MOURARIA_PLACES: readonly PlaceAround[] = [
  { name: "Tasca do Largo", categories: PORTUGUESE, metersNorth: 30, metersEast: 20 },
  { name: "O Cantinho da Rua", categories: PORTUGUESE, metersNorth: -40, metersEast: 60 },
  { name: "Casa da Severa", categories: RESTAURANT, metersNorth: 80, metersEast: -30 },
  { name: "Tasca da Rua Nova", categories: PORTUGUESE, metersNorth: 120, metersEast: 40 },
  {
    name: "Sabores do Bengal",
    categories: [...RESTAURANT, "catering.restaurant.indian"],
    metersNorth: -90,
    metersEast: -70,
  },
  {
    name: "Churrasqueira do Capelão",
    categories: [...RESTAURANT, "catering.restaurant.barbecue"],
    metersNorth: 150,
    metersEast: 110,
  },
  { name: "Pastelaria Mourisca", categories: CAFE, metersNorth: 20, metersEast: -20 },
  { name: "Restaurante do Martim", categories: RESTAURANT, metersNorth: 300, metersEast: 0 },
];

const INTENDENTE_PLACES: readonly PlaceAround[] = [
  { name: "Casa do Largo", categories: PORTUGUESE, metersNorth: 10, metersEast: 40 },
  { name: "O Pátio", categories: RESTAURANT, metersNorth: -60, metersEast: 20 },
  { name: "Tasca do Intendente", categories: PORTUGUESE, metersNorth: 50, metersEast: -50 },
  { name: "Mesa da Praça", categories: RESTAURANT, metersNorth: 110, metersEast: 90 },
];

const SANTO_ANTAO_PLACES: readonly PlaceAround[] = Array.from({ length: 8 }, (_, n) => ({
  name: `Marisqueira ${n + 1}`,
  categories: SEAFOOD,
  metersNorth: 25 * n,
  metersEast: n % 2 === 0 ? 10 : -10,
}));

const RAMIRO_PLACES: readonly PlaceAround[] = [
  { name: "Cervejaria Ramiro", categories: SEAFOOD, metersNorth: 3, metersEast: 2 },
  { name: "Tasca da Almirante", categories: PORTUGUESE, metersNorth: 60, metersEast: 30 },
  { name: "O Galego", categories: RESTAURANT, metersNorth: -80, metersEast: 40 },
  { name: "Churrasco do Intendente", categories: RESTAURANT, metersNorth: 120, metersEast: -60 },
];

/** One café and the restaurants beside it: a coffee area of one door. */
const CAMPO_DE_OURIQUE_PLACES: readonly PlaceAround[] = [
  { name: "Café da Esquina", categories: CAFE, metersNorth: 15, metersEast: 10 },
  { name: "Casa de Pasto", categories: PORTUGUESE, metersNorth: -40, metersEast: 30 },
  { name: "O Prego", categories: RESTAURANT, metersNorth: 70, metersEast: -20 },
];

const SCENES: readonly { center: Coordinates; places: readonly PlaceAround[] }[] = [
  { center: MOURARIA, places: MOURARIA_PLACES },
  { center: LARGO_DO_INTENDENTE, places: INTENDENTE_PLACES },
  { center: PORTAS_DE_SANTO_ANTAO, places: SANTO_ANTAO_PLACES },
  { center: RAMIRO_DOOR, places: RAMIRO_PLACES },
  { center: CAMPO_DE_OURIQUE_CORNER, places: CAMPO_DE_OURIQUE_PLACES },
];

/**
 * Answers a Places search from the scenes above, by the circle's centre; a point they do not
 * hold fails, as a lookup can.
 */
export const searchHandWrittenPlaces: Lookup = (params) => {
  const scene = SCENES.find(({ center }) =>
    params.filter?.startsWith(`circle:${center.lng},${center.lat},`),
  );
  return Promise.resolve(
    scene === undefined
      ? { ok: false, failure: "failed" }
      : { ok: true, body: placesBodyAround(scene.center, scene.places) },
  );
};

/**
 * The geocoder's answers for a meal's name, which the name rule reads to tell a named venue
 * from an area: Cervejaria Ramiro comes back as the restaurant at its door, Mouraria as the
 * quarter.
 */
const GEOCODED: Readonly<Record<string, unknown>> = {
  "Cervejaria Ramiro, Lisbon": {
    results: [
      {
        place_id: "hand-cervejaria-ramiro",
        name: "Cervejaria Ramiro",
        lat: RAMIRO_DOOR.lat + 3 / METERS_PER_DEGREE,
        lon: RAMIRO_DOOR.lng,
        result_type: "amenity",
        category: "catering.restaurant",
      },
    ],
  },
  "Grilled fish in Mouraria, Lisbon": {
    results: [
      {
        place_id: "hand-mouraria",
        name: "Mouraria",
        lat: MOURARIA.lat + 60 / METERS_PER_DEGREE,
        lon: MOURARIA.lng,
        result_type: "suburb",
      },
    ],
  },
};

/** Answers a geocoding search for a meal's name; a name not written here fails. */
export const geocodeHandWrittenMeals: Lookup = (params) => {
  const body = params.text === undefined ? undefined : GEOCODED[params.text];
  return Promise.resolve(
    body === undefined ? { ok: false, failure: "failed" } : { ok: true, body },
  );
};

/** The lunch at one, written to day-v4: what the tascas' lanes serve, not one of their doors. */
export const MOURARIA_LUNCH: GeneratedPlace = {
  name: "Grilled fish in Mouraria",
  kind: "food",
  neighborhood: "Mouraria",
  summary:
    "Lunch in the small family tascas up these lanes starts around one: soup first, then grilled fish or the stew of the day, and the house wine by the jug, after a morning on your feet at the market.",
  aesthetic: ["paper tablecloths", "tiled walls", "cobbles"],
  coordinates: MOURARIA,
  sensory: {
    energy: "lively",
    acoustic: "chatter",
    crowd: "busy",
    texture:
      "Plates set down hard, orders called through a hatch, chairs scraped out onto the stones.",
  },
  light: {
    exposure: "open",
    orientation: "none",
    bestWindow: "none",
    note: "At midday the lanes are too narrow for the sun to reach the tables outside; indoors the lamps are on.",
  },
};

const LUNCH_OPTIONS: GeneratedAlternative[] = [
  {
    name: "Prato do dia in Intendente",
    kind: "food",
    neighborhood: "Intendente",
    summary:
      "By one the restaurants round this square have their tables out under the trees, for a slower lunch of the plate of the day and a coffee after it.",
    aesthetic: ["tiled facades", "terrace tables"],
    coordinates: LARGO_DO_INTENDENTE,
    sensory: {
      energy: "balanced",
      acoustic: "murmur",
      crowd: "steady",
      texture: "Talk across the square, cutlery on terrace tables, a tram bell from the avenue.",
    },
    light: {
      exposure: "dappled",
      orientation: "none",
      bestWindow: "none",
      note: "The midday sun is high over the open square, and the trees keep the terrace tables in shade until mid-afternoon.",
    },
    reason:
      "Lunch again a few streets north, at a terrace table on a quiet square instead of in a full lane.",
  },
  {
    name: "Seafood off Rossio",
    kind: "food",
    neighborhood: "Baixa",
    summary:
      "Seafood houses line this street off Rossio, and at one on a Saturday most are full, with waiters at the doors reading out the day's fish.",
    aesthetic: ["shellfish counters", "marble tables"],
    coordinates: PORTAS_DE_SANTO_ANTAO,
    sensory: {
      energy: "social",
      acoustic: "loud",
      crowd: "packed",
      texture:
        "Waiters calling from the doorways, shells cracked at the counters, a busker at the Rossio end.",
    },
    light: {
      exposure: "open",
      orientation: "none",
      bestWindow: "none",
      note: "Tall fronts keep the street in shade at lunch, and the counters inside are lit from above.",
    },
    reason:
      "The same lunch hour down the hill, shellfish at a loud counter instead of a stew in a small room.",
  },
];

/** The lunch's stop in the day below, Cantinho do Aziz's in the curated one. */
export const AREA_LUNCH_STOP_INDEX = 2;

/**
 * The curated lively Saturday in Lisbon with its lunch in the tascas of Mouraria, and a
 * quieter square and a livelier street of seafood houses as its options, each named as
 * day-v4 names a meal. The rest is the hand-made day's. Not one of the written days: no lab,
 * matrix or page reads it.
 */
export const AREA_LUNCH_DAY: WrittenDay = {
  request: LISBON_DAY.request,
  day: {
    ...LISBON_DAY.day,
    dek: "The Saturday flea market at Santa Clara while the blankets are full, lunch in the tascas of Mouraria at one, sunset over the river from Santa Catarina, and the lanes of Bairro Alto after dinner.",
    stops: LISBON_DAY.day.stops.map((stop, index) =>
      index === AREA_LUNCH_STOP_INDEX ? { ...stop, place: MOURARIA_LUNCH } : stop,
    ),
    alternatives: LISBON_DAY.day.alternatives.map((set) =>
      set.stopIndex === AREA_LUNCH_STOP_INDEX ? { ...set, options: LUNCH_OPTIONS } : set,
    ),
  },
};
