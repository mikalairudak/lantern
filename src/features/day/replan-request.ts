import {
  ASSUMABLE_FACT_KEYS,
  DayRequestSchema,
  isTimeWordClash,
  type AssumableFactKey,
  type DayRequest,
} from "@/lib/schema/itinerary.schema";
import type { SentenceFacts } from "./sentence";

/** A word of the request changed in the sentence, other than the energy, which the curve owns. */
export interface ChangedWord {
  key: AssumableFactKey;
  /** A value from the word's vocabulary, as the sentence's list offers it. */
  value: string;
}

/**
 * The day on screen asked for again with one word changed, as a changed word re-plans a live
 * day: its city, zone and date as they are, so the city's signature still holds; the energy
 * as the sentence says it, re-picked or not; the visitor's words, Lantern's they chose as they
 * stood among them; and the word changed. Lantern's other words are left for the model to
 * assume again, as they were for the day on screen, and so is a word of the visitor's that the
 * changed one cannot stand beside (`isTimeWordClash`): home by eight leaves a late dinner to
 * Lantern, and a late dinner an evening end.
 */
export function replannedRequestOf(
  request: DayRequest,
  facts: SentenceFacts,
  changed: ChangedWord,
): DayRequest {
  const visitorsWords = Object.fromEntries(
    ASSUMABLE_FACT_KEYS.map((key) => {
      const fact = facts[key];
      return [key, fact?.source === "chosen" ? fact.value : null];
    }),
  );
  const asked = DayRequestSchema.parse({
    ...request,
    ...visitorsWords,
    energy: facts.energy?.value ?? request.energy,
    energySource: facts.energy?.source === "chosen" ? "chosen" : request.energySource,
    [changed.key]: changed.value,
  });
  if (!isTimeWordClash(asked.dinner, asked.end)) return asked;
  return changed.key === "dinner" ? { ...asked, end: null } : { ...asked, dinner: null };
}
