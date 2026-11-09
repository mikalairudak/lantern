import type { DayRequest } from "@/lib/schema/itinerary.schema";

const REQUEST_KEYS = [
  "city",
  "citySource",
  "date",
  "timezone",
  "energy",
  "energySource",
  "travel",
  "start",
  "dinner",
  "end",
  "company",
] as const satisfies readonly (keyof DayRequest)[];

/** Whether two requests ask for the same day, field by field. */
export function isSameRequest(a: DayRequest, b: DayRequest): boolean {
  return REQUEST_KEYS.every((key) => a[key] === b[key]);
}

/** Whether two requests ask for the same words, whatever date each names. */
export function isSameWords(a: DayRequest, b: DayRequest): boolean {
  return REQUEST_KEYS.every((key) => key === "date" || a[key] === b[key]);
}
