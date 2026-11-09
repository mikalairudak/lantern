import { NO_CHECKS, type DayStream, type PlaceChecks } from "@/features/itinerary/use-day-stream";
import type { DayOutcome, PartialDay } from "@/lib/stream/outcome";
import { hasDayBegun } from "./header-ready";

/**
 * The day a written day's page draws in place of how its play ended: the page's own day whole,
 * for any ending but the day complete, a dropped connection, a cut, a busy route or a day that
 * did not read, since the page already holds that day whole (`docs/decisions.md`, "A written day's
 * page is built whole, and plays only for a visitor who has not seen it"). Null while the play
 * writes, once it lands complete, and where the day played is not the page's own.
 */
export function wholeInPlaceOf<Day>(outcome: DayOutcome | null, own: Day | null): Day | null {
  if (own === null || outcome === null || outcome.kind === "complete") return null;
  return own;
}

/** A day drawn as it ended: how it ended, and each place's check. */
export interface EndedDay {
  outcome: DayOutcome;
  checks: PlaceChecks;
}

/** The day on screen as it last streamed, held while another request streams. */
export interface HeldFrame {
  partial: PartialDay | null;
  outcome: DayOutcome | null;
  checks: PlaceChecks;
}

/** What the stream holds of the day it plays. */
export type StreamFrame = Pick<
  DayStream,
  "partial" | "outcome" | "checks" | "isStreaming" | "held"
>;

/** What the page holds that the day on screen can be drawn from, each null when it has none. */
export interface DaySources {
  /** A re-plan merged into the run's day, drawn as it ended in the run's place. */
  merged: EndedDay | null;
  /** A day kept on the server, drawn as it ended, with nothing streaming. */
  kept: EndedDay | null;
  /**
   * A day drawn whole, with nothing played. The page makes its outcome once per whole day, so
   * every render draws the same object and nothing the day remembers by it starts again.
   */
  whole: EndedDay | null;
  /** The stream, once it has taken the run's request; null while it still holds another's. */
  stream: StreamFrame | null;
  /** The day on screen as it last streamed, held while a changed word's whole day streams. */
  held: HeldFrame | null;
}

/** The day the visitor sees: its frame, how it ended, each place's check, and whether it streams. */
export interface ShownDay {
  partial: PartialDay | null;
  outcome: DayOutcome | null;
  checks: PlaceChecks;
  isStreaming: boolean;
  /** Drawn from the stream: it has taken the run's request, and no kept or whole day stands in. */
  isFromStream: boolean;
}

/**
 * Which day is drawn, from what the page holds. How the day ended comes first from a re-plan
 * merged into it, then from a kept day, then from a day drawn whole, then from the stream once
 * it has taken the run's request, and last from the day held while another streams. The frame
 * comes from the stream or the held day alone: a merged day is drawn over the frame it was
 * merged into. With nothing yet, the day waits for the stream to take it, and so streams.
 */
export function shownDayOf({ merged, kept, whole, stream, held }: DaySources): ShownDay {
  const isDrawnAsItIs = kept !== null || whole !== null;
  // A kept or whole day is drawn as it is: whatever the stream holds, it is not this day.
  const current = isDrawnAsItIs ? null : stream;
  return {
    partial: current ? frameOf(current) : (held?.partial ?? null),
    outcome:
      merged?.outcome ??
      kept?.outcome ??
      whole?.outcome ??
      (current ? current.outcome : (held?.outcome ?? null)),
    checks:
      merged?.checks ??
      kept?.checks ??
      whole?.checks ??
      (current ? current.checks : (held?.checks ?? NO_CHECKS)),
    isStreaming: !isDrawnAsItIs && (current ? current.isStreaming : held === null),
    isFromStream: current !== null,
  };
}

/**
 * The stream's frame. A day that came back empty holds its last frame while it is asked for
 * again, as a re-plan holds the day it was asked from: never drawn again from its empty frame,
 * so its header keeps the room its words took and its city word the focus. Once the day asked
 * again has begun, it writes on from there.
 */
function frameOf(stream: StreamFrame): PartialDay | null {
  const isAskedAgain = stream.held !== null && !hasDayBegun(stream.partial, stream.outcome);
  return isAskedAgain ? stream.held : stream.partial;
}
