import { normalizeDay } from "@/lib/normalizer/normalize";
import type { WrittenDay } from "./written-day";
import { BOLOGNA_START_DAY } from "./bologna";
import { KANAZAWA_START_DAY } from "./kanazawa";
import { MADRID_START_DAY } from "./madrid";
import { NAFPLIO_START_DAY } from "./nafplio";
import { PORTO_START_DAY } from "./porto";
import { UTRECHT_START_DAY } from "./utrecht";

/**
 * A written day as it streams: with the end Lantern assumed said as the one its hours keep,
 * as the normalizer says it once the day lands (`withAssumedEndFitted`). Kept as written, Porto
 * and Utrecht, which assumed "home by eleven" and end at 20:00, would write "home by eleven"
 * into the headline and change it to "home by eight" as the day landed.
 */
function streamedAsLanded(written: WrittenDay): WrittenDay {
  const normalized = normalizeDay(written.request, written.day);
  const end = normalized.ok ? normalized.itinerary.facts.end : null;
  if (end?.source !== "assumed" || end.value === written.day.assumptions.end) return written;
  const assumptions = { ...written.day.assumptions, end: end.value };
  return { ...written, day: { ...written.day, assumptions } };
}

/** The starts' days, in the order of `QUICK_STARTS`. */
export const START_DAYS: readonly WrittenDay[] = [
  BOLOGNA_START_DAY,
  PORTO_START_DAY,
  KANAZAWA_START_DAY,
  MADRID_START_DAY,
  UTRECHT_START_DAY,
  NAFPLIO_START_DAY,
].map(streamedAsLanded);
