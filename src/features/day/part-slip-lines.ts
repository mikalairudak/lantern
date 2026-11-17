import type { StopDraft } from "@/features/abacus/day-draft";
import { kindWordOf } from "@/features/abacus/meal";
import type { ReplanWindow } from "@/features/abacus/replan-frame";
import {
  receiptOf,
  type TimedStop,
  type WorkChange,
  type WorkCounts,
  type WorkReach,
  type WorkReceipt,
} from "@/features/abacus/work-line";
import { isSameSpelling } from "@/lib/places/match";
import { formatClock, minutesOf, runningSpans, runningStart } from "@/lib/time/clock";
import type { ForkSide } from "./replan-controls";

/**
 * What a part's slip says of the other version of its part, worked out by code from the two
 * versions' stops: one line a stop, which of the version on screen's hours it would take, and
 * the fork's receipt, counted from the lines.
 * A stop the other version keeps is found by its place's spelling, as the merge finds a stop
 * written again (`stayingStopOf`), never by id: a whole day written again
 * numbers its stops from the start as the day before did. A part's hours run on the day's own
 * clock, from where the part opens, so a part after midnight is the night's, never a morning.
 */

/** "until" and its time stay on one line, as on the plan's rows. */
const NO_BREAK = "\u00a0";

/**
 * Between a line's items: the dot bound to the item before it, so a line breaks after a dot and
 * never begins with one.
 */
export const SEPARATOR = `${NO_BREAK}· `;

/** How a stop of the other version stands against the version on screen. */
export type SlipMark =
  /** At a place the part on screen does not have: what it is, until when. */
  | { kind: "new"; what: string }
  /** At a place of the part on screen, at the same hour. */
  | { kind: "stays" }
  /**
   * At a place of the part on screen, at another hour: the hour the part on screen gives it, and
   * which way the other version moves it.
   */
  | { kind: "moved"; hour: string; way: "later" | "earlier" };

/** One line of the slip: a stop of the other version, its time and its name. */
export interface SlipLine {
  id: string;
  time: string;
  name: string;
  mark: SlipMark;
}

/** A stop with its visit in minutes on the day's running clock. */
interface Timed {
  stop: StopDraft;
  name: string;
  from: number;
  to: number;
}

/** The place a stop's plan shows: its primary, or the version its plan names. */
export function shownPlaceOf(stop: StopDraft) {
  return stop.alternatives.find(({ id }) => id === stop.selectedPlaceId) ?? stop.primary;
}

/**
 * A part's stops timed on the day's running clock: the clock runs on from `opens`, where the
 * part opens, the end of the stop the day keeps before it, as the plan's rows run on from the
 * day's first stop (`runningSpans`). Null where the part starts the day.
 */
function timedOf(stops: readonly StopDraft[], opens: number | null): Timed[] {
  let previousEnd = opens;
  return stops.map((stop) => {
    const from = runningStart(minutesOf(stop.startTime), previousEnd);
    previousEnd = from + stop.durationMinutes;
    return { stop, name: shownPlaceOf(stop).name ?? "", from, to: previousEnd };
  });
}

/**
 * Pairs each of the other version's stops with the stop on screen at the same place, each
 * taken once, in the order the stream writes them: a stop takes the one at its own hour if it
 * is left, then one at another hour. A stop arriving later only takes what the earlier left, so
 * a line's mark is final once it is drawn.
 */
function pairsOf(shown: readonly Timed[], other: readonly Timed[]): Map<Timed, Timed> {
  const left = [...shown];
  const pairs = new Map<Timed, Timed>();
  for (const stop of other) {
    const places = left.filter((old) => isSameSpelling(old.name, stop.name));
    const old = places.find(({ from }) => from === stop.from) ?? places[0];
    if (old === undefined) continue;
    pairs.set(stop, old);
    left.splice(left.indexOf(old), 1);
  }
  return pairs;
}

/**
 * The slip's lines: each of the other version's stops in this part, in time order, marked new,
 * staying or moved against the part on screen. `opens` is where the part opens on the day's
 * running clock, null where it starts the day.
 */
export function slipLinesOf(
  shown: readonly StopDraft[],
  other: readonly StopDraft[],
  opens: number | null,
): SlipLine[] {
  const others = timedOf(other, opens);
  const pairs = pairsOf(timedOf(shown, opens), others);
  return others.map((timed) => {
    const { stop, name, from, to } = timed;
    const old = pairs.get(timed);
    const kind = kindWordOf(shownPlaceOf(stop).kind, from);
    const mark: SlipMark =
      old === undefined
        ? {
            kind: "new",
            what: [kind, `until${NO_BREAK}${formatClock(to)}`].filter(Boolean).join(SEPARATOR),
          }
        : old.from === from
          ? { kind: "stays" }
          : {
              kind: "moved",
              hour: formatClock(old.from),
              way: from > old.from ? "later" : "earlier",
            };
    return { id: stop.id, time: formatClock(from), name, mark };
  });
}

/**
 * What a slip's lines count against the version on screen, as the receipt says it: its new
 * lines; on a part, its moved lines by which way they moved; on a whole day, the lines at the
 * day's own places, staying or moved, as the same.
 */
export function slipCountsOf(lines: readonly SlipLine[], reach: WorkReach): WorkCounts {
  const added = lines.filter(({ mark }) => mark.kind === "new").length;
  if (reach === "whole") return { added, same: lines.length - added, later: 0, earlier: 0 };
  const ways = lines.flatMap(({ mark }) => (mark.kind === "moved" ? [mark.way] : []));
  const later = ways.filter((way) => way === "later").length;
  return { added, same: null, later, earlier: ways.length - later };
}

/** Hours as a sentence says them: "13:15", "18:15 and 20:00", "10:00, 11:15 and 12:45". */
function hoursSaid(hours: readonly string[]): string {
  if (hours.length <= 1) return hours.join("");
  return `${hours.slice(0, -1).join(", ")} and ${hours.at(-1)}`;
}

/**
 * The slip's foot: the hours of the part on screen that the other version would take, those
 * not kept at their own hour; "the whole day" for a whole day's. Null where it takes none.
 */
export function slipFootOf(
  shown: readonly StopDraft[],
  other: readonly StopDraft[],
  reach: WorkReach,
  opens: number | null,
): string | null {
  if (reach === "whole") return "in place of the whole day";
  const timed = timedOf(shown, opens);
  const kept = new Set(
    [...pairsOf(timed, timedOf(other, opens)).entries()]
      .filter(([stop, old]) => stop.from === old.from)
      .map(([, old]) => old),
  );
  const hours = timed.filter((stop) => !kept.has(stop)).map(({ from }) => formatClock(from));
  return hours.length === 0 ? null : `in place of ${hoursSaid(hours)}`;
}

/**
 * The lines a slip holds room for from the press, before the other version is known: the
 * part's own stops on screen, each as a new stop's line, so it wraps as such a line does at the
 * width the slip stands in, and for a part one more, the longest of them, as a part's proposal
 * is often a stop longer. A whole day's holds its own stops alone.
 */
export function heldLinesOf(
  shown: readonly StopDraft[],
  opens: number | null,
  reach: WorkReach,
): SlipLine[] {
  const own = slipLinesOf([], shown, opens);
  const longest = own.reduce<SlipLine | null>(
    (most, line) => (most === null || lengthOf(line) > lengthOf(most) ? line : most),
    null,
  );
  return reach === "whole" || longest === null
    ? own
    : [...own, { ...longest, id: `${longest.id}:more` }];
}

/** How many letters a line sets. */
function lengthOf({ time, name, mark }: SlipLine): number {
  return time.length + name.length + (mark.kind === "new" ? mark.what.length : 0);
}

/**
 * Each window's stops, in a version of the day: those whose visit starts inside it, as a fork
 * row finds the stop it stands over (`forkAnchorsOf`). A whole day's one window holds them all.
 */
export function partsOf<Stop extends StopDraft>(
  stops: readonly Stop[],
  windows: readonly ReplanWindow[],
): Stop[][] {
  const starts = runningSpans(stops).map(({ from }) => from);
  return windows.map(({ opens, closes }) =>
    stops.filter((_, at) => {
      const from = starts[at] ?? 0;
      return from >= (opens ?? -Infinity) && from < (closes ?? Infinity);
    }),
  );
}

/** A fork's two versions as they are drawn, and which of them stands beside the day. */
export interface DrawnFork {
  change: Pick<WorkChange, "word" | "from" | "to">;
  reach: WorkReach;
  /** The other version's answer: the proposal's, or the day before's once the proposal is taken. */
  side: ForkSide;
  /** The day on screen, and the other version, each as drawn (`asShownOf`). */
  day: readonly StopDraft[];
  other: readonly StopDraft[];
  windows: readonly ReplanWindow[];
}

/** A stop as a receipt reads it: its hours, and the kind of the place it shows. */
function timedAsShownOf(stop: StopDraft): TimedStop {
  return { ...stop, primary: shownPlaceOf(stop) };
}

/**
 * What the version beside the day would change against the day on screen, worked out from the
 * two as they are drawn, re-picked for the energy chosen with the visitor's picks on them, so it
 * says what the slips list at any energy: its counts are the slips' own lines, each part's paired
 * as its slip pairs them (`slipCountsOf`), and its hour is read from the places each version
 * shows. The day before, beside a proposal taken, says its hour alone.
 */
export function forkReceiptOf({
  change,
  reach,
  side,
  day,
  other,
  windows,
}: DrawnFork): WorkReceipt {
  const shown = partsOf(day, windows);
  const lines = partsOf(other, windows).flatMap((part, at) =>
    slipLinesOf(shown[at] ?? [], part, windows[at]?.opens ?? null),
  );
  const isProposal = side === "to";
  return receiptOf(
    { word: change.word, to: isProposal ? change.to : change.from },
    reach,
    day.map(timedAsShownOf),
    other.map(timedAsShownOf),
    isProposal ? slipCountsOf(lines, reach) : null,
  );
}
