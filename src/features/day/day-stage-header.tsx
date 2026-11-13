"use client";

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  type AnimationPlaybackControls,
  type MotionValue,
} from "motion/react";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import {
  ASSUMABLE_FACT_KEYS,
  type AssumableFactKey,
  type DayRequest,
  type EnergyLevel,
  type Itinerary,
} from "@/lib/schema/itinerary.schema";
import type { CityReading } from "@/lib/schema/intake.schema";
import { formatClock } from "@/lib/time/clock";
import { SunMark } from "@/features/abacus/best-light-icon";
import {
  ASKED_LABELS,
  FACT_KEYS,
  FACT_OPTIONS,
  labelOf,
  optionOf,
  type Answer,
  type Fact,
  type FactKey,
} from "./facts";
import { GlidingHeight } from "@/components/ui/gliding-height";
import type { BestLight } from "@/features/abacus/light";
import { ClauseText, owedClauseOf, setOff, useHasStood } from "./clause-text";
import {
  ASSUMED_CLASSES,
  SentenceWord,
  wordClassesOf,
  type OptionView,
  type WordReplanning,
  type WordView,
} from "./sentence-word";
import { FadeIn } from "@/components/ui/fade-in";
import { useWrittenText } from "@/components/ui/use-written-text";
import { Ink } from "@/components/ui/ink";
import { cn } from "@/components/ui/cn";
import { CityWord, type CityFocus, type TypedCity } from "./city-word";
import { LINK_CLASSES, TARGET_CLASSES } from "./link-classes";
import { unplacedLineOf } from "./start";
import { PEN_BEAT_MS } from "./use-pen";
import { ROOM_REACH_PX, SPRINGS } from "@/lib/tokens/motion";
import {
  chosenLabelsOf,
  energyLabelOf,
  trailsOf,
  weekdayOf,
  widestClauses,
  type SentenceFacts,
} from "./sentence";
import { DayMenu, type DayMenuItem } from "./day-menu";
import { Masthead } from "./masthead";
import {
  BEING_WRITTEN,
  PROPOSED_BESIDE,
  THE_DAY_BEFORE,
  THE_PROPOSAL,
  YOUR_DAY_WHILE_WRITTEN,
  answerReachOf,
  forecastOf,
  replanningOf,
  replanningReachOf,
} from "./not-yet";
import type { ReplanControls } from "./replan-controls";

/**
 * The time the header holds room for before the sun's are known. The times are set in
 * figures of one width, so any time takes the same room as midnight, "00:00".
 */
const WIDEST_CLOCK = 0;
/** Worked out once: what the curve could say about any day, the longest first. */
const ANY_DAYS_CLAUSES = widestClauses();
/** Less than this between where a word stood and where it stands is a rounding, not a move. */
const MOVED_PX = 0.5;
const MS_PER_SECOND = 1000;
const FRAMES_PER_SECOND = 60;
/**
 * A pen let go reaches the screen a frame later: Motion writes its first letter on a frame,
 * and React draws it on the next. Let go this much early, a notice's first letter comes a
 * beat after the step.
 */
const PEN_LAG_MS = MS_PER_SECOND / FRAMES_PER_SECOND;

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/**
 * Wrapped greedily, `text-pretty` rather than `text-balance`: balancing re-flows the whole
 * headline as a word writes in, moving words already written from line to line.
 */
const SENTENCE_CLASSES = "type-voice text-title text-pretty text-ink-soft";
/**
 * The waiting line's light through the headline, every word of it (`docs/decisions.md`, "A row's
 * words go where its bead comes to rest, and rows ease rather than jump"): its pass and its muted
 * ground, as the start screen had them through the visitor's words before its light was quickened
 * (2026-11-05).
 */
const HEADLINE_LIT_CLASSES = "words-lit";

/** The light's loop, as `--animate-pass` names it. */
const LIGHT_ANIMATION = "pass";

/**
 * When the headline's light set off, on the document's clock, while any headline is lit. The
 * page's first HTML lights the playing's first frame from its first paint; the live header that
 * takes its place once the page runs starts its own light, and set off then, the band jumped
 * back a third of the screen. A headline lit while another is takes its light from this moment,
 * so it goes on. Once none is lit it is forgotten: a light that comes later sets off afresh,
 * rather than in a phase whose band may stand off the screen for a second and a half.
 */
let headlineLightStart: CSSNumberish | null = null;
/** How many headlines are lit now. */
let litHeadlines = 0;
/** Longer than the copy's hand-over to the live header, far shorter than a light's pause. */
const LIGHT_HANDOVER_MS = 250;

/** Runs a lit headline's light in step with one already lit on this page. */
export function useLightInPhase(headline: { current: HTMLElement | null }, isLit: boolean): void {
  useLayoutEffect(() => {
    if (!isLit) return undefined;
    litHeadlines += 1;
    return () => {
      litHeadlines -= 1;
      // The copy goes as the live header takes its light, a commit or two apart: only a pause
      // longer than that hand-over forgets the light.
      window.setTimeout(() => {
        if (litHeadlines === 0) headlineLightStart = null;
      }, LIGHT_HANDOVER_MS);
    };
  }, [isLit]);
  useLayoutEffect(() => {
    const element = headline.current;
    if (!isLit || !element || typeof element.getAnimations !== "function") return;
    const light = element
      .getAnimations()
      .find((each) => "animationName" in each && each.animationName === LIGHT_ANIMATION);
    if (!light) return;
    const startedAt = light.startTime ?? document.timeline.currentTime;
    if (headlineLightStart === null) headlineLightStart = startedAt;
    else if (startedAt !== headlineLightStart) light.startTime = headlineLightStart;
  });
}
/**
 * The line about the day, a size down on a phone, in the quote's size: at the dek's it took
 * four to eight of the first screen's lines before the chart (`docs/decisions.md`, "A row's words
 * go where its bead comes to rest, and rows ease rather than jump").
 */
const DEK_CLASSES = "type-prose text-dek @max-measure:text-quote";
/**
 * Room held only on a laptop: for the longest clause and for the line's lead after a swap. On a
 * phone the header takes them when they come, once the finger lifts, and the day below glides once,
 * as a gesture's answer may: the visitor caused it (the same entry).
 */
const LAPTOP_ROOM_CLASSES = "@max-measure:hidden";
/** A live line of the header, in its row's cell over its reserve, as tall as its own words. */
const LIVE_LINE_CLASSES = "col-start-1 row-start-1 self-start";

/** What each word's picker is called, for screen readers. */
const LIST_LABELS: Readonly<Record<FactKey, string>> = {
  energy: "The day's energy",
  travel: "Getting around",
  start: "The morning",
  dinner: "Dinner",
  end: "The end of the night",
  company: "Who is coming",
};

/**
 * What the end of the facts line says. A stream that ends without a day says so in the
 * notice, in place of this line.
 */
export type HeaderSlot =
  | { kind: "hint" }
  /** A word was changed with live generation off: what Lantern kept, written in. */
  | { kind: "not-yet"; text: string }
  | null;

/**
 * Which ending a notice says: a day Lantern could not finish (cut or invalid), one whose
 * connection dropped, one it would not plan, a written day that did not come, a day no one
 * has written, or our own limit; and at a day's own address, a day still being written
 * elsewhere, or a link past its days.
 */
export type NoticeKind =
  | "unfinished"
  | "dropped"
  | "refused"
  | "busy"
  | "not-yet"
  | "resting"
  | "still-writing"
  | "expired";

/** What stands in for the day when there is none to show: what happened, and a way on. */
export interface HeaderNotice {
  kind: NoticeKind;
  /** What happened, said first. */
  text: string;
  /** The words of the control that asks for the same day again, when it may be asked again. */
  retry?: string;
  /** What leads to the written days, after the retry when there is one. */
  offer?: string;
  /** The days Lantern has written that it offers, each whole. */
  written: readonly DayRequest[];
}

/**
 * What the header says before the line about the day while the day on show is not the one
 * it was written for: the line names the planned places, as the visitor's swaps do not. The
 * product's words, set upright before the model's italic, as a note before a quotation.
 */
const PLANNED_LEAD = "As first planned: ";
/** The lead is said lighter than the line it leads. */
const LEAD_CLASSES = "text-muted";
/** The hint, a step quieter than the date beside it; the caption's size is the credits'. */
const HINT_CLASSES = "text-meta text-muted";

const ignore = () => undefined;

/** No word change on screen: what a header is given when the page names none. */
const NO_REPLAN: ReplanControls = {
  status: "idle",
  change: null,
  reach: null,
  ending: null,
  written: null,
  receipt: null,
  windows: [],
  isCompared: false,
  choose: () => false,
  compare: ignore,
  askAgain: ignore,
};

/**
 * Said in the facts line's place when a locked word is pressed while another word's re-plan
 * is written: one word changes at a time, and nothing else happens.
 */
export const ONE_CHANGE_AT_A_TIME = "one change at a time";

/** The day menu's last item, set apart under the ways to take the day along. */
const PLAN_ANOTHER_DAY = "Plan another day";

/** No way to take the day along: the menu holds "Plan another day" alone. */
const NO_WAYS_ALONG: readonly DayMenuItem[] = [];

/** How the end of the facts line stands while a word is re-planned and after. */
type SlotStanding = "shown" | "faded" | "locked";

interface ReservedDekProps {
  dek: string | undefined;
  /** The lead is on show or on its way: its room is held on a phone too. */
  isLeadHeld: boolean;
  ref?: Ref<HTMLParagraphElement>;
}

/**
 * The room the line about the day takes, its lead's included: on a laptop always, so a swap
 * that brings the lead never moves the chart; on a phone from when the lead is due until it
 * has gone, so its line opens before the lead comes into it. None until the line has come.
 */
function ReservedDek({ dek, isLeadHeld, ref }: ReservedDekProps): ReactNode {
  return (
    <p ref={ref} className={DEK_CLASSES}>
      {dek && (
        <span className={cn("not-italic", LEAD_CLASSES, !isLeadHeld && LAPTOP_ROOM_CLASSES)}>
          {PLANNED_LEAD}
        </span>
      )}
      {dek}
    </p>
  );
}

interface DayStageHeaderProps {
  request: DayRequest;
  /** The words as the pen has written them so far. */
  facts: SentenceFacts;
  /** Every word that has arrived, written or not: the header holds their room. */
  reservedFacts: SentenceFacts;
  /**
   * The curve's clause, or null while the day shows the model's plan. The header holds room
   * for the longest the curve could say about any day, so neither a drag nor a re-pick of the
   * energy moves the chart.
   */
  clause: string | null;
  /** The line about the day once the pen has reached it, which then writes itself in. */
  dek: string | undefined;
  /** The line about the day as far as it has arrived: the header holds its room. */
  reservedDek: string | undefined;
  /** The stream is still writing the line about the day. */
  isDekWriting: boolean;
  /**
   * Every stop shows the place the line about the day was written for. Once one shows another,
   * the line says it is the day as first planned, in the quiet ink, until the day matches it.
   */
  isAsPlanned?: boolean;
  /** When the sun rises and sets, once the first place's coordinates are written. */
  sunrise: number | null;
  sunset: number | null;
  /** The sun times are said; until then the header only holds their room. */
  isSunShown: boolean;
  /**
   * The header holds room for the sun's times from its first frame, before the first place
   * says what they are, so it does not grow when they arrive.
   */
  isSunReserved?: boolean;
  slot: HeaderSlot;
  /** The end of the facts line the header holds room for. */
  reservedSlot: HeaderSlot;
  /**
   * The facts line, with the date, and the phrases said back under it are drawn. Until
   * then they hold their room unseen, as a day streamed from nothing does for its first
   * beat, so a day that ends sooner never shows them.
   */
  isFactsShown?: boolean;
  /** In place of the line about the day and the facts: no day is coming. */
  notice: HeaderNotice | null;
  /**
   * The notice takes the place of a day's lines as the day ends. Nothing visible stands
   * under the headline by then, so the room closes at once and the notice is said a beat
   * later, or once a word of the visitor's that the step moved has glided to its place.
   * Otherwise, as in a still, it is whole from the first frame.
   */
  isNoticeWrittenIn?: boolean;
  /**
   * The notice's opacity: whole, until it leaves for the next day the visitor asked for,
   * fading as the day's words do.
   */
  noticeOpacity?: MotionValue<number>;
  /**
   * The notice is leaving for the next day: out of the hand's reach and its pen stopped
   * where it is, while the focus stays on the control pressed, which fades with it, until
   * the next day's city word takes it.
   */
  isNoticeLeaving?: boolean;
  /**
   * A choice from the city's list takes this day's place: the list goes from sight at once
   * and keeps the focus on the row chosen until the day chosen takes it.
   */
  isChoiceHeld?: boolean;
  /**
   * The day's opacity: whole, until a day that ends without one fades with its chart. The
   * line about the day, the facts and Lantern's words with their commas fade on it, so they
   * leave as one piece with the chart.
   */
  dayOpacity?: MotionValue<number>;
  /** The day is fading: every pen stops where it is, so nothing but opacity changes. */
  isLeaving?: boolean;
  /** The day is written and still: its words can be opened. */
  isEnabled: boolean;
  /** Nothing has arrived for a while: screen readers hear that the day is being written. */
  isWaiting: boolean;
  /**
   * Nothing has arrived for a while and nothing is drawn under the headline yet, as while a
   * link waits for the model's first words: the waiting line's light runs through the
   * headline, where the waiting line has no place yet (`docs/decisions.md`, "A row's words go where
   * its bead comes to rest, and rows ease rather than jump").
   */
  isHeadlineLit?: boolean;
  written: readonly DayRequest[];
  cityOpenAt: CityFocus | null;
  /** A city typed on the city word that the page reads, or could not play; null when none. */
  typedCity?: TypedCity | null;
  /** The day was chosen from the city word, which takes the focus back. */
  isCityFocused: boolean;
  /** The word a re-plan merged for, which takes the focus back when it is drawn anew. */
  focusedWord?: AssumableFactKey | null;
  /**
   * A word change, its fork, from the press on (`ReplanControls`); none by default. While the
   * proposal is drawn beside the day the word says both answers, "early dinner or eating late",
   * the proposal's in blue and lit while it is written, with every other word locked meanwhile
   * and the facts line's place saying what the fork does (`forkNote`), or its hint faded where
   * it says nothing; the word's list takes either version from memory.
   */
  replan?: ReplanControls;
  /** The proposal's answer in the sentence was pressed: the page takes the visitor to the fork. */
  onPointToFork?: () => void;
  /**
   * While a changed word's fork stands, what it is doing and where, or why the word came back,
   * said in the facts line's place with the press it offers (`forkNoteOf`); null otherwise.
   */
  forkNote?: ForkNoteShown | null;
  /**
   * The day on screen once written to its end, when a changed word re-plans it: each answer in
   * a word's list says what choosing it would do, from the plan the route runs. Null while it
   * streams, and with live generation off, when only the energy says what it does.
   */
  replanDay?: Itinerary | null;
  /** A word whose list is drawn open, as a lab cell draws it, taking no focus; null for none. */
  openedWord?: FactKey | null;
  /** As a lab cell draws it: a locked word was pressed while a re-plan is written. */
  isLockSaid?: boolean;
  onCityOpenChange: (openAt: CityFocus | null) => void;
  /**
   * The ways to take the day along, for the day menu, which holds them and "Plan another day";
   * none for a day that has none, as one that ended without a day.
   */
  takeAlong?: readonly DayMenuItem[];
  /** A written day chosen from the city word's list. */
  onChooseWritten: (request: DayRequest) => void;
  /** A written day the notice offers, chosen; the city word's `onChooseWritten` if not given. */
  onOpenWritten?: (request: DayRequest) => void;
  onChooseCity: (city: string) => void;
  /**
   * Every city the name could mean, when the day was played as one of them; the city word
   * lists them first. Empty for a city named whole.
   */
  readings?: readonly CityReading[];
  /** Which of the readings the day is, by its place id: the first until another is chosen. */
  playedReading?: string | null;
  onChooseReading?: (reading: CityReading) => void;
  onChoose: (answer: Answer) => void;
  onLight: (key: FactKey | null) => void;
  onRetry: () => void;
  /** The visitor's phrases Lantern could not plan around, said back under the facts. */
  unplaced?: readonly string[];
  /** Told when the header starts making room and when it has come to rest. */
  onGlide?: (isGliding: boolean) => void;
  /**
   * Told when the sentence's row starts opening room for words that have arrived and when it
   * has opened, so the pen that writes them in can wait for their line.
   */
  onSentenceGlide?: (isGliding: boolean) => void;
  /**
   * Taken from the start screen, which keeps its place until Lantern's words have streamed: every
   * word is known as the sentence is drawn, and it is written in its order (`docs/decisions.md`,
   * "A row's words go where its bead comes to rest, and rows ease rather than jump"). A day's own
   * address, a kept day's link and a re-plan keep the pen's beat.
   */
  isFromStart?: boolean;
  /**
   * Told while the sentence is written in its order, as on the start screen, and once it has
   * stood whole: the line about the day waits for it, so one pen writes at a time.
   */
  onWrittenInOrder?: (isInOrder: boolean) => void;
  /** Whether the curve's clause stands whole in the sentence, written to its last letter. */
  onClauseWhole?: (isWhole: boolean) => void;
  /**
   * Whether the line about the day stands whole, written to its last letter: a re-plan's new
   * line is written as its day lands, and what Lantern did is said once it is.
   */
  onDekWhole?: (isWhole: boolean) => void;
  /**
   * Receives the header's written lines as they stand, without the room held under them for
   * more: what lies over the day, as an open stop's sheet, stops short of the last of them.
   */
  linesRef?: Ref<HTMLDivElement>;
  /**
   * Receives the box that holds the header's room under the masthead, as tall as the room
   * the chart stands under.
   */
  roomRef?: Ref<HTMLDivElement>;
  /** Classes for the header itself. */
  className?: string;
  /**
   * A copy that only shows how the header is drawn, as the playing's first frame beside the
   * whole header in the page's first HTML: never heard, never reached by the keyboard.
   */
  isCopy?: boolean;
  /**
   * A height the room keeps while what it holds is shorter: the room the day before held,
   * when the visitor played this day from it, until this day's own room is known.
   */
  heldRoom?: number;
  /**
   * A hand has just acted on the chart below: the header's growth scrolls the page as it
   * glides, so what the hand is on holds still (`GlidingHeight`'s `isViewHeldOnScreen`).
   */
  isViewHeld?: boolean;
  /**
   * The room's height on the day this one was played from, which the room glides from when
   * it mounts: a day that takes the page with its header already streamed, as a re-plan
   * does, grows or shrinks to its own room rather than stepping to it.
   */
  roomFrom?: number;
}

/**
 * The request as the headline and the form: the visitor's words from the start, Lantern's as
 * they arrive, then the line about the day and the facts. The city is a word like the
 * others, and the masthead's "Plan another day" opens it at its field.
 */
export function DayStageHeader({
  request,
  facts: givenFacts,
  reservedFacts: givenReservedFacts,
  clause,
  dek,
  reservedDek,
  isDekWriting,
  isAsPlanned = true,
  sunrise,
  sunset,
  isSunShown,
  isSunReserved = false,
  slot,
  reservedSlot,
  isFactsShown = true,
  notice,
  isNoticeWrittenIn = false,
  noticeOpacity,
  isNoticeLeaving = false,
  isChoiceHeld = false,
  dayOpacity,
  isLeaving = false,
  isEnabled,
  isWaiting,
  isHeadlineLit = false,
  written,
  cityOpenAt,
  typedCity = null,
  isCityFocused,
  focusedWord = null,
  replan: givenReplan = NO_REPLAN,
  onPointToFork = ignore,
  forkNote = null,
  replanDay = null,
  openedWord = null,
  isLockSaid = false,
  onCityOpenChange,
  takeAlong = NO_WAYS_ALONG,
  onChooseWritten,
  onOpenWritten = onChooseWritten,
  onChooseCity,
  readings,
  playedReading,
  onChooseReading,
  onChoose,
  onLight,
  onRetry,
  unplaced = [],
  onGlide,
  onSentenceGlide,
  isFromStart = false,
  onWrittenInOrder,
  onDekWhole,
  linesRef,
  roomRef,
  className,
  isCopy = false,
  heldRoom,
  isViewHeld = false,
  roomFrom,
}: DayStageHeaderProps) {
  const replan = withAnswerValuesOf(givenReplan);
  const { status, change } = replan;
  const isReplanWriting = status === "writing" && change !== null;
  // The day's own words: the request on screen is the version the visitor has, and the fork's
  // other answer stands after its word as its pair while it is drawn beside the day.
  const facts = givenFacts;
  const reservedFacts = givenReservedFacts;
  const pair = pairOf(replan);
  const clauseRoomFacts = withWidestEnergy(reservedFacts);
  // Lantern's words known as the sentence is first drawn hold their room from then, commas
  // and all, so the pen writes them into room already open: the start screen gives the page
  // to a day once Lantern's words have streamed. Words that arrive after it is drawn, as on a
  // day's own address, take their room as they are written: held at once, theirs opened
  // under the visitor's words on screen ahead of the header's own glide, and Lisbon's "with
  // friends" stood a line down, cut by it. Under a notice Lantern's words have gone.
  const [firstKnown] = useState(
    () => new Set(ASSUMABLE_FACT_KEYS.filter((key) => reservedFacts[key] !== null)),
  );
  const roomed = Object.fromEntries(
    ASSUMABLE_FACT_KEYS.map((key) => [key, firstKnown.has(key) ? reservedFacts[key] : facts[key]]),
  ) as SentenceFacts;
  // Taken from the start screen, where it is known whole as it is drawn, the sentence is
  // written in reading order until it has once stood whole: a word waits unseen in its room until every
  // word before it stands whole, so none stands with a gap before it or after it (question
  // 29, C). The visitor's own words show whole as the pen reaches them; Lantern's are written
  // in. From then a word changed is written in as on any day, a re-plan's answer too.
  const [isWrittenInOrder] = useState(
    () =>
      isFromStart &&
      ASSUMABLE_FACT_KEYS.some((key) => {
        const fact = reservedFacts[key];
        return fact !== null && fact.source !== "chosen" && facts[key] === null;
      }),
  );
  // The visitor's words before Lantern's first stand whole as the sentence is drawn; every
  // other word once it has been shown whole, which it says.
  const [shownAtDraw] = useState(() => {
    const shown = new Set<FactKey>();
    if (!isWrittenInOrder) return shown;
    for (const key of ASSUMABLE_FACT_KEYS) {
      const fact = reservedFacts[key];
      if (fact === null) continue;
      if (fact.source !== "chosen") break;
      shown.add(key);
    }
    return shown;
  });
  const [wholeKeys, setWholeKeys] = useState<ReadonlySet<FactKey>>(shownAtDraw);
  const noteWhole = useCallback(
    (key: FactKey) => setWholeKeys((now) => (now.has(key) ? now : new Set(now).add(key))),
    [],
  );
  // Lantern's words whose first letter has shown: until then a word on its way brings no
  // comma to the word before it, which on a day's own address stood alone for 126 to 140 ms
  // after the city while the pen waited to write "on foot". A word there as the header is
  // first drawn stands whole from then, as a day drawn whole has all of them, its commas in
  // its first HTML too.
  const [seenKeys, setSeenKeys] = useState<ReadonlySet<FactKey>>(
    () => new Set(ASSUMABLE_FACT_KEYS.filter((key) => facts[key] !== null)),
  );
  const noteSeen = useCallback(
    (key: FactKey) => setSeenKeys((now) => (now.has(key) ? now : new Set(now).add(key))),
    [],
  );
  const [isOrderDone, setIsOrderDone] = useState(!isWrittenInOrder);
  const behind = new Set<FactKey>();
  if (!isOrderDone && notice === null) {
    let isAllWhole = true;
    ASSUMABLE_FACT_KEYS.forEach((key, at) => {
      const fact = reservedFacts[key];
      if (fact === null) return;
      // A word of Lantern's that comes after the sentence is drawn joins its order while no
      // word after it has shown: once one has, it takes its room as it is written, as on a
      // day's own address, and hides no word already shown.
      const isLate = !firstKnown.has(key);
      if (isLate && ASSUMABLE_FACT_KEYS.slice(at + 1).some((after) => wholeKeys.has(after))) return;
      if (!isAllWhole) behind.add(key);
      if (!wholeKeys.has(key)) isAllWhole = false;
    });
    if (isAllWhole) setIsOrderDone(true);
  }
  const isInOrder = !isOrderDone && notice === null;
  const onWrittenInOrderRef = useRef(onWrittenInOrder);
  useEffect(() => {
    onWrittenInOrderRef.current = onWrittenInOrder;
  });
  useLayoutEffect(() => {
    onWrittenInOrderRef.current?.(isInOrder);
  }, [isInOrder]);
  // Each comma comes with the word shown after it: one held behind the pen brings none yet.
  // A word held behind the pen, or one of Lantern's with no letter shown yet, is not shown.
  const unseen = ASSUMABLE_FACT_KEYS.filter((key) => {
    const fact = facts[key];
    return behind.has(key) || (fact !== null && fact.source !== "chosen" && !seenKeys.has(key));
  });
  const shownFacts =
    unseen.length === 0
      ? facts
      : ({
          ...facts,
          ...Object.fromEntries(unseen.map((key) => [key, null])),
        } as SentenceFacts);
  const trails = trailsOf(shownFacts);
  const trailRooms = notice === null ? trailsOf(roomed) : trails;
  // The commas that stay once Lantern's words have gone; the others leave with them. A word
  // held behind the pen brings neither: read from all the visitor's words, the city stood
  // with its comma from the turn, a word of theirs still unseen after it.
  const keptTrails = trailsOf(visitorsWordsOf(shownFacts, request));
  // A visitor's word keeps its comma when another of theirs follows it; when only Lantern's
  // words follow, its comma leaves with them, faded as they are.
  const trailOf = (word: "city" | AssumableFactKey) => {
    const leaving = trails[word].slice(keptTrails[word].length);
    return leaving
      ? { trail: trails[word], trailOpacity: opacity }
      : { trail: keptTrails[word], trailOpacity: undefined };
  };
  const whole = useMotionValue(1);
  const opacity = dayOpacity ?? whole;
  const unplacedLine = unplacedLineOf(unplaced);
  // A clause that takes the sentence onto another line waits for the sentence's row to open
  // that line, so the words it pushes down are never clipped; one that fits comes in at once.
  const [isSentenceGliding, setSentenceGliding] = useState(false);
  useLayoutEffect(() => onSentenceGlide?.(isSentenceGliding), [isSentenceGliding, onSentenceGlide]);
  // Which word of the sentence has its panel open, if any: nothing moves under a hand.
  const [openWord, setOpenWord] = useState<FactKey | null>(null);
  const isPanelOpen = openWord !== null || cityOpenAt !== null;
  // A line opened for a clause receives it (`owedClauseOf`).
  const [owedClause, setOwedClause] = useState<string | null>(null);
  const liveClause = clause ?? owedClause;
  // While a word's panel is open the sentence keeps the clause it showed as the panel
  // opened, its room and its words still, so no word moves under the hand; it goes on once
  // the panel closes.
  const [underHand, setUnderHand] = useState<{ clause: string | null } | null>(null);
  if (isPanelOpen && underHand === null) setUnderHand({ clause: liveClause });
  if (!isPanelOpen && underHand !== null) setUnderHand(null);
  const shownClause = underHand ? underHand.clause : liveClause;
  // The page's own words, from the visitor's swaps: they come in whole, never written.
  const writtenClause = useWrittenText(
    setOff(shownClause),
    "fade-held",
    isSentenceGliding,
    isPanelOpen || isLeaving,
  );
  const isWrittenWhole = !writtenClause.isWriting && writtenClause.text === setOff(shownClause);
  // An owed clause is paid once it has stood whole long enough to come in and be read.
  const hasOwedStood = useHasStood(owedClause, owedClause !== null && isWrittenWhole);
  const owed = owedClauseOf(owedClause, clause, {
    isOpening: isSentenceGliding,
    isPanelOpen,
    isOwedWhole: hasOwedStood,
  });
  if (owed !== owedClause) setOwedClause(owed);
  // A proposal's new line is written once, as it is first taken, from its first word that
  // differs from the line on screen. Taken back, or taken again, the day is one the visitor has
  // read, so its line stands whole at once, as its word does.
  const [lastStatus, setLastStatus] = useState(status);
  const [isDekAtOnce, setIsDekAtOnce] = useState(false);
  if (status !== lastStatus) {
    setLastStatus(status);
    setIsDekAtOnce(status === "left" || (status === "taken" && lastStatus === "left"));
  }
  const writtenDek = useWrittenText(dek ?? "", isDekAtOnce ? "instant" : "words", false, isLeaving);
  const isDekWhole = isDekAtOnce || writtenDek.text === (dek ?? "");
  const onDekWholeRef = useRef(onDekWhole);
  useEffect(() => {
    onDekWholeRef.current = onDekWhole;
  });
  // Told before the frame paints, so a line still to write is never said done for a frame.
  useLayoutEffect(() => {
    onDekWholeRef.current?.(isDekWhole);
  }, [isDekWhole]);
  // While a word's re-plan is written, the line on screen is the day as first planned: it says
  // so where its lead has room, which on a laptop is held always and on a phone is measured,
  // so the press never moves the day under it.
  const withLeadShape = useRef<HTMLParagraphElement>(null);
  const withoutLeadShape = useRef<HTMLParagraphElement>(null);
  const [isLeadFitting, setIsLeadFitting] = useState(false);
  useLayoutEffect(() => {
    const withLead = withLeadShape.current;
    const withoutLead = withoutLeadShape.current;
    if (!withLead || !withoutLead) return undefined;
    const measure = () => setIsLeadFitting(withLead.offsetHeight <= withoutLead.offsetHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(withLead);
    observer.observe(withoutLead);
    return () => observer.disconnect();
  }, []);
  const isAsFirstPlanned = !isAsPlanned || (isReplanWriting && isLeadFitting);
  // The lead is the line's own: it is due only before the line as written whole, so it never
  // stands alone while a re-plan unwrites the line and writes the next, and it goes at once
  // as the line starts to. It comes in once its line is open, as a clause does, so a phone's
  // line about the day never shows a word clipped while its row glides open, and its room
  // stays until it has gone, so the row closes only under shorter words.
  const isLeadDue =
    isAsFirstPlanned && !writtenDek.isWriting && dek !== undefined && writtenDek.text === dek;
  const [isDekGliding, setDekGliding] = useState(false);
  const writtenLead = useWrittenText(
    isLeadDue ? PLANNED_LEAD : "",
    "fade-held",
    isDekGliding,
    isLeaving,
  );
  const isLeadHeld = isLeadDue || writtenLead.text !== "";
  // Where each of the visitor's words stood as the day faded: nothing moves meanwhile, and
  // the last frame before the step is the one a word the step moves glides from.
  const headline = useRef<HTMLHeadingElement>(null);
  useLightInPhase(headline, isHeadlineLit);
  const stood = useRef<WordPlaces | null>(null);
  useLayoutEffect(() => {
    const line = headline.current;
    if (!isLeaving || !line) return undefined;
    const note = () => {
      stood.current = placesOf(line);
    };
    note();
    return opacity.on("change", note);
  }, [isLeaving, opacity]);
  // The notice's room stands empty under the headline from the step, so nothing visible is
  // there for its room to glide under, and it closes at once. Its first letter comes a beat
  // later, never in a frame with the lines it replaces, or once a word the step moved has
  // come to rest. Under reduced motion it is there in the same step.
  const isReducedMotion = useReducedMotion() ?? false;
  const hasNotice = notice !== null;
  const isRoomClosedAtOnce = hasNotice && isNoticeWrittenIn;
  const [isNoticeReleased, setIsNoticeReleased] = useState(false);
  useLayoutEffect(() => {
    if (!isRoomClosedAtOnce || isNoticeReleased || isReducedMotion) return undefined;
    const line = headline.current;
    const glides = line && stood.current ? glideMovedWords(line, stood.current) : [];
    stood.current = null;
    if (glides.length === 0) {
      const release = window.setTimeout(() => setIsNoticeReleased(true), PEN_BEAT_MS - PEN_LAG_MS);
      return () => window.clearTimeout(release);
    }
    let isGliding = true;
    void Promise.all(glides.map((glide) => glide.finished)).then(() => {
      if (isGliding) setIsNoticeReleased(true);
    });
    return () => {
      isGliding = false;
      glides.forEach((glide) => glide.stop());
    };
  }, [isRoomClosedAtOnce, isNoticeReleased, isReducedMotion]);
  const isNoticeWritten = !isNoticeWrittenIn || isReducedMotion || isNoticeReleased;
  // The status says a notice once, in the step, and is quiet once the page says it: when it
  // stands whole, and no sooner than a beat after it was said, so a notice whole at once, as
  // under reduced motion, is still heard.
  const [isNoticeWhole, setIsNoticeWhole] = useState(false);
  const noticeLine = notice ? noticeLineOf(notice) : null;
  const [saidLine, setSaidLine] = useState<string | null>(null);
  useEffect(() => {
    if (noticeLine === null) return undefined;
    const said = window.setTimeout(() => setSaidLine(noticeLine), PEN_BEAT_MS);
    return () => window.clearTimeout(said);
  }, [noticeLine]);
  const isNoticeSaid = isNoticeWhole && noticeLine !== null && saidLine === noticeLine;
  // The city is one of Lantern's assumptions too when it played the likeliest of its readings.
  const isCityAssumed = request.citySource === "assumed";
  // Read from the day on screen's words, not the re-plan's: the word changed may have been
  // Lantern's only assumption, and its key stays until the day asked for lands.
  const hasAssumed =
    isCityAssumed || Object.values(givenFacts).some((fact) => fact?.source === "assumed");
  // While a word is re-planned, and until its change settles, the end of the facts line is
  // the one it had at the press, so no letter of it is written over: faded in its own room
  // while the re-plan is written, as no word can be changed then, or saying why when a locked
  // word is pressed. Once the change has landed, been kept or undone, what a change before it
  // said is over, a re-plan that failed included, so the hint stands in for it.
  const [restSlot, setRestSlot] = useState(slot);
  if (status === "idle" && slotKeyOf(restSlot) !== slotKeyOf(slot)) setRestSlot(slot);
  const changeSlot = status === "writing" ? restSlot : settledSlotOf(restSlot);
  const shownSlot = status === "idle" ? slot : changeSlot;
  const [isLockedPressed, setIsLockedPressed] = useState(false);
  if (!isReplanWriting && isLockedPressed) setIsLockedPressed(false);
  const sayLocked = () => setIsLockedPressed(true);
  const isLockedSaid = isReplanWriting && (isLockedPressed || isLockSaid);
  const slotStanding: SlotStanding = !isReplanWriting ? "shown" : isLockedSaid ? "locked" : "faded";
  // A locked word pressed is answered in the facts line, so the fork's note gives way to it.
  const isForkNoteShown = forkNote !== null && !isLockedSaid;
  const factsLine = {
    date: request.date,
    sunrise: isSunShown ? sunrise : null,
    sunset: isSunShown ? sunset : null,
    hasAssumed,
    slot: shownSlot,
    slotStanding,
  };
  const reservedFactsLine = {
    date: request.date,
    // The times themselves once known, the same width in its figures: a placeholder's
    // "00:00" stood in the page's HTML for any reader without its styles.
    sunrise: sunrise ?? (isSunReserved ? WIDEST_CLOCK : null),
    sunset: sunset ?? (isSunReserved ? WIDEST_CLOCK : null),
    hasAssumed:
      isCityAssumed || Object.values(givenReservedFacts).some((fact) => fact?.source === "assumed"),
    slot: status === "idle" ? reservedSlot : changeSlot,
  };
  // What each answer of each word would do, from the plan the route runs for it: worked out
  // once a day and its words, not at each frame of the pen.
  const forecasts = useMemo(
    () => forecastsOf(replanDay, request, givenReservedFacts),
    [replanDay, request, givenReservedFacts],
  );
  // What a screen reader hears while the re-plan is written: what it rewrites, every part.
  const replanningLine =
    isReplanWriting && change !== null
      ? replanningLineOf(change, replan.reach, replanDay, request, givenReservedFacts)
      : null;
  /**
   * An answer chosen from a word's list: the fork's two take either version from memory, as its
   * rows do, and while the proposal is written neither changes anything; any other answer is a
   * new change, which settles the fork.
   */
  const choose = (key: FactKey, value: string) => {
    const side =
      change === null || key !== change.word
        ? null
        : value === change.from
          ? "from"
          : value === change.to
            ? "to"
            : null;
    if (side !== null && status !== "failed") {
      if (status !== "writing") replan.choose(side);
      return;
    }
    onChoose({ key, value });
  };

  const wordFor = (
    key: FactKey,
    lead: string,
    trail: string,
    trailOpacity?: MotionValue<number>,
  ) => {
    const fact = facts[key];
    // Lantern's word, known before the pen reaches it, holds its room from then.
    const known = key === "energy" || !firstKnown.has(key) ? null : reservedFacts[key];
    const isBehind = behind.has(key);
    const reserved =
      notice === null && known && known.source !== "chosen"
        ? labelOf(known)
        : isBehind && fact
          ? labelOf(fact)
          : undefined;
    const isChangedWord = change !== null && key === change.word;
    return (
      <SentenceWord
        key={key}
        isFocusedOnMount={key === focusedWord}
        view={{
          ...viewOf(key, fact, notice === null),
          options: optionsOf(key, fact, replan, forecasts),
        }}
        lead={lead}
        trail={trail}
        trailOpacity={trailOpacity}
        trailRoom={key === "energy" ? undefined : trailRooms[key]}
        isHeld={fact === null || isBehind}
        reserved={reserved}
        isShownWhole={isInOrder && key !== "energy" && fact?.source === "chosen"}
        onWhole={isInOrder ? () => noteWhole(key) : undefined}
        onSeen={() => noteSeen(key)}
        isStill={isLeaving}
        replanning={wordReplanningOf(key, replan)}
        // The word changed stays open while its re-plan is written, so the day before can be
        // kept from its list; every other word is locked, whatever the page says of the day.
        isEnabled={isReplanWriting ? isChangedWord : isEnabled}
        isLocked={isReplanWriting && !isChangedWord}
        onLockedPress={sayLocked}
        pair={
          pair !== null && key === pair.key
            ? { label: pair.label, isLit: pair.isLit, onPoint: onPointToFork }
            : null
        }
        isDrawnOpen={key === openedWord}
        onChoose={(value) => choose(key, value)}
        onLight={(isLit) => onLight(isLit ? key : null)}
        onOpenChange={(isOpen) => setOpenWord((now) => (isOpen ? key : now === key ? null : now))}
      />
    );
  };

  return (
    <header
      aria-hidden={isCopy || undefined}
      inert={isCopy}
      className={cn("flex shrink-0 flex-col pt-5 pb-5", className)}
    >
      <Masthead
        menu={
          <DayMenu
            items={[
              ...takeAlong,
              {
                key: "another",
                label: PLAN_ANOTHER_DAY,
                note: "Ask for a day somewhere else",
                // It opens the city word at its field, locked while a re-plan is written.
                onSelect: () => (isReplanWriting ? sayLocked() : onCityOpenChange("elsewhere")),
                isLocked: isReplanWriting,
                movesFocus: !isReplanWriting,
                isApart: takeAlong.length > 0,
              },
            ]}
          />
        }
      />
      {/*
       * The header's room: what the next day played from this one keeps as its floor. A
       * container, so a phone's lines read true wherever it is set, as in a matrix's phone
       * cell; its title's size then follows the header's column rather than the screen. On a
       * laptop it takes the plan's width in either view, under the masthead's at the page's, so
       * the head ends where the day under it does and the switch between views re-wraps nothing.
       */}
      <div ref={roomRef} className="@container mt-5 lg:max-w-abacus">
        <GlidingHeight
          onGlide={onGlide}
          isInstant={isRoomClosedAtOnce}
          minHeight={heldRoom}
          reachPx={ROOM_REACH_PX}
          // Scrolled away, as on a phone a swap is made, the header grows above the screen;
          // on screen too in the moments after a hand acts on the chart below it.
          shouldHoldTheView
          isViewHeldOnScreen={isViewHeld}
          fromHeight={roomFrom}
        >
          {/*
           * Unseen under the live header, its words so far with the longest clauses the curve
           * can add hold its height, so a drag never moves the chart. The spare room sits
           * under the facts, not between the headline and the line about the day.
           */}
          <div className="grid">
            {/*
             * The live header, a line at a time: each over an unseen copy of what has arrived
             * for it, so room opens ahead of the words and a line that wraps glides rather
             * than pushing the lines under it down in one frame.
             */}
            <div ref={linesRef} className="col-start-1 row-start-1 flex flex-col gap-3 self-start">
              <GlidingLine onGlide={setSentenceGliding} isInstant={isRoomClosedAtOnce}>
                <h1
                  ref={headline}
                  className={cn(
                    SENTENCE_CLASSES,
                    LIVE_LINE_CLASSES,
                    isHeadlineLit && HEADLINE_LIT_CLASSES,
                  )}
                >
                  A {wordFor("energy", "", "")}{" "}
                  {/* Muted with the locked words while a re-plan is written, so the word
                    changed is the one word in ink. */}
                  <span
                    className={cn("transition-colors", isReplanWriting ? "text-muted" : "text-ink")}
                  >
                    {weekdayOf(request.date)}
                  </span>
                  {/* Unheard while an owed clause is written after the curve let it go: it
                    does not say what the day is. */}
                  <span aria-hidden={clause === null || undefined}>
                    <ClauseText text={writtenClause.text} isFaded />
                  </span>{" "}
                  in{" "}
                  <VisitorsWord word="city">
                    <CityWord
                      city={request.city}
                      written={written}
                      current={request}
                      openAt={cityOpenAt}
                      onOpenChange={onCityOpenChange}
                      onChooseWritten={onChooseWritten}
                      onChooseCity={onChooseCity}
                      typedCity={typedCity}
                      readings={readings}
                      playedReading={playedReading}
                      onChooseReading={onChooseReading}
                      {...trailOf("city")}
                      trailRoom={trailRooms.city}
                      isChoiceHeld={isChoiceHeld}
                      isFocusedOnMount={isCityFocused}
                      isAssumptionMarked={notice === null}
                      isLocked={isReplanWriting}
                      onLockedPress={sayLocked}
                    />
                  </VisitorsWord>
                  {/* Once a notice says no day is coming, Lantern's words leave with the lines
                    about the day, faded with them rather than unwritten letter by letter. */}
                  {ASSUMABLE_FACT_KEYS.map((key) => {
                    if (notice && facts[key] === null) return null;
                    if (request[key] === null) {
                      return (
                        <motion.span key={key} style={{ opacity }}>
                          {wordFor(key, " ", trails[key])}
                        </motion.span>
                      );
                    }
                    return (
                      <Fragment key={key}>
                        {" "}
                        <VisitorsWord word={key}>
                          {wordFor(key, "", trailOf(key).trail, trailOf(key).trailOpacity)}
                        </VisitorsWord>
                      </Fragment>
                    );
                  })}
                </h1>
                {/*
                 * Its words so far with the clause the header shows, in full from the moment it
                 * is set, so the line a clause needs opens before the clause comes into it. On a
                 * laptop the whole reserve holds the longest clauses, so the chart never moves;
                 * on a phone this line opens once the finger lifts.
                 */}
                <SentenceShape request={request} facts={reservedFacts} clause={shownClause} />
                {/* While the fork's pair stands after its word, the sentence with it holds its
                    room, so the day makes way for it once, at the press. */}
                {pair !== null && (
                  <SentenceShape
                    request={request}
                    facts={reservedFacts}
                    clause={shownClause}
                    pair={pair}
                  />
                )}
              </GlidingLine>
              {notice ? (
                <Notice
                  notice={notice}
                  isWritten={isNoticeWritten}
                  opacity={noticeOpacity ?? whole}
                  isLeaving={isNoticeLeaving}
                  isFocusTaken={isNoticeWrittenIn}
                  onWhole={setIsNoticeWhole}
                  onRetry={onRetry}
                  onChooseWritten={onOpenWritten}
                />
              ) : (
                <motion.div className="flex flex-col gap-2" style={{ opacity }}>
                  <GlidingLine onGlide={setDekGliding}>
                    <p
                      className={cn(
                        DEK_CLASSES,
                        LIVE_LINE_CLASSES,
                        "transition-colors",
                        isAsPlanned && !isReplanWriting ? "text-ink-soft" : "text-muted",
                      )}
                    >
                      {/* Kept mounted while the lead comes and goes, so it comes in. */}
                      <FadeIn of={writtenLead.text}>
                        {writtenLead.text && (
                          <span className={cn("not-italic", LEAD_CLASSES)}>{writtenLead.text}</span>
                        )}
                      </FadeIn>
                      <Ink text={writtenDek.text} isActive={writtenDek.isWriting || isDekWriting} />
                    </p>
                    <div aria-hidden className="invisible col-start-1 row-start-1">
                      <ReservedDek dek={reservedDek} isLeadHeld={isLeadHeld} />
                    </div>
                    {/* The line with its lead and without it, measured and holding no room. */}
                    <div
                      aria-hidden
                      className="invisible col-start-1 row-start-1 h-0 overflow-hidden"
                    >
                      <ReservedDek ref={withLeadShape} dek={reservedDek} isLeadHeld />
                      <ReservedDek ref={withoutLeadShape} dek={reservedDek} isLeadHeld={false} />
                    </div>
                  </GlidingLine>
                  <GlidingLine>
                    {isFactsShown &&
                      (isForkNoteShown && forkNote ? (
                        <ForkNoteLine note={forkNote} className={LIVE_LINE_CLASSES} />
                      ) : (
                        <FactsLine {...factsLine} className={LIVE_LINE_CLASSES} />
                      ))}
                    <div aria-hidden className="invisible col-start-1 row-start-1">
                      <FactsLine {...reservedFactsLine} isReserve />
                    </div>
                    {/* The room of the longer of the two, so the switch moves nothing under it. */}
                    {forkNote && (
                      <div aria-hidden className="invisible col-start-1 row-start-1">
                        <ForkNoteLine note={forkNote} isReserve />
                      </div>
                    )}
                  </GlidingLine>
                  {isFactsShown && unplacedLine && (
                    <p className="type-note text-muted">{unplacedLine}</p>
                  )}
                </motion.div>
              )}
              {/* What a screen reader hears: that the day is being written, or once, in the
                step, the notice's whole line, before the page shows it. Once the notice stands
                whole, the page says it, so this says it no more: read through, the header
                holds the line once. */}
              <p role="status" className="sr-only">
                {noticeLine !== null
                  ? isNoticeSaid
                    ? ""
                    : noticeLine
                  : replanningLine !== null
                    ? isLockedSaid
                      ? ONE_CHANGE_AT_A_TIME
                      : replanningLine
                    : isWaiting
                      ? "Writing the day"
                      : ""}
              </p>
            </div>
            {!notice && (
              <div aria-hidden className="invisible col-start-1 row-start-1 flex flex-col gap-3">
                <div className="grid">
                  {[null, ...ANY_DAYS_CLAUSES].map((reserved) => (
                    <SentenceShape
                      key={reserved ?? ""}
                      request={request}
                      // A clause's room is held for the widest energy word, so a re-picked energy
                      // never moves a laptop's chart (`WIDEST_ENERGY`).
                      facts={reserved === null ? reservedFacts : clauseRoomFacts}
                      clause={reserved}
                      className={reserved === null ? undefined : LAPTOP_ROOM_CLASSES}
                    />
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  <ReservedDek dek={reservedDek} isLeadHeld={isLeadHeld} />
                  <div className="grid">
                    <FactsLine
                      {...reservedFactsLine}
                      isReserve
                      className="col-start-1 row-start-1"
                    />
                    {forkNote && (
                      <ForkNoteLine note={forkNote} isReserve className="col-start-1 row-start-1" />
                    )}
                  </div>
                  {unplacedLine && <p className="type-note">{unplacedLine}</p>}
                </div>
              </div>
            )}
          </div>
        </GlidingHeight>
      </div>
    </header>
  );
}

interface GlidingLineProps {
  children: ReactNode;
  /** Told when the line starts making room and when it has come to rest. */
  onGlide?: (isGliding: boolean) => void;
  /** Takes its new height at once: nothing visible stands under it. */
  isInstant?: boolean;
}

/**
 * One line of the live header over its unseen reserve, both set in the same cell, gliding
 * as either grows. A word written before its room has opened is clipped while the line
 * glides, so lines never overlap; at rest nothing is clipped, so focus rings are whole.
 */
function GlidingLine({ children, onGlide, isInstant }: GlidingLineProps) {
  return (
    <GlidingHeight isClippedWhileGliding onGlide={onGlide} isInstant={isInstant}>
      <div className="grid">{children}</div>
    </GlidingHeight>
  );
}

interface VisitorsWordProps {
  /** Which word it is: the city, or one the visitor's text said. */
  word: "city" | AssumableFactKey;
  children: ReactNode;
}

/**
 * A word of the visitor's in the headline, one unbreakable box with its comma, which sits
 * inside the word's own box (`WordTrail`). Once Lantern's words have gone the box glides to
 * wherever their going moved it (`glideMovedWords`).
 */
function VisitorsWord({ word, children }: VisitorsWordProps) {
  return (
    <span data-word={word} className="inline-block whitespace-nowrap">
      {children}
    </span>
  );
}

/** The sentence's words without Lantern's, as they stand once a day that ended has gone. */
function visitorsWordsOf(facts: SentenceFacts, request: DayRequest): SentenceFacts {
  const assumedKeys = ASSUMABLE_FACT_KEYS.filter((key) => request[key] === null);
  return { ...facts, ...Object.fromEntries(assumedKeys.map((key) => [key, null])) };
}

/** Where each of the visitor's words stands in the headline, by word, from its corner. */
type WordPlaces = ReadonlyMap<string, { x: number; y: number }>;

function wordBoxesOf(line: HTMLElement): HTMLElement[] {
  return [...line.querySelectorAll<HTMLElement>("[data-word]")];
}

/** Measured from the headline, so a page that scrolls as the day leaves moves no word. */
function placesOf(line: HTMLElement): WordPlaces {
  const corner = line.getBoundingClientRect();
  return new Map(
    wordBoxesOf(line).map((box) => {
      const { left, top } = box.getBoundingClientRect();
      return [box.dataset.word ?? "", { x: left - corner.left, y: top - corner.top }];
    }),
  );
}

/**
 * Glides each of the visitor's words that stands elsewhere than it stood from there to its
 * place, on the layout spring, as Lisbon's "with friends" does once Lantern's words before it
 * have left. Each starts where it stood in the frame the step is drawn in.
 */
function glideMovedWords(line: HTMLElement, stood: WordPlaces): AnimationPlaybackControls[] {
  const now = placesOf(line);
  return wordBoxesOf(line).flatMap((box) => {
    const word = box.dataset.word ?? "";
    const from = stood.get(word);
    const to = now.get(word);
    if (!from || !to) return [];
    const x = from.x - to.x;
    const y = from.y - to.y;
    if (Math.hypot(x, y) < MOVED_PX) return [];
    // Set before the frame is drawn, as Motion draws its first only on its next.
    box.style.transform = `translateX(${x}px) translateY(${y}px)`;
    return [animate(box, { x: [x, 0], y: [y, 0] }, SPRINGS.layout)];
  });
}

interface SentenceShapeProps {
  request: DayRequest;
  facts: SentenceFacts;
  /** A clause written in full, or null for the sentence without one. */
  clause: string | null;
  /** The fork's pair after its word, "or eating late". */
  pair?: Pair | null;
  ref?: Ref<HTMLParagraphElement>;
  className?: string;
}

/**
 * The sentence with its words so far and a clause written in full, unseen and inert. Each
 * word is set as the live one is, unbreakable with its comma, so both wrap alike.
 */
function SentenceShape({
  request,
  facts,
  clause,
  pair = null,
  ref,
  className,
}: SentenceShapeProps) {
  const trails = trailsOf(facts);
  return (
    <p
      ref={ref}
      aria-hidden
      className={cn(SENTENCE_CLASSES, "invisible col-start-1 row-start-1", className)}
    >
      A <span>{facts.energy ? labelOf(facts.energy) : ""}</span>{" "}
      <span>{weekdayOf(request.date)}</span>
      <ClauseText text={setOff(clause)} /> in{" "}
      <span className="inline-block whitespace-nowrap">
        {request.city}
        {trails.city}
      </span>
      {ASSUMABLE_FACT_KEYS.map((key) => {
        const fact = facts[key];
        if (fact === null) return null;
        return (
          <span key={key}>
            {" "}
            <span className="inline-block whitespace-nowrap">
              <span className={wordClassesOf(fact)}>{labelOf(fact)}</span>
              {pair?.key !== key && trails[key]}
            </span>
            {pair?.key === key && (
              <span className="inline-block whitespace-nowrap">
                {" or "}
                {pair.label}
                {trails[key]}
              </span>
            )}
          </span>
        );
      })}
    </p>
  );
}

/**
 * The energy word the room for a clause is held for: the widest of the five as the headline sets
 * them, 128 px in a laptop's head where "social" takes 81.5 and "calm" 66.8. The visitor re-picks
 * the energy at once, and a wider word can take the longest clause a line further, so the room
 * is the widest word's. On Nafplio's, Madrid's and Barcelona's days at 1024 and 1280 px no
 * re-picked energy changes the head's room.
 */
const WIDEST_ENERGY: EnergyLevel = "balanced";

/** The words with the energy word the widest, as a re-pick could set it. */
function withWidestEnergy(facts: SentenceFacts): SentenceFacts {
  return facts.energy === null
    ? facts
    : { ...facts, energy: { ...facts.energy, value: WIDEST_ENERGY } };
}

/** The fork's other answer after its word: its key, its label, and whether it is written. */
interface Pair {
  key: AssumableFactKey;
  label: string;
  isLit: boolean;
}

/**
 * The fork's pair while the version not on screen is drawn beside the day: the proposal's
 * answer after the visitor's own while it is written and once whole until a choice, and either
 * version's once compared. None once the fork has folded, or failed.
 */
function pairOf({ status, change, isCompared }: ReplanControls): Pair | null {
  if (change === null) return null;
  const isBeside =
    status === "writing" || status === "proposed" || (isCompared && status !== "failed");
  if (!isBeside) return null;
  const other = status === "taken" ? change.from : change.to;
  return {
    key: change.word,
    label: answerLabelOf(change.word, other),
    isLit: status === "writing",
  };
}

/**
 * Where a word stands in a change of it: its answer changes at once, as one the visitor has
 * chosen or read, whichever version is taken.
 */
function wordReplanningOf(key: FactKey, { change }: ReplanControls): WordReplanning {
  return change !== null && key === change.word ? "after" : null;
}

/** A slot by what it says, so two slots worked out alike read as one. */
function slotKeyOf(slot: HeaderSlot): string {
  return slot === null ? "" : slot.kind === "hint" ? "hint" : `not-yet:${slot.text}`;
}

/**
 * The end of the facts line once a change has settled: the hint where a line said what an
 * earlier change did, which this one has made old; none where the day had no hint left.
 */
function settledSlotOf(slot: HeaderSlot): HeaderSlot {
  return slot?.kind === "not-yet" ? { kind: "hint" } : slot;
}

/** The value of a word's answer the page names by its label or by its value. */
function answerValueOf(key: AssumableFactKey, answer: string): string {
  const option = FACT_OPTIONS[key].find(({ value, label }) => value === answer || label === answer);
  return option?.value ?? answer;
}

/**
 * The controls with the change's two answers as values of the word's vocabulary, as its list's
 * options are. The page names them as the sentence says them, "early dinner", "eating late"
 * (`ReplanControls`); a value is read as its answer too. A word Lantern asked about had no
 * answer, so its question, "with anyone", stays as the page said it and stands for the day before.
 */
function withAnswerValuesOf(replan: ReplanControls): ReplanControls {
  const { change } = replan;
  if (change === null) return replan;
  return {
    ...replan,
    change: {
      word: change.word,
      from: answerValueOf(change.word, change.from),
      to: answerValueOf(change.word, change.to),
    },
  };
}

/** What each answer of each word would do, by `${key}:${value}`; for the energy alone without a day. */
type Forecasts = ReadonlyMap<string, string | null>;

function forecastsOf(day: Itinerary | null, request: DayRequest, facts: SentenceFacts): Forecasts {
  const forecasts = new Map<string, string | null>();
  for (const key of FACT_KEYS) {
    if (key !== "energy" && day === null) continue;
    for (const { value } of FACT_OPTIONS[key]) {
      const reach =
        day === null
          ? facts.energy?.value === value
            ? ({ kind: "current" } as const)
            : ({ kind: "repick" } as const)
          : answerReachOf(day, request, facts, { key, value });
      forecasts.set(`${key}:${value}`, forecastOf(reach));
    }
  }
  return forecasts;
}

/** An answer of a changed word as the sentence says it: its label, or the page's question. */
function answerLabelOf(word: AssumableFactKey, answer: string): string {
  return optionOf({ options: FACT_OPTIONS[word] }, answer)?.label ?? answer;
}

/**
 * What a screen reader hears while a word's re-plan is written: every part its windows
 * rewrite, read from the route's plan for the day on screen, or the whole day's line.
 */
function replanningLineOf(
  change: NonNullable<ReplanControls["change"]>,
  reach: ReplanControls["reach"],
  day: Itinerary | null,
  request: DayRequest,
  facts: SentenceFacts,
): string {
  const word = optionOf({ options: FACT_OPTIONS[change.word] }, change.to)?.label ?? change.to;
  if (reach !== "part" || day === null) return replanningOf(word);
  const answer = { key: change.word, value: change.to };
  return replanningReachOf(word, answerReachOf(day, request, facts, answer));
}

/**
 * The answers a word's list offers, each with what it would do. While the word's proposal is
 * written, the fork's two answers alone: the visitor's, their day as it is, and the proposal's,
 * being written. Once it is whole the proposal's answer takes it, and once a version is chosen
 * the other's brings it back, from memory; any other answer is a new change. A word Lantern
 * had asked about has no answer of its own for the day before, so its question stands for it,
 * first.
 */
function optionsOf(
  key: FactKey,
  fact: Fact | null,
  { status, change }: ReplanControls,
  forecasts: Forecasts,
): OptionView[] {
  const options = (fact?.options ?? []).map((option): OptionView => ({
    value: option.value,
    label: option.label,
    isCurrent: option.value === fact?.value,
    consequence:
      option.value === fact?.value ? null : (forecasts.get(`${key}:${option.value}`) ?? null),
  }));
  if (change === null || key !== change.word || status === "failed") return options;
  // The day before had Lantern's question here: its row stands for it by what the page said.
  const isAsked = !options.some(({ value }) => value === change.from);
  const asked: OptionView[] = isAsked
    ? [
        {
          value: change.from,
          label: ASKED_LABELS[key],
          isCurrent: status !== "taken",
          consequence: null,
        },
      ]
    : [];
  const fromSaid = status === "writing" ? YOUR_DAY_WHILE_WRITTEN : THE_DAY_BEFORE;
  const toSaid: Partial<Record<typeof status, string>> = {
    writing: BEING_WRITTEN,
    proposed: PROPOSED_BESIDE,
    left: THE_PROPOSAL,
  };
  const said = (option: OptionView): OptionView => {
    if (option.value === change.from) {
      return {
        ...option,
        consequence: status === "writing" || !option.isCurrent ? fromSaid : null,
      };
    }
    if (option.value === change.to) return { ...option, consequence: toSaid[status] ?? null };
    return option;
  };
  const withAsked = [...asked, ...options].map(said);
  return status === "writing"
    ? withAsked.filter(({ value }) => value === change.from || value === change.to)
    : withAsked;
}

/**
 * A word of the sentence as its picker shows it. Lantern's assumption is dotted while there
 * is a day planned on it: under a notice there is none, and the dots' key has left with
 * the facts line, so the word reads as plain ink until a day comes. Its answers are its
 * list's (`optionsOf`).
 */
function viewOf(key: FactKey, fact: Fact | null, isPlanned: boolean): Omit<WordView, "options"> {
  const source = fact?.source ?? "assumed";
  return {
    key,
    label: fact === null ? "" : labelOf(fact),
    source: !isPlanned && source === "assumed" ? "chosen" : source,
    struck: null,
    listLabel: LIST_LABELS[key],
  };
}

interface NoticeProps {
  notice: HeaderNotice;
  /** The notice is said, whole; until then its room stands empty. */
  isWritten: boolean;
  opacity: MotionValue<number>;
  /**
   * Leaving for the next day: out of the hand's reach. It is not made inert, which would take
   * the focus off the control pressed.
   */
  isLeaving: boolean;
  /**
   * Said as a day ends on the page, it takes the focus once whole when nothing else holds
   * it; a still, whole from its first frame, never does.
   */
  isFocusTaken: boolean;
  /** Told when the notice stands whole, so it can be read on the page. */
  onWhole: (isWhole: boolean) => void;
  onRetry: () => void;
  onChooseWritten: (request: DayRequest) => void;
}

/**
 * No day to show: what happened, said plainly, then the way on in the same line, a retry
 * or the days that are written or both, each written day as its sentence. Lantern's own
 * words, so no pen writes them: they stand whole once said, into room that stands from
 * before, and once another day is asked for they fade whole as they stand.
 */
function Notice({
  notice,
  isWritten,
  opacity,
  isLeaving,
  isFocusTaken,
  onWhole,
  onRetry,
  onChooseWritten,
}: NoticeProps) {
  const { text, retry, offer, written } = notice;
  // Lantern's own words, said whole as they come, never written letter by letter.
  const isWhole = isWritten;
  const write = noticeRunsOf(isWhole);
  // Out of reach until it stands whole, so the focus never lands on a control that is not
  // there to the eye; its words are heard from the header's status meanwhile.
  useEffect(() => onWhole(isWhole), [isWhole, onWhole]);
  // Written whole, it takes the focus when nothing else holds it, as when it was in a stop's
  // sheet the fading chart took with it: its first way on, so the next Tab is not the foot
  // line. A focus held anywhere else stays where it is.
  const line = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!isWhole || isLeaving || !isFocusTaken) return;
    const active = document.activeElement;
    if (active !== null && active !== document.body) return;
    line.current?.querySelector<HTMLElement>("button")?.focus();
  }, [isWhole, isLeaving, isFocusTaken]);
  return (
    <motion.div
      ref={line}
      inert={!isWhole}
      style={{ opacity }}
      className={cn("flex flex-col gap-5", isLeaving && "pointer-events-none")}
    >
      <p className="type-voice text-quote text-ink-soft">
        {write(text)}
        {retry && (
          <>
            {write(" ")}
            {/* An action named by a verb is set in ink. Its comma is inside it, so the comma
                never opens a line and the focus ring goes round it rather than across it;
                set apart, the comma takes no underline and keeps the line's ink. */}
            <button
              type="button"
              onClick={onRetry}
              className={cn(LINK_CLASSES, "whitespace-nowrap text-ink")}
            >
              {write(retry)}
              {offer && (
                <span aria-hidden className="inline-block text-ink-soft">
                  {write(",")}
                </span>
              )}
            </button>
          </>
        )}
        {offer && write(` ${offer}`)}
      </p>
      {written.length > 0 && (
        <ul className="flex flex-col gap-4">
          {written.map((request) => {
            const { energy, lead, words } = sentenceRunsOf(request);
            return (
              <li key={request.city}>
                <button
                  type="button"
                  onClick={() => onChooseWritten(request)}
                  className={cn(LINK_CLASSES, "text-left type-voice text-dek text-ink-soft")}
                >
                  {/* Set as `AskedSentence` sets it: its energy word in its colour, and each
                      word of the request one unbreakable box with its comma. */}
                  {write("A ")}
                  <span className="text-energy">{write(energy)}</span>
                  {write(lead)}
                  {words.map((word, index) => (
                    <Fragment key={word}>
                      {index > 0 && write(" ")}
                      <span className="whitespace-nowrap">
                        {write(index < words.length - 1 ? `${word},` : word)}
                      </span>
                    </Fragment>
                  ))}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </motion.div>
  );
}

/** The notice's line: what happened, then the way on, as the eye reads it and the ear hears it. */
function noticeLineOf({ text, retry, offer }: HeaderNotice): string {
  const retried = retry ? ` ${retry}${offer ? "," : ""}` : "";
  const offered = offer ? ` ${offer}` : "";
  return `${text}${retried}${offered}`;
}

/**
 * A written day's sentence in the runs it is set in, which say `requestSentenceOf` in
 * order: "A ", "lively", " Saturday in ", then "Lisbon" and "with friends", each word kept
 * whole with the comma after it.
 */
function sentenceRunsOf(request: DayRequest): {
  energy: string;
  lead: string;
  words: readonly string[];
} {
  return {
    energy: energyLabelOf(request.energy),
    lead: ` ${weekdayOf(request.date)} in `,
    words: [request.city, ...chosenLabelsOf(request)],
  };
}

/**
 * Sets each run of the notice: said, as it is; until then in its place unseen, so the notice's
 * lines break where they will stand. A screen reader is told the line meanwhile from the
 * header's status, and finds every word here once it is said.
 */
function noticeRunsOf(isSaid: boolean): (run: string) => ReactNode {
  return function write(run) {
    return isSaid ? run : <span className="opacity-0">{run}</span>;
  };
}

interface FactsLineProps {
  date: string;
  sunrise: number | null;
  sunset: number | null;
  /** The mark's key shows once there is a word of Lantern's to read it on. */
  hasAssumed: boolean;
  slot: HeaderSlot;
  /**
   * Shown; faded where it stands while a word's re-plan is written, its letters kept; or, once
   * a locked word is pressed then, saying one change is made at a time in its place.
   */
  slotStanding?: SlotStanding;
  /** The unseen copy that holds the line's room: plain text, nothing written in. */
  isReserve?: boolean;
  className?: string;
}

/** The facts from code, not the model: the date, the sun, the mark's key and the slot. */
function FactsLine({
  date,
  sunrise,
  sunset,
  hasAssumed,
  slot,
  slotStanding = "shown",
  isReserve = false,
  className,
}: FactsLineProps) {
  const isFaded = slotStanding !== "shown";
  return (
    <p className={cn("type-note text-muted", className)}>
      {DATE_FORMAT.format(new Date(`${date}T12:00:00Z`))}
      {sunrise !== null && (
        <>
          {" · "}
          <SunFact light="sunrise" minutes={sunrise} />
        </>
      )}
      {sunset !== null && (
        <>
          {" · "}
          <SunFact light="sunset" minutes={sunset} />
        </>
      )}
      {hasAssumed && (
        <>
          {" · "}
          <span className={ASSUMED_CLASSES}>assumed</span> by Lantern
        </>
      )}
      {slotStanding === "locked" && <LockedLine />}
      {/* Faded in place, its words kept as they stand; with reduced motion it goes and comes
        back at once. */}
      <span
        aria-hidden={isFaded || undefined}
        className={cn(
          "transition-opacity motion-reduce:transition-none",
          isFaded && "opacity-0",
          slotStanding === "locked" && "hidden",
        )}
      >
        <SlotText slot={slot} />
        {isReserve ? (
          slot?.kind === "not-yet" && ` · ${slot.text}`
        ) : (
          // Mounted throughout, so a changed word's line comes in from nothing.
          <WrittenLine text={slot?.kind === "not-yet" ? slot.text : ""} />
        )}
      </span>
    </p>
  );
}

/** What a changed word's fork says in the facts line's place, and the press it offers. */
export interface ForkNoteShown {
  words: string;
  link: { label: string; onPress: () => void } | null;
}

interface ForkNoteLineProps {
  note: ForkNoteShown;
  /** The unseen copy that holds the line's room: plain text, nothing pressed. */
  isReserve?: boolean;
  className?: string;
}

/**
 * The fork's note in the facts line's place, in the stronger of the two quiet inks: its words
 * come in faded as they change, as words not the model's do, and its press leads to the fork
 * or asks again. The dot before the press is bound to it, so a note that wraps takes the dot to
 * the next line with "see it at 17:30" rather than leaving it at a line's end, as the day's end
 * does with its ways.
 */
function ForkNoteLine({ note, isReserve = false, className }: ForkNoteLineProps) {
  return (
    <p className={cn("type-note text-ink-soft", className)}>
      {isReserve ? note.words : <FadeIn of={note.words}>{note.words}</FadeIn>}
      {note.link && (
        <>
          {" "}
          <span className="whitespace-nowrap">
            {FORK_NOTE_DOT}
            {isReserve ? (
              note.link.label
            ) : (
              <button
                type="button"
                onClick={note.link.onPress}
                className={cn(LINK_CLASSES, TARGET_CLASSES, "text-ink")}
              >
                {note.link.label}
              </button>
            )}
          </span>
        </>
      )}
    </p>
  );
}

/** The dot before a fork note's press, held to it by a space that never breaks. */
const FORK_NOTE_DOT = "·\u00A0";

function SlotText({ slot }: { slot: HeaderSlot }) {
  // A changed word's line comes in after it, and a day that failed is said in the notice,
  // in place of this line.
  if (slot?.kind !== "hint") return null;
  return (
    <>
      {" · "}
      {/* Quieter than the date, it goes at the page's first change. */}
      <span className={cn("pointer-coarse:hidden", HINT_CLASSES)}>click a word to change it</span>
      <span className={cn("hidden pointer-coarse:inline", HINT_CLASSES)}>
        tap a word to change it
      </span>
    </>
  );
}

/**
 * Said in the place of the line's end, fading in whole, when a locked word is pressed while
 * another word's re-plan is written; with reduced motion it stands there at once. Shorter than
 * the hint it stands for, so it takes no line the hint did not; the header's status says it to
 * a screen reader.
 */
function LockedLine() {
  return (
    <span
      aria-hidden
      className="transition-opacity motion-reduce:transition-none starting:opacity-0"
    >
      {" · "}
      <span className="text-ink">{ONE_CHANGE_AT_A_TIME}</span>
    </span>
  );
}

/** A line code says, after its separator, each new one coming in whole. */
function WrittenLine({ text }: { text: string }) {
  const written = useWrittenText(text, "fade");
  const separator = written.text ? " · " : "";
  // Kept mounted while its lines come and go, so the first comes in, its separator with it,
  // and each next line comes in under the separator that stays.
  return (
    <span role="status">
      <FadeIn of={separator}>{separator}</FadeIn>
      <span className="text-ink">
        <FadeIn of={written.text}>{written.text}</FadeIn>
      </span>
    </span>
  );
}

interface SunFactProps {
  light: BestLight;
  minutes: number;
}

/**
 * "sunrise 06:30" after its mark, kept on one line, in figures of one width, so any time
 * takes the room held for it before it is known.
 */
function SunFact({ light, minutes }: SunFactProps) {
  return (
    <span className="whitespace-nowrap text-amber tabular-nums">
      {/* Lifted a pixel, so its horizon sits on the baseline of the capitals. */}
      <SunMark light={light} className="mr-1 inline-block -translate-y-px text-lamp" />
      {light} {formatClock(minutes)}
    </span>
  );
}
