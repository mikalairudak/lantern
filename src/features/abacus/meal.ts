import { isAreaKind, type AreaKind, type PlaceKind } from "@/lib/schema/itinerary.schema";

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
/** A meal or a coffee before this is breakfast. */
export const LUNCH_FROM = 11 * MINUTES_PER_HOUR;
/** A meal from this is the afternoon's, a snack: kuzukiri at three, bread at five. */
export const SNACK_FROM = 15 * MINUTES_PER_HOUR;
/** A meal from this is dinner, as any other stop's evening starts. */
export const DINNER_FROM = 18 * MINUTES_PER_HOUR;

export type Meal = "breakfast" | "lunch" | "snack" | "dinner" | "late supper";

/**
 * The meal a food stop is, by the minute it starts on the day's running clock: past
 * midnight the clock runs on (`runningSpans`), so a meal at half past twelve at night is a
 * late supper, never the morning's breakfast.
 */
export function mealAt(start: number): Meal {
  if (start >= MINUTES_PER_DAY) return "late supper";
  if (start < LUNCH_FROM) return "breakfast";
  if (start < SNACK_FROM) return "lunch";
  return start < DINNER_FROM ? "snack" : "dinner";
}

/**
 * What a place to eat or drink around is for, as its row says it in place of its kind: a
 * meal by the minute its stop starts on the day's running clock, the hours the headline's
 * clause reads too ("at lunch"), a café, or a bar. One whose start is not known yet says
 * "food". Its name says what is eaten or drunk there, so the row says only when.
 */
export function mealWordOf(kind: AreaKind, start: number | undefined): string {
  if (kind === "coffee") return "café";
  if (kind === "bar") return "bar";
  return start === undefined ? "food" : mealAt(start);
}

/**
 * What a row says after its name of what the place is: its kind; or, for a place to eat or
 * drink around, its meal, café or bar (`mealWordOf`).
 */
export function kindWordOf(
  kind: PlaceKind | undefined,
  start: number | undefined,
): string | undefined {
  if (kind === undefined || !isAreaKind(kind)) return kind;
  return mealWordOf(kind, start);
}
