import { z } from "zod";
import { DayRequestSchema, EnergyLevelSchema } from "@/lib/schema/itinerary.schema";
import { BROWSER_STORAGE, YOUR_DAYS_KEPT } from "@/lib/browser-storage";
import { forgetCaveats, keepCaveatsOf } from "./caveats";

/**
 * The visitor's own days (`docs/decisions.md`, "A day is written to its end, and kept to be
 * opened again"): each day Lantern wrote
 * for them, kept in their browser alone, so the start screen can list it and its address
 * can open it again. The server keeps no key of the visitor's: a day is found by its id.
 */

/** Where the list lives in the browser; a new shape takes a new key. */
export const YOUR_DAYS_KEY = BROWSER_STORAGE.days.key;

/** The most days the list keeps, newest first; an older one falls off the end. */
export { YOUR_DAYS_KEPT };

const YourDaySchema = z.strictObject({
  /** The day's id in the log, as its answer named it. */
  id: z.string(),
  request: DayRequestSchema,
  /** When it was asked for, as ISO 8601: a day not found three minutes on did not finish. */
  startedAt: z.string(),
  /** Each stop's energy as the day showed it, so far: the beads of its shape. */
  energies: z.array(EnergyLevelSchema),
  /** How it stands: still written, written, cut short with its stops kept, or no day. */
  ending: z.enum(["writing", "written", "cut", "failed"]),
  /**
   * How long it took to write, once written. No longer said anywhere: kept in the shape so the
   * lists browsers already hold still read, since a new shape takes a new key.
   */
  seconds: z.number().nullable(),
});

export type YourDay = z.infer<typeof YourDaySchema>;

/** The browser's storage as the list uses it, so a test or a private window can stand in. */
export type DayStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * The visitor's days, newest first. A browser that keeps nothing, a list another version
 * wrote, or one edited by hand reads as no days, rather than as a page that breaks.
 */
export function readYourDays(storage: DayStorage | null): YourDay[] {
  try {
    const kept = storage?.getItem(YOUR_DAYS_KEY);
    if (!kept) return [];
    const parsed = z.array(YourDaySchema).safeParse(JSON.parse(kept));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/**
 * Keeps a day, or what changed in it, first in the list: a day asked again stands at the top
 * once, and the list keeps `YOUR_DAYS_KEPT`. A browser that keeps nothing keeps nothing, and
 * the day on screen is untouched.
 */
export function keepYourDay(storage: DayStorage | null, day: YourDay): YourDay[] {
  const days = [day, ...readYourDays(storage).filter((kept) => kept.id !== day.id)].slice(
    0,
    YOUR_DAYS_KEPT,
  );
  return written(storage, days);
}

/**
 * Says how a day already in the list now stands, where it stands: told by the log after it
 * was asked, it keeps its place. A day the list does not hold is not added: a link opened
 * here is someone's day, not one this browser asked.
 */
export function restateYourDay(storage: DayStorage | null, day: YourDay): YourDay[] {
  const kept = readYourDays(storage);
  if (!kept.some((each) => each.id === day.id)) return kept;
  return written(
    storage,
    kept.map((each) => (each.id === day.id ? day : each)),
  );
}

/**
 * Forgets one day of the list: a re-plan that ended without a day, which is no day of theirs. A list that does not hold it is left as it is.
 */
export function forgetYourDay(storage: DayStorage | null, id: string): YourDay[] {
  const kept = readYourDays(storage);
  if (!kept.some((each) => each.id === id)) return kept;
  return written(
    storage,
    kept.filter((each) => each.id !== id),
  );
}

/**
 * Writes the list, and keeps only the caveats of the days it holds: a day's caveats live as long
 * as its row, so a row forgotten, let go or past `YOUR_DAYS_KEPT` takes them with it.
 */
function written(storage: DayStorage | null, days: YourDay[]): YourDay[] {
  try {
    storage?.setItem(YOUR_DAYS_KEY, JSON.stringify(days));
  } catch {
    // A full or blocked storage: the list stays as it was, and so do its caveats.
    return days;
  }
  keepCaveatsOf(storage, new Set(days.map(({ id }) => id)));
  return days;
}

/** Forgets every day in this browser's list and its caveats; the days themselves stay in the log. */
export function forgetYourDays(storage: DayStorage | null): void {
  try {
    storage?.removeItem(YOUR_DAYS_KEY);
  } catch {
    // Nothing kept, nothing to forget.
  }
  forgetCaveats(storage);
}

/** The browser's storage, or null where reading it throws, as in some private windows. */
export function browserStorage(): DayStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
