import { MAX_CITY_READINGS, MIDDLE_ENERGY } from "@/lib/normalizer/normalize-intake";
import {
  GeneratedIntakeSchema,
  type CityReading,
  type GeneratedIntake,
  type IntakeResult,
} from "@/lib/schema/intake.schema";
import {
  ASSUMABLE_FACT_KEYS,
  type Company,
  type DayEnd,
  type DayRequest,
  type DayStart,
  type DinnerTime,
  type EnergyLevel,
  type TravelMode,
} from "@/lib/schema/itinerary.schema";
import type { CheckResult } from "./checks";

/**
 * The intake's eval (`docs/harness.md`, "B. The intake eval"). Unlike a day, each golden text
 * has one right answer, or the few a careful reader could give, so a case scores by exact
 * match. Hard checks hold in every run; scored ones are shares held to a threshold, which
 * are proposals until the first live run calibrates them, as the day's were.
 */

type EnergySource = DayRequest["energySource"];

/** The words a case expects. A word left out is expected null; the energy, the middle one, Lantern's. */
export interface ExpectedWords {
  /** Every energy a careful reader could take from the text. */
  energy?: readonly EnergyLevel[];
  /**
   * Every source a careful reader could give the energy: "chosen" when the text names it
   * itself. Left out, it is Lantern's alone.
   */
  energySource?: readonly EnergySource[];
  travel?: TravelMode;
  start?: DayStart;
  dinner?: DinnerTime;
  end?: DayEnd;
  company?: Company;
}

export interface ExpectedRequest {
  city: string;
  /** Tells apart cities that share a name, as the day's light and date do. */
  timezone: string;
  date: string;
  words?: ExpectedWords;
  /**
   * The other cities the name could mean, as "Portland, Maine", where Lantern plays the
   * likeliest as its assumption. None where the city is the visitor's own.
   */
  readings?: readonly string[];
  /** Phrases the visitor must hear back; others the model says back are no miss. */
  unplaced?: readonly string[];
}

export interface ExpectedQuestion {
  /**
   * Each city the question must offer, as "Springfield, Illinois": its name, then its region.
   * Empty, it offers none, unless the case lets Lantern suggest.
   */
  readings: readonly string[];
  /**
   * The text asked Lantern to pick the place, or described one without naming it: any two or three
   * cities it suggests, each found, are right (`docs/decisions.md`, "The start screen reads free
   * text through an intake call").
   */
  suggests?: true;
  words?: ExpectedWords;
  date?: string;
  unplaced?: readonly string[];
}

export interface IntakeCase {
  name: string;
  /** What the visitor typed. */
  text: string;
  /**
   * What a careful model writes for the text, by hand. Run through the resolver and the
   * normalizer, it proves every expected answer can be reached; live runs replace it in MVP.
   */
  recorded: GeneratedIntake;
  /** Every answer the case accepts; any other misses. */
  accepts: { request?: ExpectedRequest; question?: ExpectedQuestion; refused?: true };
  /**
   * The only phrases the visitor may hear back, in any answer; none where the list is empty.
   * Set where the text holds a phrase that is not about the day, which is dropped unsaid
   * (`docs/decisions.md`, "The intake's expected answers are product calls"); left out, anything
   * may be said back.
   */
  mayHearBack?: readonly string[];
}

export interface IntakeRun {
  /** What the model wrote; left out when it wrote nothing, as when it declined. */
  output?: unknown;
  result: IntakeResult;
}

export const INTAKE_CHECK_IDS = [
  "shape",
  "no-unnamed-city",
  "outcome",
  "readings",
  "words",
  "energy-source",
  "unplaced",
  "unsaid",
] as const;
export type IntakeCheckId = (typeof INTAKE_CHECK_IDS)[number];

/** One check over one case: how many chances it had to miss, and the misses. */
export interface IntakeTally {
  total: number;
  findings: string[];
}
export type IntakeCaseScore = Record<IntakeCheckId, IntakeTally>;

/** The fewest cities a suggestion offers; the most is the readings' `MAX_CITY_READINGS`. */
export const MIN_SUGGESTED_CITIES = 2;

/** A needless question costs a visitor a step; a missing one is a hard fail instead. */
export const MIN_SHARE_INTAKE_OUTCOMES = 0.95;
export const MIN_SHARE_INTAKE_READINGS = 0.9;
export const MIN_SHARE_INTAKE_WORDS = 0.9;
/** A guess shown as the visitor's word misstates what they asked. */
export const MIN_SHARE_INTAKE_ENERGY_SOURCE = 0.9;
export const MIN_SHARE_INTAKE_UNPLACED = 0.8;

/** The share each scored check must reach; null for a hard one. */
const THRESHOLDS: Record<IntakeCheckId, number | null> = {
  shape: null,
  "no-unnamed-city": null,
  outcome: MIN_SHARE_INTAKE_OUTCOMES,
  readings: MIN_SHARE_INTAKE_READINGS,
  words: MIN_SHARE_INTAKE_WORDS,
  "energy-source": MIN_SHARE_INTAKE_ENERGY_SOURCE,
  unplaced: MIN_SHARE_INTAKE_UNPLACED,
  unsaid: null,
};

/** Every check on one run of one case. */
export function scoreIntakeCase(golden: IntakeCase, run: IntakeRun): IntakeCaseScore {
  const parsed = run.output === undefined ? null : GeneratedIntakeSchema.safeParse(run.output);
  const shape = parsed === null || parsed.success ? null : `${golden.name}: not an intake`;
  return {
    shape: tally(parsed === null ? [] : [shape]),
    "no-unnamed-city": noUnnamedCity(golden, run.result),
    outcome: outcome(golden, run.result),
    readings: readings(golden, run.result),
    words: words(golden, run.result),
    "energy-source": energySource(golden, parsed?.success ? parsed.data : null),
    unplaced: unplaced(golden, run.result),
    unsaid: unsaid(golden, run.result),
  };
}

/** The set's results: each check over every run of every case. */
export function scoreIntakeSet(scores: readonly IntakeCaseScore[]): CheckResult<IntakeCheckId>[] {
  return INTAKE_CHECK_IDS.map((id) => {
    const total = scores.reduce((sum, score) => sum + score[id].total, 0);
    const findings = scores.flatMap((score) => score[id].findings);
    const threshold = THRESHOLDS[id];
    if (threshold === null) {
      return { id, kind: "hard", passed: findings.length === 0, value: null, threshold, findings };
    }
    const value = total === 0 ? 1 : (total - findings.length) / total;
    return { id, kind: "scored", passed: value >= threshold, value, threshold, findings };
  });
}

/** Each chance is null where it hit and a finding where it missed. */
function tally(chances: readonly (string | null)[]): IntakeTally {
  const findings = chances.filter((chance): chance is string => chance !== null);
  return { total: chances.length, findings };
}

/**
 * Hard: a day only where the case accepts one, and only for the city the visitor named. It
 * fails a day for a city they did not name, and a day for a text the model should decline.
 */
function noUnnamedCity({ name, accepts }: IntakeCase, result: IntakeResult): IntakeTally {
  if (result.kind !== "request") return tally([]);
  const { city, timezone } = result.request;
  const expected = accepts.request;
  if (expected === undefined) {
    return tally([`${name}: a day for ${city}, where the case accepts none`]);
  }
  const isExpected = city === expected.city && timezone === expected.timezone;
  const wrong = `${name}: a day for ${city} (${timezone}), not ${expected.city} (${expected.timezone})`;
  return tally([isExpected ? null : wrong]);
}

function outcome({ name, text, accepts }: IntakeCase, result: IntakeResult): IntakeTally {
  const accepted = (["request", "question", "refused"] as const).filter((kind) => accepts[kind]);
  const isAccepted = accepted.some((kind) => kind === result.kind);
  const wrong = `${name}: ${result.kind} for "${text}", which accepts ${accepted.join(" or ")}`;
  return tally([isAccepted ? null : wrong]);
}

function labelOf({ name, region }: CityReading): string {
  return region === "" ? name : `${name}, ${region}`;
}

/** Each expected city among those offered, as a question or the city word lists them. */
function offered(
  name: string,
  expected: readonly string[],
  readings: readonly CityReading[],
): (string | null)[] {
  const labels = readings.map(labelOf);
  return expected.map((each) => {
    const isOffered = labels.some((label) => label === each || label.startsWith(`${each}, `));
    return isOffered ? null : `${name}: no ${each} among ${labels.join("; ") || "no readings"}`;
  });
}

/** A suggestion's count of cities found, in the range the owner set. */
function suggested(name: string, readings: readonly CityReading[]): string | null {
  const count = readings.length;
  if (count >= MIN_SUGGESTED_CITIES && count <= MAX_CITY_READINGS) return null;
  return `${name}: ${count} cities suggested, not ${MIN_SUGGESTED_CITIES} to ${MAX_CITY_READINGS}`;
}

/** A question the case expects with no city to pick from offers none. */
function noneOffered(name: string, readings: readonly CityReading[]): string | null {
  if (readings.length === 0) return null;
  return `${name}: offers ${readings.map(labelOf).join("; ")}, where it should ask with none`;
}

/**
 * A question offers each city it should, or two or three of Lantern's own where the text asked
 * it to pick, and none where the case expects none. A day plays its city as Lantern's assumption
 * exactly when the case expects others its name could mean, and then offers each of them.
 */
function readings({ name, accepts }: IntakeCase, result: IntakeResult): IntakeTally {
  if (result.kind === "question" && accepts.question !== undefined) {
    const { readings: expected, suggests } = accepts.question;
    if (suggests) return tally([suggested(name, result.readings)]);
    if (expected.length === 0) return tally([noneOffered(name, result.readings)]);
    return tally(offered(name, expected, result.readings));
  }
  if (result.kind !== "request" || accepts.request === undefined) return tally([]);
  const others = accepts.request.readings ?? [];
  const { city, citySource } = result.request;
  const isSourceRight = citySource === (others.length > 0 ? "assumed" : "chosen");
  const wrongSource =
    citySource === "assumed"
      ? `${name}: ${city} as Lantern's assumption, not the visitor's`
      : `${name}: ${city} as the visitor's, not Lantern's assumption`;
  return tally([isSourceRight ? null : wrongSource, ...offered(name, others, result.readings)]);
}

/** What an answer of an accepted kind was expected to hold; none for any other answer. */
function expectedFor(
  { accepts }: IntakeCase,
  result: IntakeResult,
): ExpectedRequest | ExpectedQuestion | undefined {
  if (result.kind === "request") return accepts.request;
  if (result.kind === "question") return accepts.question;
  return undefined;
}

function words(golden: IntakeCase, result: IntakeResult): IntakeTally {
  const expected = expectedFor(golden, result);
  if (expected === undefined || (result.kind !== "request" && result.kind !== "question")) {
    return tally([]);
  }
  const actual = result.kind === "request" ? result.request : result.words;
  const energies = expected.words?.energy ?? [MIDDLE_ENERGY];
  const date = expected.date ?? null;
  const { name } = golden;
  return tally([
    energies.includes(actual.energy)
      ? null
      : `${name}: energy ${actual.energy}, not ${energies.join(" or ")}`,
    ...ASSUMABLE_FACT_KEYS.map((key) => {
      const want = expected.words?.[key] ?? null;
      return actual[key] === want ? null : `${name}: ${key} ${actual[key]}, not ${want}`;
    }),
    actual.date === date ? null : `${name}: date ${actual.date}, not ${date}`,
  ]);
}

/** Lantern's guess unless the case says the text names the energy, or might. */
const GUESSED: readonly EnergySource[] = ["assumed"];

/** From what the model wrote: an energy is the visitor's only where the case accepts it so. */
function energySource({ name, accepts }: IntakeCase, intake: GeneratedIntake | null): IntakeTally {
  if (intake === null) return tally([]);
  const sources =
    accepts.request?.words?.energySource ?? accepts.question?.words?.energySource ?? GUESSED;
  if (intake.energy !== null && intake.energyGuess !== null) {
    return tally([`${name}: both an energy, ${intake.energy}, and a guess, ${intake.energyGuess}`]);
  }
  const source: EnergySource = intake.energy === null ? "assumed" : "chosen";
  if (sources.includes(source)) return tally([null]);
  return tally([
    source === "assumed"
      ? `${name}: the energy the text names read as Lantern's`
      : `${name}: ${intake.energy} written as the visitor's, where the text names none`,
  ]);
}

/** Lenient on wording: "my dog" catches "with my dog", since either says the dog back. */
function unplaced(golden: IntakeCase, result: IntakeResult): IntakeTally {
  const expected = expectedFor(golden, result);
  if (
    expected?.unplaced === undefined ||
    (result.kind !== "request" && result.kind !== "question")
  ) {
    return tally([]);
  }
  const said = result.unplaced.map((phrase) => phrase.trim().toLowerCase());
  return tally(
    expected.unplaced.map((phrase) => {
      const want = phrase.toLowerCase();
      const isSaid = said.some(
        (each) => each !== "" && (each.includes(want) || want.includes(each)),
      );
      return isSaid ? null : `${golden.name}: "${phrase}" not said back`;
    }),
  );
}

/**
 * Hard, where the case sets `mayHearBack`: the visitor hears back no other phrase, in any
 * answer, a question included, so a phrase that is not about the day goes unsaid. One chance
 * a case. A phrase passes only as part of an allowed one ("my dog" within "with my dog"),
 * never the other way round, so a dropped phrase joined to an allowed one is still said back.
 */
function unsaid({ name, mayHearBack }: IntakeCase, result: IntakeResult): IntakeTally {
  if (mayHearBack === undefined || (result.kind !== "request" && result.kind !== "question")) {
    return tally([]);
  }
  const allowed = mayHearBack.map((phrase) => phrase.toLowerCase());
  const extra = result.unplaced.filter((phrase) => {
    const said = phrase.trim().toLowerCase();
    return said !== "" && !allowed.some((each) => each.includes(said));
  });
  const room =
    mayHearBack.length === 0
      ? "nothing may be"
      : `only ${mayHearBack.map((phrase) => `"${phrase}"`).join(", ")} may be`;
  return tally(
    extra.length === 0
      ? [null]
      : extra.map((phrase) => `${name}: "${phrase}" said back, where ${room}`),
  );
}
