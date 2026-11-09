import { normalizeDay, withAssumedEndFitted, type Repair } from "@/lib/normalizer/normalize";
import { isSameSpelling } from "@/lib/places/match";
import { formatPath } from "@/lib/quality/path";
import {
  ASSUMABLE_FACT_KEYS,
  isTimeWordClash,
  ItinerarySchema,
  type AssumableFactKey,
  type DayRequest,
  type Facts,
  type GeneratedAssumptions,
  type Itinerary,
  type Stop,
} from "@/lib/schema/itinerary.schema";
import type { GeneratedReplan } from "@/lib/schema/replan.schema";
import { runningSpans } from "@/lib/time/clock";
import type { WindowSpan } from "./windows";
import { isReplannedBy, replannedIdOf, stopIndexOfId } from "@/lib/schema/positions";

/**
 * Merges a targeted re-plan into the day on the visitor's screen (`docs/targeted-replan.md`,
 * sections 3 and 4). The kept stops stay as they are, ids, versions and the visitor's swaps
 * included; the new stops are normalized as a day's are and take ids under the re-plan's own
 * prefix, so no id the page has shown is reused for another place, ids being Motion's
 * `layoutId`s. A new stop at a window stop's place and start stands for it and keeps its id and
 * place (`stayingStopOf`), the same place under the same id. A re-plan is all or nothing: one that leaves a window without a stop fails, and
 * the day stays as it was; one that drops a new stop is never shown (`mergeShownReplan`).
 * Loadable in a browser, since the reader merges on both sides.
 */

/** Under this, a new stop cut short by a kept one is not worth its row. */
export const MIN_MERGED_STOP_MINUTES = 15;

/**
 * What the merge did to the re-plan's new stops, beside the normalizer's own repairs: a stop cut
 * short at a kept one, or dropped, outside every window, with no time left before a kept stop,
 * or on a kept place; and a kept stop's version off screen given up to a new stop at its place.
 */
export interface MergeRepair {
  kind:
    | "outside-windows"
    | "shortened-at-kept"
    | "dropped-at-kept"
    | "dropped-repeat"
    | "yielded-version";
  /** The new stop, by its index in the re-plan; for a version given up, its kept stop's in the day. */
  path: (string | number)[];
  note: string;
}

export type MergeResult =
  | { ok: true; itinerary: Itinerary; repairs: Repair[]; mergeRepairs: MergeRepair[] }
  | { ok: false; reason: string; repairs: Repair[]; mergeRepairs: MergeRepair[] };

export interface MergeOptions {
  /** The day on the visitor's screen. */
  itinerary: Itinerary;
  /** The request with the changed word. */
  request: DayRequest;
  changed: AssumableFactKey;
  windows: readonly WindowSpan[];
  replan: GeneratedReplan;
  /** The page's count of re-plans, as "r2": the new ids start with it. */
  idPrefix: string;
}

/** Everything a merge reads but the re-plan itself: what the page and the server hold before it streams. */
export type ReplanBasis = Omit<MergeOptions, "replan">;

/** The merge's repairs that leave a new stop out of the day, rather than cut it short. */
const DROPS: ReadonlySet<MergeRepair["kind"]> = new Set([
  "outside-windows",
  "dropped-at-kept",
  "dropped-repeat",
]);

/** The open words the day assumed, for the normalizer, which reads a day's assumptions. */
function assumptionsOf(itinerary: Itinerary): GeneratedAssumptions {
  const entries = ASSUMABLE_FACT_KEYS.map((key) => {
    const fact = itinerary.facts[key];
    return [key, fact.source === "assumed" ? fact.value : null];
  });
  return Object.fromEntries(entries) as GeneratedAssumptions;
}

/**
 * The day's words once a re-plan merges: the kept day's, chosen or assumed, with the changed
 * word as the visitor's. The merged day's headline says them, and the re-plan's prompt reads
 * them (`replanPromptOf`), so the model is asked for the words the visitor then sees. A word the
 * changed one cannot stand beside gives way to Lantern's word that can (`isTimeWordClash`): home
 * by eight takes an early dinner, and a late dinner an end by eleven.
 */
export function replannedFactsOf({
  itinerary,
  request,
  changed,
}: Pick<ReplanBasis, "itinerary" | "request" | "changed">): Facts {
  // A key and its value of one word's vocabulary, which the types cannot pair; the merge's
  // parse of the whole day reads them.
  const facts = {
    ...itinerary.facts,
    [changed]: { value: request[changed], source: "chosen" },
  } as Facts;
  if (!isTimeWordClash(facts.dinner.value, facts.end.value)) return facts;
  return changed === "dinner"
    ? { ...facts, end: { value: "early", source: "assumed" } }
    : { ...facts, dinner: { value: "early", source: "assumed" } };
}

/**
 * Every place the kept stops hold fast, once each: each one's own, and the version on screen
 * where the visitor picked another. A new stop at one of them is dropped (`dropped-repeat`). A
 * version off screen yields to a new stop at its place instead (`yieldedTo`): the re-plan's
 * prompt names only the kept stops' places on screen, since its options, listed, read as places
 * to go, so the model cannot know a version holds a place, and the visitor never saw it there.
 */
export function keptPlaceNamesOf(itinerary: Itinerary, windows: readonly WindowSpan[]): string[] {
  const names = itinerary.stops.flatMap((stop, index) =>
    isInWindow(index, windows) ? [] : [stop.primary.name, shownPlaceOf(stop).name],
  );
  return [...new Set(names)];
}

/**
 * A kept stop with the versions off screen that a new stop's place takes given up, so the day
 * holds each place once; the same object where none is. The version on screen never yields:
 * a new stop at it is a repeat (`keptPlaceNamesOf`).
 */
export function yieldedTo(stop: Stop, newNames: readonly string[]): Stop {
  const alternatives = stop.alternatives.filter(
    (version) =>
      version.id === stop.selectedPlaceId ||
      !newNames.some((name) => isSameSpelling(name, version.name)),
  );
  return alternatives.length === stop.alternatives.length ? stop : { ...stop, alternatives };
}

/** The place a stop's row shows: the version its `selectedPlaceId` names, or else its primary. */
export function shownPlaceOf(stop: Stop): Stop["primary"] {
  return stop.alternatives.find(({ id }) => id === stop.selectedPlaceId) ?? stop.primary;
}

/**
 * The stop of a window that a new stop stands for: the place its row shows spelled the same, at
 * the same start (`docs/decisions.md`, "A changed word proposes its part beside the day, and the
 * visitor takes it"), the visitor's pick where they made one, which is the place the re-plan's
 * prompt names. The re-plan wrote the same visit again, so the day keeps it as it was rather than
 * one leaving and one landing: its id, and its place as the day showed it, its point and its check
 * with it. What the re-plan says of the stop itself, how long it is, its versions and the words it
 * depends on, is the re-plan's. `taken` are the window stops already stood for, by id, so two new
 * stops never take one.
 */
export function stayingStopOf(
  itinerary: Itinerary,
  windows: readonly WindowSpan[],
  name: string,
  startMinutes: number,
  taken: ReadonlySet<string> = new Set(),
): Stop | null {
  const spans = runningSpans(itinerary.stops);
  const index = itinerary.stops.findIndex(
    (stop, at) =>
      isInWindow(at, windows) &&
      !taken.has(stop.id) &&
      spans[at]?.from === startMinutes &&
      isSameSpelling(shownPlaceOf(stop).name, name),
  );
  return itinerary.stops[index] ?? null;
}

/** Which way a re-plan moved a stop it wrote again at its own place: to a later hour or an earlier. */
export type StopMove = "later" | "earlier";

/** A stop as `movedStopsOf` reads it, whole or still being written. */
interface TimedStop {
  id: string;
  startTime: string;
  durationMinutes: number;
  primary: { name?: string };
}

/**
 * The stops a re-plan added that are its windows' own places at another hour, by id, and which
 * way each moved. A window's old stop is read as its row showed it (`shownPlaceOf`), the
 * visitor's pick where the re-plan was asked with one, and each is matched once, by a new stop
 * spelled as it at another start, which says "later" or "earlier". A stop written again at its
 * own place and start stays (`stayingStopOf`) and keeps its own id, so it is never among them,
 * and its old stop is matched by no other; one under the prefix all the same takes its old stop
 * first and says nothing, so a second visit of the name moves from the other. `stops` are a day
 * in time order: the merged day, or the rows a re-plan's frame shows.
 */
export function movedStopsOf(
  { itinerary, windows, idPrefix }: Pick<ReplanBasis, "itinerary" | "windows" | "idPrefix">,
  stops: readonly TimedStop[],
): ReadonlyMap<string, StopMove> {
  const before = runningSpans(itinerary.stops);
  const ids = new Set(stops.map(({ id }) => id));
  const left = itinerary.stops.flatMap((stop, index) =>
    isInWindow(index, windows) && !ids.has(stop.id)
      ? [{ name: shownPlaceOf(stop).name, from: before[index]?.from ?? 0 }]
      : [],
  );
  const spans = runningSpans(stops);
  const written = stops.flatMap((stop, index) => {
    const from = spans[index]?.from;
    return isReplannedBy(idPrefix, stop.id) && from !== undefined
      ? [{ id: stop.id, name: stop.primary.name ?? "", from }]
      : [];
  });
  const take = (isMatch: (old: { name: string; from: number }) => boolean) => {
    const at = left.findIndex(isMatch);
    return at === -1 ? undefined : left.splice(at, 1)[0];
  };
  // At its own hour first, so a stop written again where it stood never takes another's turn.
  const unmoved = written.filter((stop) =>
    take((old) => old.from === stop.from && isSameSpelling(old.name, stop.name)),
  );
  const moved = new Map<string, StopMove>();
  for (const stop of written) {
    if (unmoved.includes(stop)) continue;
    const old = take(({ name }) => isSameSpelling(name, stop.name));
    if (old !== undefined) moved.set(stop.id, stop.from > old.from ? "later" : "earlier");
  }
  return moved;
}

/**
 * A staying stop's versions (`stayingStopOf`): each the re-plan wrote spelled as one of the old
 * stop's keeps that one, its id, place and check, so a version that comes back the same never
 * leaves and lands again, nor does the visitor's pick of it; the others are the re-plan's. The
 * version the row shows is the staying stop's place (`stayingPlaceOf`), so it is no version of it.
 */
export function stayingVersionsOf<Version extends { name?: string }>(
  old: Stop,
  written: readonly Version[],
): (Version | Stop["alternatives"][number])[] {
  const taken = new Set<string>([old.selectedPlaceId]);
  return written.map((version) => {
    const same = old.alternatives.find(
      (kept) => !taken.has(kept.id) && isSameSpelling(kept.name, version.name ?? ""),
    );
    if (same === undefined) return version;
    taken.add(same.id);
    return same;
  });
}

/**
 * A staying stop's place: the one its row showed, the visitor's pick where they made one, as a
 * place of the stop's own, its id, point and check kept. The re-plan wrote it as the stop's
 * place, so it is the staying stop's primary and its plan.
 */
export function stayingPlaceOf(old: Stop): Stop["primary"] {
  const picked = old.alternatives.find(({ id }) => id === old.selectedPlaceId);
  if (picked === undefined) return old.primary;
  const { reason, ...place } = picked;
  return place;
}

/**
 * A new stop standing for a window's stop (`stayingStopOf`): the old stop's id and the place its
 * row showed (`stayingPlaceOf`), with the re-plan's length, versions and dependencies, a version
 * spelled as one of the old stop's kept as it was (`stayingVersionsOf`). Its place is its plan.
 * A primary the row did not show that the re-plan writes again among the versions is one of the
 * re-plan's, under its prefix.
 */
function staying(old: Stop, stop: Stop): Stop {
  const place = stayingPlaceOf(old);
  return {
    ...stop,
    id: old.id,
    primary: place,
    alternatives: stayingVersionsOf(old, stop.alternatives),
    selectedPlaceId: place.id,
  };
}

function prefixed(stop: Stop, prefix: string): Stop {
  const id = (placeId: string): string => replannedIdOf(prefix, placeId);
  return {
    ...stop,
    id: id(stop.id),
    primary: { ...stop.primary, id: id(stop.primary.id) },
    alternatives: stop.alternatives.map((option) => ({ ...option, id: id(option.id) })),
    selectedPlaceId: id(stop.selectedPlaceId),
  };
}

/** A window's time, in minutes of the day; infinite where it runs from the day's start or to its end. */
export interface WindowBound {
  opens: number;
  closes: number;
}

/** Each window's time: from the kept stop before it ends to the next one's start. */
export function windowBoundsOf(
  itinerary: Itinerary,
  windows: readonly WindowSpan[],
): WindowBound[] {
  const spans = runningSpans(itinerary.stops);
  return windows.map(({ from, to }) => ({
    opens: spans[from - 1]?.to ?? Number.NEGATIVE_INFINITY,
    closes: spans[to + 1]?.from ?? Number.POSITIVE_INFINITY,
  }));
}

/** What the merge does with a new stop: it takes it into a window, cut short or not, or drops it. */
export type NewStopFate =
  | { kind: "taken"; window: number; durationMinutes: number; isShortened: boolean }
  | { kind: "outside-windows" | "dropped-at-kept" | "dropped-repeat" };

/**
 * What the merge does with a new stop, from its place's name and its time: one at a kept place
 * is dropped, as is one that starts outside every window, or one cut short at the next kept
 * stop to under a quarter of an hour; one that runs into the next kept stop is cut short there.
 * The page reads it of each whole stop while the re-plan streams, so it knows a re-plan lost
 * as soon as the merge would know it (`ReplanFrame.isLost`).
 */
export function newStopFateOf(
  bounds: readonly WindowBound[],
  keptNames: readonly string[],
  name: string,
  from: number,
  durationMinutes: number,
): NewStopFate {
  if (keptNames.some((kept) => isSameSpelling(kept, name))) return { kind: "dropped-repeat" };
  const window = bounds.findIndex(({ opens, closes }) => from >= opens && from < closes);
  const bound = bounds[window];
  if (bound === undefined) return { kind: "outside-windows" };
  if (from + durationMinutes <= bound.closes) {
    return { kind: "taken", window, durationMinutes, isShortened: false };
  }
  const cut = bound.closes - from;
  if (cut < MIN_MERGED_STOP_MINUTES) return { kind: "dropped-at-kept" };
  return { kind: "taken", window, durationMinutes: cut, isShortened: true };
}

/** What a merge's repair says of a new stop it drops. */
const DROP_NOTES: Readonly<Record<Exclude<NewStopFate["kind"], "taken">, (stop: Stop) => string>> =
  {
    "dropped-repeat": (stop) => `${stop.primary.name} is kept`,
    "outside-windows": (stop) => `starts at ${stop.startTime}`,
    "dropped-at-kept": () => "no time left before a kept stop",
  };

function isInWindow(index: number, windows: readonly WindowSpan[]): boolean {
  return windows.some(({ from, to }) => index >= from && index <= to);
}

export function mergeReplan({
  itinerary,
  request,
  changed,
  windows,
  replan,
  idPrefix,
}: MergeOptions): MergeResult {
  const mergeRepairs: MergeRepair[] = [];
  const normalized = normalizeDay(request, {
    dek: replan.dek,
    assumptions: assumptionsOf(itinerary),
    stops: replan.stops,
    alternatives: replan.alternatives,
  });
  if (!normalized.ok) {
    return { ok: false, reason: normalized.reason, repairs: normalized.repairs, mergeRepairs };
  }
  // The new stops alone are not the day, so an end fitted to them is no repair of it: the
  // merged day's end is fitted below, on all its stops.
  const repairs = normalized.repairs.filter(({ kind }) => kind !== "fitted-end");
  const keptNames = keptPlaceNamesOf(itinerary, windows);
  const bounds = windowBoundsOf(itinerary, windows);
  const filled = new Set<number>();
  const newStops: { stop: Stop; from: number }[] = [];
  const spans = runningSpans(normalized.itinerary.stops);
  // The window stops a new stop stands for, by id: each is stood for once.
  const stood = new Set<string>();

  normalized.itinerary.stops.forEach((stop, index) => {
    // Where the model wrote it: the normalizer's ids are the generation's positions.
    const path = ["stops", stopIndexOfId(stop.id) ?? index];
    const span = spans[index];
    if (span === undefined) return;
    const fate = newStopFateOf(
      bounds,
      keptNames,
      stop.primary.name,
      span.from,
      stop.durationMinutes,
    );
    if (fate.kind !== "taken") {
      mergeRepairs.push({ kind: fate.kind, path, note: DROP_NOTES[fate.kind](stop) });
      return;
    }
    const { window, durationMinutes } = fate;
    if (fate.isShortened) {
      mergeRepairs.push({
        kind: "shortened-at-kept",
        path,
        note: `cut to ${durationMinutes} minutes`,
      });
    }
    filled.add(window);
    const written = prefixed({ ...stop, durationMinutes }, idPrefix);
    const old = stayingStopOf(itinerary, windows, stop.primary.name, span.from, stood);
    if (old !== null) stood.add(old.id);
    newStops.push({ stop: old === null ? written : staying(old, written), from: span.from });
  });

  const empty = windows.findIndex((_, window) => !filled.has(window));
  if (empty !== -1) {
    const reason = `the re-plan left window ${empty + 1} without a stop`;
    return { ok: false, reason, repairs, mergeRepairs };
  }

  const keptSpans = runningSpans(itinerary.stops);
  const newNames = newStops.map(({ stop }) => stop.primary.name);
  const keptTimed = itinerary.stops.flatMap((stop, index) => {
    if (isInWindow(index, windows)) return [];
    const kept = yieldedTo(stop, newNames);
    stop.alternatives.forEach((version, at) => {
      if (kept.alternatives.includes(version)) return;
      const path = ["stops", index, "alternatives", at];
      mergeRepairs.push({ kind: "yielded-version", path, note: `${version.name} is a new stop` });
    });
    return [{ stop: kept, from: keptSpans[index]?.from ?? 0 }];
  });
  const stops = [...keptTimed, ...newStops].sort((a, b) => a.from - b.from).map(({ stop }) => stop);
  const merged = {
    ...itinerary,
    dek: normalized.itinerary.dek,
    // An end Lantern assumed says the one the merged day keeps, as a day's does.
    facts: withAssumedEndFitted(replannedFactsOf({ itinerary, request, changed }), stops),
    stops,
  };
  const parsed = ItinerarySchema.safeParse(merged);
  if (!parsed.success) {
    return { ok: false, reason: parsed.error.message, repairs, mergeRepairs };
  }
  // The day as merged, not the parse's copy: a kept stop stays the same object, so nothing the
  // page holds of it remounts. The schema has just read it whole.
  return { ok: true, itinerary: merged as Itinerary, repairs, mergeRepairs };
}

/**
 * The new stops the model wrote that a merge leaves out of the day, with why: the normalizer's
 * (a time, a length or a place it cannot show, or a stop out of order) and the merge's (outside
 * every window, no time left before a kept stop, a kept place), in the order they were written.
 * A merge that failed may list some before it stopped.
 */
export function droppedStopsOf({
  repairs,
  mergeRepairs,
}: Pick<MergeResult, "repairs" | "mergeRepairs">): (Repair | MergeRepair)[] {
  const dropped = [
    ...repairs.filter(({ kind }) => kind === "dropped-stop"),
    ...mergeRepairs.filter(({ kind }) => DROPS.has(kind)),
  ];
  // In the order the model wrote them: each path is ["stops", its index].
  return dropped.sort((a, b) => Number(a.path[1]) - Number(b.path[1]));
}

/**
 * The merge as the visitor is shown it (`docs/decisions.md`, "A changed word proposes its part
 * beside the day, and the visitor takes it"): one that drops a new stop fails as a whole, as one
 * that leaves a window empty does, and the day stays as it was. The line about the day is the
 * model's, written after its stops, so it may name the stop dropped, as production's Elche evening
 * named a coffee the merge had taken out; and the hours the stop held stand empty, 17:30 to 21:00
 * there. A stop cut short at a kept one is still shown. The page and the server read a re-plan's
 * outcome through this.
 */
export function mergeShownReplan(options: MergeOptions): MergeResult {
  const merged = mergeReplan(options);
  const [dropped] = droppedStopsOf(merged);
  if (!merged.ok || dropped === undefined) return merged;
  return {
    ok: false,
    reason: `the re-plan dropped ${formatPath(dropped.path)}: ${dropped.note}`,
    repairs: merged.repairs,
    mergeRepairs: merged.mergeRepairs,
  };
}
