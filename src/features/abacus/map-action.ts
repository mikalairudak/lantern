import { isAreaKind, type AreaKind, type PlaceKind } from "@/lib/schema/itinerary.schema";
import type { PlaceCheck } from "@/lib/stream/place-checks";

/**
 * How an open stop's sheet sends a traveller to the place on a map, and how far the map
 * vouches for it, in the margin's "map" row (`docs/decisions.md`, "Places are checked through
 * Geoapify, not Google Places").
 *
 * The link is a Google Maps URL: it needs no key, opens the Maps app on Android, and on an
 * iPhone when Google Maps is installed, and otherwise the map in the browser, on a laptop
 * as on a phone (developers.google.com/maps/documentation/urls). Apple's map links open an
 * app only on Apple's devices, and its map in a browser names no Android browser it serves
 * (support.apple.com/120585), so on Android they may open no map at all.
 *
 * | the place's check         | a named place                      | a place to eat or drink around    |
 * | ------------------------- | ---------------------------------- | --------------------------------- |
 * | confirmed                 | "Open in Google Maps", its name    | "Directions to the area", at the  |
 * |                           | and city; how it was found         | point the check vouches for; what |
 * |                           |                                    | it is, then what is around it     |
 * | being looked up           | "Search in Google Maps", its name  | "Search in Google Maps", its name |
 * |                           | and city; checking                 | and city; what it is, checking    |
 * | not confirmed, or its     | "Search in Google Maps"; not       | "Search in Google Maps"; what it  |
 * | lookup failed             | confirmed                          | is, not confirmed                 |
 * | never checked (a day      | "Search in Google Maps"; no line   | "Search in Google Maps"; what it  |
 * | written by hand)          |                                    | is, alone                         |
 *
 * A named place is always asked for by its name and the day's city, so Google opens its
 * card, with its hours and its reviews: a bare point would open a dropped pin. Only a place
 * to eat or drink around, a stretch of places and not one, is led to by its point, and only
 * a point the check vouches for; one it doubts, or that nothing checked, is searched for as
 * a named place is. A day never checked says nothing of the map, as it knows nothing of it.
 */

export interface Point {
  lat: number;
  lng: number;
}

/** What the map is asked about: the place as the sheet names it. */
export interface MapPlace {
  name: string;
  /** Null while its kind is still to come. */
  kind: PlaceKind | null;
  /** The day's city, which a search for the place names. */
  city: string;
  /** The model's point for the place, once written. */
  point: Point | null;
}

/** The sheet's "map" row: the link, and the line under it. */
export interface MapAction {
  label: string;
  href: string;
  /** How far the map vouches for the place; null for a day never checked. */
  trust: string | null;
}

export const OPEN_IN_GOOGLE_MAPS = "Open in Google Maps";
export const SEARCH_IN_GOOGLE_MAPS = "Search in Google Maps";
export const DIRECTIONS_TO_THE_AREA = "Directions to the area";

export const FOUND_BY_NAME =
  "Location found by its name on OpenStreetMap. Opening hours haven't been checked.";
export const CHECKING = "Checking the location.";
export const NOT_CONFIRMED = "Location not confirmed.";

/** What a place to eat or drink around is, and what the check counted around its point. */
const AREA_WORDS: Record<AreaKind, { line: string; around: string }> = {
  food: { line: "An area to eat in; choose a place when you arrive.", around: "Places to eat" },
  coffee: { line: "An area for coffee; choose a café when you arrive.", around: "Cafés" },
  bar: { line: "An area for a drink; choose a bar when you arrive.", around: "Bars" },
};

const SEARCH_URL = "https://www.google.com/maps/search/";
export const DIRECTIONS_URL = "https://www.google.com/maps/dir/";
/** Six decimals: about 10 cm, as fine as any point here is given, with no float noise. */
const COORDINATE_DIGITS = 6;

/** "44.492737,11.343032": a point as a map's destination takes it. */
export function pointWords({ lat, lng }: Point): string {
  const digits = (value: number): string => String(Number(value.toFixed(COORDINATE_DIGITS)));
  return `${digits(lat)},${digits(lng)}`;
}

/** A map searched for the words. */
export function mapSearchUrlOf(query: string): string {
  return `${SEARCH_URL}?${new URLSearchParams({ api: "1", query })}`;
}

/** The way to the point, from wherever the map finds the traveller. */
export function mapDirectionsUrlOf(point: Point): string {
  return `${DIRECTIONS_URL}?${new URLSearchParams({ api: "1", destination: pointWords(point) })}`;
}

/** The point the check vouches for: the search's by its name, else the model's own. */
function confirmedPointOf(check: PlaceCheck | null, point: Point | null): Point | null {
  if (check?.state !== "confirmed") return null;
  return check.by === "name" ? check.coordinates : point;
}

/** What the check says of the place, in the line under the link; null if none ran. */
function checkWordsOf(check: PlaceCheck | null, kind: PlaceKind | null): string | null {
  if (check === null) return null;
  switch (check.state) {
    case "checking":
      return CHECKING;
    case "unconfirmed":
    case "unchecked":
      return NOT_CONFIRMED;
    case "confirmed": {
      if (check.by === "name") return FOUND_BY_NAME;
      const around = kind !== null && isAreaKind(kind) ? AREA_WORDS[kind].around : null;
      return `${around ?? "Places of its kind"} found around it on OpenStreetMap.`;
    }
  }
}

/** How the sheet sends a traveller to the place, and how far the map vouches for it. */
export function mapActionOf(place: MapPlace, check: PlaceCheck | null): MapAction {
  const checked = checkWordsOf(check, place.kind);
  const search = mapSearchUrlOf(`${place.name}, ${place.city}`);
  if (place.kind !== null && isAreaKind(place.kind)) {
    const { line } = AREA_WORDS[place.kind];
    const trust = checked === null ? line : `${line} ${checked}`;
    const confirmed = confirmedPointOf(check, place.point);
    return confirmed === null
      ? { label: SEARCH_IN_GOOGLE_MAPS, href: search, trust }
      : { label: DIRECTIONS_TO_THE_AREA, href: mapDirectionsUrlOf(confirmed), trust };
  }
  const label = check?.state === "confirmed" ? OPEN_IN_GOOGLE_MAPS : SEARCH_IN_GOOGLE_MAPS;
  return { label, href: search, trust: checked };
}
