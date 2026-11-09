import { z } from "zod";
import { BROWSER_STORAGE } from "@/lib/browser-storage";
import type { DayStorage } from "./your-days";

/**
 * The visitor's caveats, kept with their day on this device (`docs/decisions.md`, "A day is written
 * to its end, and kept to be opened again"): the phrases of theirs Lantern could not plan the day
 * around, "she walks slowly", which the intake said back (`unplaced`). Kept by the day's id in the
 * log, so the day says them again however it opens here: reloaded, from the visitor's list or at
 * its link. They live as long as the day's row in the visitor's list (`your-days.ts`): they follow
 * the row to the version of the day it takes, and go when it goes, forgotten, let go or past the
 * list's length. They are the visitor's own words, so they stay in this browser: a day's record and
 * its link carry none (`docs/security.md`, "Guessing a day's link"), and the day opened on another
 * device says none. A written day served from the build keeps them on the page alone, since its
 * address is everyone's.
 */

/** Where the caveats live in the browser; a new shape takes a new key. */
export const CAVEATS_KEY = BROWSER_STORAGE.caveats.key;

const CaveatDaySchema = z.strictObject({
  /** The day's id in the log, as its answer named it. */
  id: z.string(),
  phrases: z.array(z.string()),
});

type CaveatDay = z.infer<typeof CaveatDaySchema>;

const NO_PHRASES: readonly string[] = [];

/**
 * Every day's caveats, the one kept last first. A browser that keeps nothing, a list another
 * version wrote, or one edited by hand reads as none, rather than as a page that breaks.
 */
function readCaveatDays(storage: DayStorage | null): CaveatDay[] {
  try {
    const kept = storage?.getItem(CAVEATS_KEY);
    if (!kept) return [];
    const parsed = z.array(CaveatDaySchema).safeParse(JSON.parse(kept));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/** The caveats kept for the day under this id; none for a day this device kept none of. */
export function readCaveats(storage: DayStorage | null, id: string): readonly string[] {
  return readCaveatDays(storage).find((day) => day.id === id)?.phrases ?? NO_PHRASES;
}

function written(storage: DayStorage | null, days: readonly CaveatDay[]): void {
  try {
    if (days.length === 0) storage?.removeItem(CAVEATS_KEY);
    else storage?.setItem(CAVEATS_KEY, JSON.stringify(days));
  } catch {
    // Without storage the caveats hold on the page alone.
  }
}

/**
 * Keeps a day's caveats, first in the list; a day with none is let go. A full or blocked storage
 * keeps what it had, and the day on screen still says them.
 */
export function keepCaveats(
  storage: DayStorage | null,
  id: string,
  phrases: readonly string[],
): void {
  const others = readCaveatDays(storage).filter((day) => day.id !== id);
  written(storage, phrases.length === 0 ? others : [{ id, phrases: [...phrases] }, ...others]);
}

/** Keeps only the caveats of the days the visitor's list still holds, by their ids. */
export function keepCaveatsOf(storage: DayStorage | null, ids: ReadonlySet<string>): void {
  const days = readCaveatDays(storage);
  const kept = days.filter((day) => ids.has(day.id));
  if (kept.length < days.length) written(storage, kept);
}

/** Forgets every day's caveats, as forgetting the visitor's days does. */
export function forgetCaveats(storage: DayStorage | null): void {
  try {
    storage?.removeItem(CAVEATS_KEY);
  } catch {
    // Without storage nothing was kept.
  }
}
