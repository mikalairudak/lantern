import { isWrittenRequest, WRITTEN_REQUESTS } from "@/lib/days/written/requests";
import { isOnItsWeekday } from "@/lib/days/written/shown-date";
import type { DayRequest, Itinerary } from "@/lib/schema/itinerary.schema";
import type { DayOutcome } from "@/lib/stream/outcome";
import {
  BUSY,
  CONNECTION_DROPPED,
  LINK_EXPIRED,
  NOT_WRITING_YET,
  OPENS_HERE,
  OPEN_WRITTEN,
  OR_OPEN_WRITTEN,
  REFUSED_LINE,
  RESTING,
  STILL_WRITING,
  UNFINISHED,
  WRITE_IT_AGAIN,
} from "./not-yet";
import type { LocalWords } from "./sentence";
import type { HeaderNotice, HeaderSlot } from "./day-stage-header";

/**
 * How a stream's ending reaches the day's header: the day it ended with, how the day
 * stands, and what the header says in place of a day that is not coming. A plain module, so
 * the lab can set the header in every ending without playing a stream.
 */

/** How the day stands: being written, done, or not coming. */
export type Phase = "writing" | "done" | "not-yet" | "failed";

/**
 * The day a stream ended with: a complete one, or what the salvage rule kept of a cut or
 * dropped one; null while it streams and for any ending without a day.
 */
export function endedDayOf(outcome: DayOutcome | null): Itinerary | null {
  if (outcome?.kind === "complete") return outcome.itinerary;
  if (outcome?.kind === "cut" || outcome?.kind === "disconnected") return outcome.itinerary;
  return null;
}

export function phaseOf(outcome: DayOutcome | null, ended: Itinerary | null): Phase {
  if (outcome === null) return "writing";
  if (ended) return "done";
  if (outcome.kind === "unavailable" || outcome.kind === "limited") return "not-yet";
  return "failed";
}

/** The written days to offer beside this request: every one but its own, on whatever date it is shown. */
function othersThan(request: DayRequest): readonly DayRequest[] {
  return WRITTEN_REQUESTS.filter((written) => !isOnItsWeekday(written, request));
}

/**
 * What the header says in place of the day when a stream ended without one: what happened,
 * then a way on, a retry or the written days or both. A written day that failed or was
 * refused is never offered among them, so the words do not count them; over any other
 * request all of them are. Once live generation is on (`isLive`), Lantern writes any day, so
 * nothing that came for one is the route being busy, as for a written day, never "not yet".
 */
export function noticeOf(
  outcome: DayOutcome | null,
  request: DayRequest,
  isLive = false,
): HeaderNotice | null {
  if (outcome === null || outcome.kind === "complete" || endedDayOf(outcome)) return null;
  const others = othersThan(request);
  switch (outcome.kind) {
    case "cut":
    case "invalid":
      return {
        kind: "unfinished",
        text: UNFINISHED,
        retry: WRITE_IT_AGAIN,
        offer: OR_OPEN_WRITTEN,
        written: others,
      };
    case "disconnected":
      return {
        kind: "dropped",
        text: CONNECTION_DROPPED,
        retry: WRITE_IT_AGAIN,
        offer: OR_OPEN_WRITTEN,
        written: others,
      };
    case "refused":
      return { kind: "refused", text: REFUSED_LINE, offer: OPEN_WRITTEN, written: others };
    case "unavailable":
      // Nothing came for a day Lantern writes: the route was busy, so it is asked again.
      return isLive || isWrittenRequest(request)
        ? { kind: "busy", text: BUSY, retry: WRITE_IT_AGAIN, written: [] }
        : { kind: "not-yet", text: NOT_WRITING_YET, written: WRITTEN_REQUESTS };
    case "limited":
      return { kind: "resting", text: RESTING, written: WRITTEN_REQUESTS };
  }
}

/**
 * What a day's own address says in place of a day kept there that it cannot show: one still
 * being written, which opens there once done and is waited for with nothing to press, or a
 * link past its days, which can write the day again or open a written one.
 */
export function keptNoticeOf(
  standing: "still-writing" | "expired",
  request: DayRequest,
): HeaderNotice {
  if (standing === "still-writing") {
    return { kind: standing, text: `${STILL_WRITING} ${OPENS_HERE}`, written: [] };
  }
  return {
    kind: standing,
    text: LINK_EXPIRED,
    retry: WRITE_IT_AGAIN,
    offer: OR_OPEN_WRITTEN,
    written: othersThan(request),
  };
}

/**
 * The end of the facts line: the hint on a day that is done until a word is changed, then
 * what a changed word would have re-planned; nothing while the day is being written, or when
 * none is coming, which the notice says in place of the line.
 */
export function slotOf(
  phase: Phase,
  notYet: string | null,
  local: LocalWords,
  /** The hint goes at the page's first change of any kind. */
  isTouched = false,
): HeaderSlot {
  if (phase !== "done") return null;
  if (notYet) return { kind: "not-yet", text: notYet };
  const hasChanged =
    isTouched ||
    local.energy !== null ||
    local.confirmed.length > 0 ||
    Object.keys(local.kept).length > 0;
  return hasChanged ? null : { kind: "hint" };
}
