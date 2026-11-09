import { NO_CHECKS, type PlaceChecks } from "@/features/itinerary/use-day-stream";
import type { StoredDay } from "@/lib/days/stored-day";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import type { DayOutcome } from "@/lib/stream/outcome";
import { keptNoticeOf } from "./stream-ending";
import { shownEnergiesOf } from "./day-shape";
import type { HeaderNotice } from "./day-stage-header";
import type { YourDay } from "./your-days";

/**
 * A day kept on the server, at its own address (`docs/decisions.md`, "A day is written to its end,
 * and kept to be opened again"): what the page shows for each way the log answers, how long it
 * waits for a day still being written, and how the visitor's own list is told. A plain module, so
 * tests and the page read it without a browser.
 */

/** How often a page waiting for a day still being written asks for it again. */
export const KEPT_POLL_MS = 3000;

/**
 * How long after a day was asked a page waits for its record: the day route's longest run,
 * 150 s, and half a minute for the record's write after it. A day not found by then did not
 * finish.
 */
export const KEPT_WAIT_MS = 180_000;

/** A day kept on the server, as the day lands on it: nothing is played for it. */
export interface KeptLanding {
  /** Its id in the log, which is its address. */
  id: string;
  request: DayRequest;
  /** How it ended: whole, cut with the stops kept, or with no day, which a notice says. */
  outcome: DayOutcome;
  /** What the header says in place of the ending's own notice, when the log said more. */
  notice: HeaderNotice | null;
  /** Each place's check as the log kept it, by its id. */
  checks: PlaceChecks;
  /**
   * How many re-plans the day has taken, as the log says (`KeptDay.round`): the next re-plan of
   * it is this plus one. 0 for a day with none to show.
   */
  round: number;
}

/**
 * How a landing reads, by what the page draws of it: the same day, ended the same way and
 * said by the same notice, is the same landing, however often its page makes it again.
 */
export function keptKeyOf(landing: KeptLanding): string {
  return [landing.id, landing.outcome.kind, landing.notice?.kind ?? "own"].join(" ");
}

/**
 * What a day's address shows: the day as the day draws any (`landing`), or, for a day this
 * browser did not ask whose record has not landed, a page that waits for it and then says
 * Lantern has no day there.
 */
export type KeptView =
  { kind: "day"; landing: KeptLanding } | { kind: "writing" } | { kind: "none" };

/** A day not written to its end, as the day reads endings: its notice says so and offers it again. */
const UNFINISHED: DayOutcome = { kind: "cut", itinerary: null };

/**
 * The view of the day kept under `id`, as the log answered (`stored`), with the visitor's own
 * record of it when this browser asked it (`asked`), and whether the wait for a record that
 * has not landed is over (`isOverdue`). Only `asked` knows what a day still being written
 * was asked for.
 */
export function keptViewOf(
  id: string,
  stored: StoredDay,
  asked: YourDay | null,
  isOverdue: boolean,
): KeptView {
  const isShown = stored.status === "written" || stored.status === "cut";
  const shown = isShown ? stored.checks : NO_CHECKS;
  const round = isShown ? stored.round : 0;
  const day = (request: DayRequest, outcome: DayOutcome, notice: HeaderNotice | null) => ({
    kind: "day" as const,
    landing: { id, request, outcome, notice, checks: shown, round },
  });
  switch (stored.status) {
    case "written":
      return day(stored.request, { kind: "complete", itinerary: stored.itinerary }, null);
    case "cut":
      return day(stored.request, { kind: "cut", itinerary: stored.itinerary }, null);
    case "failed":
      return day(stored.request, UNFINISHED, null);
    case "expired":
      return day(stored.request, UNFINISHED, keptNoticeOf("expired", stored.request));
    case "unknown":
      if (asked === null) return { kind: isOverdue ? "none" : "writing" };
      return day(
        asked.request,
        UNFINISHED,
        isOverdue ? null : keptNoticeOf("still-writing", asked.request),
      );
  }
}

/**
 * The visitor's own record of a day, told how the log answered: a day written or cut takes
 * its shape and how it ended, one that failed, or was not found once the wait was over, did
 * not finish. A day still being written stays as recorded, and so does one past its link,
 * unless it was recorded as still being written: its record landed, so it ended, and the
 * row says only when it was asked rather than "writing" for good.
 */
export function restatedYourDayOf(day: YourDay, stored: StoredDay, isOverdue: boolean): YourDay {
  switch (stored.status) {
    case "written":
      return {
        ...day,
        energies: shownEnergiesOf(stored.itinerary),
        ending: "written",
        seconds: stored.seconds,
      };
    case "cut":
      return { ...day, energies: shownEnergiesOf(stored.itinerary), ending: "cut", seconds: null };
    case "failed":
      return { ...day, ending: "failed", seconds: null };
    case "unknown":
      return isOverdue && day.ending === "writing" ? { ...day, ending: "failed" } : day;
    case "expired":
      return day.ending === "writing" ? { ...day, ending: "written", seconds: null } : day;
  }
}

const STATUSES = new Set<StoredDay["status"]>(["written", "cut", "failed", "unknown", "expired"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * The log's answer, as `GET /api/day/<id>` sends it, or null for anything else. Our own route
 * sends it, so its shape is read, not its every field: a status, a request with it unless
 * unknown, and a day with stops when written or cut.
 */
export function storedDayFrom(answer: unknown): StoredDay | null {
  if (!isRecord(answer) || !STATUSES.has(answer.status as StoredDay["status"])) return null;
  if (answer.status === "unknown") return { status: "unknown" };
  if (!isRecord(answer.request)) return null;
  if (answer.status === "written" || answer.status === "cut") {
    const { itinerary } = answer;
    if (!isRecord(itinerary) || !Array.isArray(itinerary.stops)) return null;
  }
  return answer as StoredDay;
}

/**
 * Asks the log for the day under `id` once: its answer, or null when it could not be read
 * (a 503, a lost connection), which is worth asking again.
 */
export async function askKeptDay(id: string, signal: AbortSignal): Promise<StoredDay | null> {
  try {
    const answer = await fetch(`/api/day/${id}`, { cache: "no-store", signal });
    return answer.ok ? storedDayFrom(await answer.json()) : null;
  } catch {
    return null;
  }
}
