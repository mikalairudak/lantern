const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

/**
 * A day can run on past midnight, but it never wraps round to its own morning. A start
 * earlier on the clock than the stop before it reads as the small hours only when it is
 * before this, and the stop before it ended at `LATE_EVENING_MINUTES` or later. Anything
 * else is a stop out of order.
 */
export const SMALL_HOURS_END_MINUTES = 6 * MINUTES_PER_HOUR;
export const LATE_EVENING_MINUTES = 21 * MINUTES_PER_HOUR;

const HOURS_PER_DAY = 24;
/** How a model may write a time: "H:mm", "HH:mm" or "HH:mm:ss". */
const CLOCK_TIME = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;

/**
 * Minutes after midnight for a time as a model may write it, or null for anything that is
 * not a time of day. `formatClock` gives it back as "HH:mm".
 */
export function parseClock(value: string): number | null {
  const match = CLOCK_TIME.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours >= HOURS_PER_DAY || minutes >= MINUTES_PER_HOUR) return null;
  return hours * MINUTES_PER_HOUR + minutes;
}

/** Minutes after midnight for a "HH:mm" time. */
export function minutesOf(time: string): number {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return hours * MINUTES_PER_HOUR + minutes;
}

/** "HH:mm" for minutes after midnight. Past 24:00 it reads the next day's clock. */
export function formatClock(totalMinutes: number): string {
  const ofDay = totalMinutes % MINUTES_PER_DAY;
  const hours = Math.floor(ofDay / MINUTES_PER_HOUR);
  const minutes = ofDay % MINUTES_PER_HOUR;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Minutes from the day's midnight for a stop's clock time, given where the stop before it
 * ended on the same count (`null` for the first stop). After midnight the count runs on
 * past 1440, so "00:15" after a stop that ended at 23:30 is 1455, and every later stop
 * keeps the extra day because the end it is measured against already carries it.
 */
export function runningStart(clockMinutes: number, previousEnd: number | null): number {
  const isSmallHours =
    previousEnd !== null &&
    previousEnd >= LATE_EVENING_MINUTES &&
    clockMinutes < SMALL_HOURS_END_MINUTES;
  return isSmallHours ? clockMinutes + MINUTES_PER_DAY : clockMinutes;
}

/**
 * Each stop's visit in minutes from the day's midnight, running on past it. The same shape
 * as a light window's span, so a visit after midnight compares with an evening window
 * that ends after midnight.
 */
export function runningSpans(
  stops: readonly { startTime: string; durationMinutes: number }[],
): { from: number; to: number }[] {
  let previousEnd: number | null = null;
  return stops.map((stop) => {
    const from = runningStart(minutesOf(stop.startTime), previousEnd);
    previousEnd = from + stop.durationMinutes;
    return { from, to: previousEnd };
  });
}
