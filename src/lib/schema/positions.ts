/**
 * A place's id is its position in the generation, not in the day: the stop's index as the
 * model wrote it (`stop-2`), its primary (`stop-2:p`), and the n-th option of the first set
 * that names it (`stop-2:a1`). A stop or an option the normalizer drops leaves a gap, so a row
 * keyed by its id while the day streamed keeps its key once the day is whole, and a swap only
 * changes which id a stop shows (`docs/decisions.md`, "Swaps change selection, not data").
 * A re-plan's places carry its round before the generation's own (`r2-stop-1:p`), so they
 * never share an id with the day they join. The normalizer, the stream's place checks, the
 * client's drafts, the merge and the stored days all name places through this file.
 */

/** A stop's id, by its index in the generation. */
export function stopIdAt(index: number): string {
  return `stop-${index}`;
}

/**
 * The generation's index a stop's id, or one of its places' ids, names (`stop-2:a1` is 2);
 * null for an id that is not one, a re-plan's among them.
 */
export function stopIndexOfId(id: string): number | null {
  const match = /^stop-(\d+)(?::|$)/.exec(id);
  return match === null ? null : Number(match[1]);
}

/** A stop's primary place's id. */
export function primaryIdOf(stopId: string): string {
  return `${stopId}:p`;
}

/** The id of a stop's option, by its index in the stop's set, counted from 0. */
export function optionIdOf(stopId: string, index: number): string {
  return `${stopId}:a${index + 1}`;
}

/**
 * Whether a set of options names one of the day's stops. Of the sets that name the same stop,
 * only the first counts: the normalizer keeps it, and so the checks and the stream read it.
 */
export function isStopIndexOf(stopIndex: number, stopCount: number): boolean {
  return Number.isInteger(stopIndex) && stopIndex >= 0 && stopIndex < stopCount;
}

/** A re-plan's id for a place it wrote: its round's prefix before the generation's id. */
export function replannedIdOf(prefix: string, id: string): string {
  return `${prefix}-${id}`;
}

/** Whether an id names a place the re-plan with this prefix wrote. */
export function isReplannedBy(prefix: string, id: string): boolean {
  return id.startsWith(`${prefix}-`);
}
