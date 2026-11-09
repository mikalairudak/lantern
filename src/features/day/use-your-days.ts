"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { DayOutcome, PartialDay } from "@/lib/stream/outcome";
import type { EnergyLevel } from "@/lib/schema/itinerary.schema";
import { shownEnergiesOf } from "./day-shape";
import { KEPT_WAIT_MS, askKeptDay, restatedYourDayOf } from "./kept-day";
import { forgetKeptPicks } from "./picked-places";
import { forgetKeptSeen } from "./seen-days";
import {
  YOUR_DAYS_KEY,
  browserStorage,
  forgetYourDay,
  forgetYourDays,
  keepYourDay,
  readYourDays,
  restateYourDay,
  type YourDay,
} from "./your-days";

/** No days: the server's, and a browser's before it has read its own. */
const NO_DAYS: readonly YourDay[] = [];

const listeners = new Set<() => void>();
let readText: string | null | undefined;
let readDays: readonly YourDay[] = NO_DAYS;

/** The list as stored now, read again only when its text has changed. */
function snapshot(): readonly YourDay[] {
  let text: string | null = null;
  try {
    text = browserStorage()?.getItem(YOUR_DAYS_KEY) ?? null;
  } catch {
    text = null;
  }
  if (text !== readText) {
    readText = text;
    readDays = text === null ? NO_DAYS : readYourDays(browserStorage());
  }
  return readDays;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab keeping or forgetting a day.
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === YOUR_DAYS_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function told(): void {
  for (const listener of listeners) listener();
}

/**
 * The visitor's days as this browser keeps them, newest first: none on the server and in
 * the first frame, then the browser's own, so the page hydrates as the server drew it.
 */
export function useYourDays(): readonly YourDay[] {
  return useSyncExternalStore(subscribe, snapshot, () => NO_DAYS);
}

/** Keeps a day, or what changed in it, and tells every list on the page. */
export function keepDay(day: YourDay): void {
  keepYourDay(browserStorage(), day);
  told();
}

/** Says how a day already in the list now stands, in its place, and tells every list on the page. */
export function restateDay(day: YourDay): void {
  restateYourDay(browserStorage(), day);
  told();
}

/**
 * Asks the log once a page how each day the list still holds as being written now stands,
 * but the one this page is writing (`writingHere`): a day left while it was written is
 * written on by the server, so its row says how it ended rather than "writing" for good.
 */
export function useDaysAskedAgain(days: readonly YourDay[], writingHere: string | null): void {
  // A day is asked about until the log has answered for it: a read stopped as the list
  // changed, or one that failed, is asked again with the list as it now stands.
  const answered = useRef(new Set<string>());
  useEffect(() => {
    const controller = new AbortController();
    for (const day of days) {
      // Ended, or told by the stream this page is writing it from.
      const isToldHere = day.ending !== "writing" || day.id === writingHere;
      if (isToldHere || answered.current.has(day.id)) continue;
      void askKeptDay(day.id, controller.signal).then((stored) => {
        if (stored === null || controller.signal.aborted) return;
        const isOverdue = Date.now() - Date.parse(day.startedAt) > KEPT_WAIT_MS;
        // A record not found yet, within the wait, is asked about again with the list.
        if (stored.status !== "unknown" || isOverdue) answered.current.add(day.id);
        const restated = restatedYourDayOf(day, stored, isOverdue);
        if (restated !== day) restateDay(restated);
      });
    }
    return () => controller.abort();
  }, [days, writingHere]);
}

/** How many times this page has forgotten the visitor's days, which the day on screen reads. */
let forgets = 0;

/**
 * How many times this page has forgotten the visitor's days: none on the server and in the
 * first frame. The day on screen keeps nothing it was asked with before the last of them.
 */
export function useForgetCount(): number {
  return useSyncExternalStore(
    subscribe,
    () => forgets,
    () => 0,
  );
}

/** Forgets one day of the list, a re-plan let go, and tells every list on the page. */
export function forgetDay(id: string): void {
  forgetYourDay(browserStorage(), id);
  told();
}

/**
 * Forgets every day in this browser, and all it kept of each: whether it was watched to its
 * end, the places chosen on it and its caveats, for every day the log keeps (`forgetKeptSeen`).
 * Then tells every list on the page.
 */
export function forgetDays(): void {
  const storage = browserStorage();
  forgetYourDays(storage);
  forgetKeptSeen();
  forgetKeptPicks(storage);
  forgets += 1;
  told();
}

/** The energy of each stop that has arrived whole enough to have one, in the day's order. */
export function energiesSoFarOf(partial: PartialDay | null): EnergyLevel[] {
  return (partial?.stops ?? []).flatMap((stop) => {
    const energy = stop?.place?.sensory?.energy;
    return energy ? [energy] : [];
  });
}

/** How a day stands for the list, from how its stream stands. */
export function endingOf(outcome: DayOutcome | null): YourDay["ending"] {
  if (outcome === null) return "writing";
  if (outcome.kind === "complete") return "written";
  const kept = outcome.kind === "cut" || outcome.kind === "disconnected" ? outcome.itinerary : null;
  return kept ? "cut" : "failed";
}

/** The shape a finished day shows, or the stops that have arrived while it is written. */
export function energiesOfDay(
  partial: PartialDay | null,
  outcome: DayOutcome | null,
): EnergyLevel[] {
  if (outcome?.kind === "complete") return shownEnergiesOf(outcome.itinerary);
  return energiesSoFarOf(partial);
}
