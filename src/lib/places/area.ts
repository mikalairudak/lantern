import { z } from "zod";
import { distanceInMeters } from "@/lib/geo/distance";
import {
  WALKING_METERS_PER_MINUTE,
  type AreaKind,
  type Coordinates,
} from "@/lib/schema/itinerary.schema";
import type { LookupParams } from "./geoapify";
import { isCategoryUnder } from "./match";

/**
 * The check of a place to eat or drink around (`docs/decisions.md`, "Lantern names no
 * restaurant, café or bar"): a coffee, food or bar stop names a street, square or quarter,
 * never one venue, so it is confirmed by how many places of its kind stand within a short
 * walk of its point, asked of Geoapify's Places API, and not by its name. Both numbers below
 * are reasoned guesses that a live round calibrates.
 */

/** An area as the check reads it: its kind and its point. */
export interface AreaToCheck {
  kind: AreaKind;
  coordinates: Coordinates;
}

/**
 * How far from the area's point its places are counted: a three-minute walk at Lantern's
 * pace, 240 m. The point is the middle of a stretch, and the eating streets the decision names
 * run a few hundred metres, so a walk of three minutes either way covers the stretch and stays
 * inside its quarter. The name check found right venues up to 185 m from the model's points,
 * which is the size of the model's error this has to hold. Wider, and any city centre would
 * pass for a street to eat in.
 */
export const AREA_WALK_MINUTES = 3;
export const AREA_RADIUS_METERS = AREA_WALK_MINUTES * WALKING_METERS_PER_MINUTE;

/**
 * The fewest places of its kind that make the point a place to eat or drink around. The
 * visitor picks the door on the spot, so the area has to offer a choice, and three is the
 * fewest that is one rather than a door and its neighbour. It starts low because
 * OpenStreetMap maps some cities thinly: the name check left half of Kyoto's places
 * unconfirmed, and an area should not read unverified for the map's gaps.
 */
export const MIN_PLACES_AROUND = 3;

/**
 * How many places one lookup reads. Geoapify charges one credit a call up to 20, so 20 costs
 * what 3 would, and the count it returns beyond the threshold is what calibrates it.
 */
export const PLACES_PER_LOOKUP = 20;

/**
 * The Places API's categories each kind counts, matched as dotted prefixes:
 * "catering.restaurant" holds "catering.restaurant.portuguese". A café is any of Geoapify's
 * cafés, the tea and coffee shops among them. A meal is a restaurant, a fast-food counter,
 * where tapas, ramen and noodles are filed, or a food court, never an ice-cream stand. A bar
 * is a place to drink, never a restaurant: the name check takes a restaurant for a bar,
 * because one tapas bar is often mapped as one, but a street of restaurants is not a street
 * of bars. Narrower than the name check's own lists (`KIND_CATEGORIES` in `match.ts`), which
 * say what one named place may come back as.
 */
export const AREA_CATEGORIES: Readonly<Record<AreaKind, readonly string[]>> = {
  coffee: ["catering.cafe"],
  food: ["catering.restaurant", "catering.fast_food", "catering.food_court"],
  bar: ["catering.bar", "catering.pub", "catering.biergarten", "catering.taproom"],
};

/**
 * One Places search per area: its kind's categories inside the circle, nearest first, so a
 * full page of 20 is the 20 closest.
 */
export function areaSearchParams({ kind, coordinates }: AreaToCheck): LookupParams {
  const { lat, lng } = coordinates;
  return {
    categories: AREA_CATEGORIES[kind].join(","),
    filter: `circle:${lng},${lat},${AREA_RADIUS_METERS}`,
    bias: `proximity:${lng},${lat}`,
    limit: String(PLACES_PER_LOOKUP),
    lang: "en",
  };
}

// Loose: a feature carries much more than the count reads.
const FeatureSchema = z.object({
  properties: z.object({
    place_id: z.string(),
    lat: z.number(),
    lon: z.number(),
    categories: z.array(z.string()),
    name: z.string().optional(),
  }),
});
const FeatureCollectionSchema = z.object({ features: z.array(z.unknown()) });

type PlaceAround = z.infer<typeof FeatureSchema>["properties"];

/**
 * The places of the area's kind a Places body holds within the radius, or null when the body
 * is not a Places answer. The provider's own circle and categories already filter them; both
 * are read again so that a body for another point or another kind cannot count. A feature
 * that cannot be read is left out rather than spoil the others.
 */
function placesAround(area: AreaToCheck, body: unknown): PlaceAround[] | null {
  const collection = FeatureCollectionSchema.safeParse(body);
  if (!collection.success) return null;
  return collection.data.features.flatMap((entry) => {
    const feature = FeatureSchema.safeParse(entry);
    if (!feature.success) return [];
    const place = feature.data.properties;
    const isOfKind = place.categories.some((category) =>
      isCategoryUnder(category, AREA_CATEGORIES[area.kind]),
    );
    const meters = distanceInMeters(area.coordinates, { lat: place.lat, lng: place.lon });
    return isOfKind && meters <= AREA_RADIUS_METERS ? [place] : [];
  });
}

/** How many distinct places of the area's kind a Places body holds within the radius. */
export function placesAroundIn(area: AreaToCheck, body: unknown): number | null {
  const places = placesAround(area, body);
  return places === null ? null : new Set(places.map(({ place_id }) => place_id)).size;
}

/**
 * The names of those places, the venues a meal's words could name: a meal's check reads them
 * (`src/lib/places/venue.ts`). Empty when the body is not a Places answer.
 */
export function namesAroundIn(area: AreaToCheck, body: unknown): string[] {
  const names = (placesAround(area, body) ?? []).flatMap(({ name }) =>
    name === undefined ? [] : [name],
  );
  return [...new Set(names)];
}
