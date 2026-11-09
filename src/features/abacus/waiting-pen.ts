import { minutesOf, runningSpans } from "@/lib/time/clock";
import type { StopDraft } from "./day-draft";
import type { DaySpan } from "./geometry";
import { mealAt as runningMealAt, type Meal } from "./meal";

/**
 * Where the writing stopped, for the waiting line, which sits at the pen. Derived from the
 * stops on screen and the hours the visitor asked for, never from what the model has not
 * written yet.
 */

/** What arrives next: another stop, or the other versions of every stop. */
export type NextPart = "stop" | "versions";

export interface Pen {
  next: NextPart;
  /** How far the day is written, in minutes from midnight: the last stop's end. */
  minutes: number;
}

const MINUTES_PER_HOUR = 60;
const at = (hours: number) => hours * MINUTES_PER_HOUR;

/**
 * A plan that reaches the last hour the visitor asked for is taken as complete, so what
 * comes next is the options. A live stream would know for sure once the model opens its
 * list of alternatives; the simulated one has no such mark.
 */
const LAST_HOUR = MINUTES_PER_HOUR;

/** Where the pen is: at the start of the day before any stop, then after the last one. */
export function penOf(stops: readonly StopDraft[], day: DaySpan): Pen {
  const end = runningSpans(stops).at(-1)?.to;
  if (end === undefined) return { next: "stop", minutes: day.start };
  return { next: end >= day.end - LAST_HOUR ? "versions" : "stop", minutes: end };
}

/** The part of the day that starts at a minute, in plain words. */
function partOfDay(minutes: number): string {
  if (minutes < at(12)) return "the morning";
  if (minutes < at(14)) return "midday";
  if (minutes < at(18)) return "the afternoon";
  if (minutes < at(21)) return "the evening";
  return "late evening";
}

/**
 * The part of the day a placed stop begins, by its own start on the day's running clock, for
 * the line that waits in its row while its words wait for its bead: its time is on screen
 * beside it, so the words agree with it, and they need nothing of the stop but its time.
 */
export function startingPhraseOf(stops: readonly StopDraft[], stop: StopDraft): string {
  const start = runningSpans(stops)[stops.indexOf(stop)]?.from ?? minutesOf(stop.startTime);
  return partOfDay(start);
}

/** After a meal, as the rows name it: "after lunch", "after a snack". */
function afterMeal(meal: Meal): string {
  return meal === "snack" || meal === "late supper" ? `after a ${meal}` : `after ${meal}`;
}

/**
 * The next part of the day in its own words, for the line that waits where the next row
 * will be: "the morning", "midday", "other versions". Built only from times and the
 * vocabulary of kinds, so it never names a place or says anything the model has not. A
 * meal is the one its row says, on the day's running clock: past midnight a late supper.
 */
export function phraseOf(stops: readonly StopDraft[], pen: Pen): string {
  if (pen.next === "versions") return "other versions";
  const last = stops.at(-1);
  const lastStart = runningSpans(stops).at(-1)?.from;
  if (last?.primary.kind === "food" && lastStart !== undefined) {
    return afterMeal(runningMealAt(lastStart));
  }
  return partOfDay(pen.minutes);
}

/**
 * Kinds of place a meal is had at, for what an answer would re-plan: a tapas bar after nine
 * is the dinner the visitor's word names, though its row says "bar".
 */
const MEAL_KINDS: ReadonlySet<string | undefined> = new Set(["food", "bar"]);

/**
 * What a stop being rewritten stands for, for the line that waits in its row's place while
 * the day is re-composed, and for the facts line naming what an answer would re-plan: the
 * meal its row says at a place to eat, "dinner", else its part of the day. Built, like
 * `phraseOf`, from the old stop's time and kind, never from what replaces it, its time read
 * on the day's running clock when given: past midnight a late supper, never breakfast.
 */
export function rewritingPhraseOf(
  stop: Pick<StopDraft, "startTime" | "primary">,
  start: number = minutesOf(stop.startTime),
): string {
  return MEAL_KINDS.has(stop.primary.kind) ? runningMealAt(start) : partOfDay(start);
}
