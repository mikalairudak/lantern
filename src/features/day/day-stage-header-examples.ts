/**
 * The day stage header's examples for the lab's matrix: the days it is set on, the moments
 * of a day it is set in, and each moment worked out as a frame of the day's real stream, the
 * day as it ended, or what the visitor did to it. A plain module, so the lab's server page
 * can read the axes; the cell that draws a frame is a client component.
 */

import type { ComponentProps } from "react";
import { changesOf, clauseOf } from "@/features/abacus/clause";
import {
  candidatesOf,
  energyOf,
  hintStop,
  isAsWritten,
  modelPicks,
  pickCandidate,
  stepEnergy,
} from "@/features/abacus/curve";
import { DEK, completeDraftOf, draftDayOf } from "@/features/abacus/day-draft";
import { dayContextOf } from "@/features/abacus/light";
import { revealedOf, type RevealedPartial } from "@/features/itinerary/revealed";
import { firstAt, partialAt } from "@/features/itinerary/stream-frames";
import { PORTLAND_MAINE, PORTLAND_OREGON } from "@/lib/fixtures/city-readings";
import {
  ELCHE_DINNER_BASIS,
  ELCHE_EATING_LATE,
  ELCHE_ITINERARY,
  ELCHE_LATE_DINNER_UNREPEATED,
  ELCHE_REQUEST,
} from "@/lib/fixtures/replan/elche-dinner";
import { KANAZAWA_START_DAY } from "@/lib/days/written/kanazawa";
import { LISBON_DAY } from "@/lib/fixtures/curated/lisbon";
import { LISBON_REQUEST } from "@/lib/fixtures/curated/requests";
import { MINIMAL_DAY } from "@/lib/fixtures/edge/minimal";
import { POLAR_NIGHT_DAY } from "@/lib/fixtures/edge/polar";
import { GOLDEN_INTAKES } from "@/lib/fixtures/intake/golden";
import { SUNRISE_ALTITUDE, sunCrossing } from "@/lib/geo/sun";
import { normalizeDay } from "@/lib/normalizer/normalize";
import { mergeShownReplan } from "@/lib/replan/merge";
import type { CityReading } from "@/lib/schema/intake.schema";
import {
  ASSUMABLE_FACT_KEYS,
  type AssumableFactKey,
  type DayRequest,
  type GeneratedDay,
  type Itinerary,
  type Stop,
} from "@/lib/schema/itinerary.schema";
import type { DayOutcome, PartialDay } from "@/lib/stream/outcome";
import {
  dayText,
  dayTextOffsets,
  simulateDayStream,
  type StreamPace,
} from "@/lib/stream/simulate-day-stream";
import { endedDayOf, keptNoticeOf, noticeOf, phaseOf, slotOf } from "./stream-ending";
import { ASKED_LABELS, FACT_OPTIONS, labelOf } from "./facts";
import { answerReachOf, forkNoteOf, notReplanningYetOf, replanningOf, seeItAtOf } from "./not-yet";
import type { ReplanControls } from "./replan-controls";
import {
  NO_LOCAL_WORDS,
  heldBack,
  penPiecesOf,
  sentenceFactsOf,
  type SentenceFacts,
} from "./sentence";
import type { DayStageHeader } from "./day-stage-header";

/** A day the header is set on: its request, and the stream that writes it, when one is written. */
export interface HeaderDay {
  label: string;
  request: DayRequest;
  /** The fixture its stream plays; null for a request no one has written a day for. */
  day: GeneratedDay | null;
  /**
   * A day kept as production recorded it, written to its end, with no stream to play, and the
   * day a recorded re-plan of it merged into, with the request it was asked with.
   */
  recorded?: { itinerary: Itinerary; replanned: { request: DayRequest; itinerary: Itinerary } };
  /** Every city the name could mean, when Lantern played the likeliest of them. */
  readings?: readonly CityReading[];
  playedReading?: string | null;
}

/** Production's Elche day, re-planned from an early dinner to eating late, as merged. */
function elcheReplannedOf(): Itinerary {
  const merged = mergeShownReplan({ ...ELCHE_DINNER_BASIS, replan: ELCHE_LATE_DINNER_UNREPEATED });
  if (!merged.ok) throw new Error(`Elche's re-plan merges: ${merged.reason}`);
  return merged.itinerary;
}

/**
 * "Portland, out late with friends", as the intake reads it: the text names no energy but
 * points to a lively one, which Lantern assumes, as it assumes the city most visitors mean by
 * the name and offers the other beside it. The one day whose energy word is Lantern's.
 */
const PORTLAND: DayRequest = {
  ...LISBON_REQUEST,
  city: PORTLAND_OREGON.name,
  citySource: "assumed",
  timezone: PORTLAND_OREGON.timezone,
  energySource: "assumed",
  end: "late",
};

/**
 * The days the header is set on: the hero day; Lisbon, the longest sentence and line about
 * the day; Hong Kong, the shortest line, every word the visitor's own, so nothing is dotted;
 * a city and an energy Lantern assumed, with the others the name could mean; and a day whose
 * sun never rises, so its facts say no sun.
 */
export const HEADER_DAYS: readonly HeaderDay[] = [
  { label: "Kanazawa", request: KANAZAWA_START_DAY.request, day: KANAZAWA_START_DAY.day },
  { label: "Lisbon, the longest", request: LISBON_DAY.request, day: LISBON_DAY.day },
  {
    label: `${MINIMAL_DAY.request.city}, the shortest, every word the visitor's`,
    request: MINIMAL_DAY.request,
    day: MINIMAL_DAY.day,
  },
  {
    label: "Portland, assumed, with readings",
    request: PORTLAND,
    day: null,
    readings: [PORTLAND_OREGON, PORTLAND_MAINE],
    playedReading: PORTLAND_OREGON.placeId,
  },
  {
    label: `${POLAR_NIGHT_DAY.request.city}, ${POLAR_NIGHT_DAY.edge}`,
    request: POLAR_NIGHT_DAY.request,
    day: POLAR_NIGHT_DAY.day,
  },
  {
    label: "Elche, production's, its dinner re-planned",
    request: ELCHE_REQUEST,
    day: null,
    recorded: {
      itinerary: ELCHE_ITINERARY,
      replanned: { request: ELCHE_EATING_LATE, itinerary: elcheReplannedOf() },
    },
  },
];

/**
 * What a moment's label says when a visitor cannot reach it with live generation off: the route
 * answers every written day whole and any other city with not yet, so only a live model's
 * stream is cut, dropped, refused, busy or at our own limit.
 */
const AFTER_LAUNCH = "(after launch)";

/**
 * The moments the product sets the header in, in the order a day lives them, its endings
 * last. Moment and ending are one axis, so no cell crosses a moment with an ending the
 * product never draws over it.
 */
export const HEADER_MOMENTS = [
  { label: "the visitor's words only", key: "asked" },
  {
    label: "the visitor's words, waiting for the model's first: the light through them",
    key: "asked-waiting",
  },
  { label: "the start screen's turn: the words after Lantern's first held unseen", key: "turn" },
  { label: "Lantern's words being written", key: "words" },
  { label: "the line about the day, mid-word", key: "dek" },
  { label: "written, with the hint", key: "written" },
  {
    label: "drawn whole, as a day seen here and the page's first HTML have it",
    key: "whole",
  },
  {
    label:
      "the playing's first frame, the unheard copy an unseen visitor has beside the whole header before the page runs, lit",
    key: "first-frame",
  },
  { label: "written, after one stop is dragged livelier", key: "one-livelier" },
  { label: "written, after every stop is dragged livelier", key: "all-livelier" },
  { label: "a changed word", key: "changed" },
  { label: `a changed word being re-planned, the day held ${AFTER_LAUNCH}`, key: "replanning" },
  {
    label: `a proposal being written: its word says both answers, the proposal's lit in blue, every other word locked, the facts line saying what is written and where, the line as first planned ${AFTER_LAUNCH}`,
    key: "replan-writing",
  },
  {
    label: `a proposal being written for the longest answer a word offers: on a phone the pair can take a line more, gliding once ${AFTER_LAUNCH}`,
    key: "replan-writing-longest",
  },
  {
    label: `a proposal being written for the shortest answer a word offers ${AFTER_LAUNCH}`,
    key: "replan-writing-shortest",
  },
  {
    label: `a proposal being written, its word's list open: the visitor's day as it is, and the proposal being written ${AFTER_LAUNCH}`,
    key: "replan-writing-list",
  },
  {
    label: `a re-plan being written, a locked word pressed: one change at a time ${AFTER_LAUNCH}`,
    key: "replan-locked",
  },
  {
    label: `a re-plan being written with no hint left, as after an energy re-pick, a locked word pressed: one change at a time on a line of its own ${AFTER_LAUNCH}`,
    key: "replan-locked-unhinted",
  },
  {
    label: `a proposal whole beside the day, its word's list open: taken at once from it, the facts line saying where it is drawn ${AFTER_LAUNCH}`,
    key: "replan-proposed",
  },
  {
    label: `a proposal taken, its word's list open: the day before one press away ${AFTER_LAUNCH}`,
    key: "replan-taken",
  },
  {
    label: `a proposal left, its word's list open: the proposal one press away ${AFTER_LAUNCH}`,
    key: "replan-left",
  },
  { label: "an unplaced phrase", key: "unplaced" },
  { label: `cut or dropped in the swaps, the day kept ${AFTER_LAUNCH}`, key: "kept" },
  { label: `cut before a day, or invalid ${AFTER_LAUNCH}`, key: "cut" },
  { label: `disconnected ${AFTER_LAUNCH}`, key: "disconnected" },
  { label: `refused ${AFTER_LAUNCH}`, key: "refused" },
  {
    label: `unavailable: busy over a written day ${AFTER_LAUNCH}, not yet over any other`,
    key: "unavailable",
  },
  { label: `resting, at our own limit ${AFTER_LAUNCH}`, key: "limited" },
  { label: `at the day's own address, still being written ${AFTER_LAUNCH}`, key: "kept-writing" },
  { label: `at the day's own address, its link expired ${AFTER_LAUNCH}`, key: "kept-expired" },
] as const;

export type HeaderMoment = (typeof HEADER_MOMENTS)[number]["key"];

/**
 * Each ending without a day, as the stream reader reports it: a cut or a dropped connection
 * before the salvage rule could keep a day. Invalid says what cut says, and a connection
 * dropped inside the swaps keeps its day as a cut there does.
 */
const ENDINGS = {
  cut: { kind: "cut", itinerary: null },
  disconnected: { kind: "disconnected", itinerary: null },
  refused: { kind: "refused" },
  unavailable: { kind: "unavailable" },
  limited: { kind: "limited" },
} as const satisfies Partial<Record<HeaderMoment, DayOutcome>>;

type EndingMoment = keyof typeof ENDINGS;

function isEnding(moment: HeaderMoment): moment is EndingMoment {
  return moment in ENDINGS;
}

/**
 * What a day's own address says in place of a day kept there that it cannot show, over the
 * ending a day not written to its end has (`src/features/day/kept-day.ts`).
 */
const KEPT_STANDINGS = {
  "kept-writing": "still-writing",
  "kept-expired": "expired",
} as const satisfies Partial<Record<HeaderMoment, Parameters<typeof keptNoticeOf>[0]>>;

type KeptMoment = keyof typeof KEPT_STANDINGS;

function isKeptMoment(moment: HeaderMoment): moment is KeptMoment {
  return moment in KEPT_STANDINGS;
}

/** The longest word a visitor can choose, which a re-plan's line names: the widest line. */
const LONGEST_WORD = "by public transport";

/** How many of Lantern's words have arrived while the rest are still being written. */
const WORDS_ARRIVED = 2;
/** Where in its swaps the bench cuts a day the salvage rule keeps: halfway through them. */
const SWAPS_CUT_SHARE = 0.5;
/** Large deltas: the reader reads a cut day the same at any pace, and quickly at this one. */
const CUT_PACE: Partial<StreamPace> = { deltaChars: 64 };
/** How far the line about the day has come, as a share of it, before it stops mid-word. */
const DEK_SHARE = 0.5;
const LETTER = /\p{L}/u;

/** The golden intake whose words fall outside the vocabulary, which the day says back. */
const OUTSIDE_THE_VOCABULARY = "words outside the vocabulary";

function unplacedPhrases(): readonly string[] {
  const golden = GOLDEN_INTAKES.find(({ name }) => name === OUTSIDE_THE_VOCABULARY);
  if (!golden) throw new Error(`The golden intakes have no case named "${OUTSIDE_THE_VOCABULARY}"`);
  return golden.recorded.unplaced;
}

export type HeaderProps = ComponentProps<typeof DayStageHeader>;

/** What a moment of the day sets in the header; the rest is the cell's own, at rest. */
type HeaderFrame = Pick<
  HeaderProps,
  | "request"
  | "facts"
  | "reservedFacts"
  | "clause"
  | "dek"
  | "reservedDek"
  | "isDekWriting"
  | "isAsPlanned"
  | "sunrise"
  | "sunset"
  | "isSunShown"
  | "isSunReserved"
  | "slot"
  | "reservedSlot"
  | "notice"
  | "isEnabled"
  | "unplaced"
  | "isFromStart"
  | "isCopy"
  | "isHeadlineLit"
  | "isFactsShown"
  | "replan"
  | "replanDay"
  | "openedWord"
  | "isLockSaid"
>;

/**
 * Which answer a day's re-plan cells change to: the first that rewrites part of the day; the
 * one that lengthens the sentence most, which a phone may take a line more for; or the one
 * that shortens it most, which can let the words after it up a line, where its room is held.
 */
type ReplanPick = "part" | "longest" | "shortest";

/**
 * The moments a re-plan is set in, by the status the page gives the header in each, whether
 * its word's list is drawn open, and which answer it changes to.
 */
const REPLAN_MOMENTS = {
  "replan-writing": { status: "writing", isListOpen: false, pick: "part" },
  "replan-writing-longest": { status: "writing", isListOpen: false, pick: "longest" },
  "replan-writing-shortest": { status: "writing", isListOpen: false, pick: "shortest" },
  "replan-writing-list": { status: "writing", isListOpen: true, pick: "part" },
  "replan-locked": { status: "writing", isListOpen: false, pick: "part" },
  "replan-locked-unhinted": { status: "writing", isListOpen: false, pick: "part" },
  "replan-proposed": { status: "proposed", isListOpen: true, pick: "part" },
  "replan-taken": { status: "taken", isListOpen: true, pick: "part" },
  "replan-left": { status: "left", isListOpen: true, pick: "part" },
} as const satisfies Partial<
  Record<HeaderMoment, { status: ReplanControls["status"]; isListOpen: boolean; pick: ReplanPick }>
>;

type ReplanMoment = keyof typeof REPLAN_MOMENTS;

function isReplanMoment(moment: HeaderMoment): moment is ReplanMoment {
  return moment in REPLAN_MOMENTS;
}

/** Whether a moment draws a word's list open, which hangs below the header into the cell. */
export function isListOpenAt(moment: HeaderMoment): boolean {
  return isReplanMoment(moment) && REPLAN_MOMENTS[moment].isListOpen;
}

const ignore = () => undefined;

/** The order a re-plan's word is picked in for a day's cells: a time word that rewrites a part first. */
const REPLAN_WORDS: readonly AssumableFactKey[] = ["dinner", "end", "start", "company", "travel"];

/** A word's answer as the sentence says it: its label, or Lantern's question for none. */
function sayingOf(key: AssumableFactKey, facts: SentenceFacts): string {
  const fact = facts[key];
  return fact ? labelOf(fact) : ASKED_LABELS[key];
}

/**
 * The word a day's re-plan cells change, and its new answer, as the page tells the header of
 * it: each answer as the sentence says it, Lantern's question for a word it asked about. For
 * `"part"`, the first time word whose other answer rewrites part of the day, as the route's
 * plan reads it, else the first other word; for `"longest"` and `"shortest"`, the answer whose
 * label is longest or shortest beside the one it replaces.
 */
function replanChangeOf(
  day: Itinerary,
  request: DayRequest,
  facts: SentenceFacts,
  pick: ReplanPick,
): {
  answer: { key: AssumableFactKey; value: string };
  change: NonNullable<ReplanControls["change"]>;
  reach: "part" | "whole";
} | null {
  const answers = REPLAN_WORDS.flatMap((key) =>
    FACT_OPTIONS[key]
      .filter(({ value }) => value !== facts[key]?.value)
      .map(({ value, label }) => ({
        key,
        value,
        growth: label.length - sayingOf(key, facts).length,
      })),
  );
  const part = answers.find((answer) => answerReachOf(day, request, facts, answer).kind === "part");
  const longest = answers.reduce<(typeof answers)[number] | undefined>(
    (most, answer) => (most === undefined || answer.growth > most.growth ? answer : most),
    undefined,
  );
  const shortest = answers.reduce<(typeof answers)[number] | undefined>(
    (least, answer) => (least === undefined || answer.growth < least.growth ? answer : least),
    undefined,
  );
  const answer =
    pick === "longest" ? longest : pick === "shortest" ? shortest : (part ?? answers[0]);
  if (answer === undefined) return null;
  const { key, value } = answer;
  const to = FACT_OPTIONS[key].find((option) => option.value === value)?.label ?? value;
  return {
    answer: { key, value },
    change: { word: key, from: sayingOf(key, facts), to },
    reach: answerReachOf(day, request, facts, answer).kind === "part" ? "part" : "whole",
  };
}

/** A moment the day reaches, set in the header; or why the day never reaches it. */
export type HeaderStill = { frame: HeaderFrame } | { unreached: string };

/** Where a moment of the day stands: the stream so far, how it ended, and what the visitor did. */
interface DayState {
  request: DayRequest;
  partial: PartialDay | null;
  outcome: DayOutcome | null;
  /** The version each stop shows; the model's, unless the curve was dragged. */
  picks?: readonly number[];
  /** What the facts line says after a changed word. */
  notYet?: string | null;
  unplaced?: readonly string[];
}

/**
 * The header's props for one state of the day, worked out as `DayStage` works them out,
 * with the pen and the stops at rest: the pen has reached every piece that has arrived, and
 * every stop has landed. Endings go through `stream-ending.ts`, as the product's do.
 */
function headerFrameOf({
  request,
  partial,
  outcome,
  picks,
  notYet = null,
  unplaced = [],
}: DayState): HeaderFrame {
  const revealed = revealedOf(partial, outcome);
  const ended = endedDayOf(outcome);
  const draft = ended ? completeDraftOf(ended) : draftDayOf(revealed);
  const phase = phaseOf(outcome, ended);
  // A day that ended says Lantern's words as its itinerary does; after any other ending the
  // outcome, not the partial, says what shows, so only the visitor's words stand.
  const facts = sentenceFactsOf(request, ended ? assumptionsOf(ended) : revealed.day.assumptions);
  const reached = penPiecesOf(request, facts, draft.dek);
  const isHeaderWritten = reached.includes("dek");
  const isDone = phase === "done";
  // The sun is known from the first place, which the moments set here reach only once the
  // day has ended with it.
  const context = ended ? dayContextOf(ended) : null;
  const slot = slotOf(phase, notYet, NO_LOCAL_WORDS);
  return {
    request,
    facts: heldBack(facts, reached),
    reservedFacts: facts,
    clause: clauseOf(changesOf(draft.stops, picks ?? modelPicks(draft.stops))),
    dek: isHeaderWritten ? draft.dek : undefined,
    reservedDek: draft.dek,
    isDekWriting: draft.writing === DEK,
    // The line about the day names the planned places, as `DayStage` reads its picks.
    isAsPlanned: isAsWritten(draft.stops, picks ?? modelPicks(draft.stops)),
    sunrise: context ? sunCrossing(context, SUNRISE_ALTITUDE, "rising") : null,
    sunset: context ? sunCrossing(context, SUNRISE_ALTITUDE, "setting") : null,
    isSunShown: isHeaderWritten,
    isSunReserved: phase === "writing",
    slot,
    // While the day is written, the room for the hint a written day ends with.
    reservedSlot: phase === "writing" ? slotOf("done", null, NO_LOCAL_WORDS) : slot,
    notice: noticeOf(outcome, request),
    isEnabled: isDone && draft.isComplete,
    unplaced,
  };
}

/** What an ended day says Lantern assumed, as `DayStage` reads it (its own is private). */
function assumptionsOf(itinerary: Itinerary): PartialDay["assumptions"] {
  return Object.fromEntries(
    ASSUMABLE_FACT_KEYS.map((key): [AssumableFactKey, string | null] => [
      key,
      itinerary.facts[key].source === "assumed" ? itinerary.facts[key].value : null,
    ]),
  );
}

/**
 * What the client holds at the first frame of the stream at which what it can draw, read
 * as the page reads it, satisfies `isReached`.
 */
async function frameWhere(
  day: GeneratedDay,
  isReached: (revealed: RevealedPartial) => boolean,
): Promise<PartialDay> {
  const text = dayText(day);
  return partialAt(text, await firstAt(text, isReached));
}

/** How long the line about the day is when it stops mid-word, past its first half. */
function midWordLengthOf(dek: string): number {
  for (let length = Math.floor(dek.length * DEK_SHARE) + 1; length < dek.length; length += 1) {
    if (LETTER.test(dek[length - 1] ?? "") && LETTER.test(dek[length] ?? "")) return length;
  }
  return dek.length;
}

/**
 * How the stream ends when it is cut halfway through the day's swaps, read by the product's
 * own reader, which keeps the day without the swaps that did not arrive. Null for a day with
 * no swaps to cut inside.
 */
async function keptOutcomeOf(request: DayRequest, day: GeneratedDay): Promise<DayOutcome | null> {
  const { options } = dayTextOffsets(day);
  if (options === null) return null;
  const at = options + Math.floor((dayText(day).length - options) * SWAPS_CUT_SHARE);
  // Loaded when a cell needs it, as the page loads it when a day plays.
  const { readDayStream } = await import("@/lib/stream/read-day-stream");
  return readDayStream({
    request,
    response: simulateDayStream({ day, ending: { kind: "cut", at, by: "length" }, pace: CUT_PACE }),
    onPartial: () => undefined,
  });
}

function itineraryOf(request: DayRequest, day: GeneratedDay): Itinerary {
  const normalized = normalizeDay(request, day);
  if (!normalized.ok) throw new Error(`A header day does not normalize: ${normalized.reason}`);
  return normalized.itinerary;
}

/** The version a stop shows once dragged one bead livelier, or null when it has none. */
function livelierOf(stop: Stop, shown: number): number | null {
  const energy = stepEnergy(stop, shown, "livelier");
  return energy === null ? null : pickCandidate(candidatesOf(stop).map(energyOf), energy, shown);
}

/**
 * The versions the stops show once dragged livelier: one stop, where the curve invites the
 * first drag when it can go livelier, or every stop that can. Null when none can.
 */
function livelierPicksOf(stops: readonly Stop[], isEvery: boolean): number[] | null {
  const planned = modelPicks(stops);
  const livelier = stops.map((stop, index) => livelierOf(stop, planned[index] ?? 0));
  if (livelier.every((pick) => pick === null)) return null;
  const invited = hintStop(stops);
  const dragged =
    livelier[invited] === null ? livelier.findIndex((pick) => pick !== null) : invited;
  return planned.map((pick, index) =>
    isEvery || index === dragged ? (livelier[index] ?? pick) : pick,
  );
}

/** The facts line after a changed word: of the words that say not yet, the longest line. */
function longestNotYetOf(stops: readonly Stop[]): string {
  const lines = ASSUMABLE_FACT_KEYS.map((key) => notReplanningYetOf(key, stops));
  return lines.reduce((longest, line) => (line.length > longest.length ? line : longest));
}

/**
 * A day's header while a word of it is re-planned and after, as the page sets it through
 * `ReplanControls`: the word the day's cells change, its status, and its list open where the
 * moment says. Landed, the day is the recorded re-plan's where there is one, and otherwise the
 * day itself with the new word as the visitor's, which the header says the same.
 */
function replanStillOf(
  { request, recorded }: HeaderDay,
  itinerary: Itinerary,
  moment: ReplanMoment,
): HeaderStill {
  const written = { request, partial: null, outcome: { kind: "complete", itinerary } } as const;
  const isUnhinted = moment === "replan-locked-unhinted";
  // A word the visitor changed at no cost, as an energy re-picked, leaves the facts line no hint.
  const frame = {
    ...headerFrameOf(written),
    ...(isUnhinted && { slot: null, reservedSlot: null }),
  };
  const { status, isListOpen, pick } = REPLAN_MOMENTS[moment];
  const asked = replanChangeOf(itinerary, request, frame.reservedFacts, pick);
  if (asked === null) return { unreached: "This day has no word to re-plan." };
  const replan: ReplanControls = {
    status,
    change: asked.change,
    reach: asked.reach,
    ending: null,
    written: null,
    receipt: null,
    windows: [],
    isCompared: status === "proposed",
    choose: () => false,
    compare: ignore,
    askAgain: ignore,
  };
  const openedWord = isListOpen ? asked.change.word : null;
  // What the facts line says while the fork stands, as the page works it out (`forkNoteOf`).
  const reach = answerReachOf(itinerary, request, frame.reservedFacts, asked.answer);
  const note = forkNoteOf(
    {
      from: asked.change.from,
      to: asked.change.to,
      isWriting: status === "writing",
      isReady: status === "proposed",
      isFailed: false,
      isChosen: false,
      canAskAgain: false,
      reason: null,
    },
    reach.kind === "part" ? reach.parts : [],
    reach.kind === "part" ? reach.at : null,
  );
  const shared = {
    replan,
    replanDay: itinerary,
    openedWord,
    isLockSaid: moment === "replan-locked" || isUnhinted,
    forkNote:
      note === null
        ? null
        : {
            words: note.words,
            link:
              note.link?.kind === "see"
                ? { label: seeItAtOf(note.link.at), onPress: ignore }
                : null,
          },
  };
  if (status === "writing") return { frame: { ...frame, ...shared, isEnabled: false } };
  if (status !== "taken") return { frame: { ...frame, ...shared } };
  const landed = recorded?.replanned ?? {
    request: { ...request, [asked.answer.key]: asked.answer.value },
    itinerary,
  };
  const merged = headerFrameOf({
    request: landed.request,
    partial: null,
    outcome: { kind: "complete", itinerary: landed.itinerary },
  });
  return { frame: { ...merged, ...shared, replanDay: landed.itinerary } };
}

async function stillFor(headerDay: HeaderDay, moment: HeaderMoment): Promise<HeaderStill> {
  const { request, day, recorded } = headerDay;
  // Before its first words the day draws nothing under the headline, its date included: the
  // header's room is not known (`docs/decisions.md`, "A row's words go where its bead comes to
  // rest, and rows ease rather than jump").
  if (moment === "asked") {
    const frame = headerFrameOf({ request, partial: null, outcome: null });
    return { frame: { ...frame, isFactsShown: false } };
  }
  if (moment === "asked-waiting") {
    // Silent before the first words, with nothing drawn under it: the headline carries the
    // waiting line's light (the same entry).
    const frame = headerFrameOf({ request, partial: null, outcome: null });
    return { frame: { ...frame, isFactsShown: false, isHeadlineLit: true } };
  }
  if (moment === "first-frame") {
    // The copy draws as the playing starts: the visitor's words, the sun's and hint's room, and
    // the light the wait for the model's first words runs through them from the first paint.
    const frame = headerFrameOf({ request, partial: null, outcome: null });
    return {
      frame: { ...frame, isFactsShown: false, isEnabled: false, isCopy: true, isHeadlineLit: true },
    };
  }
  if (isEnding(moment)) {
    return { frame: headerFrameOf({ request, partial: null, outcome: ENDINGS[moment] }) };
  }
  if (isKeptMoment(moment)) {
    const frame = headerFrameOf({ request, partial: null, outcome: ENDINGS.cut });
    return { frame: { ...frame, notice: keptNoticeOf(KEPT_STANDINGS[moment], request) } };
  }
  if (day === null && recorded === undefined) {
    return { unreached: `No day is written for ${request.city}, so it never reaches this moment.` };
  }
  // The day as the page holds it once written to its end: its stream's, or the one recorded.
  const itinerary = day === null ? (recorded?.itinerary ?? null) : itineraryOf(request, day);
  if (itinerary === null) {
    return { unreached: `No day is written for ${request.city}, so it never reaches this moment.` };
  }
  if (isReplanMoment(moment)) return replanStillOf(headerDay, itinerary, moment);
  // The moments a stream reaches, which a day recorded without its stream never shows.
  const isStreamed =
    moment === "kept" || moment === "turn" || moment === "words" || moment === "dek";
  if (day === null && isStreamed) {
    return {
      unreached: `${request.city}'s day is production's record, kept whole without its stream, so it is set only as written.`,
    };
  }
  if (day === null) return writtenStillOf(request, itinerary, null, moment);
  if (moment === "kept") {
    const outcome = await keptOutcomeOf(request, day);
    if (outcome === null) return { unreached: "This day has no swaps for a cut to fall inside." };
    return { frame: headerFrameOf({ request, partial: null, outcome }) };
  }
  if (moment === "turn") {
    // The start screen gives the page to a day once Lantern's words have streamed, so every word
    // is known as the sentence is drawn, and it is written in its order: the visitor's words
    // before Lantern's first stand written, and every word from there waits unseen in its
    // room, commas and all, until the words before it are whole.
    const facts = sentenceFactsOf(request, day.assumptions);
    if (penPiecesOf(request, facts, undefined).length === 0) {
      return { unreached: "The visitor said every word of this day, so Lantern writes none." };
    }
    const frame = headerFrameOf({ request, partial: day, outcome: null });
    return {
      frame: {
        ...frame,
        facts: heldBack(frame.reservedFacts, []),
        dek: undefined,
        isSunShown: false,
        isFromStart: true,
      },
    };
  }
  if (moment === "words") {
    const pieces = penPiecesOf(request, sentenceFactsOf(request, day.assumptions), undefined);
    if (pieces.length < WORDS_ARRIVED) {
      return { unreached: "The visitor said every word of this day, so Lantern writes none." };
    }
    const partial = await frameWhere(day, (revealed) => {
      const facts = sentenceFactsOf(request, revealed.day.assumptions);
      return penPiecesOf(request, facts, revealed.day.dek).length >= WORDS_ARRIVED;
    });
    return { frame: headerFrameOf({ request, partial, outcome: null }) };
  }
  if (moment === "dek") {
    const length = midWordLengthOf(day.dek);
    const partial = await frameWhere(day, (revealed) => (revealed.day.dek?.length ?? 0) >= length);
    return { frame: headerFrameOf({ request, partial, outcome: null }) };
  }

  return writtenStillOf(request, itinerary, day, moment);
}

/**
 * A moment of a day written to its end, or of what the visitor did to it, from the day the
 * page holds and the stream that wrote it, when one did.
 */
function writtenStillOf(
  request: DayRequest,
  itinerary: Itinerary,
  day: GeneratedDay | null,
  moment: HeaderMoment,
): HeaderStill {
  // The whole stream parses to the day itself, which the page holds once it is complete.
  const written = { request, partial: day, outcome: { kind: "complete", itinerary } } as const;
  if (moment === "one-livelier" || moment === "all-livelier") {
    const picks = livelierPicksOf(itinerary.stops, moment === "all-livelier");
    if (picks === null) return { unreached: "No stop of this day has a livelier version." };
    return { frame: headerFrameOf({ ...written, picks }) };
  }
  if (moment === "changed") {
    return { frame: headerFrameOf({ ...written, notYet: longestNotYetOf(itinerary.stops) }) };
  }
  if (moment === "unplaced") {
    return { frame: headerFrameOf({ ...written, unplaced: unplacedPhrases() }) };
  }
  if (moment === "replanning") {
    // Held while the day asked for is on its way: nothing on it can be changed.
    const frame = headerFrameOf({ ...written, notYet: replanningOf(LONGEST_WORD) });
    return { frame: { ...frame, isEnabled: false } };
  }
  return { frame: headerFrameOf(written) };
}

const stills = new Map<string, Promise<HeaderStill>>();

/** One day at one moment, worked out once: both themes and both widths show the same frame. */
export function stillOf(day: HeaderDay, moment: HeaderMoment): Promise<HeaderStill> {
  const key = `${day.label}:${moment}`;
  const known = stills.get(key);
  if (known) return known;
  const still = stillFor(day, moment);
  stills.set(key, still);
  return still;
}
