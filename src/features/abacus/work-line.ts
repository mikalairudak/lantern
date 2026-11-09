import { EVENING_MEAL_FROM, type AssumableFactKey } from "@/lib/schema/itinerary.schema";
import { formatClock, minutesOf, runningSpans } from "@/lib/time/clock";
import { newStopsOf, type ReplanFrame, type ReplanRow } from "./replan-frame";

/**
 * A changed word's work, said under its fork row (`docs/decisions.md`, "A changed word proposes
 * its part beside the day, and the visitor takes it", which moved the line out of the legend's
 * slot of "A changed word's work is said in the legend's slot"): while Lantern writes the
 * proposal, what it is doing; once the proposal is whole, what it would change against the day
 * on screen, its receipt; and why, when it ended without one. Its words change only at
 * milestones, each when the chart shows one; between them only its count does.
 */

/** A changed word as the work line says it. */
export interface WorkChange {
  word: AssumableFactKey;
  /** The answer before, as the sentence said it: "early dinner", or a question's cue, "with …?". */
  from: string;
  /** Whether `from` was the word's own question, which no answer had filled. */
  isFromAsked: boolean;
  /** The answer chosen, as its vocabulary names it: "late", "family". */
  toValue: string;
  /** The same, as the sentence says it: "eating late", "with family". */
  to: string;
}

/** Whether a change rewrites part of the day or all of it. */
export type WorkReach = "part" | "whole";

/** Where a change stands while its proposal is written, or once it ended without one. */
export type WorkMoment =
  /** Asked, and nothing new beside the day yet. */
  | { kind: "looking" }
  /** Its new stops landing: how many are beside the day so far. */
  | { kind: "stops"; written: number }
  /** Their versions written: how many of the stops it wrote have them. */
  | { kind: "versions"; written: number; of: number }
  /** The line about the day, the last of what it writes. */
  | { kind: "dek" }
  /** Ended without a proposal, the day as it was: why, as the page says it by the reason. */
  | { kind: "failed"; said: string };

/** The work line at one moment. */
export interface WorkLine {
  /** Said whole, and anew, at each milestone. */
  words: string;
  /** After the words, alone to change between milestones; null where there is none. */
  count: string | null;
  /** Lantern is working: the steady light runs through the words. */
  isWorking: boolean;
}

/**
 * What a version counts against the day on screen: its stops at places new to the day, on a
 * part its own places moved later or earlier, and on a whole day the same places (null on a
 * part).
 */
export interface WorkCounts {
  added: number;
  same: number | null;
  later: number;
  earlier: number;
}

/**
 * What a version would change against the day on screen (`ReplanControls.receipt`): its first
 * line, "Dinner 21:00, not 18:15 · 3 new stops", and where the day's end moves and the word is
 * not the end's own, its second, "ends 23:45, not 20:45".
 */
export interface WorkReceipt {
  words: string;
  end: string | null;
}

/**
 * What a word looks for while its part is written. A time word's from the schema's own hours:
 * an early start by half past eight, a slow one from nine, an early dinner by about seven, a
 * late one after nine, home by eight, home by eleven, out past midnight. Company's places for
 * who comes along. Travel re-plans nothing, so says no work.
 */
const LOOKING_FOR: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  company: {
    alone: "places for one",
    partner: "places for two",
    family: "places for a family",
    friends: "places for friends",
  },
  start: { early: "an early first stop", slow: "a start from mid-morning" },
  dinner: { early: "a dinner by about seven", late: "a dinner after nine" },
  end: {
    evening: "an evening home by eight",
    early: "an evening home by eleven",
    late: "a night past midnight",
  },
};

/** Who or how a whole day is written again for: "for a family", "for an early start". */
const WRITTEN_FOR: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  company: { alone: "alone", partner: "for two", family: "for a family", friends: "with friends" },
  start: { early: "for an early start", slow: "for a slow morning" },
  dinner: { early: "for an early dinner", late: "for a late dinner" },
  end: { evening: "home by eight", early: "home by eleven", late: "for a late night" },
};

/** The part a time word rewrites alone, as its search names it when it has no hour to seek. */
const PART_OF: Readonly<Partial<Record<AssumableFactKey, string>>> = {
  start: "the morning",
  dinner: "dinner",
  end: "the evening",
};

/** Small counts in words, as "the same eight stops" says them; past twelve, figures. */
const COUNT_WORDS = [
  "no",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

function stopsSaid(count: number): string {
  return count === 1 ? "1 new stop" : `${count} new stops`;
}

/** The first letter up, as a receipt's first word: "With family". */
function capitalized(words: string): string {
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * How a part's stops at its own places moved: "2 later", "1 earlier", or "2 moved" where some
 * went each way; null where none did.
 */
function movedSaid(later: number, earlier: number): string | null {
  if (later > 0 && earlier > 0) return `${later + earlier} moved`;
  if (later > 0) return `${later} later`;
  return earlier > 0 ? `${earlier} earlier` : null;
}

/**
 * What a receipt says after its hour: how many stops are at new places, and on a part how many
 * of its own moved, "1 new stop, 2 later", or on a whole day how many are the same.
 */
function addedSaid({ added, same, later, earlier }: WorkCounts): string {
  if (same === null) {
    const moved = movedSaid(later, earlier);
    if (moved === null) return added === 0 ? "the same stops" : stopsSaid(added);
    if (added > 0) return `${stopsSaid(added)}, ${moved}`;
    // "2 later" alone says no stops: "2 stops later".
    const count = later + earlier;
    return moved.replace(String(count), count === 1 ? "1 stop" : `${count} stops`);
  }
  if (added === 0) return `the same ${COUNT_WORDS[same] ?? same} stops`;
  return `${stopsSaid(added)}, ${same} the same`;
}

/**
 * The work line for a change at one moment. Its words and count keep to about 45 characters, a
 * phone's line beside the fork row's time.
 */
export function workLineOf(change: WorkChange, reach: WorkReach, moment: WorkMoment): WorkLine {
  const isWhole = reach === "whole";
  const working = (words: string, count: string | null = null): WorkLine => ({
    words,
    count,
    isWorking: true,
  });
  switch (moment.kind) {
    case "looking": {
      if (isWhole) {
        const said = WRITTEN_FOR[change.word]?.[change.toValue] ?? change.to;
        return working(`Writing the day again, ${said}`);
      }
      const sought = LOOKING_FOR[change.word]?.[change.toValue];
      return working(sought ? `Looking for ${sought}` : `Writing ${PART_OF[change.word] ?? "it"}`);
    }
    case "stops":
      return working(
        isWhole ? "Writing the day" : "Writing the new stops",
        `${moment.written} so far`,
      );
    case "versions":
      return working("Writing their versions", `${moment.written} of ${moment.of}`);
    case "dek":
      return working("Writing the line about the day");
    case "failed":
      return { words: moment.said, count: null, isWorking: false };
  }
}

/** A stop as a receipt reads it: its time and its kind. */
export interface TimedStop {
  startTime: string;
  durationMinutes: number;
  primary: { kind?: string | null };
}

/** The words a receipt opens with for each hour a time word sets. */
const HOUR_WORDS = { start: "Starts", dinner: "Dinner", end: "Ends" } as const;

type HourWord = keyof typeof HOUR_WORDS;

function isHourWord(word: AssumableFactKey): word is HourWord {
  return word === "start" || word === "dinner" || word === "end";
}

/**
 * The hour a time word sets on a day, in running minutes: the first stop's start, the evening's
 * meal, or the last stop's end. Null for a word that sets no hour, and for a day with no
 * evening meal to name.
 */
export function hourOf(word: AssumableFactKey, stops: readonly TimedStop[]): number | null {
  const spans = runningSpans(stops);
  if (word === "start") return spans[0]?.from ?? null;
  if (word === "end") return spans.at(-1)?.to ?? null;
  if (word === "dinner") {
    const from = minutesOf(EVENING_MEAL_FROM);
    const meal = spans.find(
      (span, index) => stops[index]?.primary.kind === "food" && span.from >= from,
    );
    return meal?.from ?? null;
  }
  return null;
}

/** "Dinner 21:00, not 18:15", or "Dinner at 21:00" where the day on screen says the same or none. */
function hourSaid(word: HourWord, other: number, day: number | null): string {
  const said = HOUR_WORDS[word];
  if (day === null || day === other) return `${said} at ${formatClock(other)}`;
  return `${said} ${formatClock(other)}, not ${formatClock(day)}`;
}

/**
 * What a version would change against the day on screen, read from the two days by code, never
 * from the model's line: the hour its word sets, then its stops at new places, "Dinner 21:00,
 * not 18:15 · 3 new stops"; a whole day by its answer, "With family · 3 new stops, 5 the same".
 * Where its end moves and the word is not the end's own, a second line says so, "ends 23:45,
 * not 20:45". With no counts, as for the day before once the proposal is taken, its hour alone.
 */
export function receiptOf(
  change: Pick<WorkChange, "word" | "to">,
  reach: WorkReach,
  day: readonly TimedStop[],
  other: readonly TimedStop[],
  counts: WorkCounts | null,
): WorkReceipt {
  const { word } = change;
  const hour = isHourWord(word) ? hourOf(word, other) : null;
  const result =
    hour !== null && isHourWord(word)
      ? hourSaid(word, hour, hourOf(word, day))
      : reach === "whole"
        ? capitalized(change.to)
        : null;
  const words = [result, counts === null ? null : addedSaid(counts)].filter(Boolean).join(" · ");
  const ends = hourOf("end", other);
  const ended = hourOf("end", day);
  const isEndMoved = word !== "end" && ends !== null && ended !== null && ends !== ended;
  return { words, end: isEndMoved ? `ends ${formatClock(ends)}, not ${formatClock(ended)}` : null };
}

/** A row the re-plan wrote and the chart shows: a whole new stop, or one that stays. */
type WrittenRow = Extract<ReplanRow, { source: "proposed" | "stays" }>;

function isWritten(row: ReplanRow): row is WrittenRow {
  return row.source === "stays" || (row.source === "proposed" && row.isWhole);
}

/**
 * Where a part's proposal stands, from its frame: what the rows on screen show, never the stream
 * ahead of them. Its new stops are counted as they land, a stop that stays not among them; its
 * versions once the first set is written, of every stop it wrote.
 */
export function partMomentOf(frame: ReplanFrame): WorkMoment {
  const written = frame.rows.filter(isWritten);
  const added = newStopsOf(
    written.map(({ stop }) => stop),
    [frame.idPrefix],
  ).size;
  const versioned = written.filter((row) => row.hasVersions);
  if (frame.writing === "dek") return { kind: "dek" };
  // Once the first set is written, the set being written counts, so the last is said, "4 of 4",
  // before the line about the day.
  if (frame.writing === "versions" && versioned.length > 0) {
    const of = written.length;
    return { kind: "versions", written: Math.min(versioned.length + 1, of), of };
  }
  return added === 0 ? { kind: "looking" } : { kind: "stops", written: added };
}
