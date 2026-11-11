"use client";

import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import {
  cloneElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type Ref,
} from "react";
import { cn } from "@/components/ui/cn";
import { useHydrated } from "@/components/ui/use-hydrated";
import { WRITTEN_REQUESTS } from "@/lib/days/written/requests";
import { writtenRequestFor } from "@/lib/intake/written-intake";
import { dateInZone } from "@/lib/normalizer/normalize-intake";
import {
  ASSUMABLE_FACT_KEYS,
  ENERGY_LEVELS,
  type AssumableFactKey,
  type DayRequest,
  type EnergyLevel,
  type Itinerary,
} from "@/lib/schema/itinerary.schema";
import type { DayOutcome, PartialDay } from "@/lib/stream/outcome";
import type { CityReading } from "@/lib/schema/intake.schema";
import {
  SUNRISE_ALTITUDE,
  sunCrossing,
  utcOffsetMinutes,
  type DayContext,
  type GeoPoint,
} from "@/lib/geo/sun";
import { changesOf, clauseOf } from "@/features/abacus/clause";
import {
  DEK,
  completeDraftOf,
  hasEnergy,
  draftDayOf,
  openableStopsOf,
  wordsWrittenStopsOf,
  type DayDraft,
  type StopDraft,
} from "@/features/abacus/day-draft";
import { DayRows, type ForkRows } from "@/features/abacus/day-rows";
import { FORK_ROW_ATTRIBUTE } from "@/features/abacus/fork-row";
import { useDrawing } from "@/features/abacus/drawing";
import { FACT_OPTIONS, optionOf, type Answer, type FactKey } from "./facts";
import { forkViewOf } from "./replan-work";
import {
  askedHoursOf,
  basisAtPaceOf,
  dayBounds,
  paceOf,
  wholeDayEndOf,
} from "@/features/abacus/geometry";
import { PEN_BEAT_MS, STOP_BEAT_SECONDS, usePen } from "./use-pen";
import { axisLightWithin, dayLightOf } from "@/features/abacus/light";
import { replanForEnergy } from "@/features/abacus/replan";
import { VIEW_HELD_AFTER_GESTURE_MS } from "./view-hold";
import { useArrivals, type Arrivals } from "@/features/abacus/use-arrivals";
import {
  noteCurveDragged,
  useInvitation,
  type InvitationMemory,
} from "@/features/abacus/use-invitation";
import { PlaceChecksContext } from "@/features/abacus/place-check";
import { forkAnchorsOf, frameStopsOf, type ReplanFrame } from "@/features/abacus/replan-frame";
import { NO_CHECKS, type PlaceChecks } from "@/features/itinerary/use-day-stream";
import { useElementSize, type ElementSize } from "@/components/ui/use-element-size";
import { GlidingHeight } from "@/components/ui/gliding-height";
import { useEnergyCurve, type EnergyCurve } from "@/features/abacus/use-energy-curve";
import type { DayAct, DayAnswer, HeaderWord, ProductEvent } from "@/lib/events/event.schema";
import { useSprung } from "@/components/ui/use-sprung";
import { SPRINGS, gentleOver } from "@/lib/tokens/motion";
import { bareStopOf, waitingInBareRow, waitingOver } from "@/features/abacus/waiting";
import { isAsWritten, midOf, shownPlacesOf, type ShownPlaces } from "@/features/abacus/curve";
import type { CityFocus, TypedCity } from "./city-word";
import { daySlugOf } from "@/lib/days/address";
import {
  ASK_AGAIN,
  answerReachOf,
  forkNoteOf,
  keptStopsLineOf,
  notReplanningYetOf,
  seeItAtOf,
} from "./not-yet";
import { replannedRequestOf } from "./replan-request";
import type { ReplanControls } from "./replan-controls";
import { endedDayOf, noticeOf, phaseOf, slotOf } from "./stream-ending";
import { revealedOf } from "@/features/itinerary/revealed";
import {
  NO_LOCAL_WORDS,
  heldBack,
  penPiecesOf,
  sentenceFactsOf,
  type LocalWords,
  type PenPiece,
} from "./sentence";
import { FootLine, ProgressLine, SOURCES } from "./foot-line";
import { DayEnd } from "./day-end-line";
import type { DayExport } from "./day-export-words";
import { useDayExports } from "./day-exports";
import { takeAlongOf } from "./take-along";
import { PlanBar } from "./plan-energy";
import { progressOf, progressWordsOf } from "./progress";
import { readDayView, serverDayView, subscribeDayView } from "./view-choice";
import { enteredOf, versionsWrittenOf } from "./reading-gates";
import { ReadingList } from "./reading-list";
import { SILENCE_SECONDS, WHOLE_ROWS_SILENCE_SECONDS, useSilence } from "./use-silence";
import { DayStageHeader, type HeaderNotice } from "./day-stage-header";
import { usePickedPlaces } from "./use-picked-places";

const MS_PER_SECOND = 1000;
/**
 * How long after a changed word's press its fork row says what it looks for: longer than a
 * busy route takes to answer that it cannot write (0.1 to 0.3 s), so a failure is said alone.
 */
const LOOKING_SAID_AFTER_SECONDS = 0.35;
/** Where the chart's light is worked out before the first place says where the day is. */
const NOWHERE: GeoPoint = { lat: 0, lng: 0 };
/**
 * A day that ends without one, or a notice that leaves for the next day, has gone to the
 * eye at this opacity, and the header steps then, rather than on the fading spring's last
 * unseen tail.
 */
const FADED_OPACITY = 0.01;

/**
 * The foot's room: apart from the day above it, and under it the room the page kept under the
 * chart before the foot left it, more on a phone than on a laptop.
 */
const FOOT_CLASSES = "mt-12 pb-24 lg:pb-6";

/** The line under the chart's place: just under its frame, as a caption under its data. */
const UNDER_CHART_CLASSES = "mt-1";

/**
 * The day's end: apart from the chart's last row above it, in padding of its own, so nothing
 * of its room is a margin outside the box that glides to it. In Read it is the list's last
 * row, its rule above it.
 */
const END_CLASSES = "pt-3 pb-4 view-read:border-t view-read:border-line view-read:pt-4";

const NO_STOPS: readonly StopDraft[] = [];
/** A day whose text named none of Lantern's words. */
export const NO_CONFIRMED: readonly AssumableFactKey[] = [];

/** The chart's gestures the product's events count. */
type GestureKind = Extract<DayAct, "curve-dragged" | "stop-swapped">;

/** The event each way of taking the day along is counted as. */
const EXPORT_EVENTS = {
  link: "link-shared",
  calendar: "calendar-saved",
  route: "route-opened",
} as const satisfies Record<DayExport, DayAct>;

/** A day that ended without one, as drawn when it ended, kept while its chart fades. */
interface Leaving {
  /** How many pieces the header's pen had written. */
  reached: number;
  /** How many stops the chart had let in. */
  stops: number;
  /** Where the beads were, and the curve with them. */
  arrivals: Arrivals;
  /** The waiting line was showing as the stream last stood, so it fades with the chart. */
  isWaiting: boolean;
}

/** An energy re-picked on a day: the day's stops with the versions picked, and the day. */
interface Repicked {
  day: Itinerary | null;
  stops: readonly StopDraft[];
}

interface DayStageProps {
  /** What the day on screen was asked for; the stream's request once it has started. */
  request: DayRequest;
  partial: PartialDay | null;
  outcome: DayOutcome | null;
  isStreaming: boolean;
  /** The day was chosen on the last one, from its city word or its notice. */
  isChosen: boolean;
  /**
   * The word a re-plan merged for, which takes the focus back as the merged sentence draws it
   * anew: the visitor's own word where Lantern's assumed one stood.
   */
  focusedWord?: AssumableFactKey | null;
  /**
   * Played in place of a day that ended without one: its date and axes wait a beat as well
   * as its header's room, so a day that ends as soon never shows them.
   */
  isAfterExit?: boolean;
  /**
   * Taken from the start screen, which kept its place while the day's header streamed, so
   * the header is written in the order of its words (`DayStageHeader`).
   */
  isFromStart?: boolean;
  /**
   * The day is drawn whole, as it is, with nothing played: its header written, its rows
   * landed and still, its list in, from its first frame. For a written day this device has
   * watched to its end, and for a written day's page in its first HTML, which a reader
   * without the page's script reads; there, until the page's script plays the day for a
   * visitor who has not seen it, it stays unseen (`seen-days.ts`).
   */
  isDrawnWhole?: boolean;
  /** Told when a day played here has come to its end, written whole and still. */
  onPlayedThrough?: () => void;
  /**
   * The day's key on this device, under which the places the visitor chose on it are kept and
   * come back next time (`use-picked-places.ts`); null keeps them on the page alone.
   */
  picksKey?: string | null;
  /**
   * Where the day's first place is before the stream has said it, as the server knows it for
   * a written day: its sun is worked out from it until the first stop brings its own.
   */
  placeHint?: GeoPoint;
  /**
   * What the header says in place of the ending's own notice, for a day kept on the server
   * that its address cannot show: one still being written, or a link past its days.
   */
  keptNotice?: HeaderNotice | null;
  /** Each place's check, by its id, which its row and sheet show; none for a written day. */
  checks?: PlaceChecks;
  /**
   * The day's own address, `/day/kanazawa` or `/day/<id>`, which the line under the finished
   * day sends as its link; null for a day with none, as one at the start screen's address.
   */
  address?: string | null;
  /**
   * A changed word's fork on this day (`replanFrameOf`, `forkFrameOf`): the rows the day shows,
   * its own and a proposal's beside them, or a version's fading out as the fork folds it. Null
   * otherwise.
   */
  replanFrame?: ReplanFrame | null;
  /** A version's stops are off the curve as the fork folds it (`AbacusChart`'s `onFaded`). */
  onReplanFaded?: () => void;
  /**
   * The header's room as a re-plan of this day began, its floor while the re-plan streams, so
   * a shorter line about the day on its way never lifts the chart; lifted as the merged day
   * takes the page, the room glides to its own height at the reach's pace. Null otherwise.
   */
  replanRoom?: number | null;
  /** Plays another day from the city word: a written one, or a city typed there. */
  onPlay: (request: DayRequest) => void;
  /** Plays a written day offered in place of one that ended without one; `onPlay` if not given. */
  onOpenWritten?: (request: DayRequest) => void;
  /** Writes the same day again after a failure. */
  onRetry: () => void;
  /** The visitor's phrases Lantern could not plan around, said back under the facts. */
  unplaced?: readonly string[];
  /**
   * Lantern's words the visitor's text said as they are: theirs from the first frame, as
   * though chosen, while the hint still offers every word to change.
   */
  confirmed?: readonly AssumableFactKey[];
  /**
   * Every city the name could mean, when the day was played as one of them, which the city
   * word lists first; and which of them it is, by place id. Empty for a city named whole.
   */
  readings?: readonly CityReading[];
  playedReading?: string | null;
  /** Another of the readings, chosen: the request for the same day there, and the reading. */
  onChooseReading?: (request: DayRequest, reading: CityReading) => void;
  /**
   * A city typed on the city word that Lantern has not written, with the day's words: given,
   * the page reads the city before it plays a day there, as live generation needs; without
   * it, the request as typed is played.
   */
  onChooseCity?: (request: DayRequest) => void;
  /** The city typed on the city word that the page reads, or could not play; null when none. */
  typedCity?: TypedCity | null;
  /** The city word's list closed on a typed city the page reads or could not play. */
  onTypedCityDropped?: () => void;
  /** Live generation is on: a day that could not be written is asked again, never "not yet". */
  isLive?: boolean;
  /** Told when the visitor re-picks the day's energy on screen, which plays no new day. */
  onEnergyPicked?: (energy: EnergyLevel) => void;
  /**
   * A word other than the energy, changed: given, the day is asked for again with it
   * (`replannedRequestOf`), as live generation re-plans it, with the place each stop shows as
   * the visitor left it, so a re-plan of part of it is written around them; without it, the
   * word keeps its value and the facts line says what it would have re-planned.
   */
  onReplan?: (request: DayRequest, word: string, changed: FactKey, shown: ShownPlaces) => void;
  /**
   * A proposal asked from this day is on its way: the day stays the visitor's, and what sums it
   * up under it waits, as the day it would sum up is not settled.
   */
  isReplanning?: boolean;
  /**
   * What the facts line says of a re-plan asked from this day: that it is on its way, or
   * why the day stays as it was. Null when there is none.
   */
  replanLine?: string | null;
  /** A changed word, while Lantern writes it and after, as the header tells it (`DayStageHeader`). */
  replan?: ReplanControls;
  /** Told of each word of the header changed, as the product's event it makes. */
  onEvent?: (event: Extract<ProductEvent, { kind: "word-changed" }>) => void;
  /**
   * Told of what the visitor does with this day, for the product's events, which add the day
   * as it was opened and its view: each drag of the curve let go, a stop's arrow key among
   * them, each stop swapped, each way the day is taken along, and the line under the whole day
   * staying in view (`READ_TO_END_MS`).
   */
  onDayAct?: (act: DayAct) => void;
  /** Tells the visitor's answer to the one question at the day's end. */
  onDayAnswer?: (answer: DayAnswer) => void;
  /** The answer given for the day opened, held by the page across a re-plan's new end. */
  dayAnswered?: DayAnswer | null;
  /**
   * The page's memory of the chart's invitation to drag, which it shows once across the days
   * it draws (`useInvitation`); left out, each day invites its own.
   */
  invitationMemory?: InvitationMemory;
  /**
   * The height of the room the day before held for its header, when the visitor played this
   * day from it. This header keeps it as a floor until its own room is known, so the chart
   * stays where it stood: without it, the chart rose by the day before's facts and line in
   * one frame, then glided back down as this day's arrived. Null for a day landed on, played
   * again or played after one that ended without a day.
   */
  heldRoom?: number | null;
  /** Receives the box of the header's room, which a day played from this one keeps. */
  roomRef?: Ref<HTMLDivElement>;
}

/** No piece of the header the pen has reached: the playing's first frame. */
const NO_PIECES: readonly PenPiece[] = [];

/**
 * A day as the route streams it: the request as the headline from the start, the chart and
 * the list drawn from the same partial, and the words the visitor can change. The energy
 * word re-picks among the versions already written, and the city plays another day. Any
 * other word re-plans the day once live generation is on (`onReplan`); with it off it says
 * what it would have re-planned.
 */
export function DayStage({
  request,
  partial,
  outcome,
  isStreaming,
  isChosen,
  focusedWord = null,
  isAfterExit = false,
  isFromStart = false,
  isDrawnWhole = false,
  onPlayedThrough,
  picksKey = null,
  placeHint,
  keptNotice = null,
  checks = NO_CHECKS,
  address = null,
  replanFrame = null,
  onReplanFaded,
  replanRoom = null,
  onPlay,
  onOpenWritten = onPlay,
  onRetry,
  unplaced = [],
  confirmed = NO_CONFIRMED,
  readings,
  playedReading,
  onChooseReading,
  onChooseCity,
  typedCity = null,
  onTypedCityDropped,
  isLive = false,
  onEnergyPicked,
  onReplan,
  isReplanning = false,
  replanLine = null,
  replan,
  onEvent,
  onDayAct,
  onDayAnswer,
  dayAnswered = null,
  invitationMemory,
  heldRoom = null,
  roomRef,
}: DayStageProps) {
  const isReducedMotion = useReducedMotion() ?? false;
  // A day that ends without one leaves from the stream as last drawn: while its chart fades,
  // the chart and the header stay as they were, so nothing moves but the fade, and the header
  // takes the ending once the chart has gone. A refusal's partial is gone with its outcome.
  const [drawnPartial, setDrawnPartial] = useState(partial);
  if (outcome === null && partial !== drawnPartial) setDrawnPartial(partial);
  const endingPhase = phaseOf(outcome, endedDayOf(outcome));
  const isEndedWithoutDay = endingPhase === "failed" || endingPhase === "not-yet";
  // A day played in place of one that ended without one draws its date and axes a beat
  // after its run starts, with motion and without, and never if it too ends without one
  // before then.
  const [isDayDrawn, setIsDayDrawn] = useState(!isAfterExit);
  useEffect(() => {
    if (isDayDrawn || isEndedWithoutDay) return undefined;
    const beat = window.setTimeout(() => setIsDayDrawn(true), PEN_BEAT_MS);
    return () => window.clearTimeout(beat);
  }, [isDayDrawn, isEndedWithoutDay]);
  // A day draws them once the header's room is known (below), wherever it was landed on:
  // drawn sooner, the empty date and axes rode the room's glide down by the line about the
  // day as it arrived, up to 324 px at 25 px a frame from the start screen and 186 px on
  // Kyoto's link. A day drawn whole, or written under the room the day before held, knows it.
  const [isRoomKnown, setIsRoomKnown] = useState(isDrawnWhole || heldRoom !== null);
  const isFrameDrawn = isDayDrawn && isRoomKnown;
  const [basis, setBasis] = useState<ElementSize | null>(null);
  const [isChartGone, setIsChartGone] = useState(false);
  // Only a chart on screen fades. Under reduced motion the day leaves in one step, opacity
  // included, which `MotionConfig reducedMotion="user"` would still animate.
  const isChartLeaving =
    isEndedWithoutDay && !isChartGone && basis !== null && isFrameDrawn && !isReducedMotion;
  // The chart and what the header says of the day fade on this one value, as one piece.
  const dayOpacity = useMotionValue(1);
  const shownPartial = isChartLeaving ? drawnPartial : partial;
  const shownOutcome = isChartLeaving ? null : outcome;
  // What the pens had reached and the beads had done when the stream ended, which the
  // leaving chart and header keep: a stop let in or a bead sliding on would move.
  const [leaving, setLeaving] = useState<Leaving | null>(null);
  const frozen = isChartLeaving ? leaving : null;

  const revealed = useMemo(
    () => revealedOf(shownPartial, shownOutcome),
    [shownPartial, shownOutcome],
  );
  // Once the stream has ended with a day, the chart draws the normalized itinerary: its
  // repairs show, and its ids are the ones the stream used, so nothing remounts.
  const ended = endedDayOf(shownOutcome);
  const draft = useMemo(
    (): DayDraft => (ended ? completeDraftOf(ended) : draftDayOf(revealed)),
    [ended, revealed],
  );
  const phase = phaseOf(shownOutcome, ended);
  const assumptions = ended ? assumptionsOf(ended) : revealed.day.assumptions;

  const [local, setLocal] = useState<LocalWords>(NO_LOCAL_WORDS);
  const [notYet, setNotYet] = useState<string | null>(null);
  // An energy re-picked on the day: its stops as picked, with the day they were picked on. They
  // stand only while that day does: kept on, a merged re-plan showed the day before's stops,
  // its old dinner among them, under the new word.
  const [repicked, setRepicked] = useState<Repicked | null>(null);
  const replanned = repicked !== null && repicked.day === ended ? repicked.stops : null;
  const [cityOpenAt, setCityOpenAt] = useState<CityFocus | null>(null);
  const words = useMemo(
    (): LocalWords => ({ ...local, confirmed: [...confirmed, ...local.confirmed] }),
    [local, confirmed],
  );
  const facts = sentenceFactsOf(request, assumptions, words);
  // The facts the playing's first frame says: the request's own, none of the stream's.
  const startFacts = sentenceFactsOf(request, undefined, words);
  // A re-plan's line about the day waits for the merged day, whose pen writes it as it takes
  // the page with its sentence: written as it streamed, Lisbon's line a line longer pushed
  // the day 24 px down on a phone, and the merged sentence a line shorter lifted it back.
  const dek = draft.dek;
  // The header's pen reaches what has arrived a beat at a time, in the sentence's order.
  const pieces = penPiecesOf(request, facts, dek);
  // The pen writes a word in only once the sentence's row has opened the line it needs: on a
  // slow machine the pen caught up at once after a pause while the row's glide started a
  // frame late, and a word's first letter stood a frame under the row's edge.
  const [isSentenceGliding, setIsSentenceGliding] = useState(false);
  // On the start screen the sentence is written in its order, and the line about the day waits
  // for it to stand whole, so the pen writes the line after the sentence: the
  // pen sees the line only then, and the stops land once it reaches it, so one pen writes at
  // a time (`docs/decisions.md`, "A row's words go where its bead comes to rest, and rows ease
  // rather than jump").
  const [isSentenceInOrder, setIsSentenceInOrder] = useState(false);
  const wordPieces = pieces.filter((piece) => piece !== "dek").length;
  const penReached = usePen(
    isSentenceInOrder ? wordPieces : pieces.length,
    PEN_BEAT_MS,
    isSentenceGliding,
  );
  const reached = pieces.slice(0, frozen?.reached ?? (isDrawnWhole ? pieces.length : penReached));
  // The day lands on the chart once the pen has reached the line about the day, so its
  // first stop never arrives while the header above it is still making room.
  const isHeaderWritten = reached.includes("dek");
  // ...and once the header has come to rest: a long line about the day still streaming in
  // makes room for itself, and a stop landing under it would ride the glide down.
  const [isHeaderGliding, setIsHeaderGliding] = useState(false);
  // The chart's rows springing to new places, which a fade waits for as it waits for the header.
  const [isRowsGliding, setIsRowsGliding] = useState(false);
  // The list's rows on their way, a row let in or its versions coming in, which the day's
  // end waits for; in a ref too, read in the frame that would land it, since a fold sets off
  // in the effects of the render the end waits from.
  const listGliding = useRef(false);
  const [isListGliding, setIsListGliding] = useState(false);
  const onListGlide = useCallback((isGliding: boolean) => {
    listGliding.current = isGliding;
    setIsListGliding(isGliding);
  }, []);
  // The room a re-plan held stays the header's floor once the merged day takes the page,
  // until its rows have come to rest: the rows rise into the room the old stops leave, and
  // then the header lifts the day to its own height. Each glides at the reach's pace, about
  // 3 px a frame; together they moved a row on screen twice that.
  const [mergedRoom, setMergedRoom] = useState<number | null>(null);
  const [lastReplanRoom, setLastReplanRoom] = useState(replanRoom);
  if (lastReplanRoom !== replanRoom) {
    setLastReplanRoom(replanRoom);
    setMergedRoom(replanRoom === null ? lastReplanRoom : null);
  }
  useEffect(() => {
    if (mergedRoom === null || isRowsGliding) return undefined;
    // A frame on, so rows the merge sets gliding have said so before the room goes.
    const rested = requestAnimationFrame(() => setMergedRoom(null));
    return () => cancelAnimationFrame(rested);
  }, [mergedRoom, isRowsGliding]);
  // The day before's room stays under this header until this day's own is known: the line
  // about the day written to its end, as the room holds what has arrived and the line grows
  // as it streams; the stream ended; or a chart that ended without a day gone, so the header
  // steps to its notice with nothing under it. Lifted as the pen reached the line, the room
  // fell to the line's first words and rose again as the rest arrived. Lifting the floor may
  // glide the room to its own height, and the header reports that glide only once the lift
  // is drawn, so the first stop waits for the rest reported after the lift, never before it.
  const [isRoomHeld, setIsRoomHeld] = useState(heldRoom !== null);
  const [isRoomLifting, setIsRoomLifting] = useState(false);
  // A day that takes the page with its header already streamed, as a re-plan does, is drawn
  // once on the room held for it before the room goes: the header then glides from the day
  // before's height to its own and says when it rests, which its stops wait for. Let go in
  // its first render, the room was never drawn, nothing glided, and the stops waited on.
  const [isRoomDrawn, setIsRoomDrawn] = useState(false);
  useEffect(() => {
    const drawn = requestAnimationFrame(() => setIsRoomDrawn(true));
    return () => cancelAnimationFrame(drawn);
  }, []);
  const isDekWhole = isHeaderWritten && draft.writing !== DEK;
  if (isRoomHeld && isRoomDrawn && (isDekWhole || (outcome !== null && !isChartLeaving))) {
    setIsRoomHeld(false);
    setIsRoomLifting(true);
  }
  const onHeaderGlide = useCallback((isGliding: boolean) => {
    setIsHeaderGliding(isGliding);
    if (!isGliding) setIsRoomLifting(false);
  }, []);
  // The room is known once the line about the day has arrived whole, or the stream has
  // ended, and the room has come to rest a frame on: a glide the arrival sets off is
  // reported after it is drawn, and cancels the frame's wait for it.
  const hasDekArrived = draft.dek !== undefined && draft.writing !== DEK;
  // A stream that ends without a day before then never draws the frame: the header steps to
  // its notice over nothing, where the frame drawn as it ended came for a frame and faded.
  const isRoomSettling =
    !isRoomKnown && (hasDekArrived || (outcome !== null && !isEndedWithoutDay)) && !isHeaderGliding;
  useEffect(() => {
    if (!isRoomSettling) return undefined;
    const rested = requestAnimationFrame(() => setIsRoomKnown(true));
    return () => cancelAnimationFrame(rested);
  }, [isRoomSettling]);
  const [hasLanded, setHasLanded] = useState(isDrawnWhole);
  // The chart its stops land on is drawn once the room is known.
  const isRoomAtRest = !isHeaderGliding && !isRoomHeld && !isRoomLifting && isRoomKnown;
  if (!hasLanded && isHeaderWritten && isRoomAtRest) setHasLanded(true);
  // With motion a row lands as soon as its stop is placed, and eases as its words arrive.
  // Under reduced motion nothing eases, so a row waits until its words are all there and
  // lands whole: one that grew as they arrived would step, and the rows below it with it.
  const frameStops = useMemo(
    () => (replanFrame === null ? null : frameStopsOf(replanFrame)),
    [replanFrame],
  );
  // A proposal's stops beside the day, the day's own it would replace, and a version's fading.
  const replanProposed = useMemo(() => new Set(replanFrame?.proposed ?? []), [replanFrame]);
  const replanReplaced = useMemo(() => new Set(replanFrame?.replaced ?? []), [replanFrame]);
  const replanFading = useMemo(() => new Set(replanFrame?.fading ?? []), [replanFrame]);
  const shownStops = frameStops ?? replanned ?? draft.stops;
  const ready = useMemo(
    () => (isReducedMotion ? wordsWrittenStopsOf(shownStops) : shownStops),
    [isReducedMotion, shownStops],
  );
  const landed = hasLanded ? ready : NO_STOPS;
  // Stops that arrive together, as those held for the header do, land a beat apart.
  const stopsPen = usePen(landed.length, STOP_BEAT_SECONDS * MS_PER_SECOND);
  const stopsLetIn = frozen?.stops ?? (isDrawnWhole ? landed.length : stopsPen);
  // A re-plan's frame is let in whole: its new stops enter among the others, each growing into
  // the room an old one leaves, and a count let in a beat at a time would hold back the day's
  // last stop instead of the new one.
  const stops = useMemo(
    () => (frameStops === null ? landed.slice(0, stopsLetIn) : landed),
    [frameStops, landed, stopsLetIn],
  );
  // The list to read lets in the chart's rows once each says nothing the stream may still
  // change: a stop once the stream has placed the next, kept by the normalizer as written,
  // and its versions once the stream has begun the next stop's or ended. A fork's rows are
  // whole: the day's with their versions, a proposal's without, as on the chart.
  const listVersions = useMemo((): ReadonlySet<string> => {
    if (replanFrame !== null) {
      return new Set(
        replanFrame.rows.flatMap((row) => (row.source === "proposed" ? [] : [row.stop.id])),
      );
    }
    return versionsWrittenOf(
      stops,
      revealed.day.alternatives,
      replanned !== null || draft.isComplete,
    );
  }, [replanFrame, replanned, draft.isComplete, stops, revealed.day.alternatives]);
  // Under reduced motion nothing eases, so a row waits for its versions too and comes in
  // whole, as the chart's rows wait for their words: one that took its versions after
  // stepped the rows below by 22 to 45 px.
  const listWhole = useMemo(() => {
    if (frameStops !== null || replanned !== null || draft.isComplete) return stops.length;
    const whole = openableStopsOf(revealed.day, draft);
    return enteredOf(
      stops,
      isReducedMotion ? new Set([...whole].filter((id) => listVersions.has(id))) : whole,
    );
  }, [frameStops, replanned, draft, revealed.day, stops, isReducedMotion, listVersions]);
  // A day that ends without one keeps the rows it showed while its chart fades.
  const [listEntered, setListEntered] = useState(isDrawnWhole ? listWhole : 0);
  if (!isChartLeaving && listEntered !== listWhole) setListEntered(listWhole);
  const isListWritten =
    phase === "done" &&
    listEntered === stops.length &&
    stops.every((stop) => listVersions.has(stop.id));
  // The list is drawn only while it is on show: hidden behind the chart, its pens and
  // springs took frames from the chart's on a busy machine. Drawn again, the rows let in so
  // far stand whole, and the ones after are written in.
  const view = useSyncExternalStore(subscribeDayView, readDayView, serverDayView);
  // A changed word's fork, a row over each part it rewrites: what Lantern is doing, what the
  // proposal would change, or why it failed, which stays until the visitor next acts on the day.
  const changeKey = replan ? `${replan.status}|${replan.change?.word}|${replan.change?.to}` : "";
  const [isActedOn, setIsActedOn] = useState(false);
  // The search is said a beat after the press: a route that answers at once that it cannot
  // write, as a busy one does in a tenth of a second, says so with nothing said before it.
  const isLookingDue = useSilence(
    changeKey,
    replan?.status === "writing",
    LOOKING_SAID_AFTER_SECONDS,
  );
  const [actedKey, setActedKey] = useState(changeKey);
  if (actedKey !== changeKey) {
    setActedKey(changeKey);
    setIsActedOn(false);
  }
  const forkView = replan ? forkViewOf({ replan, frame: replanFrame, isLookingDue }) : null;
  const isForkShown = forkView !== null && !(forkView.isFailed && isActedOn);
  const fork: ForkRows | null =
    replan && forkView && isForkShown && replan.windows.length > 0
      ? {
          view: forkView,
          // Over the version that stays: a version folding away gives its room back at the tap.
          anchors: forkAnchorsOf(
            replanFading.size === 0 ? stops : stops.filter((stop) => !replanFading.has(stop.id)),
            replan.windows,
          ),
          onChoose: replan.choose,
          onCompare: replan.compare,
          // "Ask again" goes from under the focus as the fork writes anew: the changed word in
          // the headline takes it, where the change came from, so it never falls to the page.
          onAskAgain: () => {
            const word = replan.change?.word;
            replan.askAgain();
            if (word === undefined) return;
            document.querySelector<HTMLElement>(`h1 button[data-fact="${word}"]`)?.focus();
          },
        }
      : null;
  /**
   * The proposal's answer in the sentence points to its fork: the first row scrolls into view,
   * on the chart or in the list, whichever is shown, and its chosen answer takes the focus.
   */
  const pointToFork = () => {
    const rows = [...document.querySelectorAll<HTMLElement>(`[${FORK_ROW_ATTRIBUTE}="0"]`)];
    const row = rows.find((each) => each.getClientRects().length > 0 && each.offsetHeight > 0);
    if (!row) return;
    row.scrollIntoView({ block: "center", behavior: isReducedMotion ? "instant" : "smooth" });
    row.querySelector<HTMLElement>('[role="radio"][tabindex="0"]')?.focus({ preventScroll: true });
  };
  // Where the visitor looks once they have pressed a word, the facts line says what its fork is
  // doing and where, or why the word came back, until they next act on the day; "see it at"
  // leads to the fork's first row, usually below a phone's screen, which nothing scrolls to by
  // itself (the phone pass, 2026-11-08).
  const replanBasis = shownOutcome?.kind === "complete" ? shownOutcome.itinerary : null;
  const forkParts =
    replan?.change && replan.reach === "part" && replanBasis !== null
      ? answerReachOf(replanBasis, request, facts, {
          key: replan.change.word,
          // The sentence's label, as the change says it, is the answer's value here.
          value:
            FACT_OPTIONS[replan.change.word].find(
              ({ label, value }) => label === replan.change?.to || value === replan.change?.to,
            )?.value ?? replan.change.to,
        })
      : null;
  // The fork's first row stands over its part's first stop, where "see it at" leads.
  const forkAt = fork && forkParts?.kind === "part" ? forkParts.at : null;
  const forkNote =
    forkView !== null && isForkShown && !isActedOn
      ? forkNoteOf(
          {
            ...forkView,
            reason: forkView.isFailed ? (forkView.line?.words ?? null) : null,
          },
          forkParts?.kind === "part" ? forkParts.parts : [],
          forkAt,
        )
      : null;
  const forkNoteShown =
    forkNote === null
      ? null
      : {
          words: forkNote.words,
          link:
            forkNote.link === null
              ? null
              : forkNote.link.kind === "see"
                ? { label: seeItAtOf(forkNote.link.at), onPress: pointToFork }
                : { label: ASK_AGAIN, onPress: fork?.onAskAgain ?? (() => replan?.askAgain()) },
        };
  // The line under the day counts the rows on screen, never the stream ahead of them: it
  // says nothing until the first row has landed. In Read those are the list's, which lets a
  // stop in and says its versions later than the chart: counted from the chart, the line
  // said a stop so far over an empty list for 2.3 s.
  const listShown = useMemo(
    () =>
      stops.slice(0, listEntered).map((stop) => ({
        alternatives: listVersions.has(stop.id) ? stop.alternatives : [],
      })),
    [stops, listEntered, listVersions],
  );
  const progress = progressWordsOf(
    view === "read" ? progressOf(listShown, isListWritten) : progressOf(stops, phase === "done"),
  );

  // The open stop by its id, which the normalizer keeps whatever it drops, so a stop opened
  // while the day is written stays the one open when the day completes, and closes if the
  // finished day leaves it out.
  const [openStopId, setOpenStopId] = useState<string | null>(null);
  const openAt = openStopId === null ? -1 : stops.findIndex((stop) => stop.id === openStopId);
  const openStop = openAt === -1 ? null : openAt;
  const setOpenStop = useCallback(
    (index: number | null) => setOpenStopId(index === null ? null : (stops[index]?.id ?? null)),
    [stops],
  );
  const [hoveredStop, setHoveredStop] = useState<number | null>(null);
  const [hoveredPlace, setHoveredPlace] = useState<string | null>(null);
  const [litFact, setLitFact] = useState<FactKey | null>(null);
  const requestedEnergy = ENERGY_LEVELS.indexOf(request.energy);
  const arrivals = useArrivals(stops, requestedEnergy);
  // The day's city as its events name it, the city the visitor changed a word on.
  const city = daySlugOf(request);
  // A gesture on the chart holds the view while the header glides after it, and a while
  // after its last glide (`VIEW_HELD_AFTER_GESTURE_MS`): on a phone the header takes the room
  // its clause and the line's lead need once the finger lifts, and held, it grows up and out
  // of the screen instead of moving the chart under the hand.
  const [heldGesture, setHeldGesture] = useState(0);
  useEffect(() => {
    if (heldGesture === 0 || isHeaderGliding) return undefined;
    const timer = window.setTimeout(() => setHeldGesture(0), VIEW_HELD_AFTER_GESTURE_MS);
    return () => window.clearTimeout(timer);
  }, [heldGesture, isHeaderGliding]);
  const countGesture = (kind: GestureKind) => {
    // A gesture on the day is the visitor acting on it: a re-plan's receipt makes way.
    setIsActedOn(true);
    setHeldGesture((count) => count + 1);
    // One who has bent the curve needs showing how no more, on any page.
    if (kind === "curve-dragged") noteCurveDragged();
    onDayAct?.(kind);
  };
  const curve = useEnergyCurve(stops);
  const energy: EnergyCurve = {
    ...curve,
    // Called only once a press has become a drag; let go, the curve was dragged.
    endDrag: () => {
      countGesture("curve-dragged");
      curve.endDrag();
    },
    // A stop's arrow key bends the curve at it, as a drag there does.
    pullTo: (stopIndex, level) => {
      countGesture("curve-dragged");
      curve.pullTo(stopIndex, level);
    },
    choose: (stopIndex, candidateIndex) => {
      // A proposal's bead is taken as a version's is: its version of the part becomes the day.
      const id = stops[stopIndex]?.id;
      if (id !== undefined && replanProposed.has(id)) {
        replan?.choose(replan.status === "taken" ? "from" : "to");
        return;
      }
      if (candidateIndex !== curve.selected[stopIndex]) countGesture("stop-swapped");
      curve.choose(stopIndex, candidateIndex);
    },
  };
  // Ready once every stop has landed and settled: a stream can end before its day lands. A
  // proposal beside the day leaves the day the visitor's, to drag and open as at rest.
  const isAllIn = hasLanded && stops.length === landed.length;
  const isInteractive = phase === "done" && draft.isComplete && isAllIn && arrivals.isSettled;
  // The ring's example is dashed as a proposal's path is: it waits while a fork draws one, so
  // the only dashed curve beside the day is the proposal's.
  const invitation = useInvitation({
    stops,
    isInteractive: isInteractive && replanFrame === null,
    memory: invitationMemory,
  });
  usePickedPlaces({
    day: picksKey,
    written: draft.stops,
    stops,
    committed: curve.committed,
    restore: curve.restore,
    isWhole: draft.isComplete,
    isInteractive,
  });
  // A day played to its end here is one this device has seen; one drawn whole was already.
  const onPlayedThroughNow = useRef(onPlayedThrough);
  useLayoutEffect(() => {
    onPlayedThroughNow.current = onPlayedThrough;
  });
  useEffect(() => {
    if (isInteractive && !isDrawnWhole) onPlayedThroughNow.current?.();
  }, [isInteractive, isDrawnWhole]);
  // Drawn whole in the page's first HTML, the day shows a visitor who has not seen it the
  // playing's first frame until the page's script plays it from there (`seen-days.ts`): the
  // header as the playing starts it, beside the whole one, and the list without its rows.
  // Under the chart the sources and the page's end wait for it, seen or not: drawn in the
  // first HTML under the list, they stood under the switch until the chart pushed them down.
  const isHydrated = useHydrated();
  const isStartDrawn = isDrawnWhole && !isHydrated;
  const wholeClasses = isDrawnWhole ? "unseen:hidden" : undefined;
  const footClasses = isStartDrawn ? "view-chart:hidden" : undefined;
  // The sources and the page's end stand under the list from the first frame of a day drawn
  // whole, in its HTML too, so a reader without the page's script has the places' credit.
  // Under the chart they wait for it, whose drawing would push them down.
  const isFootDrawn = (basis !== null && isFrameDrawn) || (isDrawnWhole && view === "read");
  const clause = clauseOf(changesOf(stops, energy.committed));
  // The places the line about the day was written around: what each stop showed when the line
  // last changed. A re-plan writes the line again around the day as it then stands, so a
  // version the visitor kept through it is the line's own.
  const shownPlaces = shownPlacesOf(stops, energy.committed);
  const [writtenFor, setWrittenFor] = useState({ dek, places: shownPlaces });
  if (writtenFor.dek !== dek) setWrittenFor({ dek, places: shownPlaces });
  // Under reduced motion a placed stop waits unseen while its words are written. When that
  // lasts as long as a silence, as with a live model, the waiting line stands where its row
  // will land, as it does in a silence.
  const heldStop = ready.length < shownStops.length ? (shownStops[ready.length]?.id ?? null) : null;
  // One pen at a time: a silence counts only once the header's pen has no word or line about
  // the day left to write, so the waiting line never writes under a headline still being
  // written. On the start screen it wrote on the empty chart from 1.45 to 1.96 s after the
  // turn (the same entry); counted through the pen, it came for a frame as the rows landed.
  const isHeaderPenDone = (frozen?.reached ?? penReached) >= pieces.length;
  const isHeldLong = useSilence(heldStop, hasLanded && heldStop !== null && isHeaderPenDone);
  // A silence is a pause in what the page shows, not in what the stream sends: the stream
  // writes a place's name and kind unseen until its bead is weighed, and its summary and
  // look, which only its sheet shows, after its row is written. Read from the partial, a row
  // that stood bare, or a pause before the next row while a summary streamed, never fell
  // silent, and no waiting line said the day was still being written.
  // A row that lands is an arrival, bare or not, and ends the line. And a silence waits for
  // the rows' pens, as for the header's, so the line never writes under a name still being
  // written, as it did under all eight of Kyoto's.
  const shownProgress = [
    penReached,
    draft.dek?.length ?? 0,
    ...stops.map((stop) => `${stop.id}:${hasEnergy(stop)}:${stop.alternatives.length}`),
  ].join("|");
  const [isRowPenWriting, setIsRowPenWriting] = useState(false);
  const isSilent =
    useSilence(
      shownProgress,
      isStreaming && isHeaderPenDone && !isRowPenWriting,
      isReducedMotion ? WHOLE_ROWS_SILENCE_SECONDS : SILENCE_SECONDS,
    ) || isHeldLong;
  // The silence as the stream last stood: its ending stops the stream in the same render,
  // which ends the silence too, so a day that ends in one keeps its waiting line through
  // the fade from this.
  const [wasSilent, setWasSilent] = useState(false);
  if (outcome === null && isSilent !== wasSilent) setWasSilent(isSilent);
  const isWaiting = frozen?.isWaiting ?? isSilent;
  // A day being written whose headline stands whole, before the stream's first words: the
  // light leaves with them, and comes back only in a silence before the frame is drawn.
  const hasFirstWords = partial !== null && Object.keys(partial).length > 0;
  const isAwaitingFirstWords =
    !frozen && isStreaming && isHeaderPenDone && outcome === null && !hasFirstWords;
  if (isChartLeaving && leaving === null) {
    setLeaving({ reached: penReached, stops: stopsLetIn, arrivals, isWaiting: wasSilent });
  }
  // A day asked for while something of this one fades, the notice or the chart with what
  // the header says of the day, waits for it to go. What the press leaves, the notice and
  // the city's list the day was chosen from, fades on this one value, out of the hand's
  // reach; a second press plays nothing more. Then the next day is drawn at its place.
  const leavingOpacity = useMotionValue(1);
  const nextDay = useRef<(() => void) | null>(null);
  const hasPlayedNext = useRef(false);
  const [isLeavingForNext, setIsLeavingForNext] = useState(false);
  /** Plays the day asked for once what the press leaves, and a chart fading, are gone. */
  const playNextOnceGone = useCallback(
    (isChartFading: boolean) => {
      const play = nextDay.current;
      if (!play || hasPlayedNext.current || leavingOpacity.get() > FADED_OPACITY) return;
      if (isChartFading && dayOpacity.get() > FADED_OPACITY) return;
      hasPlayedNext.current = true;
      play();
    },
    [leavingOpacity, dayOpacity],
  );
  // The fade sets off once the header and the chart's rows have come to rest, the pens
  // stopped where they were and the last row landed, so from its first frame nothing changes
  // but opacity: a stream can end while a row is still on its way. The header steps once the day has
  // gone to the eye, unless a day was asked for meanwhile: that day takes this one's place,
  // and this one's notice is never drawn.
  useEffect(() => {
    if (!isChartLeaving || isHeaderGliding || isRowsGliding) return undefined;
    const fade = animate(dayOpacity, 0, {
      ...SPRINGS.snappy,
      onUpdate: (opacity) => {
        if (opacity > FADED_OPACITY) return;
        if (nextDay.current) playNextOnceGone(true);
        else setIsChartGone(true);
      },
    });
    return () => fade.stop();
  }, [isChartLeaving, isHeaderGliding, isRowsGliding, dayOpacity, playNextOnceGone]);

  // The frame follows the hours the words ask for, and springs when they arrive; time runs
  // down it at the pace they set for as long as the day is on screen.
  const bounds = dayBounds(
    stops,
    askedHoursOf(facts.start?.value ?? null, facts.end?.value ?? null),
  );
  const dayStart = useSprung(bounds.start);
  const askedEnd = useSprung(bounds.end);
  // The first place's own numbers as they arrive, so each new partial of the same place
  // keeps the context; the header holds room for its sun times from then. Both are needed:
  // no sun time is said for a place that is not there yet, unless the page knows where it is.
  const { lat, lng } = draft.stops[0]?.primary.coordinates ?? placeHint ?? {};
  const context = useMemo(
    () => (lat !== undefined && lng !== undefined ? contextOf(request, { lat, lng }) : null),
    [request, lat, lng],
  );
  const daylight = context ?? contextOf(request, NOWHERE);
  // The sun's light is worked out once for the day and its place; the frame cuts it as it springs.
  const dayLight = useMemo(() => (context ? dayLightOf(context) : []), [context]);
  const sunrise = context ? sunCrossing(context, SUNRISE_ALTITUDE, "rising") : null;
  const sunset = context ? sunCrossing(context, SUNRISE_ALTITUDE, "setting") : null;

  // The header's written lines, which an open stop's sheet rising over the day stops short of.
  const [headerLines, setHeaderLines] = useState<HTMLDivElement | null>(null);
  const [chartBox, setChartBox] = useState<HTMLDivElement | null>(null);
  // Measured once as the box is attached, before the first paint, so a day there whole from
  // its first frame has its chart in that frame; the observer keeps it current after.
  const [attachedSize, setAttachedSize] = useState<ElementSize | null>(null);
  const attachChartBox = useCallback((box: HTMLDivElement | null) => {
    setChartBox(box);
    if (box) setAttachedSize({ width: box.clientWidth, height: box.clientHeight });
  }, []);
  const size = useElementSize(chartBox) ?? attachedSize;
  // The time scale is fitted to a day's height, the same however tall the header grows,
  // once per width.
  if (size && size.width > 0 && size.width !== basis?.width) setBasis(size);
  // The chart's pixels for the root's size, read as the day renders, before any paint, so a
  // day drawn on a large screen is drawn at them from its first frame.
  const { chart } = useDrawing();
  const dayHeight = basis?.height ?? 0;
  // Once the stream has ended with a day, the frame ends on the whole hour after its last visit
  // rather than on the hour its words asked for: the same minute in every plan a re-pick can show,
  // since a stop's times are its own whichever version it shows. Time keeps the asked hours' pace,
  // so no row moves, and only the frame's end and what stands under it rise, on the gentle spring,
  // given longer for a longer shrink so it never moves faster than over Kyoto's 90 px. While the
  // day is written, and for a day that ends without one, the frame keeps the asked hours on the
  // layout spring. One spring carries the end through both, so it goes on from wherever it stands.
  const pace = paceOf({ start: dayStart, end: askedEnd }, dayHeight, chart);
  // A re-plan's frame ends on its stops, struck and new, so a new last stop past the old end
  // draws the frame out as it arrives, on the same spring, rather than past the frame's end
  // until the merged day takes the page.
  const wholeEnd = ended
    ? wholeDayEndOf(frameStops ?? draft.stops, bounds, paceOf(bounds, dayHeight, chart), chart)
    : bounds.end;
  const shrinkPx = Math.abs(bounds.end - wholeEnd) * pace;
  const sprungEnd = useSprung(wholeEnd, wholeEnd, ended ? gentleOver(shrinkPx) : "layout");
  // A day that opens whole draws its frame's end where it rests from its first frame. Its
  // spring sets off from the asked hours, the end worked out before the chart's room is known,
  // and a seen day's frame rose 60 px on a phone each time it was opened; it catches up
  // unseen, and the frame follows it from there.
  const [isFrameEndSprung, setIsFrameEndSprung] = useState(!isDrawnWhole);
  if (!isFrameEndSprung && basis !== null && sprungEnd === wholeEnd) setIsFrameEndSprung(true);
  const dayEnd = isFrameEndSprung ? sprungEnd : wholeEnd;
  const basisHeight = basis ? basisAtPaceOf({ start: dayStart, end: dayEnd }, pace, chart) : 0;
  const light = axisLightWithin(dayLight, dayStart, dayEnd);

  // The day's end is due under the last row once the day is whole and every row is on screen,
  // in Read once the list has let them all in with their versions. A day held for a re-plan,
  // or showing a re-plan's rows, is not the day it would sum up.
  const isEndDue =
    ended !== null &&
    !isReplanning &&
    replanFrame === null &&
    (view === "read" ? isListWritten : phase === "done" && isAllIn);
  // It lands once what stands over it has come to rest, so it never moves once it is there: on
  // the plan the rows, the last taking its versions as the day completes; under the chart
  // the rows and the frame's end, rising to the day's last hour. Landed as the outcome came,
  // the end rode the last row's line down 27 px, and the frame's end up 60. A day that opens
  // whole has it from its first frame; landed, it stays through the swaps and pulls after.
  const [isEndLanded, setIsEndLanded] = useState(isDrawnWhole);
  if (isEndLanded && !isEndDue) setIsEndLanded(false);
  const isOverEndAtRest = view === "read" ? !isListGliding : dayEnd === wholeEnd && !isRowsGliding;
  useEffect(() => {
    if (!isEndDue || isEndLanded || !isOverEndAtRest) return undefined;
    // A frame on, by when a glide the render that made it due set off has been told.
    const landing = requestAnimationFrame(() => {
      if (view !== "read" || !listGliding.current) setIsEndLanded(true);
    });
    return () => cancelAnimationFrame(landing);
  }, [isEndDue, isEndLanded, isOverEndAtRest, view]);
  const isEndShown = isEndDue && isEndLanded;
  // A day that opens whole has its end in the first frame it stands on screen, and the line's
  // box takes that room at once, so nothing under it glides; after, it glides as any day's
  // does, as a swap rewraps its words. Its first HTML holds the end under the list, hidden
  // under the chart until the page runs: measured there, the box opened from nothing, and
  // the sources slid 82 px under a reopened day. So the box is drawn at once until a frame
  // has shown it.
  const [isEndAtOnce, setIsEndAtOnce] = useState(isDrawnWhole);
  useEffect(() => {
    if (!isEndAtOnce || !isEndShown || !isHydrated) return undefined;
    const drawn = requestAnimationFrame(() => setIsEndAtOnce(false));
    return () => cancelAnimationFrame(drawn);
  }, [isEndAtOnce, isEndShown, isHydrated]);
  // A day the salvage rule kept, cut or dropped inside its swaps, offers its link alone.
  const isCut = ended !== null && shownOutcome?.kind !== "complete";
  const planBar = useRef<HTMLDivElement>(null);
  const takeable = isEndShown ? ended : null;
  const dayExports = useDayExports({
    day: takeable,
    shown: energy.committed,
    checks,
    address,
    calendarKey: picksKey ?? city,
    onExport: (way) => onDayAct?.(EXPORT_EVENTS[way]),
  });
  // The day menu holds the ways to take the day along: there once the day is whole, waiting
  // till then. A stream that ended with no day leaves nothing to take along: the menu holds
  // "Plan another day" alone.
  const takeAlong = isEndedWithoutDay
    ? []
    : takeAlongOf({
        day: takeable,
        shown: energy.committed,
        checks,
        isCut,
        exports: dayExports,
        onRoute: () => onDayAct?.(EXPORT_EVENTS.route),
        hasLink: address !== null,
      });
  // The line under the chart as it last said how far the day was written, and the frame's
  // height then. Once the day is whole its end waits for the frame to rise to the day's own
  // last hour (Kanazawa's by 60 px on a phone, over about a second): meanwhile the line
  // stays, and the room the frame gives up is held under it, so the page neither empties nor
  // shrinks under a visitor reading at its foot before the end takes the line's place. Let
  // go once the end has stood, so no later wait for it, as a fork's, says the day is being
  // written.
  const [lastLine, setLastLine] = useState<{ words: string; frameHeight: number } | null>(null);
  if (progress !== null && (lastLine?.words !== progress || lastLine.frameHeight !== basisHeight)) {
    setLastLine({ words: progress, frameHeight: basisHeight });
  }
  if (isEndShown && lastLine !== null) setLastLine(null);
  const waitingLine =
    ended !== null && !isEndShown && progress === null && !isReplanning ? lastLine : null;
  const roomUnderLine =
    waitingLine !== null && view !== "read"
      ? Math.max(0, waitingLine.frameHeight - basisHeight)
      : 0;

  // With motion a row lands on its time and hollow bead, its words unseen until its bead is weighed
  // (`docs/decisions.md`, "A row's words go where its bead comes to rest, and rows ease rather than
  // jump"). Bare in a silence, it says in its own place what part of the day is being written,
  // where its name will be, rather than under it: a live model left rows bare 1.4 to 2.7 s with
  // nothing on screen changing. Read in a fade too, so a day that ends with a row bare keeps its
  // line in that row.
  const bareStop = frameStops === null ? bareStopOf(stops) : null;
  // Once the versions are being written the line under the chart says so, and a waiting
  // line promising another stop came and went sixteen times through Kyoto's.
  const isVersionsWritten = stops.some((stop) => stop.alternatives.length > 0);
  const daySpan = { start: dayStart, end: dayEnd };
  const waiting =
    !isWaiting || isVersionsWritten
      ? null
      : bareStop
        ? waitingInBareRow(stops, bareStop, midOf(stops, bareStop))
        : waitingOver(stops, daySpan);
  const factLit =
    litFact === null
      ? []
      : stops.flatMap((stop, index) => (stop.dependsOn?.includes(litFact) ? [index] : []));
  const litStops = [openStop, hoveredStop, ...factLit].filter(
    (index, at, all): index is number => index !== null && all.indexOf(index) === at,
  );

  /** A word of the header changed, the city included: counted each time. */
  const countWord = (word: HeaderWord) => onEvent?.({ kind: "word-changed", city, word });

  const answer = ({ key, value }: Answer) => {
    const fact = facts[key];
    if (!fact) return;
    if (value === fact.value) {
      if (fact.source !== "assumed") return;
      // Lantern's word chosen as it is becomes the visitor's.
      if (key === "energy") setLocal((words) => ({ ...words, energy: value as EnergyLevel }));
      else setLocal((words) => ({ ...words, confirmed: [...words.confirmed, key] }));
      return;
    }
    countWord(key);
    setOpenStop(null);
    // A word that changes no stop is the visitor's at once, the day as it was, live or not: the
    // facts line says why (`docs/decisions.md`, "A changed word proposes its part beside the day,
    // and the visitor takes it").
    const day = shownOutcome?.kind === "complete" ? shownOutcome.itinerary : null;
    if (key !== "energy" && day !== null) {
      const reach = answerReachOf(day, request, facts, { key, value });
      if (reach.kind === "keep") {
        setLocal((words) => ({ ...words, kept: { ...words.kept, [key]: value } }));
        setNotYet(keptStopsLineOf(key));
        return;
      }
    }
    if (key === "energy") {
      const to = ENERGY_LEVELS.indexOf(value as EnergyLevel);
      const next = replanForEnergy(draft.stops, requestedEnergy, to);
      energy.replan(next);
      setRepicked({ day: ended, stops: next });
      setLocal((words) => ({ ...words, energy: value as EnergyLevel }));
      setNotYet(null);
      onEnergyPicked?.(value as EnergyLevel);
      return;
    }
    if (onReplan) {
      const next = replannedRequestOf(request, facts, { key, value });
      const word = optionOf({ options: FACT_OPTIONS[key] }, value)?.label ?? value;
      playOnceFaded(() => onReplan(next, word, key, shownPlaces));
      return;
    }
    setNotYet(notReplanningYetOf(key, stops));
  };

  const checkOf = useCallback((placeId: string) => checks[placeId] ?? null, [checks]);
  const ownNotice = noticeOf(shownOutcome, request, isLive);
  const notice = ownNotice === null ? null : (keptNotice ?? ownNotice);
  // What the press leaves fades on the axes' spring, as the day's words do, so the next day's
  // header takes its own height in one step with nothing seen under the headline, and its
  // date and axes are drawn at their place rather than riding a glide. The focus stays on
  // the control pressed until the next day's city word takes it. Under reduced motion the
  // next day is there in the same step.
  const playOnceFaded = (play: () => void) => {
    if (nextDay.current) return;
    if ((notice === null && !isChartLeaving) || isReducedMotion) {
      play();
      return;
    }
    nextDay.current = play;
    setIsLeavingForNext(true);
  };
  useEffect(() => {
    if (!isLeavingForNext) return undefined;
    const fade = animate(leavingOpacity, 0, {
      ...SPRINGS.snappy,
      onUpdate: () => playNextOnceGone(isChartLeaving),
    });
    return () => fade.stop();
  }, [isLeavingForNext, isChartLeaving, leavingOpacity, playNextOnceGone]);
  const playDay = (next: DayRequest) => playOnceFaded(() => onPlay(next));
  const retry = () => playOnceFaded(onRetry);
  /** A written day from the city word's list. */
  const chooseWritten = (next: DayRequest) => {
    countWord("city");
    playDay(next);
  };
  /** A written day the notice offers in place of one that ended without one: no word changed. */
  const openWritten = (next: DayRequest) => playOnceFaded(() => onOpenWritten(next));

  /**
   * Another city, as typed: a written day if it is one, otherwise a new request, which the
   * page reads first when it asks to (`onChooseCity`).
   */
  const chooseCity = (typedCity: string) => {
    countWord("city");
    const written = writtenRequestFor(typedCity);
    if (written) return playDay(written);
    const energy = local.energy ?? request.energy;
    const energySource = local.energy === null ? request.energySource : "chosen";
    // A city typed is the visitor's, whichever the day before was played as.
    const typed: DayRequest = {
      ...request,
      energy,
      energySource,
      city: typedCity,
      citySource: "chosen",
    };
    if (onChooseCity) onChooseCity(typed);
    else playDay(typed);
  };

  // The same day in another city of the name: its words stay, its zone is that city's, and
  // so is its date when the day was today, and the city is now the visitor's, so it loses
  // Lantern's dots.
  const chooseReading = (reading: CityReading) => {
    countWord("city");
    const energy = local.energy ?? request.energy;
    const energySource = local.energy === null ? request.energySource : "chosen";
    const next: DayRequest = {
      ...request,
      energy,
      energySource,
      city: reading.name,
      citySource: "chosen",
      timezone: reading.timezone,
      date: dateInZone(request, reading.timezone, new Date()),
    };
    playOnceFaded(() => onChooseReading?.(next, reading));
  };

  const toggleStop = (index: number) => setOpenStop(openStop === index ? null : index);
  // Stable, since the chart re-arms its outside press whenever it changes.
  const closeStop = useCallback(() => setOpenStopId(null), []);
  // A stop opened while the day was written fades with the chart when the stream ends without
  // a day, and closes once the chart has gone, so a day asked for next never opens it itself.
  if (isEndedWithoutDay && !isChartLeaving && openStopId !== null) setOpenStopId(null);

  // The hint goes at the page's first change, a swap or a drag as much as a word; it does not
  // come back when the day is put back as planned.
  const isChangedFromPlan = !isAsWritten(stops, energy.committed, writtenFor.places);
  const [isTouched, setIsTouched] = useState(false);
  if (isChangedFromPlan && !isTouched) setIsTouched(true);
  const slot = slotOf(phase, replanLine ?? notYet, local, isTouched);
  const startSlot = slotOf("writing", null, local);
  const isChartShown = phase === "writing" || phase === "done";

  const header = (
    <DayStageHeader
      request={request}
      facts={heldBack(facts, reached)}
      reservedFacts={facts}
      clause={clause}
      dek={reached.includes("dek") ? dek : undefined}
      reservedDek={dek}
      isDekWriting={draft.writing === DEK}
      isAsPlanned={isAsWritten(stops, energy.committed, writtenFor.places)}
      sunrise={sunrise}
      sunset={sunset}
      // The sun is said with the first place, which lands once the pen has written the
      // header; the room for it is held from when its coordinates arrive.
      isSunShown={isHeaderWritten}
      // A streamed day holds room for its sun's times from its first frame, so the header
      // does not grow under its first row when the first place gives them; a stream that
      // ends without a day lets the room go.
      isSunReserved={phase === "writing"}
      slot={slot}
      // While the day is written, the room for the hint that ends it.
      reservedSlot={phase === "writing" ? { kind: "hint" } : slot}
      isFactsShown={isFrameDrawn}
      notice={notice}
      // A notice here takes the place of a day that ended, once its chart has gone; a day
      // drawn whole, as one this device has seen, has its notice whole from the first frame.
      isNoticeWrittenIn={!isDrawnWhole}
      noticeOpacity={leavingOpacity}
      isNoticeLeaving={isLeavingForNext}
      isChoiceHeld
      dayOpacity={dayOpacity}
      isLeaving={isChartLeaving}
      isEnabled={isInteractive}
      isWaiting={isWaiting}
      // Until the frame is drawn the waiting line has nowhere to stand: the light it carries
      // runs through the headline instead (`docs/decisions.md`, "A row's words go where its bead
      // comes to rest, and rows ease rather than jump"), from the frame the headline stands whole.
      // The wait for a model's first words is always longer than a silence, so it needs none of the
      // waiting line's: lit after one, it stood unlit for 0.4 s after the page ran.
      isHeadlineLit={(isWaiting || isAwaitingFirstWords) && !isFrameDrawn}
      written={WRITTEN_REQUESTS}
      cityOpenAt={cityOpenAt}
      typedCity={typedCity}
      isCityFocused={isChosen}
      focusedWord={focusedWord}
      replan={replan}
      onPointToFork={pointToFork}
      forkNote={forkNoteShown}
      // A changed word re-plans the day once it is written to its end, live: each answer then
      // says what it would do, from the plan the route runs.
      replanDay={onReplan && shownOutcome?.kind === "complete" ? shownOutcome.itinerary : null}
      takeAlong={takeAlong}
      onCityOpenChange={(openAt) => {
        setCityOpenAt(openAt);
        if (openAt === null && typedCity !== null) onTypedCityDropped?.();
      }}
      onChooseWritten={chooseWritten}
      onOpenWritten={openWritten}
      onChooseCity={chooseCity}
      readings={readings}
      playedReading={playedReading}
      onChooseReading={chooseReading}
      onChoose={answer}
      onLight={setLitFact}
      onRetry={retry}
      unplaced={unplaced}
      onGlide={onHeaderGlide}
      onSentenceGlide={setIsSentenceGliding}
      isFromStart={isFromStart}
      onWrittenInOrder={setIsSentenceInOrder}
      linesRef={setHeaderLines}
      roomRef={roomRef}
      className={wholeClasses}
      isViewHeld={heldGesture > 0}
      heldRoom={
        isRoomHeld && heldRoom !== null ? heldRoom : (replanRoom ?? mergedRoom ?? undefined)
      }
      roomFrom={heldRoom ?? undefined}
    />
  );
  // The header of the playing's first frame: no word of the stream's yet, no line about the
  // day, the sun's room held, the hint's too. Drawn only in the first HTML.
  const startHeader = isStartDrawn
    ? cloneElement(header, {
        facts: heldBack(startFacts, NO_PIECES),
        reservedFacts: startFacts,
        clause: null,
        dek: undefined,
        reservedDek: undefined,
        isDekWriting: false,
        isSunShown: false,
        isSunReserved: true,
        // Its date waits for the header's room, as the playing's first frame has it: shown in
        // the first HTML, it stood under the headline until the page ran and then went.
        isFactsShown: false,
        slot: startSlot,
        reservedSlot: { kind: "hint" },
        isEnabled: false,
        isWaiting: false,
        // The playing's first frame waits for the model's first words, its light lit from the
        // first paint; the live header takes it on from there (`useLightInPhase`).
        isHeadlineLit: true,
        linesRef: undefined,
        roomRef: undefined,
        onGlide: undefined,
        onSentenceGlide: undefined,
        onWrittenInOrder: undefined,
        className: "hidden unseen:flex",
        isCopy: true,
      })
    : null;

  return (
    // The page scrolls, on a laptop as on a phone: nothing inside the day scrolls on its own.
    // It is at least a screen tall, its main taking what the day leaves, so a short page holds
    // its last line at the foot of the screen.
    <div className="mx-auto flex min-h-svh max-w-page flex-col px-4 md:px-10 lg:px-16">
      <main className="flex min-w-0 grow flex-col">
        {/* The header holds room for what has arrived and glides inside itself, written where
            the start screen was as on its own address. */}
        {/* The whole header first in the HTML, for a reader without its styles; the first
            frame's after it, which takes no room when hidden. */}
        {header}
        {startHeader}
        {isChartShown && (
          // A day that ends without one fades its whole chart as one piece with what the
          // header says of the day, on the spring the axes fade in on, and the chart stays
          // until it has gone to the eye.
          <motion.div
            data-exit={isChartLeaving ? "fading" : undefined}
            inert={isChartLeaving}
            style={{ opacity: dayOpacity }}
            className="relative min-w-0 lg:max-w-abacus"
          >
            {/* Measures the room the day has: a day's height, on a laptop as on a phone. */}
            <div
              ref={attachChartBox}
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-day"
            />
            {/* The day's energy and Plan or Chart, over the day, fading with it as one piece.
                It comes with the frame; in a day's first HTML it waits for it too, for a visitor
                who has not seen the day, rather than stand under the headline until it plays. */}
            {isFrameDrawn && (
              // On the plan the day's energy and the switch are held at the screen's top while
              // the plan scrolls; on the chart its own scale is, and the bar stands still.
              <PlanBar
                ref={planBar}
                energy={(facts.energy?.value as EnergyLevel | undefined) ?? request.energy}
                isEnabled={isInteractive}
                onChoose={(level) => {
                  answer({ key: "energy", value: level });
                  countWord("energy");
                }}
                className={wholeClasses}
              />
            )}
            {/* The chart, or the same day as a list to read: the styles show the one the
                visitor chose (`docs/decisions.md`, "A day can be read as a list, written as
                the chart is"). Behind the list the chart is laid out unseen, at no height,
                rather than not at all: drawn first under `display: none`, its rows measured
                nothing, and shown, they slid 1.4 s to their places. */}
            <div className="view-read:invisible view-read:h-0 view-read:overflow-hidden">
              {basis && isFrameDrawn && (
                <PlaceChecksContext.Provider value={checkOf}>
                  <DayRows
                    width={basis.width}
                    basisHeight={basisHeight}
                    dayStart={dayStart}
                    dayEnd={dayEnd}
                    stops={stops}
                    densityOverride={null}
                    picks={energy.committed}
                    energy={energy}
                    arrivals={frozen?.arrivals ?? arrivals}
                    requestedEnergy={requestedEnergy}
                    light={light}
                    daylight={daylight}
                    city={request.city}
                    sunrise={sunrise}
                    sunset={sunset}
                    writing={draft.writing}
                    isInteractive={isInteractive}
                    isStill={false}
                    // A stop opens as soon as it is whole, while the day is still written.
                    openableStops={openableStopsOf(revealed.day, draft)}
                    invitation={invitation}
                    waiting={waiting}
                    openStop={openStop}
                    litStops={litStops}
                    rewriting={[]}
                    proposed={replanProposed}
                    replaced={replanReplaced}
                    fading={replanFading}
                    fork={fork}
                    onFaded={onReplanFaded}
                    isReplanning={replanFrame !== null}
                    rewritingStop={null}
                    onPensWriting={setIsRowPenWriting}
                    hoveredPlace={hoveredPlace}
                    onToggleStop={toggleStop}
                    onTapStop={setOpenStop}
                    onCloseStop={closeStop}
                    onHoverStop={setHoveredStop}
                    onHoverPlace={setHoveredPlace}
                    onGlide={setIsRowsGliding}
                    isLeaving={isChartLeaving}
                    header={headerLines}
                  />
                </PlaceChecksContext.Provider>
              )}
            </div>
            {/* At least a day's room, as the chart's frame holds: a day played from the city
                word mid-stream clears the list, and the page's foot stays where it stood. */}
            <div className="min-h-day view-chart:hidden">
              {view === "read" && isFrameDrawn && (
                <ReadingList
                  stops={stops}
                  entered={listEntered}
                  versionsShown={listVersions}
                  picks={energy.committed}
                  daylight={daylight}
                  proposed={replanProposed}
                  fork={fork}
                  fading={replanFading}
                  isWritten={isListWritten}
                  rowClassName={wholeClasses}
                  onChoose={isInteractive ? energy.choose : undefined}
                  onGlide={onListGlide}
                />
              )}
            </div>
            {/* How far the day is written, then the day's end in its place, under the chart,
                riding its frame's end and fading with it as one piece. The end opens its room
                from the line it takes the place of, and the page's foot under it glides to make
                that room, never jumps. */}
            {isFootDrawn && (
              <div data-under-chart className={cn(UNDER_CHART_CLASSES, footClasses)}>
                {/* While the day is written the line takes each new height at once, as it
                    always has, so a stream that ends without a day leaves nothing gliding; so
                    does the room held under it while the day's end waits for the frame. */}
                <GlidingHeight
                  isClippedWhileGliding
                  isInstant={ended === null || isEndAtOnce || waitingLine !== null}
                >
                  {isEndShown && ended ? (
                    <DayEnd
                      day={ended}
                      shown={energy.committed}
                      checks={checks}
                      isCut={isCut}
                      onAnswer={onDayAnswer}
                      answered={dayAnswered}
                      onReadToEnd={onDayAct && (() => onDayAct("day-read-to-end"))}
                      className={cn(END_CLASSES, wholeClasses)}
                    />
                  ) : waitingLine !== null ? (
                    <>
                      <ProgressLine>{waitingLine.words}</ProgressLine>
                      <div aria-hidden style={{ height: roomUnderLine }} />
                    </>
                  ) : (
                    !isReplanning && progress && <ProgressLine>{progress}</ProgressLine>
                  )}
                </GlidingHeight>
              </div>
            )}
          </motion.div>
        )}
      </main>
      {/* The page's foot, outside its main, so it is the page's contentinfo: Lantern's own
          links, and the sources a drawn day's places come from while its chart or list is
          shown, or the links alone under the notice of one that ended without one. Never before the day is drawn,
          where the chart's arrival would push it down. */}
      {(!isChartShown || isFootDrawn) && (
        <FootLine
          sources={isChartShown && isFootDrawn ? SOURCES : undefined}
          className={cn(FOOT_CLASSES, footClasses)}
        />
      )}
    </div>
  );
}

/** What an ended day says Lantern assumed, as the stream wrote it. */
function assumptionsOf(itinerary: Itinerary): PartialDay["assumptions"] {
  return Object.fromEntries(
    ASSUMABLE_FACT_KEYS.map((key): [AssumableFactKey, string | null] => [
      key,
      itinerary.facts[key].source === "assumed" ? itinerary.facts[key].value : null,
    ]),
  );
}

/** Where and when the day happens, for the sun. */
function contextOf(request: DayRequest, position: GeoPoint): DayContext {
  return {
    position,
    date: request.date,
    utcOffsetMinutes: utcOffsetMinutes(request.timezone, request.date),
  };
}
