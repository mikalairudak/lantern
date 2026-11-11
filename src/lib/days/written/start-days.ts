import { normalizeDay } from "@/lib/normalizer/normalize";
import type { WrittenDay } from "./written-day";
import { writtenChecksOf } from "./checks";
import type { WrittenSeason } from "./seasons";
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

/**
 * A season as written here, its day as it streams. Each day here has one season, open-ended:
 * the season that began last answers every date after it anyway (`seasonOn`), and how long its
 * day holds is worked out by code (`freshUntil`), never written down.
 */
function seasonOf(from: string, written: WrittenDay): WrittenSeason {
  return {
    from,
    through: null,
    written: streamedAsLanded(written),
    checks: writtenChecksOf(written.request.city),
  };
}

/**
 * Each start's seasons, in the order of `QUICK_STARTS`, oldest first, none overlapping. Every
 * season of a city keeps the start's words, weekday and first hour, which a page reads without
 * the day's text, and the first is the start's own request; `start-days.test.ts` holds both.
 */
export const START_SEASONS: readonly (readonly WrittenSeason[])[] = [
  [seasonOf("2026-11-07", BOLOGNA_START_DAY)],
  [seasonOf("2026-11-15", PORTO_START_DAY)],
  [seasonOf("2026-11-07", KANAZAWA_START_DAY)],
  [seasonOf("2026-11-14", MADRID_START_DAY)],
  [seasonOf("2026-11-08", UTRECHT_START_DAY)],
  [seasonOf("2026-11-07", NAFPLIO_START_DAY)],
];

/** The starts' days in their first season, each on the start's own request, in the starts' order. */
export const START_DAYS: readonly WrittenDay[] = START_SEASONS.map((seasons) => {
  const [first] = seasons;
  if (first === undefined) throw new Error("A start has no season");
  return first.written;
});
