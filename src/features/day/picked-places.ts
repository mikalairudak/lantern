import { z } from "zod";
import { candidatesOf, modelPick, type Selectable } from "@/features/abacus/curve";
import { BROWSER_STORAGE, PICKED_DAYS_KEPT } from "@/lib/browser-storage";
import { isKeptSeenKey } from "./seen-days";
import type { DayStorage } from "./your-days";

/**
 * The places the visitor chose on a day, kept on this device so the day opens as they left it. For
 * each stop, the place it showed where that is not the one the day was written with: a version
 * swapped in, one a drag of the curve left, or one an energy picked again on the day moved to. The
 * energy word itself is not kept: the day opens under the word it was written for, and the
 * headline's clause says how its places differ from it.
 *
 * A day is kept by the key its seen mark uses, on purpose, so the device has one notion of a
 * day: a written day by its address and its version (`seenKeyOf`), so one rewritten in a later
 * build opens as written; a day kept on the server by its id (`keptSeenKeyOf`). A place kept
 * for a stop the day no longer has, or that is not one of its versions, is let go. Nothing of
 * it leaves the browser, and without storage the places chosen hold on the page alone.
 */

/** Where the picked places live in the browser; a new shape takes a new key. */
export const PICKED_PLACES_KEY = BROWSER_STORAGE.picks.key;

export { PICKED_DAYS_KEPT };

/** The place each stop shows in place of its written one, by the stop's id. */
export type PickedPlaces = Readonly<Record<string, string>>;

/** A stop as the picks read it: its id and its versions, the written one marked. */
type PickableStop = Selectable & { id: string };

const PickedDaySchema = z.strictObject({
  /** The day's key on this device: `seenKeyOf` or `keptSeenKeyOf`. */
  day: z.string(),
  places: z.record(z.string(), z.string()),
});

type PickedDay = z.infer<typeof PickedDaySchema>;

const NO_PICKS: PickedPlaces = {};

/**
 * Every day's picked places, the one changed last first. A browser that keeps nothing, a list
 * another version wrote, or one edited by hand reads as none, rather than as a page that breaks.
 */
function readPickedDays(storage: DayStorage | null): PickedDay[] {
  try {
    const kept = storage?.getItem(PICKED_PLACES_KEY);
    if (!kept) return [];
    const parsed = z.array(PickedDaySchema).safeParse(JSON.parse(kept));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/** The places kept for the day under this key; none for a day this device kept nothing of. */
export function readPickedPlaces(storage: DayStorage | null, day: string): PickedPlaces {
  return readPickedDays(storage).find((kept) => kept.day === day)?.places ?? NO_PICKS;
}

/**
 * Keeps the places the day shows, first in the list, which keeps `PICKED_DAYS_KEPT`; a day
 * that shows its written places again is let go. A full or blocked storage keeps what it had,
 * and the day on screen is untouched.
 */
export function keepPickedPlaces(
  storage: DayStorage | null,
  day: string,
  places: PickedPlaces,
): void {
  const others = readPickedDays(storage).filter((kept) => kept.day !== day);
  const days = Object.keys(places).length === 0 ? others : [{ day, places }, ...others];
  try {
    if (days.length === 0) storage?.removeItem(PICKED_PLACES_KEY);
    else storage?.setItem(PICKED_PLACES_KEY, JSON.stringify(days.slice(0, PICKED_DAYS_KEPT)));
  } catch {
    // Without storage the places chosen hold on the page alone.
  }
}

/**
 * Forgets the places chosen on every kept day, by its id (`isKeptSeenKey`), as forgetting the
 * visitor's days does; the places chosen on Lantern's own written days stay.
 */
export function forgetKeptPicks(storage: DayStorage | null): void {
  const written = readPickedDays(storage).filter(({ day }) => !isKeptSeenKey(day));
  try {
    if (written.length === 0) storage?.removeItem(PICKED_PLACES_KEY);
    else storage?.setItem(PICKED_PLACES_KEY, JSON.stringify(written));
  } catch {
    // Without storage nothing was kept.
  }
}

/** The place a stop was written with: the model's pick, before anything was chosen. */
function writtenPlaceOf(stop: PickableStop): string | undefined {
  return candidatesOf(stop)[modelPick(stop)]?.id;
}

/**
 * The places the stops show where they differ from the day as written, by stop id: `shown`
 * holds the index among its versions each of `stops` shows, and `written` is the day before
 * anything was chosen on it, an energy picked again included. A stop the written day does not
 * have is left out.
 */
export function departuresOf(
  written: readonly PickableStop[],
  stops: readonly PickableStop[],
  shown: readonly number[],
): PickedPlaces {
  const writtenById = new Map(written.map((stop) => [stop.id, stop]));
  return Object.fromEntries(
    stops.flatMap((stop, index) => {
      const place = candidatesOf(stop)[shown[index] ?? -1]?.id;
      const writtenStop = writtenById.get(stop.id);
      const writtenPlace = writtenStop ? writtenPlaceOf(writtenStop) : undefined;
      return place !== undefined && writtenPlace !== undefined && place !== writtenPlace
        ? [[stop.id, place]]
        : [];
    }),
  );
}

/**
 * Of the places kept for a day, those it can still show: each for a stop the day has, one of
 * that stop's versions, and not the one it was written with. Anything else was kept for a day
 * since written again, or by hand, and is let go.
 */
export function picksWithin(stops: readonly PickableStop[], places: PickedPlaces): PickedPlaces {
  return Object.fromEntries(
    stops.flatMap((stop) => {
      const place = Object.hasOwn(places, stop.id) ? places[stop.id] : undefined;
      const isVersion = candidatesOf(stop).some(({ id }) => id === place);
      return place !== undefined && isVersion && place !== writtenPlaceOf(stop)
        ? [[stop.id, place]]
        : [];
    }),
  );
}
