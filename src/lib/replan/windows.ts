import { distanceInMeters } from "@/lib/geo/distance";
import type { KeptStop, ReplanInput, ReplanWindow } from "@/lib/live/replan-prompt";
import {
  EARLY_DINNER_BY,
  EARLY_END_BY,
  EARLY_START_AIM,
  EVENING_END_AIM,
  EVENING_END_BY,
  LATE_DINNER_FROM,
  LATE_END_AIM,
  SLOW_START_FROM,
  type AssumableFactKey,
  type DayRequest,
  type Itinerary,
  type Stop,
} from "@/lib/schema/itinerary.schema";
import { formatClock, minutesOf, runningSpans } from "@/lib/time/clock";
import { shownPlaceOf } from "./merge";

/**
 * Which stretch of a day a changed word rewrites (`docs/targeted-replan.md`, section 1), read
 * from the stops' `dependsOn`. Loadable in a browser: the page asks it which re-plan a word
 * makes before it sends one.
 */

/** The stops of one window, by their index in the itinerary, first and last included. */
export interface WindowSpan {
  from: number;
  to: number;
}

/**
 * What a changed word does to a day: rewrites its windows, writes the whole day again, or
 * changes the word alone, with no call, every stop as it was.
 */
export type ReplanPlan =
  | { kind: "targeted"; windows: WindowSpan[] }
  | { kind: "full"; reason: string }
  | { kind: "word"; reason: string };

/** Past this share of the stops, the seams cost more than the kept stops save. */
export const MAX_SHARE_REWRITTEN = 2 / 3;

function runsOf(marks: readonly boolean[]): WindowSpan[] {
  const runs: WindowSpan[] = [];
  marks.forEach((mark, index) => {
    if (!mark) return;
    const last = runs.at(-1);
    if (last !== undefined && last.to === index - 1) last.to = index;
    else runs.push({ from: index, to: index });
  });
  return runs;
}

/**
 * The room a slow morning keeps for its first stop: the hour from where a slow day may begin,
 * since the written days' first stops run 45 to 105 minutes. Stopping at 09:00 alone left
 * Kanazawa's slow morning the 15 minutes before its kept 09:15 coffee, and cut a 75-minute
 * garden to fit; a kept stop at 09:30 would have emptied the window and failed the re-plan.
 */
const SLOW_MORNING_ROOM_MINUTES = 60;

/**
 * Whether a stop must be planned again for the start word: it names it, or, for a slow start,
 * it begins in the slow morning's first hour (`SLOW_MORNING_ROOM_MINUTES`), so the window ends
 * at a kept stop from 10:00 at the earliest. The written Kyoto day names the start on its
 * 07:30 temple alone, and keeping its 08:25 walk would leave a slow morning no room before it.
 * `from` runs past midnight, so a stop after it never counts as morning.
 */
function isShapedByStart(stop: Stop, from: number, request: DayRequest): boolean {
  if (stop.dependsOn.includes("start")) return true;
  return request.start === "slow" && from < SLOW_MORNING_ENDS_MINUTES;
}

const SLOW_MORNING_ENDS_MINUTES = minutesOf(SLOW_START_FROM) + SLOW_MORNING_ROOM_MINUTES;
const EARLY_DINNER_MINUTES = minutesOf(EARLY_DINNER_BY);
const LATE_DINNER_MINUTES = minutesOf(LATE_DINNER_FROM);
/**
 * The room an evening end keeps for its last stop: the hour before eight, so a window that ends
 * the day by eight always opens early enough to hold a stop, where a kept stop over at eight would
 * leave it none.
 */
const EVENING_ROOM_MINUTES = 60;
const EVENING_ROOM_FROM = minutesOf(EVENING_END_BY) - EVENING_ROOM_MINUTES;
/**
 * The room an early end keeps for its last stop: the hour before eleven, as the evening's before
 * eight, where a kept stop over at eleven would leave it none.
 */
const EARLY_END_ROOM_MINUTES = 60;
const EARLY_END_ROOM_FROM = minutesOf(EARLY_END_BY) - EARLY_END_ROOM_MINUTES;

/** A stop's visit in minutes of the day, running past midnight (`runningSpans`). */
interface Span {
  from: number;
  to: number;
}

/** The last window, widened through each stop after it that starts before `minutes`. */
function widenedForward(windows: WindowSpan[], spans: readonly Span[], minutes: number) {
  const last = windows.at(-1);
  if (last === undefined) return windows;
  let to = last.to;
  while ((spans[to + 1]?.from ?? Number.POSITIVE_INFINITY) < minutes) to += 1;
  return [...windows.slice(0, -1), { from: last.from, to }];
}

/** The first window, widened through each stop before it that ends after `minutes`. */
function widenedBackward(windows: WindowSpan[], spans: readonly Span[], minutes: number) {
  const [first, ...rest] = windows;
  if (first === undefined) return windows;
  let from = first.from;
  while ((spans[from - 1]?.to ?? Number.NEGATIVE_INFINITY) > minutes) from -= 1;
  return [{ from, to: first.to }, ...rest];
}

/**
 * The windows widened through the kept stops that stand where the new word allows none, which
 * the merge never moves: a late dinner takes the stops after it that start before 20:30 (the
 * recorded Lisbon day's 19:00 walk after its 17:30 dinner); an early dinner, the stops before
 * it that end after 19:30; an evening end, the stops before it that end after 19:00, the hour
 * its last stop needs before eight (`EVENING_ROOM_MINUTES`), a late dinner among them; an early
 * end, the stops before it that end after 22:00, the hour before eleven (`EARLY_END_ROOM_MINUTES`).
 * Spans run past midnight, so a stop after it compares as late.
 */
function widenedForWord(
  windows: WindowSpan[],
  spans: readonly Span[],
  changed: AssumableFactKey,
  request: DayRequest,
): WindowSpan[] {
  if (changed === "dinner" && request.dinner === "late") {
    return widenedForward(windows, spans, LATE_DINNER_MINUTES);
  }
  if (changed === "dinner" && request.dinner === "early") {
    return widenedBackward(windows, spans, EARLY_DINNER_MINUTES);
  }
  if (changed === "end" && request.end === "evening") {
    return widenedBackward(windows, spans, EVENING_ROOM_FROM);
  }
  if (changed === "end" && request.end === "early") {
    return widenedBackward(windows, spans, EARLY_END_ROOM_FROM);
  }
  return windows;
}

/**
 * The windows a changed word rewrites, for the request with its new value: for the start, the
 * morning from the first stop through the last it shaped; for the end, the evening from the
 * first stop that names it through the last stop; for dinner and company, each run of stops
 * that name it (`docs/decisions.md`, "A changed word proposes its part beside the day, and the
 * visitor takes it"). A time word's are widened through the kept stops the new word leaves no room
 * for (`widenedForWord`). Travel changes the word alone, as a day is planned a walk's way across
 * whatever the travel word, and so does company where no stop names it; a time word no stop
 * names re-plans the whole day, its hours a promise, as do windows that would hold more than
 * two thirds of it.
 */
export function replanPlanOf(
  itinerary: Itinerary,
  request: DayRequest,
  changed: AssumableFactKey,
): ReplanPlan {
  if (changed === "travel") return { kind: "word", reason: "travel changes no stop" };
  const { stops } = itinerary;
  const spans = runningSpans(stops);
  const marks = stops.map((stop, index) =>
    changed === "start"
      ? isShapedByStart(stop, spans[index]?.from ?? 0, request)
      : stop.dependsOn.includes(changed),
  );
  const first = marks.indexOf(true);
  if (first === -1 && changed === "company")
    return { kind: "word", reason: "no stop names company" };
  if (first === -1) return { kind: "full", reason: `no stop names ${changed}` };
  const last = marks.lastIndexOf(true);
  const tagged =
    changed === "start"
      ? [{ from: 0, to: last }]
      : changed === "end"
        ? [{ from: first, to: stops.length - 1 }]
        : runsOf(marks);
  const windows = widenedForWord(tagged, spans, changed, request);
  const rewritten = windows.reduce((sum, { from, to }) => sum + to - from + 1, 0);
  if (rewritten / stops.length > MAX_SHARE_REWRITTEN) {
    return {
      kind: "full",
      reason: `${changed} would rewrite ${rewritten} of ${stops.length} stops`,
    };
  }
  return { kind: "targeted", windows };
}

function isInWindow(index: number, windows: readonly WindowSpan[]): boolean {
  return windows.some(({ from, to }) => index >= from && index <= to);
}

/**
 * The straight lines between kept stops that stand next to each other, as the visitor sees
 * them, added up in whole meters: a leg into or out of a window is the re-plan's to write.
 */
function keptFlowMetersOf(stops: readonly Stop[], windows: readonly WindowSpan[]): number {
  const meters = stops.reduce((sum, stop, index) => {
    const previous = stops[index - 1];
    if (previous === undefined || isInWindow(index - 1, windows) || isInWindow(index, windows)) {
      return sum;
    }
    return (
      sum + distanceInMeters(shownPlaceOf(previous).coordinates, shownPlaceOf(stop).coordinates)
    );
  }, 0);
  return Math.round(meters);
}

/**
 * The hours a window that opens or ends the day gives the re-plan, where the start or end word
 * has an aim: a number the model reaches, where an hour it works out from the word fell short,
 * a late end at 22:40 and 23:50 (`docs/harness.md`, "The prompt versions", `replan-v2` to
 * `replan-v5`). An evening end reaches for its aim as an early start does. A slow start and an
 * early end have a limit alone, which a number would read as the target, so they give none.
 */
function dayStartOf(request: DayRequest): string | null {
  return request.start === "early" ? EARLY_START_AIM : null;
}

function dayEndOf(request: DayRequest): string | null {
  if (request.end === "evening") return EVENING_END_AIM;
  return request.end === "late" ? LATE_END_AIM : null;
}

/**
 * What the re-plan reads (`replanPromptFor`): the kept stops as the visitor sees them, without
 * their lines, each window with the kept stops either side of it and the stops it held, and
 * what the kept stops already walk of the day's flow.
 */
export function replanInputOf(
  itinerary: Itinerary,
  request: DayRequest,
  changed: AssumableFactKey,
  windows: readonly WindowSpan[],
): ReplanInput {
  const { stops } = itinerary;
  const spans = runningSpans(stops);
  const kept: KeptStop[] = stops.flatMap((stop, index) => {
    if (isInWindow(index, windows)) return [];
    const place = shownPlaceOf(stop);
    return [
      {
        startTime: stop.startTime,
        durationMinutes: stop.durationMinutes,
        name: place.name,
        kind: place.kind,
        neighborhood: place.neighborhood,
        coordinates: place.coordinates,
        energy: place.sensory.energy,
      },
    ];
  });
  const windowsRead: ReplanWindow[] = windows.map(({ from, to }) => {
    const previous = stops[from - 1];
    const next = stops[to + 1];
    const previousEnd = spans[from - 1]?.to;
    const after =
      previous === undefined || previousEnd === undefined
        ? null
        : { endTime: formatClock(previousEnd), name: shownPlaceOf(previous).name };
    const before =
      next === undefined ? null : { startTime: next.startTime, name: shownPlaceOf(next).name };
    return {
      after,
      before,
      dayStartsAt: after === null ? dayStartOf(request) : null,
      dayEndsAt: before === null ? dayEndOf(request) : null,
      oldStops: stops
        .slice(from, to + 1)
        .map((stop) => ({ name: shownPlaceOf(stop).name, kind: shownPlaceOf(stop).kind })),
    };
  });
  return {
    request,
    changed,
    kept,
    windows: windowsRead,
    keptFlowMeters: keptFlowMetersOf(stops, windows),
  };
}
