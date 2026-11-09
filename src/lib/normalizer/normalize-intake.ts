import { z } from "zod";
import type {
  CityReading,
  GeneratedIntake,
  IntakeResult,
  IntakeWords,
} from "@/lib/schema/intake.schema";
import { foldToLatin } from "@/lib/places/names";
import {
  DayRequestSchema,
  isTimeWordClash,
  type DayRequest,
  type EnergyLevel,
} from "@/lib/schema/itinerary.schema";

/** The energy Lantern assumes when nothing in the text points either way: the middle of five. */
export const MIDDLE_ENERGY: EnergyLevel = "balanced";

/** How many cities a shared name is offered as, the one Lantern plays among them. */
export const MAX_CITY_READINGS = 3;

const IsoDateSchema = z.iso.date();

/**
 * The request's words as the intake read them. The energy is the visitor's when the text
 * names it, and otherwise Lantern's: the one the text points to, or the middle one. Who chose
 * it follows from which field holds it, never from a label the model writes, so a named
 * energy wins over a guess beside it. A date that is not one is no date.
 */
export function intakeWordsOf(intake: GeneratedIntake): IntakeWords {
  return {
    energy: intake.energy ?? intake.energyGuess ?? MIDDLE_ENERGY,
    energySource: intake.energy === null ? "assumed" : "chosen",
    travel: intake.travel,
    start: intake.start,
    // A time to be home by is the visitor's limit, so a late dinner it leaves no room for is
    // left to Lantern and said back (`isTimeWordClash`, `unplacedOf`).
    dinner: isTimeWordClash(intake.dinner, intake.end) ? null : intake.dinner,
    end: intake.end,
    company: intake.company,
    date: IsoDateSchema.safeParse(intake.date).success ? intake.date : null,
  };
}

/** Today's date where the city is, which a request without a date asks for. */
export function todayIn(timezone: string, now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((each) => each.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/**
 * The date a day keeps when its city moves to another zone. A day the visitor named stays,
 * but today where the day was is today where it goes, and a day already over there is
 * planned for today instead: from Lisbon in the evening to Tokyo, "today" is not yesterday.
 */
export function dateInZone(
  request: Pick<DayRequest, "date" | "timezone">,
  timezone: string,
  now: Date,
): string {
  const today = todayIn(timezone, now);
  if (request.date === todayIn(request.timezone, now)) return today;
  return request.date < today ? today : request.date;
}

/**
 * The request the words make once their city is known: the visitor's, as when a question
 * is answered, or Lantern's when it played the likeliest of several.
 */
export function requestOf(
  words: IntakeWords,
  city: CityReading,
  now: Date,
  citySource: DayRequest["citySource"] = "chosen",
): DayRequest {
  const { date, ...rest } = words;
  return {
    ...rest,
    city: city.name,
    citySource,
    timezone: city.timezone,
    date: date ?? todayIn(city.timezone, now),
  };
}

/** Lower case, in plain Latin letters, words alone: "São Paulo, Brazil" reads "sao paulo brazil". */
function plain(text: string): string {
  return foldToLatin(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Whether a city shares the played one's name, as Portland, Maine does Portland, Oregon's. */
function isSameName(reading: CityReading, city: CityReading): boolean {
  return plain(reading.name) === plain(city.name);
}

/** Whether the text names a city by its name or by a region or country it is in. */
function isNamedIn(text: string, { name, region }: CityReading): boolean {
  const words = ` ${plain(text)} `;
  const parts = [name, ...region.split(",")].map(plain).filter((part) => part !== "");
  return parts.some((part) => words.includes(` ${part} `));
}

/**
 * Whether a question's cities are Lantern's suggestions: none of them named by the text, by
 * itself or its region or country, as a country's or two named cities' are. Unknown without
 * the text, and then never.
 */
function isSuggestion(readings: readonly CityReading[], text: string | null): boolean {
  return text !== null && readings.length > 0 && !readings.some((each) => isNamedIn(text, each));
}

/**
 * What the visitor hears Lantern could not plan around when a late dinner meets a time to be home
 * by eight: the intake's model writes both words, and the dinner is the one that gives way.
 */
export const LATE_DINNER_SAID = "a late dinner";

/**
 * The phrases said back to the visitor, as typed, without blank ones or repeats. A late dinner
 * the end leaves no room for, which the intake drops, is said back too, as the end's own hour is
 * when no end holds it.
 */
function unplacedOf(intake: GeneratedIntake): string[] {
  const dropped = isTimeWordClash(intake.dinner, intake.end) ? [LATE_DINNER_SAID] : [];
  const phrases = [...intake.unplaced, ...dropped];
  return [...new Set(phrases.map((phrase) => phrase.trim()).filter((phrase) => phrase !== ""))];
}

/**
 * The intake's answer once the resolver has looked for its city. A city the intake named
 * makes the request, as Lantern's assumption when its name could mean others too, which the
 * answer offers beside it. With no city named the answer is the question, the words already
 * read waiting for its answer, with whatever cities were found to pick from, one included:
 * the intake asked, so the visitor answers, and no day is planned for a city they did not
 * name (`docs/decisions.md`, "The start screen reads free text through an intake call"). A request
 * that is still not a valid one is answered as an intake that failed.
 *
 * Two rules the intake's prompt could not hold Haiku to are kept here, from the visitor's
 * `text` when the route gives it (`docs/decisions.md`, "The start screen reads free text through an
 * intake call"). A city the intake named is Lantern's assumption only beside others of its name,
 * the cities its name could mean; any other city written beside it is a suggestion the visitor did
 * not ask for, as Porto beside "surprise me in Lisbon", and is dropped. And a question of cities
 * Lantern suggested says nothing back: the cities answer the words that asked, which the intake
 * kept saying back as a wish it could not plan around.
 */
export function normalizeIntake(
  intake: GeneratedIntake,
  cities: readonly CityReading[],
  now: Date,
  text: string | null = null,
): IntakeResult {
  const words = intakeWordsOf(intake);
  const unplaced = unplacedOf(intake);
  const readings = cities.slice(0, MAX_CITY_READINGS);
  const [city] = readings;
  if (city === undefined || intake.city === null) {
    const said = isSuggestion(readings, text) ? [] : unplaced;
    return { kind: "question", key: "city", readings, words, unplaced: said };
  }
  const others = readings.slice(1).filter((reading) => isSameName(reading, city));
  const isAssumed = others.length > 0;
  const request = DayRequestSchema.safeParse(
    requestOf(words, city, now, isAssumed ? "assumed" : "chosen"),
  );
  if (!request.success) return { kind: "unavailable" };
  return {
    kind: "request",
    request: request.data,
    readings: isAssumed ? [city, ...others] : [],
    unplaced,
  };
}
