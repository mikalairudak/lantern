import type { ReplanWindow } from "@/features/abacus/replan-frame";
import type { WorkCounts, WorkReceipt } from "@/features/abacus/work-line";
import type { AssumableFactKey } from "@/lib/schema/itinerary.schema";
import type { DayOutcome } from "@/lib/stream/outcome";

/**
 * A changed word's re-plan as the page tells the header and the chart of it (`docs/decisions.md`,
 * "A changed word proposes its part beside the day, and the visitor takes it"): a proposal
 * written beside the day, taken or left once it is whole, and either version taken again from
 * memory until the next word changes. Types only, so the header, the chart and their lab
 * matrices read it without the page.
 */

/**
 * Where a word change stands. idle: none on screen; writing: its proposal streams beside the
 * day; proposed: the proposal is whole and the day still the visitor's; taken: the proposal is
 * the day; left: the visitor kept their own day, the proposal folded; failed: it ended without
 * a proposal, the day as it was.
 */
export type ReplanStatus = "idle" | "writing" | "proposed" | "taken" | "left" | "failed";

/** Why a change ended without a proposal: its stream's ending. */
export type ReplanEnding = Exclude<DayOutcome["kind"], "complete">;

/** One of the fork's two answers: the visitor's day before the change, or the proposal. */
export type ForkSide = "from" | "to";

/** What a proposal's receipt counts of the day it wrote. */
/**
 * What a proposal counts of the day it wrote: its stops at places new to the day (a part's by
 * the re-plan's ids, less those at its own places at another hour; a whole day's by spelling),
 * a part's own places moved later or earlier (`movedStopsOf`), and a whole day's stops at the
 * same places as the day before's, by spelling (null for a part).
 */
export type ReplanPlaces = WorkCounts;

/** What a version would change against the day on screen, read from the two days by code. */
export type ForkReceipt = WorkReceipt;

/**
 * How far a whole day's stream is written, while the day before stands on screen. A day writes
 * its line about the day first, before its stops, so only its stops and their versions mark how
 * far it has gone; a part's re-plan writes its line last.
 */
export interface ReplanWritten {
  /** Its stops placed so far. */
  stops: number;
  /** The version sets begun, the one being written among them. */
  versioning: number;
}

/** What the page tells the header and the chart about a word change, from the press on. */
export interface ReplanControls {
  status: ReplanStatus;
  /**
   * Why it ended without a proposal, while status is failed, which the fork row says in its
   * reason's words (`replanEndedOf`): the route busy, our limit, a refusal, a re-plan the merge
   * would not show ("invalid", also when the page ends one early, a new stop being one the merge
   * drops), or a stream cut or a connection lost. Null otherwise.
   */
  ending: ReplanEnding | null;
  /**
   * How far a whole day's stream is written while status is writing, which the day on screen
   * does not show; null for a part, whose proposal's rows show it.
   */
  written: ReplanWritten | null;
  /**
   * What the version not on screen would change against the day that is, once the proposal is
   * whole: the proposal's while the day is the visitor's, the day before's once the proposal is
   * taken. Null before then, and after a failure.
   */
  receipt: ForkReceipt | null;
  /**
   * The word changed and its two answers, as the sentence says them ("early dinner", "eating
   * late"; an open question as its cue, "with …?"), while status is not idle.
   */
  change: { word: AssumableFactKey; from: string; to: string } | null;
  /** Whether the change rewrites part of the day ("part") or all of it ("whole"). */
  reach: "part" | "whole" | null;
  /**
   * The parts the fork stands over, in minutes of the day, one fork row each; a whole day's one
   * window runs from the day's start to its end. Empty at idle.
   */
  windows: readonly ReplanWindow[];
  /**
   * The version not on screen is drawn beside the day: the proposal while it is written and
   * once whole until a choice, and either version again once compared.
   */
  isCompared: boolean;
  /**
   * Takes one answer's version as the day, from memory, with no model call: the proposal's
   * ("to") once it is whole, or the day before's ("from"). The answer already the day folds the
   * other version away. Whether anything changed.
   */
  choose(side: ForkSide): boolean;
  /** Draws the version not on screen beside the day again, or folds it. */
  compare(): void;
  /** Asks for the same change again, after a failure Lantern can retry. */
  askAgain(): void;
}
