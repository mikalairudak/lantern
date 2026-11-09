import type { DeepPartial } from "ai";
import type { StopDraft } from "@/features/abacus/day-draft";
import { stopIdAt } from "@/lib/schema/positions";
import type { GeneratedDay } from "@/lib/schema/itinerary.schema";

/**
 * When the list to read lets in what the stream writes. A row says a stop's time, name,
 * what and where until when, and its one line, so it waits for all of them to be final; its
 * versions come in a second pass, after every stop, as the chart's beads do.
 */

/**
 * How many of the day's first stops the list lets in: those a sheet could open on
 * (`openableStopsOf`), whole and kept by the normalizer as written, up to the first that is
 * not, so the list never skips a stop to come back for it.
 */
export function enteredOf(
  stops: readonly Pick<StopDraft, "id">[],
  whole: ReadonlySet<string>,
): number {
  const first = stops.findIndex((stop) => !whole.has(stop.id));
  return first === -1 ? stops.length : first;
}

type SetDraft = DeepPartial<GeneratedDay["alternatives"][number]> | undefined;

/**
 * The stops whose versions the stream has written whole. The model writes one set at a
 * time, each naming its stop, after every stop: a set is final once the next set has begun,
 * and every set once the day is complete. A stop the model wrote no set for has its versions,
 * none, only then.
 */
export function versionsWrittenOf(
  stops: readonly Pick<StopDraft, "id">[],
  sets: readonly SetDraft[] | undefined,
  isComplete: boolean,
): ReadonlySet<string> {
  if (isComplete) return new Set(stops.map((stop) => stop.id));
  return new Set(
    (sets ?? [])
      .slice(0, -1)
      .flatMap((set) => (set?.stopIndex === undefined ? [] : [stopIdAt(set.stopIndex)])),
  );
}
