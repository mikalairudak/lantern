import { z } from "zod";
import {
  CompanySchema,
  DayEndSchema,
  DayStartSchema,
  DinnerTimeSchema,
  EARLY_END_BY,
  EARLY_START_BY,
  EnergyLevelSchema,
  EVENING_END_BY,
  TravelModeSchema,
  type DayRequest,
} from "./itinerary.schema";

/**
 * Lantern intake contract: the visitor's free text read into the words of a request before
 * any day is asked for (`docs/decisions.md`, "The start screen reads free text through an
 * intake call"). The generated layer keeps the day's rules: strict, every field required,
 * nullable rather than optional, and no format keywords. The intake normalizer
 * (`src/lib/normalizer/normalize-intake.ts`) checks what a schema here cannot say.
 */

/**
 * The longest text the intake reads; a longer one is a 400 before any call (`docs/harness.md`).
 * Here rather than beside the intake's prompt, so the start screen's field holds to it
 * without carrying the prompts to the browser.
 */
export const MAX_INTAKE_TEXT_CHARS = 200;
export const GeneratedIntakeSchema = z.strictObject({
  city: z
    .string()
    .nullable()
    .describe(
      'The city the visitor named, in English, with its region or country when several cities share the name: "Portland, Oregon" for "Portland", where one city of the name dominates. null when the text names no one city (none, more than one, or a country), or when a name fits several cities equally.',
    ),
  cityReadings: z
    .array(z.string())
    .describe(
      "When city is null: the cities the text names when it names more than one, the likeliest two or three cities a shared name could mean, for a country the three in it a visitor most likely means, or when the text asks Lantern to pick the place or describes it without naming one, two or three cities that fit it, the best fit first. When city is the likeliest of the cities a name could mean: the one or two others, likeliest first. Each with its region or country. Otherwise empty.",
    ),
  energy: EnergyLevelSchema.nullable().describe(
    'The day\'s energy when the text names it, in its own word or a plain synonym ("quiet" is reflective, "buzzing" is social). null otherwise.',
  ),
  energyGuess: EnergyLevelSchema.nullable().describe(
    'Only when energy is null: the energy the text points to through what the day holds or who it is with, e.g. lively for "with friends, out until late". null when nothing in the text points anywhere.',
  ),
  travel: TravelModeSchema.nullable().describe(
    'How the visitor gets between stops, when the text says: "on-foot", "transit" or "taxi". null otherwise.',
  ),
  start: DayStartSchema.nullable().describe(
    `When the text says how the day begins: "early" with the first stop by ${EARLY_START_BY}, "slow" mid-morning. null otherwise.`,
  ),
  dinner: DinnerTimeSchema.nullable().describe(
    'When the text says when dinner is: "early" by about seven, "late" after nine. null otherwise.',
  ),
  end: DayEndSchema.nullable().describe(
    `When the text says how the day ends: "evening" home by eight (${EVENING_END_BY}), "early" home by eleven (${EARLY_END_BY}), "late" out past midnight. A time the visitor must be home, back or in bed by is a limit, so take the latest value that is not past it: "home by 8pm" and "back by nine" are evening, "home by midnight" is early, and "home by 7pm" is evening, the earliest there is. "an early night" is early. null otherwise.`,
  ),
  company: CompanySchema.nullable().describe(
    "Who the visitor is with, when the text says. null otherwise.",
  ),
  date: z
    .string()
    .nullable()
    .describe(
      'The day the text names ("Saturday", "tomorrow") as a date like 2026-11-14, read against the visitor\'s today given with the text. null when it names none.',
    ),
  unplaced: z
    .array(z.string())
    .describe(
      'The visitor\'s wishes about the day itself that fit none of the fields above, each quoted on its own as typed, e.g. "with my dog", "vegetarian", "by bike". A time to be home, back or in bed by goes here too, as typed, when end cannot hold it to the hour, e.g. "back by nine" or "home by 7pm", but never one it holds ("home by 8pm", "home by 11pm"). Never a phrase that is not about the day, such as one about watching, following or harming someone, or anything unlawful: that phrase is left out unsaid. Empty when every phrase fits a field or is left out.',
    ),
});

export type GeneratedIntake = z.infer<typeof GeneratedIntakeSchema>;

/** One city a name was found as, as the resolver gives it (`src/lib/intake/resolve-city.ts`). */
export interface CityReading {
  /** Geoapify's id for the place, which the day route resolves again rather than trust a name. */
  placeId: string;
  /** The city's name alone, as the sentence says it: "Portland". */
  name: string;
  /** What tells it from other cities of that name, as a question lists them: "Oregon, United States". */
  region: string;
  /** An IANA city zone, such as "Asia/Tokyo": the day's light and its date are read in it. */
  timezone: string;
}

/**
 * The words read from the text while its city is still open. The date stays the text's,
 * null for none, until the city's zone says which day today is. Who chose the city is
 * known once it is: the visitor, who answers the question.
 */
export interface IntakeWords extends Omit<DayRequest, "city" | "citySource" | "timezone" | "date"> {
  date: string | null;
}

/**
 * What the start screen gets back for the visitor's text. A question is not a way a day
 * ends, so this sits outside `DayOutcome`; once it is a request, the day is asked for as
 * any other. `unplaced` is said back to the visitor who typed it and goes nowhere else: their
 * browser keeps it beside their day (`src/features/day/caveats.ts`), and no server record does.
 */
export type IntakeResult =
  // `readings` holds every city the name could mean when Lantern played the likeliest, in the
  // intake's order, the played one first, so the city word offers the others; empty when
  // the city is the visitor's own.
  | {
      kind: "request";
      request: DayRequest;
      readings: readonly CityReading[];
      unplaced: readonly string[];
    }
  // The words already read wait for the city, so an answer needs no second call.
  | {
      kind: "question";
      key: "city";
      readings: readonly CityReading[];
      words: IntakeWords;
      unplaced: readonly string[];
    }
  // The model declined the text.
  | { kind: "refused" }
  // A timeout, an error, an invalid output, or, with live generation off, any text without a
  // written city: the day's "not yet" with the written days.
  | { kind: "unavailable" }
  // Our own cap answered: the day's resting words.
  | { kind: "limited" };

/** Reads the visitor's text into an intake result; the start screen never knows how. */
export type IntakeReader = (text: string, signal?: AbortSignal) => Promise<IntakeResult>;
