/**
 * The calendar day and month in UTC, for every visitor alike: the limits' counters, the app's
 * spend and the day's events turn over at one moment, whatever a visitor's zone.
 */

export function utcDayOf(now: Date): string {
  return now.toISOString().slice(0, "YYYY-MM-DD".length);
}

export function utcMonthOf(now: Date): string {
  return now.toISOString().slice(0, "YYYY-MM".length);
}
