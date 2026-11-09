import {
  ASSUMABLE_FACT_KEYS,
  type AssumableFactKey,
  type DayRequest,
  type EnergyLevel,
} from "@/lib/schema/itinerary.schema";
import type { PartialDay } from "@/lib/stream/outcome";
import { clauseOf, type Direction, type StopChange } from "@/features/abacus/clause";
import { FACT_OPTIONS, optionOf, type Fact, type FactKey, type FactSource } from "./facts";

/**
 * The request as a sentence, for any request: "A calm Saturday in Kyoto, on foot, early
 * start, early dinner, home by eight, with …?". The visitor's words are there before the
 * first token; Lantern's arrive one by one, each once it is final, and the word it asks
 * about arrives as the open question.
 */

/**
 * Each changeable word of the sentence, or null for a word of Lantern's that has not arrived
 * yet: absent from the stream so far, so the sentence leaves its place out.
 */
export type SentenceFacts = Readonly<Record<FactKey, Fact | null>>;

/** What the visitor changed on this page without asking for a new day. */
export interface LocalWords {
  /** The energy word, re-picked from the versions already written; null keeps the request's. */
  energy: EnergyLevel | null;
  /** Lantern's assumptions the visitor chose as they were, which makes them their own words. */
  confirmed: readonly AssumableFactKey[];
  /**
   * Words the visitor changed that change no stop, travel's and company's where no stop names
   * it: kept on the day alone, with no call, as theirs.
   */
  kept: Readonly<Partial<Record<AssumableFactKey, string>>>;
}

export const NO_LOCAL_WORDS: LocalWords = { energy: null, confirmed: [], kept: {} };

function factOf(key: FactKey, value: string | null, source: FactSource): Fact {
  return { key, value, options: FACT_OPTIONS[key], source, reason: null, revisedFrom: null };
}

/**
 * The sentence's words from the request, the assumptions as far as they have streamed
 * (already revealed, so each is final), and the visitor's own changes. A word the request
 * gives is chosen. Otherwise Lantern's value is assumed, and its null is the question. The
 * energy word is the one the request always gives, chosen or assumed by the intake, and
 * becomes the visitor's once they pick one.
 */
export function sentenceFactsOf(
  request: DayRequest,
  assumptions: PartialDay["assumptions"],
  local: LocalWords = NO_LOCAL_WORDS,
): SentenceFacts {
  const assumable = ASSUMABLE_FACT_KEYS.map((key): [FactKey, Fact | null] => {
    const kept = local.kept[key];
    if (kept !== undefined) return [key, factOf(key, kept, "chosen")];
    const asked = request[key];
    if (asked !== null) return [key, factOf(key, asked, "chosen")];
    if (assumptions === undefined || !(key in assumptions)) return [key, null];
    const value = assumptions[key] ?? null;
    if (value === null) return [key, factOf(key, null, "asked")];
    return [key, factOf(key, value, local.confirmed.includes(key) ? "chosen" : "assumed")];
  });
  return Object.fromEntries([
    [
      "energy",
      local.energy === null
        ? factOf("energy", request.energy, request.energySource)
        : factOf("energy", local.energy, "chosen"),
    ],
    ...assumable,
  ]) as SentenceFacts;
}

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" });

/** The request's day of the week, "Saturday". Read at noon UTC, so no zone moves the date. */
export function weekdayOf(date: string): string {
  return WEEKDAY.format(new Date(`${date}T12:00:00Z`));
}

/** The energy word as the sentence says it: "quiet" for reflective, the others as named. */
export function energyLabelOf(energy: EnergyLevel): string {
  return optionOf({ options: FACT_OPTIONS.energy }, energy)?.label ?? energy;
}

/** The visitor's own words beyond the energy, as the sentence says them. */
export function chosenLabelsOf(request: DayRequest): string[] {
  return ASSUMABLE_FACT_KEYS.flatMap((key) => {
    const label = optionOf({ options: FACT_OPTIONS[key] }, request[key])?.label;
    return label === undefined ? [] : [label];
  });
}

/** A request said in full, as the visitor gave it: "A lively Saturday in Lisbon, with friends". */
export function requestSentenceOf(request: DayRequest): string {
  const opening = `A ${energyLabelOf(request.energy)} ${weekdayOf(request.date)} in ${request.city}`;
  return [opening, ...chosenLabelsOf(request)].join(", ");
}

/** What a day was written as, in two parts: its energy word, and the words after it. */
export interface RequestGist {
  /** "lively" */
  energy: string;
  /** "Saturday with friends" */
  rest: string;
}

/**
 * What a day was written as, in the parts its gist is set in, so the city's list and the
 * start screen's written days say the same words.
 */
export function gistOf(request: DayRequest): RequestGist {
  return {
    energy: energyLabelOf(request.energy),
    rest: [weekdayOf(request.date), ...chosenLabelsOf(request)].join(" "),
  };
}

/**
 * What a day was written as, said after its city in the city's list: "a lively Saturday
 * with friends".
 */
export function requestGistOf(request: DayRequest): string {
  const { energy, rest } = gistOf(request);
  return `a ${energy} ${rest}`;
}

/**
 * The words in the order the sentence says them after the city, and whether each is
 * followed by another word on screen, which decides whether a comma closes it. A comma
 * shows with the word after it, so a word that arrives last never ends on one.
 */
export function trailsOf(
  facts: SentenceFacts,
): Readonly<Record<"city" | AssumableFactKey, string>> {
  const shown = ASSUMABLE_FACT_KEYS.filter((key) => facts[key] !== null);
  const isFollowed = (index: number) =>
    shown.some((key) => ASSUMABLE_FACT_KEYS.indexOf(key) > index);
  return Object.fromEntries([
    ["city", isFollowed(-1) ? "," : ""],
    // A word not on screen has no comma either: the one before it waits for the next word.
    ...ASSUMABLE_FACT_KEYS.map((key, index) => [
      key,
      facts[key] !== null && isFollowed(index) ? "," : "",
    ]),
  ]) as Record<"city" | AssumableFactKey, string>;
}

/** A piece the header's pen writes in turn: one of Lantern's words, or the line about the day. */
export type PenPiece = AssumableFactKey | "dek";

/**
 * What has arrived for the pen to write, in the order the header reads: Lantern's words as
 * the stream finishes each, then the line about the day once it starts. The visitor's own
 * words are not among them; they are on the page from the start.
 */
export function penPiecesOf(
  request: DayRequest,
  facts: SentenceFacts,
  dek: string | undefined,
): PenPiece[] {
  const words = ASSUMABLE_FACT_KEYS.filter((key) => request[key] === null && facts[key] !== null);
  return dek === undefined ? words : [...words, "dek"];
}

/**
 * The words as the page shows them: Lantern's that the pen has not reached yet are held. An
 * energy the intake assumed comes with the request, not the stream, so it is never held.
 */
export function heldBack(facts: SentenceFacts, reached: readonly PenPiece[]): SentenceFacts {
  return Object.fromEntries(
    Object.entries(facts).map(([key, fact]) => {
      const isLanterns = fact !== null && fact.source !== "chosen";
      const isHeld = isLanterns && key !== "energy" && !reached.includes(key as PenPiece);
      return [key, isHeld ? null : fact];
    }),
  ) as SentenceFacts;
}

/** How many of the longest clauses the header holds room for, as the lab's abacus does. */
export const RESERVED_CLAUSES = 8;

const MINUTES_PER_HOUR = 60;

/** A stop in each part of the day the clause can name, in the day's order. */
const PARTS_OF_A_DAY: readonly Omit<StopChange, "direction">[] = [
  { start: 8 * MINUTES_PER_HOUR, kind: "coffee" },
  { start: 9 * MINUTES_PER_HOUR, kind: "walk" },
  { start: 13 * MINUTES_PER_HOUR, kind: "food" },
  { start: 14 * MINUTES_PER_HOUR, kind: "walk" },
  { start: 19 * MINUTES_PER_HOUR, kind: "food" },
  { start: 19.5 * MINUTES_PER_HOUR, kind: "walk" },
];

const DIRECTIONS: readonly (Direction | null)[] = [null, "quieter", "livelier"];

/**
 * The longest clauses the curve can add to any day, longest first. A streamed day's
 * versions are known only at its end, so the header holds room for what any day could say
 * rather than for this one: from the first stop on, a drag never moves the chart.
 */
export function widestClauses(): string[] {
  const combinations = PARTS_OF_A_DAY.reduce<(Direction | null)[][]>(
    (sofar) => sofar.flatMap((prefix) => DIRECTIONS.map((direction) => [...prefix, direction])),
    [[]],
  );
  const clauses = combinations.map((directions) =>
    clauseOf(
      PARTS_OF_A_DAY.map((part, index) => ({ ...part, direction: directions[index] ?? null })),
    ),
  );
  return longestOf([...new Set(clauses.filter((clause): clause is string => clause !== null))]);
}

function longestOf(clauses: readonly string[]): string[] {
  return clauses.toSorted((a, b) => b.length - a.length).slice(0, RESERVED_CLAUSES);
}
