import type { EdgeDay } from "./edge-day";
import { MINIMAL_DAY } from "./minimal";

/**
 * A generation that finished but cannot be shown: its line about the day is empty, so the
 * normalizer refuses it and the stream ends as `invalid`. Structured output keeps the JSON
 * to the schema, so a refusal like this is what is left of an invalid day on the live route.
 */
export const REFUSED_DAY: EdgeDay = {
  edge: "a finished day the normalizer refuses: its line about the day is empty",
  request: MINIMAL_DAY.request,
  day: { ...MINIMAL_DAY.day, dek: "" },
};
