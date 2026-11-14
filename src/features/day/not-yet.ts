import { DAY_LINK_DAYS } from "@/lib/days/stored-day";
import { replanPlanOf, type WindowSpan } from "@/lib/replan/windows";
import type {
  AssumableFactKey,
  DayRequest,
  EnergyLevel,
  FactKey,
  Itinerary,
} from "@/lib/schema/itinerary.schema";
import type { DayOutcome } from "@/lib/stream/outcome";
import type { StopDraft } from "@/features/abacus/day-draft";
import type { Meal } from "@/features/abacus/meal";
import { rewritingPhraseOf } from "@/features/abacus/waiting-pen";
import { runningSpans } from "@/lib/time/clock";
import type { Answer } from "./facts";
import { replannedRequestOf } from "./replan-request";
import type { SentenceFacts } from "./sentence";

/**
 * What Lantern says with live generation off, where a live model would answer. The words stay
 * open and say so after the choice, so the gesture is the one that re-plans the day with it on
 * (docs/decisions.md, "A changed word proposes its part beside the day, and the visitor takes it").
 */

/** Said in place of a new day for a city Lantern has no written day for. */
export const NOT_WRITING_YET = "Lantern isn't writing new days right now. These are written:";

/** Said in place of a new day when our own limit answered. */
export const RESTING = "Lantern has written all the days it can for now. These are written:";

/*
 * What a day that ended without one says happened, with live generation off or on, each followed
 * by a way on (docs/decisions.md, "The stream reports how it ended"). The words do not count the
 * written days: the day on screen is never offered among them.
 */

/** The stream stopped early, or the day it finished could not be read: cut or invalid. */
export const UNFINISHED = "Lantern couldn't finish this day.";

/** The connection failed, before or during the stream. */
export const CONNECTION_DROPPED = "The connection dropped before Lantern finished this day.";

/** The model would not plan the day: it is never offered again, so no retry follows. */
export const REFUSED_LINE = "Lantern can't plan this day.";

/** Nothing came for a day Lantern has written: worth asking again, and nothing else. */
export const BUSY = "Lantern couldn't write this day just now.";

/*
 * What a day's own address says when the day kept there cannot be shown (`docs/decisions.md`,
 * "A day is written to its end, and kept to be opened again"). An unfinished one says `UNFINISHED`,
 * as a day that ended on the page does.
 */

/** The day is still being written, and its record lands only once it is done. */
export const STILL_WRITING = "Lantern is still writing this day.";

/** What follows `STILL_WRITING`: the page waits, and nothing needs pressing. */
export const OPENS_HERE = "It opens here once it's done.";

/** The link was opened past the days it opens its day for (`DAY_LINK_DAYS`). */
export const LINK_EXPIRED = `This day's link has expired: a link opens its day for ${DAY_LINK_DAYS} days.`;

/*
 * What the facts line says of a changed word's re-plan once live: the day on screen holds
 * its place while the new one is asked for, and stays as it was when none comes.
 */

/**
 * While the day a changed word asks for is on its way, naming the word as the visitor chose
 * it: "re-planning the day for “with family”". A part of the facts line, as "assumed by
 * Lantern" is, in place of "click a word to change it".
 */
export function replanningOf(word: string): string {
  return `re-planning the day for “${word}”`;
}

/** The part of the day a time word rewrites alone (`docs/targeted-replan.md`, section 1). */
const PARTS_REWRITTEN: Readonly<Partial<Record<AssumableFactKey, string>>> = {
  start: "the morning",
  dinner: "dinner",
  end: "the evening",
};

/**
 * While a time word rewrites only its part of the day, naming the part: "re-planning the
 * morning". The word itself is in the sentence above, beside the one it replaces, so the
 * line stays as long as the one it stands in for and never takes another line on a phone,
 * which pushed the day down 20 px. Company rewrites the stops it shaped, which no
 * part of the day names: the stops are said with the word, shorter than the whole day's line.
 */
export function replanningPartOf(word: string, changed: AssumableFactKey): string {
  const part = PARTS_REWRITTEN[changed];
  return part ? `re-planning ${part}` : `re-planning stops for “${word}”`;
}

/** A time word's part of the day as the work line names a new one: "the new evening". */
const PARTS_NEW: Readonly<Partial<Record<AssumableFactKey, string>>> = {
  start: "morning",
  dinner: "dinner",
  end: "evening",
};

/**
 * Why a change ended without a proposal, as its fork row says it, a phone's line long: nothing
 * came, worth trying again, as a day that could not be written "just now"; our limit; a
 * refusal; a re-plan that would not fit the day, a new stop the merge drops, at its end or as
 * soon as one is written; the model stopped, or the connection dropped. The day was never
 * touched, so the line says nothing of it. A word that rewrites a part names it, as "re-planning
 * dinner" did; company, which rewrites stops no part names, names the stops.
 */
export function replanEndedOf(
  ending: Exclude<DayOutcome["kind"], "complete">,
  changed: AssumableFactKey,
  reach: "part" | "whole",
): string {
  const part = reach === "part" ? (PARTS_REWRITTEN[changed] ?? "the stops") : undefined;
  const fresh = reach === "part" ? (PARTS_NEW[changed] ?? "stops") : undefined;
  switch (ending) {
    case "unavailable":
      return "Couldn't re-plan just now";
    case "limited":
      return "No more re-plans for now";
    case "refused":
      return part ? `Can't re-plan ${part}` : "Can't re-plan the day";
    case "invalid":
      return fresh ? `The new ${fresh} didn't fit` : "Couldn't finish the new day";
    case "cut":
      return "Lantern stopped part-way";
    case "disconnected":
      return "The connection dropped";
  }
}

/** The control that asks for the same day again. */
export const WRITE_IT_AGAIN = "Write it again";

/*
 * What leads to the written days. Its last two words are tied, so "written:" never stands
 * alone on a line; `text-pretty` would also split the busy line at "just / now.".
 */

/** After the retry. */
export const OR_OPEN_WRITTEN = "or open one it has\u00A0written:";

/** With no retry. */
export const OPEN_WRITTEN = "Open one it has\u00A0written:";

/** What a stop's row calls a meal between lunch and dinner (`mealAt`). */
const SNACK: Meal = "snack";

/**
 * The part of the day a stop stands for when a word's change rewrites it, as its row says it:
 * its meal, or its part of the day. A meal the dinner word names before dinner's hour is the
 * visitor's early dinner, as their word and the line about the day call it, where its row's
 * hour says "snack": Kanazawa's oden at 17:30. A lunch it names stays lunch.
 */
function partOf(stop: StopDraft, start: number | undefined, changed: FactKey): string {
  const phrase = rewritingPhraseOf(stop, start);
  const isNamedByDinner = changed === "dinner" && (stop.dependsOn?.includes("dinner") ?? false);
  return isNamedByDinner && phrase === SNACK ? "dinner" : phrase;
}

/**
 * The parts of the day the stops at these places stand for when a word's change rewrites
 * them, in the day's own words, each once and in the day's order: "lunch", "the afternoon",
 * "dinner".
 */
function partsAt(
  stops: readonly StopDraft[],
  changed: FactKey,
  isPart: (stop: StopDraft, index: number) => boolean,
) {
  // On the day's running clock, so a meal past midnight is the late supper its row says.
  const spans = runningSpans(stops);
  const phrases = stops.flatMap((stop, index) => {
    if (!isPart(stop, index)) return [];
    const phrase = partOf(stop, spans[index]?.from, changed);
    return [COUNTED_PARTS.has(phrase) ? `the ${phrase}` : phrase];
  });
  return [...new Set(phrases)];
}

/** The parts of the day an answer would re-plan, in the day's own words, each once. */
function partsShapedBy(key: FactKey, stops: readonly StopDraft[]): string[] {
  return partsAt(stops, key, (stop) => stop.dependsOn?.includes(key) ?? false);
}

/** Parts said with an article in a sentence, as "the snack stays as written". */
const COUNTED_PARTS: ReadonlySet<string> = new Set(["snack", "late supper", "late evening"]);

function listOf(parts: readonly string[]): string {
  if (parts.length < 2) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

/**
 * The facts line after a changed word, naming what it would have re-planned: "Lantern isn't
 * re-planning days right now, so dinner stays as written".
 */
export function notReplanningYetOf(key: FactKey, stops: readonly StopDraft[]): string {
  const parts = partsShapedBy(key, stops);
  const kept =
    parts.length === 0
      ? "the day stays"
      : `${listOf(parts)} ${parts.length === 1 ? "stays" : "stay"}`;
  return `Lantern isn't re-planning days right now, so ${kept} as written`;
}

/*
 * What an answer in a word's list says it will do before it is chosen, under its row
 * (`docs/decisions.md`, "A changed word proposes its part beside the day, and the visitor takes
 * it"). Worked out from the plan the route runs for it (`replanPlanOf`), never apart from it, so
 * the line and the re-plan that follows agree.
 */

/** What choosing an answer does to the day on screen. */
export type AnswerReach =
  /** The answer the word has: choosing it changes nothing. */
  | { kind: "current" }
  /**
   * The energy: the curve re-picks among the versions already written. What that changes
   * depends on the places on screen, which a reach does not know: `repickLineOf` says it.
   */
  | { kind: "repick" }
  /**
   * A word whose windows the route rewrites, by the parts of the day they hold, and the time
   * its first window starts at, where its fork's first row stands.
   */
  | { kind: "part"; parts: readonly string[]; at: string }
  /** Travel, or company no stop names: the word changes alone, every stop as it was. */
  | { kind: "keep" }
  /** A time word no stop names, or windows that hold most of the day: the whole day again. */
  | { kind: "whole" };

/** How long a change made on the page takes: it is there when chosen. */
const AT_ONCE = "at\u00A0once";

/**
 * Said under an answer that changes the word alone (travel's, and company's no stop names),
 * and under an energy answer that leaves every stop as it is shown.
 */
export const KEEPS_EVERY_STOP = `keeps every stop · ${AT_ONCE}`;

/** What the energy word's answers would do to the stops on screen, as the page counts it. */
export interface EnergyRepicks {
  /** How many stops a level would show another place at, counted from the re-pick its press makes. */
  changedBy: (level: EnergyLevel) => number;
  /** The stops on screen. */
  stops: number;
}

/**
 * The line under an energy answer: "re-picks six stops · at once", "keeps every stop · at once"
 * where it changes none, and "re-picks every stop" where it changes them all on a day of two or
 * more. The count says beforehand that a level clears the stops the visitor chose, and that a
 * neighbouring level can give the same day.
 */
export function repickLineOf(changed: number, stops: number): string {
  if (changed === 0) return KEEPS_EVERY_STOP;
  if (changed === 1) return `re-picks one stop · ${AT_ONCE}`;
  if (changed >= stops) return `re-picks every stop · ${AT_ONCE}`;
  return `re-picks ${PART_COUNTS[changed] ?? String(changed)} stops · ${AT_ONCE}`;
}

/**
 * What the facts line says once such a word is chosen, in place of its hint, why no stop
 * changed: the day is planned a walk's way across whatever the travel word, and the model
 * planned no stop around who comes. Each shorter than the whole day's re-planning line.
 */
const KEPT_BECAUSE: Readonly<Record<"travel" | "company", string>> = {
  travel: "every stop stays, a short way from the next",
  company: "every stop stays, fit for any company",
};

/** The facts line once a word is changed alone (`KEEPS_EVERY_STOP`). */
export function keptStopsLineOf(changed: AssumableFactKey): string | null {
  return changed === "travel" || changed === "company" ? KEPT_BECAUSE[changed] : null;
}

/*
 * How long each takes is tied, so it never breaks across the list's lines: "about / half a
 * minute" read as two thoughts.
 */

/** Said under an answer that writes the whole day again, as a proposal to take or leave. */
export const WHOLE_DAY_AGAIN = "a proposal for the whole day · under\u00A0a\u00A0minute";

/** How long a re-plan of part of the day takes, said after the parts it rewrites. */
const PART_AGAIN_TAKES = "about\u00A0half\u00A0a\u00A0minute";

/*
 * What a changed word's two answers say while its fork stands (`docs/decisions.md`, "A changed
 * word proposes its part beside the day, and the visitor takes it"): the day on screen is the
 * visitor's until they take the proposal, and either version is taken again from memory.
 */

/** Said under the visitor's own answer while the proposal is written: the change still counts. */
export const YOUR_DAY_WHILE_WRITTEN = "your day as it is · the proposal counts as one of your days";

/** Said under the proposal's answer while it is written beside the day: nothing to take yet. */
export const BEING_WRITTEN = "being written beside your day";

/** Said under the proposal's answer once whole and not taken: taking it is free and at once. */
export const PROPOSED_BESIDE = "drawn beside your day · take it at\u00A0once";

/** Said under the visitor's old answer once the proposal is taken: the day before, from memory. */
export const THE_DAY_BEFORE = "the day before · at\u00A0once";

/** Said under the proposal's answer once the visitor kept their own day: from memory. */
export const THE_PROPOSAL = "the proposal · at\u00A0once";

/**
 * The parts of the day the windows a word's change rewrites hold, in the day's own words, each
 * once: "lunch and dinner".
 */
export function partsInWindowsOf(
  stops: readonly StopDraft[],
  windows: readonly WindowSpan[],
  changed: FactKey,
): string[] {
  return partsAt(stops, changed, (_, index) =>
    windows.some(({ from, to }) => index >= from && index <= to),
  );
}

/**
 * What an answer would do to a day written to its end, as the page will ask the route for
 * it: the request with the answer (`replannedRequestOf`), read by the route's own plan.
 */
export function answerReachOf(
  day: Itinerary,
  request: DayRequest,
  facts: SentenceFacts,
  { key, value }: Answer,
): AnswerReach {
  if (facts[key]?.value === value) return { kind: "current" };
  if (key === "energy") return { kind: "repick" };
  const asked = replannedRequestOf(request, facts, { key, value });
  const plan = replanPlanOf(day, asked, key);
  if (plan.kind === "full") return { kind: "whole" };
  if (plan.kind === "word") return { kind: "keep" };
  const first = plan.windows[0];
  return {
    kind: "part",
    parts: partsInWindowsOf(day.stops, plan.windows, key),
    at: (first && day.stops[first.from]?.startTime) ?? day.stops[0]?.startTime ?? "",
  };
}

/**
 * The most parts the line under an answer names, more counted. On a 360 px phone's word list,
 * its time kept whole on its line, every recorded day's line takes two lines, Elche's four
 * parts included; four in an unlucky order take a third, and five always do.
 */
const MAX_NAMED_PARTS = 4;

/** A count in words to nine, as the line under an answer says it; digits past. */
const PART_COUNTS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/**
 * The line under an answer: "a proposal for lunch and dinner · about half a minute", "a proposal
 * for five parts of the day · about half a minute" past four, "a proposal for the whole day ·
 * under a minute"; none under the current answer, nor here under the energy's, whose line counts
 * the places on screen (`repickLineOf`).
 */
export function forecastOf(reach: AnswerReach): string | null {
  if (reach.kind === "current" || reach.kind === "repick") return null;
  if (reach.kind === "keep") return KEEPS_EVERY_STOP;
  if (reach.kind === "whole") return WHOLE_DAY_AGAIN;
  if (reach.parts.length <= MAX_NAMED_PARTS) {
    return `a proposal for ${listOf(reach.parts)} · ${PART_AGAIN_TAKES}`;
  }
  const count = PART_COUNTS[reach.parts.length] ?? String(reach.parts.length);
  return `a proposal for ${count} parts of the day · ${PART_AGAIN_TAKES}`;
}

/**
 * While a changed word's re-plan streams, what it rewrites, naming every part its windows
 * hold: "re-planning lunch, the afternoon, dinner and the evening"; the whole day's line
 * for any other reach.
 */
export function replanningReachOf(word: string, reach: AnswerReach): string {
  return reach.kind === "part" ? `re-planning ${listOf(reach.parts)}` : replanningOf(word);
}

/** What the facts line reads of a changed word's fork (`ForkView`). */
export interface ForkNoteInput {
  /** The visitor's answer before the change, and the proposal's, as the sentence says them. */
  from: string;
  to: string;
  isWriting: boolean;
  isReady: boolean;
  isFailed: boolean;
  isChosen: boolean;
  canAskAgain: boolean;
  /** Why it ended without a proposal, in the fork row's words; null otherwise. */
  reason: string | null;
}

/** What the facts line says while a changed word's fork stands, and the press it offers. */
export interface ForkNote {
  words: string;
  /** To the fork's first row, by its stop's time; or "Ask again"; or none. */
  link: { kind: "see"; at: string } | { kind: "ask-again" } | null;
}

/** The press that leads to a fork's first row, which is usually below a phone's screen. */
export function seeItAtOf(at: string): string {
  return `see it at\u00A0${at}`;
}

/** The press that asks for a failed proposal again. */
export const ASK_AGAIN = "Ask again";

/**
 * The facts line's words while a changed word's fork stands, where the visitor looks once they
 * have pressed (the phone pass, 2026-11-08): what is being written and where, what is drawn
 * beside the day, or why the word came back. The answers are quoted, so "Writing “eating
 * late”" never reads as a slip; a part's fork points to its first row at `at`, a press away,
 * since the page never scrolls by itself. `parts` are those the proposal writes, none for a
 * whole day's. Null once a version is chosen, and at rest.
 */
export function forkNoteOf(
  fork: ForkNoteInput,
  parts: readonly string[],
  at: string | null,
): ForkNote | null {
  if (fork.isChosen) return null;
  const see = at === null ? null : { kind: "see" as const, at };
  const what =
    parts.length === 0
      ? "the whole day"
      : parts.length <= MAX_NAMED_PARTS
        ? listOf(parts)
        : `${PART_COUNTS[parts.length] ?? String(parts.length)} parts of the day`;
  if (fork.isWriting) return { words: `Writing “${fork.to}” for ${what}`, link: see };
  if (fork.isReady) {
    return parts.length === 0
      ? { words: `“${fork.to}” is written as a whole day`, link: null }
      : { words: `“${fork.to}” drawn beside ${what}`, link: see };
  }
  if (fork.isFailed && fork.reason !== null) {
    return {
      words: `${fork.reason}, so “${fork.from}” stays`,
      link: fork.canAskAgain ? { kind: "ask-again" } : null,
    };
  }
  return null;
}
