import { writtenRequestFor } from "@/lib/intake/written-intake";
import { todayIn } from "@/lib/normalizer/normalize-intake";
import {
  ASSUMABLE_FACT_KEYS,
  isCityTimeZone,
  type DayRequest,
} from "@/lib/schema/itinerary.schema";
import type { IntakeWords } from "@/lib/schema/intake.schema";

/**
 * The start screen: one question, and the cities Lantern has written as words, with no day
 * until the visitor asks for one (`docs/decisions.md`, "The first screen asks one question, and
 * no day is drawn until a press").
 */

/** The words read name nothing beyond the city: no word of the visitor's, no date. */
function isCityAlone(words: IntakeWords): boolean {
  return (
    words.energySource === "assumed" &&
    words.date === null &&
    ASSUMABLE_FACT_KEYS.every((key) => words[key] === null)
  );
}

/**
 * The request for a city typed in answer to "in …?", with the words already read. Before
 * launch the resolver is the written days: a written city named alone is its whole written
 * day. Otherwise the day is the text's, or today in the city's zone, as for a city chosen
 * from its readings (`requestOf`); `standInZone` stands in for a city the resolver does not
 * know yet, and the route says what it can write. The question names no weekday until the
 * city does, so none of these can contradict it.
 */
export function requestFor(
  city: string,
  words: IntakeWords,
  standInZone: string,
  now: Date,
): DayRequest {
  const written = writtenRequestFor(city);
  if (written && isCityAlone(words)) return written;
  const { date, ...rest } = words;
  const timezone = written?.timezone ?? standInZone;
  return {
    ...rest,
    city: written?.city ?? city.trim(),
    citySource: "chosen",
    timezone,
    date: date ?? todayIn(timezone, now),
  };
}

/**
 * What stands in for the visitor's zone when their browser names no city's ("UTC",
 * "Etc/GMT-3"): Reykjavik's, a city at UTC all year.
 */
export const STAND_IN_ZONE = "Atlantic/Reykjavik";

/**
 * The zone a typed city is read in until a resolver gives its own: the visitor's, so the day
 * asked for is today where they are, as they mean it. Only a request the route will not write
 * reads it, a city typed while Lantern writes no new days, so it sets nothing but the date.
 */
export function standInZoneOf(visitorZone: string | undefined): string {
  return visitorZone !== undefined && isCityTimeZone(visitorZone) ? visitorZone : STAND_IN_ZONE;
}

/** "Lantern can't plan around “with my dog” and “by bike”." */
export function unplacedLineOf(unplaced: readonly string[]): string | null {
  if (unplaced.length === 0) return null;
  const quoted = unplaced.map((phrase) => `“${phrase}”`);
  const listed =
    quoted.length < 2 ? quoted.join("") : `${quoted.slice(0, -1).join(", ")} and ${quoted.at(-1)}`;
  return `Lantern can't plan around ${listed}.`;
}
