import { z } from "zod";
import { withoutEdgeSpace } from "@/lib/normalizer/normalize";
import type { PlaceCheck as VerifierResult } from "@/lib/places/verify-place";
import type { GeneratedPlace, Itinerary, Place } from "@/lib/schema/itinerary.schema";
import type { PartialDay } from "./outcome";
import { isStopIndexOf, optionIdOf, primaryIdOf, stopIdAt } from "@/lib/schema/positions";

/**
 * A place's check against Geoapify as the live day's stream carries it (`docs/grounding.md`):
 * a data part beside the model's text, keyed by the id the normalizer gives the place, which is
 * its position in the generation (`stop-2:p`, `stop-2:a1`), so a stop or an option the
 * normalizer drops or reorders moves no other place's mark. Loadable in a browser: the reader
 * reads these parts on the client.
 */

/** The UI message stream part that carries one place's check. */
export const PLACE_CHECK_PART = "data-place-check";

const CoordinatesSchema = z.strictObject({ lat: z.number(), lng: z.number() });

/**
 * `checking` while the lookup runs; `confirmed` by name, with the provider's point, or by
 * area, which keeps the model's; `unconfirmed` when Geoapify answered and the rule could not
 * confirm it; `unchecked` when the lookup failed, timed out or ran past the stream's close.
 */
export const PlaceCheckSchema = z.union([
  z.strictObject({ placeId: z.string(), state: z.literal("checking") }),
  z.strictObject({
    placeId: z.string(),
    state: z.literal("confirmed"),
    by: z.literal("name"),
    coordinates: CoordinatesSchema,
  }),
  z.strictObject({ placeId: z.string(), state: z.literal("confirmed"), by: z.literal("area") }),
  z.strictObject({ placeId: z.string(), state: z.literal("unconfirmed") }),
  z.strictObject({ placeId: z.string(), state: z.literal("unchecked") }),
]);

export type PlaceCheck = z.infer<typeof PlaceCheckSchema>;

/** What the verifier reads of a place, once every one of those fields is final. */
export type PlaceToVerify = Pick<GeneratedPlace, "name" | "kind" | "neighborhood" | "coordinates">;

export interface ReadyPlace {
  id: string;
  place: PlaceToVerify;
}

type PartialPlace = NonNullable<NonNullable<PartialDay["stops"]>[number]>["place"];

/**
 * A place whose name, kind, neighbourhood and coordinates are final: the field after its
 * coordinates, its sensory profile, has begun, as a partial's value is final only once the
 * next field has started.
 */
function finalPlaceOf(place: PartialPlace): PlaceToVerify | null {
  if (place?.sensory === undefined) return null;
  const { name, kind, neighborhood, coordinates } = place;
  const lat = coordinates?.lat;
  const lng = coordinates?.lng;
  if (name === undefined || kind === undefined || neighborhood === undefined) return null;
  if (lat === undefined || lng === undefined) return null;
  // Trimmed as the normalizer trims it, so the name checked is the name shown.
  return {
    name: withoutEdgeSpace(name),
    kind,
    neighborhood: withoutEdgeSpace(neighborhood),
    coordinates: { lat, lng },
  };
}

/**
 * The places of a partial day that are ready to check and not yet in `seen`, keyed by the ids
 * the normalizer and the client's drafts give them. An option counts only in the first set
 * that names its stop, as the normalizer keeps only that one, and only for a stop that exists.
 */
export function readyPlacesIn(day: PartialDay, seen: ReadonlySet<string>): ReadyPlace[] {
  const stops = day.stops ?? [];
  const fromStops = stops.flatMap((stop, index): ReadyPlace[] => {
    const place = finalPlaceOf(stop?.place);
    return place === null ? [] : [{ id: primaryIdOf(stopIdAt(index)), place }];
  });
  const claimed = new Set<number>();
  const fromOptions = (day.alternatives ?? []).flatMap((set): ReadyPlace[] => {
    const stopIndex = set?.stopIndex;
    // The stop index is final once its options have begun.
    if (set?.options === undefined || stopIndex === undefined) return [];
    if (!isStopIndexOf(stopIndex, stops.length)) return [];
    if (claimed.has(stopIndex)) return [];
    claimed.add(stopIndex);
    return set.options.flatMap((option, n): ReadyPlace[] => {
      const place = finalPlaceOf(option);
      return place === null ? [] : [{ id: optionIdOf(stopIdAt(stopIndex), n), place }];
    });
  });
  return [...fromStops, ...fromOptions].filter(({ id }) => !seen.has(id));
}

/**
 * The finished day with each place confirmed by name at the provider's point rather than the
 * model's (`docs/grounding.md`, "Where the coordinates come from"); every other place, a meal
 * confirmed by its area among them, keeps the model's.
 */
export function withProviderPoints(
  itinerary: Itinerary,
  checks: ReadonlyMap<string, PlaceCheck>,
): Itinerary {
  const pointOf = (place: Place): Place["coordinates"] | null => {
    const check = checks.get(place.id);
    return check?.state === "confirmed" && check.by === "name" ? check.coordinates : null;
  };
  const placed = <T extends Place>(place: T): T => {
    const point = pointOf(place);
    return point === null ? place : { ...place, coordinates: point };
  };
  const isMoved = (stop: Itinerary["stops"][number]): boolean =>
    [stop.primary, ...stop.alternatives].some((place) => pointOf(place) !== null);
  // A day with nothing to move is the same object, so nothing that holds it remounts.
  if (!itinerary.stops.some(isMoved)) return itinerary;
  return {
    ...itinerary,
    stops: itinerary.stops.map((stop) =>
      isMoved(stop)
        ? { ...stop, primary: placed(stop.primary), alternatives: stop.alternatives.map(placed) }
        : stop,
    ),
  };
}

/** What a place's check becomes in the stream: the verifier's answer, or why there is none. */
export function placeCheckOf(placeId: string, result: VerifierResult): PlaceCheck {
  if (result.kind === "verified") {
    return result.by === "name"
      ? {
          placeId,
          state: "confirmed",
          by: "name",
          coordinates: { lat: result.lat, lng: result.lng },
        }
      : { placeId, state: "confirmed", by: "area" };
  }
  const answered = result.reason === "no-match" || result.reason === "too-few-places";
  return { placeId, state: answered ? "unconfirmed" : "unchecked" };
}
