import {
  type AcousticLevel,
  type CompassPoint,
  type CrowdLevel,
  type Exposure,
  type LightWindow,
  type PlaceKind,
} from "@/lib/schema/itinerary.schema";
import { formatClock, minutesOf } from "@/lib/time/clock";
import { plannedPlace } from "./curve";
import type { PlaceDraft, StopDraft } from "./day-draft";

/** Everything an open stop says about the version it shows, as plain words. */
export interface StopDetails {
  /** "11:45–13:45 · 2 h". */
  hours: string;
  /**
   * The neighbourhood, whatever the name says: the row already says what kind of place it
   * is, and leaves out a quarter its name says, so here is the one place it always stands.
   */
  neighborhood: string | null;
  /** What a swapped-in version trades against the planned one; null for the planned one. */
  swapReason: string | null;
  summary: string | null;
  sound: AcousticLevel | null;
  crowd: CrowdLevel | null;
  texture: string | null;
  /** "open sky, faces east", "indoors". */
  sky: string | null;
  /** "best at sunrise", or null when light does not matter here. */
  bestAt: string | null;
  lightNote: string | null;
  tags: readonly string[];
  /** The place's id in the day, by which its check is found. */
  placeId: string;
  /** What kind of place it is, once written: a place to eat or drink around is an area. */
  kind: PlaceKind | null;
  /** The day's city, which a search for the place on a map names. */
  city: string;
  /** The model's point for the place, once written. */
  point: { lat: number; lng: number } | null;
}

const EXPOSURE_WORDS: Record<Exposure, string> = {
  open: "open sky",
  dappled: "dappled shade",
  covered: "roofed, open sides",
  interior: "indoors",
};

const COMPASS_WORDS: Record<CompassPoint, string> = {
  n: "north",
  ne: "north-east",
  e: "east",
  se: "south-east",
  s: "south",
  sw: "south-west",
  w: "west",
  nw: "north-west",
};

const WINDOW_WORDS: Record<LightWindow, string> = {
  sunrise: "best at sunrise",
  morning: "best in the morning",
  midday: "best at midday",
  afternoon: "best in the afternoon",
  sunset: "best at sunset",
  "after-dark": "best after dark",
};

const MINUTES_PER_HOUR = 60;

/** "45 min", "2 h", "1 h 45 min". */
export function lengthOf(minutes: number): string {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** "11:45–13:45 · 2 h": the clock runs on past midnight as the next day's. */
export function visitHoursOf(stop: Pick<StopDraft, "startTime" | "durationMinutes">): string {
  const end = formatClock(minutesOf(stop.startTime) + stop.durationMinutes);
  return `${stop.startTime}–${end} · ${lengthOf(stop.durationMinutes)}`;
}

/** "open sky, faces east": how exposed the place is, and which way it looks. */
export function skyOf(place: PlaceDraft): string | null {
  const exposure = place.light?.exposure;
  if (exposure === undefined) return null;
  const orientation = place.light?.orientation;
  const facing = orientation ? `, faces ${COMPASS_WORDS[orientation]}` : "";
  return `${EXPOSURE_WORDS[exposure]}${facing}`;
}

/** What an open stop says about the version it shows, in the day's city. */
export function detailsOf(stop: StopDraft, shown: PlaceDraft, city: string): StopDetails {
  const isPlanned = shown.id === plannedPlace(stop).id;
  const reason = stop.alternatives.find((place) => place.id === shown.id)?.reason ?? null;
  const window = shown.light?.bestWindow;
  return {
    hours: visitHoursOf(stop),
    neighborhood: shown.neighborhood ?? null,
    swapReason: isPlanned ? null : reason,
    summary: shown.summary ?? null,
    sound: shown.sensory?.acoustic ?? null,
    crowd: shown.sensory?.crowd ?? null,
    texture: shown.sensory?.texture ?? null,
    sky: skyOf(shown),
    bestAt: window ? WINDOW_WORDS[window] : null,
    lightNote: shown.light?.note ?? null,
    tags: (shown.aesthetic ?? []).filter((tag): tag is string => Boolean(tag)),
    placeId: shown.id,
    kind: shown.kind ?? null,
    city,
    point: pointOf(shown.coordinates),
  };
}

/** A point whose two numbers have both arrived. */
function pointOf(coordinates: PlaceDraft["coordinates"]): { lat: number; lng: number } | null {
  const lat = coordinates?.lat;
  const lng = coordinates?.lng;
  return lat === undefined || lng === undefined ? null : { lat, lng };
}
