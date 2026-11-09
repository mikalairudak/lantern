import type { DeepPartial } from "ai";
import {
  keptPlaceNamesOf,
  newStopFateOf,
  stayingStopOf,
  windowBoundsOf,
  type ReplanBasis,
} from "@/lib/replan/merge";
import type { WindowSpan } from "@/lib/replan/windows";
import type { Itinerary, Stop } from "@/lib/schema/itinerary.schema";
import type { GeneratedReplan } from "@/lib/schema/replan.schema";
import type { DayOutcome } from "@/lib/stream/outcome";
import { runningSpans } from "@/lib/time/clock";
import { alternativesOf, placedStopsOf, type StopDraft } from "./day-draft";
import { isReplannedBy, replannedIdOf, stopIdAt } from "@/lib/schema/positions";

/**
 * A re-plan drawn beside the day (`docs/decisions.md`, "A changed word proposes its part beside
 * the day, and the visitor takes it"): one list of rows, the day's own and the proposal's, by
 * the minute each wire stands at. The day's rows stay the day's, as they were, the stops the
 * proposal would replace among them; the proposal's stops come in as each is whole, as the
 * normalizer orders it and the merge places it, so a row keeps its time and length when the
 * proposal is taken. A new stop at an old one's place and start is the old one written again
 * (`stayingStopOf`): one row, shared by both paths. Every id is the one the merged day gives it,
 * so taking the proposal changes no row's id.
 */

/** A row of the day while a re-plan is drawn beside it. */
export type ReplanRow =
  /** A stop outside every window: both versions share it. */
  | { source: "kept"; stop: Stop }
  /** One of the day's own stops the proposal would replace: the day's while it stands. */
  | { source: "replaced"; stop: Stop }
  /**
   * The proposal's stop, as far as written; whole once the stream has moved past it. Its
   * versions are written once their set is whole (`hasVersions`), none before.
   */
  | { source: "proposed"; stop: StopDraft; isWhole: boolean; hasVersions: boolean }
  /**
   * One of the day's window stops the proposal writes again at its place and start: one row,
   * drawn as the day's own (`was`), on both paths. `stop` is as the merged day will keep it
   * (`stayingStopOf`), its length, versions and dependencies the new stop's.
   */
  | { source: "stays"; stop: StopDraft; was: Stop; hasVersions: boolean };

/** A window in minutes of the day; null where it runs from the day's start or to its end. */
export interface ReplanWindow {
  /** When the kept stop before it ends. */
  opens: number | null;
  /** When the kept stop after it starts. */
  closes: number | null;
}

/** The whole day as one window, as a change that writes the whole day again forks it. */
export const WHOLE_DAY_WINDOW: ReplanWindow = { opens: null, closes: null };

export interface ReplanFrame {
  rows: ReplanRow[];
  /**
   * What the re-plan's new stops' ids start with, as the merged day gives them ("r1"): a stop
   * whose id does is one the re-plan added, and one that stays keeps an id of its own.
   */
  idPrefix: string;
  /**
   * The proposal's rows on screen, by id, in order: drawn compact and blue beside the day, off
   * its curve, a dashed curve through them. Empty while a frame only fades a version out.
   */
  proposed: string[];
  /**
   * The day's rows the proposal would replace, by id: the day's own, which the proposal's
   * dashed path passes by.
   */
  replaced: string[];
  windows: ReplanWindow[];
  /**
   * What the stream is writing: its stops, then their versions, then the line about the day,
   * as the schema orders them. A whole proposal's frame says "dek", written.
   */
  writing: ReplanWriting;
  /**
   * A whole new stop the merge will leave out, by the merge's own rule (`newStopFateOf`): it
   * lies outside every window, repeats a kept place, or has no time left before a kept stop. A
   * re-plan that drops a new stop is never shown (`mergeShownReplan`), so this one is lost
   * already, however far it has to go. A stop the normalizer drops, out of order among them,
   * only the stream's end tells.
   */
  isLost: boolean;
  /**
   * The rows of a version leaving the screen, by id, fading out where they stand and off the
   * curve: a proposal that failed or was left, or the old part once one is taken. Left out
   * otherwise.
   */
  fading?: string[];
}

/** A re-plan as far as the stream has written it. */
export type PartialReplanDraft = DeepPartial<GeneratedReplan>;

/** What a re-plan's stream is writing, in the schema's order. */
export type ReplanWriting = "stops" | "versions" | "dek";

interface Timed<Row> {
  row: Row;
  /** The minute its wire stands at: the middle of its visit. */
  mid: number;
}

/**
 * At one minute the day's row comes first, then the proposal's, so "yours, then the proposed"
 * reads down the rows where two start alike.
 */
const ORDER: Readonly<Record<ReplanRow["source"], number>> = {
  kept: 0,
  replaced: 0,
  stays: 0,
  proposed: 1,
};

/** Rows by the minute their wires stand at, so the rows' scale runs down in time. */
function inOrder(rows: readonly Timed<ReplanRow>[]): ReplanRow[] {
  return [...rows]
    .sort((a, b) => a.mid - b.mid || ORDER[a.row.source] - ORDER[b.row.source])
    .map(({ row }) => row);
}

/**
 * The minutes each window of a day runs over, from the end of the stop it keeps before it to the
 * start of the one it keeps after: the parts a fork stands over, known at the press.
 */
export function windowsOf(itinerary: Itinerary, spans: readonly WindowSpan[]): ReplanWindow[] {
  const times = runningSpans(itinerary.stops);
  return spans.map(({ from, to }) => ({
    opens: times[from - 1]?.to ?? null,
    closes: times[to + 1]?.from ?? null,
  }));
}

interface PlacedNew {
  index: number;
  stop: StopDraft;
  from: number;
}

/**
 * The placed new stops as the normalizer orders them before the merge: one that starts no later
 * than the stop before it is dropped, and one that runs into the next is cut at its start
 * (`withoutOverlaps`). Each start is final once its stop is placed.
 */
function orderedNew(placed: readonly { index: number; stop: StopDraft }[]): PlacedNew[] {
  const spans = runningSpans(placed.map(({ stop }) => stop));
  const ordered: PlacedNew[] = [];
  placed.forEach(({ index, stop }, n) => {
    const from = spans[n]?.from ?? 0;
    const previous = ordered.at(-1);
    if (previous && from <= previous.from) return;
    if (previous && from < previous.from + previous.stop.durationMinutes) {
      previous.stop = { ...previous.stop, durationMinutes: from - previous.from };
    }
    ordered.push({ index, stop, from });
  });
  return ordered;
}

/**
 * Whether a stop's set of versions is whole: the stream has begun the next set, or the line
 * about the day, which the model writes after every set. A stop it wrote no set for has none,
 * known once the line begins.
 */
function isSetWhole(replan: PartialReplanDraft, stopIndex: number): boolean {
  const sets = replan.alternatives ?? [];
  const at = sets.findIndex((set) => set?.stopIndex === stopIndex);
  return replan.dek !== undefined || (at !== -1 && at < sets.length - 1);
}

/** The rows a re-plan's new stops draw. */
interface NewRows {
  rows: Timed<ReplanRow>[];
  /** The window stops a new stop stands for, by id: one row for both paths. */
  stood: ReadonlySet<string>;
  /** Whether a whole new stop is left out, as the merge will leave it out. */
  isLost: boolean;
}

/**
 * The new stops as the merge will take them once each is whole: one that starts outside every
 * window or repeats a kept place is dropped, and one that runs into the next kept stop is cut
 * short at it, or dropped when that leaves it under a quarter of an hour. One at an old stop's
 * place and start stands for it (`stayingStopOf`). A stop still being written is kept as
 * written, since its time and name are not yet final, and is not drawn. Its versions come once
 * their set is whole.
 */
function newRowsOf(basis: ReplanBasis, replan: PartialReplanDraft): NewRows {
  // The merge's own rule for each new stop, its kept places and its windows' bounds.
  const keptNames = keptPlaceNamesOf(basis.itinerary, basis.windows);
  const bounds = windowBoundsOf(basis.itinerary, basis.windows);
  const stops = replan.stops ?? [];
  const isPastStops = replan.alternatives !== undefined || replan.dek !== undefined;
  const placed = placedStopsOf(stops, (index) => replannedIdOf(basis.idPrefix, stopIdAt(index)));
  // The merge normalizes the re-plan's own stops, so an option repeating one of them is dropped.
  const placedStops = placed.map(({ stop }) => stop);
  const sets = replan.alternatives ?? [];
  const stood = new Set<string>();
  // Lost once a whole new stop is one the merge drops, by the merge's rule, never by the
  // normalizer's, which only the stream's end tells for sure.
  let isLost = false;
  const rows = orderedNew(placed).flatMap(({ index, stop, from }): Timed<ReplanRow>[] => {
    const mid = from + stop.durationMinutes / 2;
    const isWhole = isPastStops || index < stops.length - 1;
    if (!isWhole) {
      return [{ row: { source: "proposed", stop, isWhole, hasVersions: false }, mid }];
    }
    const name = stop.primary.name ?? "";
    const fate = newStopFateOf(bounds, keptNames, name, from, stop.durationMinutes);
    if (fate.kind !== "taken") {
      isLost = true;
      return [];
    }
    const hasVersions = isSetWhole(replan, index);
    const set = hasVersions ? sets.find((candidate) => candidate?.stopIndex === index) : undefined;
    const draft: StopDraft = {
      ...stop,
      durationMinutes: fate.durationMinutes,
      alternatives: alternativesOf(stop, set?.options ?? [], placedStops),
    };
    const was = stayingStopOf(basis.itinerary, basis.windows, name, from, stood);
    if (was !== null) {
      stood.add(was.id);
      return [{ row: { source: "stays", stop: { ...draft, id: was.id }, was, hasVersions }, mid }];
    }
    const drawn = from + fate.durationMinutes / 2;
    return [{ row: { source: "proposed", stop: draft, isWhole, hasVersions }, mid: drawn }];
  });
  return { rows, stood, isLost };
}

/** What the stream is writing now, from the parts it has begun. */
function writingOf(replan: PartialReplanDraft): ReplanWriting {
  if (replan.dek !== undefined) return "dek";
  return replan.alternatives === undefined ? "stops" : "versions";
}

/** The ids of a frame's rows from one source, in order; a new stop only once it is whole. */
function idsOf(rows: readonly ReplanRow[], source: "proposed" | "replaced"): string[] {
  return rows.flatMap((row) =>
    row.source === source && (row.source !== "proposed" || row.isWhole) ? [row.stop.id] : [],
  );
}

/**
 * The day with a re-plan's proposal beside it, from what the stream has written so far: the
 * day's stops all stay, its windows' among them, and each new stop joins once it is whole.
 */
export function replanFrameOf(basis: ReplanBasis, replan: PartialReplanDraft): ReplanFrame {
  const windows = windowsOf(basis.itinerary, basis.windows);
  const { rows: newRows, stood, isLost } = newRowsOf(basis, replan);
  const times = runningSpans(basis.itinerary.stops);
  const dayRows = basis.itinerary.stops.flatMap((stop, index): Timed<ReplanRow>[] => {
    const span = times[index] ?? { from: 0, to: 0 };
    const mid = (span.from + span.to) / 2;
    const isInWindow = basis.windows.some((window) => index >= window.from && index <= window.to);
    // A stop the proposal writes again stands once, in the new rows' place.
    if (stood.has(stop.id)) return [];
    return [{ row: { source: isInWindow ? "replaced" : "kept", stop }, mid }];
  });
  const rows = inOrder([...dayRows, ...newRows]);
  return {
    rows,
    idPrefix: basis.idPrefix,
    proposed: idsOf(rows, "proposed"),
    replaced: idsOf(rows, "replaced"),
    windows,
    writing: writingOf(replan),
    isLost,
  };
}

/** What a frame of two whole days draws of the version beside the day. */
export type Beside = "proposed" | "fading";

/**
 * The day with another whole version of it beside it, as a fork stands once its proposal is
 * whole (`docs/decisions.md`, "A changed word proposes its part beside the day, and the visitor
 * takes it"): the stops both share once, by id, the day's own, and the other's own drawn beside
 * them, "proposed", or fading out where they stand as the fork folds, "fading". Which version
 * is the day, the visitor's before or the proposal taken, is the caller's.
 */
export function forkFrameOf(
  day: readonly Stop[],
  other: readonly Stop[],
  idPrefix: string,
  windows: readonly ReplanWindow[],
  beside: Beside,
): ReplanFrame {
  const dayIds = new Set(day.map(({ id }) => id));
  const otherIds = new Set(other.map(({ id }) => id));
  const midsIn = (stops: readonly Stop[]) =>
    runningSpans(stops).map(({ from, to }) => (from + to) / 2);
  const dayMids = midsIn(day);
  const otherMids = midsIn(other);
  const rows = inOrder([
    ...day.map((stop, index): Timed<ReplanRow> => ({
      row: { source: otherIds.has(stop.id) ? "kept" : "replaced", stop },
      mid: dayMids[index] ?? 0,
    })),
    ...other.flatMap((stop, index): Timed<ReplanRow>[] =>
      dayIds.has(stop.id)
        ? []
        : [
            {
              row: { source: "proposed", stop, isWhole: true, hasVersions: true },
              mid: otherMids[index] ?? 0,
            },
          ],
    ),
  ]);
  const others = idsOf(rows, "proposed");
  return {
    rows,
    idPrefix,
    proposed: beside === "proposed" ? others : [],
    replaced: beside === "proposed" ? idsOf(rows, "replaced") : [],
    windows: [...windows],
    writing: "dek",
    isLost: false,
    ...(beside === "fading" ? { fading: others } : {}),
  };
}

/**
 * The day once a re-plan has ended: the merged day when it completed, and otherwise the day
 * as it was, since a re-plan is all or nothing (`docs/targeted-replan.md`, section 4).
 */
export function dayAfterReplan(basis: ReplanBasis, outcome: DayOutcome): Itinerary {
  return outcome.kind === "complete" ? outcome.itinerary : basis.itinerary;
}

/**
 * The stops a re-plan added: those whose ids carry one of its prefixes (`ReplanFrame.idPrefix`),
 * the merged day keeping their ids. A stop that stays keeps an id of its own.
 */
export function newStopsOf(
  stops: readonly { id: string }[],
  idPrefixes: readonly string[],
): ReadonlySet<string> {
  return new Set(
    stops.flatMap(({ id }) => (idPrefixes.some((prefix) => isReplannedBy(prefix, id)) ? [id] : [])),
  );
}

/**
 * The stops a frame's rows draw, in order: the day's as they are, a stop the proposal writes
 * again as the day's own, and a proposal's stop once it is whole, with no versions of its own
 * while it is only proposed, so the visitor's hands never pick among them.
 */
export function frameStopsOf(frame: ReplanFrame): StopDraft[] {
  const proposed = new Set(frame.proposed);
  return frame.rows.flatMap((row): StopDraft[] => {
    if (row.source === "stays") return [row.was];
    if (row.source !== "proposed") return [row.stop];
    if (!row.isWhole) return [];
    return [proposed.has(row.stop.id) ? withoutVersions(row.stop) : row.stop];
  });
}

/** A stop with its plan alone, as a proposal's stop is drawn. */
function withoutVersions(stop: StopDraft): StopDraft {
  return stop.alternatives.length === 0
    ? stop
    : { ...stop, alternatives: [], selectedPlaceId: stop.primary.id };
}

/**
 * Over which stop each window's fork row stands, by id: the first of the stops on screen whose
 * visit starts inside the window, the day's or the proposal's, so the row stands over the part
 * it forks whichever version is the day; null where none is on screen. A stop the day keeps
 * starts before a window opens or as it closes, so it is never one.
 */
export function forkAnchorsOf(
  stops: readonly StopDraft[],
  windows: readonly ReplanWindow[],
): (string | null)[] {
  const starts = runningSpans(stops).map(({ from }) => from);
  return windows.map(({ opens, closes }) => {
    const at = starts.findIndex(
      (from) => from >= (opens ?? -Infinity) && from < (closes ?? Infinity),
    );
    return stops[at]?.id ?? null;
  });
}
