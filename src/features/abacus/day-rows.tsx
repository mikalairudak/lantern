"use client";

import { motion } from "motion/react";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/components/ui/cn";
import { runningSpans } from "@/lib/time/clock";
import { AbacusChart, type AbacusChartProps } from "./abacus-chart";

import { candidatesOf, midsOf, plannedPlace, twinRankOf, writtenEnergyOf } from "./curve";
import { hasEnergy, type PlaceDraft } from "./day-draft";
import { densityOf, type Density } from "./density";
import { useDrawing } from "./drawing";
import { drawnEnergyOf } from "./geometry";
import type { DayContext } from "@/lib/geo/sun";
import { axisLightTo, bestLightOf, isGoldenAt } from "./light";
import { isSameLines, type LineBox } from "./line-boxes";
import {
  isRoomOpen,
  isSunMinuteInOrder,
  placeLabel,
  rowScale,
  rowScaleLeaving,
  leavingRowsAt,
  hasEntered,
  keptApart,
  rowsKeptClear,
  wordsRightOf,
  type RowExtent,
  type RowSizes,
} from "./rows";
import { hungDayHeightOf, sheetBandOf, sheetSideOf, type SheetRoom } from "./sheet-placement";
import { detailsOf } from "./stop-details";

import type { SunLabels } from "./chart-axes";
import { dayViewOf, roomAboveOf, roomUnder, tailUnderOf } from "./day-view";
import { useSprung, useSprungAll } from "@/components/ui/use-sprung";
import {
  ROOM_REACH_PX,
  foldGlideOver,
  type RestingSpringOptions,
  type SpringName,
} from "@/lib/tokens/motion";

import { ListWaiting, type WaitingPlace } from "./waiting-list";

import { StickyScale } from "./sticky-scale";
import { FORK_LINE_ATTRIBUTE, ForkLine, ForkRow } from "./fork-row";
import type { ForkSide } from "@/features/day/replan-controls";
import type { ForkView } from "@/features/day/replan-work";
import { useMediaQuery } from "@/components/ui/use-media-query";
import { changesOf, clauseOf } from "./clause";
import { type Box, type RowLayout, timeToneOf, StartTime, StopRow } from "./stop-row";
import { type OpenDetails, type SheetVersion, type SheetBody, type HeldSide } from "./words-sheet";

/**
 * How many frames the rows' places must hold before a newly mounted day is shown: a word's
 * box is measured before the first paint, but its one-line width reaches the observer a
 * frame or two later, and can move the rows once more.
 */
const PLACES_HELD_FRAMES = 4;

/** No lines measured yet, one array for every row, so an unmeasured row never re-renders. */
const NO_LINES: readonly LineBox[] = [];

/**
 * No stop's id: one empty set for every set of ids a day can hold none of, the rows a pen is
 * writing, proposed or fading, so a day with none never re-renders.
 */
const NO_IDS: ReadonlySet<string> = new Set();

/** No row entering: a day drawn as it streams in order. */
const NO_ENTERING: readonly string[] = [];

/** "Back to the plan" pressed, its rows not yet gliding; gliding at a re-plan's pace; or neither. */
type BackToPlan = "pressed" | "gliding" | null;

/**
 * How long a press of "Back to the plan" waits for the rows it moves to set off: they do within
 * a few frames, once their words are measured; a press that moves none lets the pace go.
 */
const BACK_TO_PLAN_WAIT_MS = 500;

/** A changed word's fork as the rows draw it: its view, the stops its rows stand over, its acts. */
export interface ForkRows {
  view: ForkView;
  /** Over which stop each part's row stands, by id (`forkAnchorsOf`); null where none is shown. */
  anchors: readonly (string | null)[];
  onChoose: (side: ForkSide) => void;
  onCompare: () => void;
  onAskAgain: () => void;
}

/**
 * Where a fork row's line stands on a laptop: in the margin right of the chart, as wide as a
 * label's column, a gutter's width from the chart's edge.
 */
const MARGIN_LINE_CLASSES = "pointer-events-auto absolute top-0 left-0 w-label pl-4";

/** The width from which the page sets a fork row's line in the margin: Tailwind's `lg`. */
const WIDE_QUERY = "(min-width: 64rem)";

/**
 * The room a row holds above its wire: its resting words', and never less than the words
 * shown, so words still folded beside their hollow bead never stand over the wire. One line
 * of a name before they are measured.
 */
function roomOf(box: Box | undefined, row: RowSizes): number {
  return box ? Math.max(box.room, box.height) : row.lineEstimate;
}

type ChartPassThrough = Omit<
  AbacusChartProps,
  "scale" | "onTapStop" | "onHoverStop" | "onHoverPlace" | "axisFrom" | "axisTo" | "wordsMaskRef"
>;

interface DayRowsProps extends ChartPassThrough {
  /**
   * A re-plan's proposal streams beside part of the day: its rows come in among the day's,
   * and the rows around them make room at the pace the header's room reaches.
   */
  isReplanning?: boolean;
  /**
   * A version's stops fading out where they stand as the fork folds it, a proposal left or
   * failed, or the old part once one is taken: unseen, off the curve, then gone.
   */
  fading?: ReadonlySet<string>;
  /**
   * A changed word's fork (`docs/decisions.md`, "A changed word proposes its part beside the
   * day, and the visitor takes it"): a row over each part it rewrites, in room held over the
   * part's first stop on screen; null where there is none.
   */
  fork?: ForkRows | null;
  width: number;
  /** The height the day's time scale is fitted to; the rows may need more. */
  basisHeight: number;
  dayStart: number;
  dayEnd: number;
  /** What each stop's words show: the chart's picks once a drag ends. */
  picks: readonly number[];
  /** Every row at one density, for the lab's matrix; null lets each row's energy decide. */
  densityOverride: Density | null;
  /** Where and when the day happens, for each place's own best window. */
  daylight: DayContext;
  /** The day's city, which an open stop's sheet names to a map searching for its place. */
  city: string;
  /** The text being written right now, which dries as the stream moves past it. */
  writing: string | null;
  /**
   * The stops being written again in place, by id, and the one the stream writes next, where
   * an in-place waiting line shows: the lab's re-composition alone writes a stop again so
   * (`src/app/lab/concepts/abacus`). The product's re-plan rewrites its rows through
   * `replanFrameOf`, and passes none.
   */
  rewriting: readonly string[];
  rewritingStop: string | null;
  /** Told whether any row's pen is writing, so a silence waits for the rows' pens too. */
  onPensWriting?: (isWriting: boolean) => void;
  /** A still for the lab's matrix: an open stop's sheet neither takes the focus nor scrolls. */
  isStill: boolean;
  /** A still of the lab's matrix whose pens stop where they are, as a row just weighed. */
  isPenStill?: boolean;
  /**
   * The stops that open while the day is still written (`openableStopsOf`), by id: whole,
   * and kept by the normalizer as written. Each opens once its row has come to rest, before
   * the day can be dragged. None while a day is held for a re-plan.
   */
  openableStops: ReadonlySet<string>;
  onToggleStop: (index: number) => void;
  /** A tap on the chart off its beads: near a wire it opens that stop, elsewhere it closes. */
  onTapStop: (index: number | null) => void;
  onCloseStop: () => void;
  onHoverStop: (index: number | null) => void;
  onHoverPlace: (placeId: string | null) => void;
  /**
   * The day is fading out, as one that ended without a day does: its pens stop where they
   * are, so only its opacity changes.
   */
  isLeaving?: boolean;
  /**
   * The header's written lines over the day, if it has one: a sheet that opens up may rise
   * past the chart's top, over the energy scale, into the empty room under them, to a little
   * under the last; it never covers them. Without one, as in a lab cell, as far as what
   * clips the day, or the document, lets it.
   */
  header?: HTMLElement | null;
  /**
   * Called as the rows set off for new places and as they come to rest, so what must start
   * on a day at rest, as its fade does, can wait for them.
   */
  onGlide?: (isGliding: boolean) => void;
}

/**
 * How far a spring may stand from its target and count as there: the springs run to targets
 * rounded to tenths of a pixel, and a spring that ends lands on its own exactly.
 */
const AT_REST_PX = 0.1;

/**
 * Whether the stop at `index` is new to the rows and has rows below it, while a re-plan puts
 * stops among the others (`isAmongOthers`): a day being written adds its stops at the end.
 */
function isNewcomerAt(
  ids: readonly string[],
  index: number,
  landed: readonly string[],
  isAmongOthers: boolean,
): boolean {
  return isAmongOthers && !landed.includes(ids[index] ?? "") && index < ids.length - 1;
}

/** Whether any of `values` still stands away from its target. */
function isAwayFrom(values: readonly number[], targets: readonly number[]): boolean {
  return values.some((value, index) => Math.abs(value - (targets[index] ?? value)) > AT_REST_PX);
}

/** The room around the day as a stop opened, by the stop's index. */
interface MeasuredRoom extends Omit<SheetRoom, "frameHeight"> {
  stop: number;
}

/**
 * The day as one object: each stop is a row of the abacus, its name written above its wire
 * beside the bead it shows. Where a name sits says how lively the place is. The words
 * follow the chart once a drag ends, gliding to their new bead. An open stop says what its
 * place is on a sheet laid over the day, so opening one never moves a row.
 */
export function DayRows({
  isReplanning = false,
  fading = NO_IDS,
  fork = null,
  width,
  densityOverride,
  basisHeight,
  dayStart,
  dayEnd,
  picks,
  daylight,
  city,
  writing,
  rewritingStop,
  onPensWriting,
  isStill,
  isPenStill = false,
  openableStops,
  onToggleStop,
  onTapStop,
  onCloseStop,
  onHoverStop,
  onHoverPlace,
  isLeaving = false,
  header = null,
  onGlide,
  ...chart
}: DayRowsProps) {
  const { stops, arrivals, requestedEnergy, openStop, rewriting, isInteractive, waiting } = chart;
  // A proposal's stops beside the day: compact and blue, and nothing of theirs opens.
  const proposed = chart.proposed ?? NO_IDS;
  // On a laptop a fork row's line stands in the margin right of the chart.
  const isWide = useMediaQuery(WIDE_QUERY);
  // Each fork row's height as laid out, by its part, and the room it holds over the part's
  // first stop on screen: its height and a row's gap to the words under it.
  const [forkHeights, setForkHeights] = useState<Readonly<Record<number, number>>>({});
  // One callback a part, kept from render to render, so a row's observer is set up once.
  const forkMeasures = useRef(new Map<number, (height: number) => void>());
  const measureFork = (part: number): ((height: number) => void) => {
    const known = forkMeasures.current.get(part);
    if (known) return known;
    const measure = (height: number) =>
      setForkHeights((now) => (now[part] === height ? now : { ...now, [part]: height }));
    forkMeasures.current.set(part, measure);
    return measure;
  };
  const forkPartOf = (id: string): number => (fork ? fork.anchors.indexOf(id) : -1);
  const forkRoomOf = (id: string): number => {
    const part = forkPartOf(id);
    if (part === -1) return 0;
    return (forkHeights[part] ?? rowSizes.lineEstimate) + rowSizes.gap;
  };
  // The pixels the chart and its rows are drawn at, for the root's size as the day draws.
  const drawing = useDrawing();
  const { row: rowSizes } = drawing;
  // The words' unseen one-line copies live outside the list, so only the day is read.
  const [measuring, setMeasuring] = useState<HTMLDivElement | null>(null);
  const [boxes, setBoxes] = useState<Readonly<Record<string, Box>>>({});
  // The boxes as last measured, which can be a render ahead of `boxes`: a row's words are
  // measured after it renders, so a room about to open is known here before it is drawn.
  const measured = useRef<Readonly<Record<string, Box>>>({});
  // Where the rows draw their lines of words for the chart, so the curve passes under them.
  const [wordsMask, setWordsMask] = useState<SVGGElement | null>(null);
  const [beadsOverSheet, setBeadsOverSheet] = useState<SVGSVGElement | null>(null);
  // The rows take their first places over the day's first frames, as each is measured and
  // Motion draws it. The frame's time scale is made from the same rows, so until their places
  // have held for a few frames the whole day is unseen, nothing springs and nothing can be
  // used: a day that mounts whole, as a written one does, is never seen or touched at its
  // rows' guesses, its frame included. Then it fades in.
  // A day that mounts empty, as a streamed one does, is placed from the start: its rows
  // arrive one by one and ease in. Only a day that mounts whole waits.
  const [isPlaced, setIsPlaced] = useState(() => stops.length === 0);
  // A day still taking its places cannot be used yet, and says it is busy. The sun keeps to
  // the day's own readiness, so a day there from its first render is still that to it.
  const isUsable = isInteractive && isPlaced;
  // The rows whose pen is still writing what their bead added. What a screen reader hears
  // of a row is not final until its pen has finished, so the day says it is busy until the
  // last one has, which can be after every bead has stopped.
  const [penning, setPenning] = useState<ReadonlySet<string>>(NO_IDS);
  /**
   * Whether a stop opens: any, once the day can be used; while it is still written, a whole
   * stop whose row has come to rest, its bead filled and settled and its pen done, so its
   * sheet opens from words that will not move. The curve, the beads and the arrow keys still
   * wait for the whole day. A day fading out keeps an open sheet as it stands, to fade with
   * it as one piece; it is inert, so nothing new opens.
   */
  const isOpenable = (index: number): boolean => {
    const stop = stops[index];
    if (!stop || proposed.has(stop.id) || fading.has(stop.id)) return false;
    if (isUsable) return true;
    if (!isPlaced || !openableStops.has(stop.id)) return false;
    const arrival = arrivals.of(stop);
    return arrival.isReady && arrival.isSettled && !penning.has(stop.id);
  };
  const isAnyPenWriting = penning.size > 0;
  useEffect(() => {
    onPensWriting?.(isAnyPenWriting);
  }, [isAnyPenWriting, onPensWriting]);
  const onPenning = useCallback((id: string, isPenning: boolean) => {
    setPenning((current) => {
      if (current.has(id) === isPenning) return current;
      const next = new Set(current);
      if (isPenning) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const [outer, setOuter] = useState<HTMLDivElement | null>(null);
  // How tall the open stop's sheet is besides the room it keeps for its words, with the
  // version on show and with its tallest, and whose stop it is.
  const [sheetBody, setSheetBody] = useState<SheetBody | null>(null);
  const onSheetBody = useCallback((body: SheetBody) => {
    setSheetBody((current) =>
      current?.stopId === body.stopId &&
      current.shown === body.shown &&
      current.tallest === body.tallest
        ? current
        : body,
    );
  }, []);
  // The side the open sheet took as it opened, kept while it stays open: a version swapped
  // in from the keyboard changes what it says, never where it lies or what has the focus.
  const [heldSide, setHeldSide] = useState<HeldSide | null>(null);
  if (openStop === null && heldSide !== null) setHeldSide(null);
  // The room around the day a sheet may take without making the page taller, measured as a
  // stop opens, before its side is chosen: above, to just under the header's last line;
  // below, the page's tail. Gone when it closes, so the next one measures afresh.
  const [room, setRoom] = useState<MeasuredRoom | null>(null);
  if (openStop === null && room !== null) setRoom(null);
  useLayoutEffect(() => {
    if (openStop === null || !outer) return;
    setRoom({
      stop: openStop,
      roomAbove: header ? roomUnder(header, outer) - rowSizes.sheetUnderHeader : roomAboveOf(outer),
      tail: tailUnderOf(outer),
    });
  }, [openStop, outer, header, rowSizes]);

  // A press anywhere outside the day closes an open stop; inside it, the rows and the chart
  // say what a press means. A still's open stop stays open, whatever the matrix's page does.
  useEffect(() => {
    if (openStop === null || !outer || isStill) return undefined;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !outer.contains(event.target)) onCloseStop();
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [openStop, outer, isStill, onCloseStop]);

  // Each row measures its own words; the rows are laid out around what they report. A row
  // being written again keeps its last box while it is empty, so it holds its place.
  const onMeasure = useCallback((id: string, box: Box) => {
    const held = measured.current[id];
    const isEmptied = held !== undefined && box.room === 0;
    if (held && (isEmptied || isSameBox(held, box))) return;
    measured.current = { ...measured.current, [id]: box };
    setBoxes(measured.current);
  }, []);

  // The day's running minutes, so a stop after midnight sits after the late evening.
  const visits = runningSpans(stops);
  // The light comes in with the day: down to the end of its last stop while it is written,
  // since a row that lands moves every hour below it, then down the rest of the frame once
  // the day is whole.
  const lightEnd = useSprung(isUsable ? dayEnd : (visits.at(-1)?.to ?? dayStart));
  const axisLight = axisLightTo(chart.light, lightEnd);
  const isLit = (minute: number | null) => minute !== null && minute <= lightEnd;
  // The time axis grows with the rows the same way, so no empty axis stands under the first
  // ones, and once drawn whole it stays: a re-plan writing part of the day again keeps it.
  const [isAxisWhole, setIsAxisWhole] = useState(isInteractive);
  if (isUsable && !isAxisWhole) setIsAxisWhole(true);
  const axisEnd = useSprung(isAxisWhole ? dayEnd : (visits.at(-1)?.to ?? dayStart));
  const ownMids = midsOf(stops);
  const mids = stops.map((stop, index) => arrivals.of(stop).mid ?? ownMids[index] ?? 0);
  // A fork row stands in room over its part's first stop: that stop's row holds it above its
  // words, so the day makes way for it as for words that grow.
  const rows: RowExtent[] = stops.map((stop, index) => ({
    mid: mids[index] ?? 0,
    above: roomOf(boxes[stop.id], rowSizes) + rowSizes.wireGap + forkRoomOf(stop.id),
  }));
  // Where the rows need their wires, and where the wires and words are this frame on
  // their way there: a row that grows or swaps eases everything below it down rather than
  // jumping it. A version the fork folds away holds no room from the tap, so the rows below
  // rise into it as its rows fade, rather than once they are gone.
  const leavingFlags = stops.map((stop) => fading.has(stop.id));
  const target = rowScaleLeaving(width, basisHeight, dayStart, dayEnd, rows, leavingFlags, drawing);
  // While a re-plan rewrites part of the day, the rows that stay hold where they stood as it
  // began, or lower: the window holds its old rows' room and grows only when its new stops
  // need more, so new stops needing less leave the room standing until the merged day takes
  // the page, and the day below rises once, then (`docs/decisions.md`, "A changed word proposes its
  // part beside the day, and the visitor takes it").
  const [pinnedAnchors, setPinnedAnchors] = useState<ReadonlyMap<string, number> | null>(null);
  if (isReplanning && isPlaced && pinnedAnchors === null) {
    setPinnedAnchors(new Map(stops.map((stop, index) => [stop.id, target.anchors[index] ?? 0])));
  }
  if (!isReplanning && pinnedAnchors !== null) setPinnedAnchors(null);
  // The rows under a row held lower than the day as written puts it are placed from it, so a
  // new row under it lands in its room (`keptApart`). A version folding away gives its room
  // back at once, so nothing is held then.
  const laidAnchors =
    pinnedAnchors === null || fading.size > 0
      ? target.anchors
      : keptApart(
          target.anchors.map((anchor, index) => {
            const id = stops[index]?.id;
            const pinned = id ? pinnedAnchors.get(id) : undefined;
            return pinned === undefined ? anchor : Math.max(anchor, pinned);
          }),
          rows,
          rowSizes.gap,
        );
  // The stops the re-plan brings: those the day did not have as it began.
  const newcomers = useMemo(
    () =>
      pinnedAnchors === null
        ? NO_IDS
        : new Set(stops.flatMap((stop) => (pinnedAnchors.has(stop.id) ? [] : [stop.id]))),
    [pinnedAnchors, stops],
  );
  const placesKey = `${target.anchors.join(",")}|${rows.map((row) => row.above).join(",")}`;
  useEffect(() => {
    if (isPlaced) return undefined;
    let held = 0;
    let frame = requestAnimationFrame(function hold() {
      held += 1;
      if (held >= PLACES_HELD_FRAMES) setIsPlaced(true);
      else frame = requestAnimationFrame(hold);
    });
    return () => cancelAnimationFrame(frame);
  }, [placesKey, isPlaced]);
  // A row lands where its words put it once they are measured and laid out again, before
  // its first paint, and only then joins the springs: a guess made before that, at one line
  // or at a side its width had not decided yet, is never sprung from. Each row springs by
  // its own id, so a row that moves up a place, as when a version folding away above it
  // hands that place on, glides from where it stands, and a new row in a place another left
  // lands at once rather than taking over the old row's glide.
  const stopIds = stops.map((stop) => stop.id);
  const stopIdsKey = stopIds.join(" ");
  const [landedIds, setLandedIds] = useState<readonly string[]>(stopIds);
  // A stop new to a day already drawn, with rows below it, as a re-plan's new stop takes an
  // old one's turn, enters: unseen, it grows into the room that opens for it as the rows
  // around it glide, so the rows below stand still, and it shows once that room is whole.
  const [entering, setEntering] = useState<readonly string[]>(NO_ENTERING);
  // Latched while a re-plan is on screen and until the rows after it rest: the merged day's
  // rows settle, or the day as it was comes back, at the re-plan's pace.
  const [isAfterReplan, setIsAfterReplan] = useState(false);
  if (isReplanning && !isAfterReplan) setIsAfterReplan(true);
  // "Back to the plan" re-picks every stop at once, a gesture over the whole day: from its press
  // until the rows it set gliding rest, they glide at a re-plan's pace, about 3 px a frame, so
  // the rows on screen when it was pressed never jump. On `layout`, as a drag's release takes
  // them, Bologna's moved up to 9 px a frame on a phone.
  const [backToPlan, setBackToPlan] = useState<BackToPlan>(null);
  useEffect(() => {
    if (backToPlan !== "pressed") return undefined;
    // A press that set no row gliding lets the pace go.
    const unmoved = window.setTimeout(
      () => setBackToPlan((now) => (now === "pressed" ? null : now)),
      BACK_TO_PLAN_WAIT_MS,
    );
    return () => window.clearTimeout(unmoved);
  }, [backToPlan]);
  // Only a re-plan puts a stop among the others, and one that goes back puts its old stops
  // back among them; a day being written adds its stops at the end, several at once under
  // reduced motion, and none of them enters.
  const isAmongOthers =
    isPlaced && (isReplanning || isAfterReplan || proposed.size > 0 || fading.size > 0);
  const enteringFlags = stopIds.map(
    (id, index) => entering.includes(id) || isNewcomerAt(stopIds, index, landedIds, isAmongOthers),
  );
  useLayoutEffect(() => {
    if (measured.current !== boxes || landedIds.join(" ") === stopIdsKey) return;
    const ids = stopIdsKey === "" ? [] : stopIdsKey.split(" ");
    const landing = ids.filter((_, index) => isNewcomerAt(ids, index, landedIds, isAmongOthers));
    setEntering((now) => [...now.filter((id) => ids.includes(id)), ...landing]);
    setLandedIds(ids);
  }, [boxes, landedIds, stopIdsKey, isAmongOthers]);
  const sprungIndexes = stops.flatMap((stop, index) =>
    landedIds.includes(stop.id) && !enteringFlags[index] ? [index] : [],
  );
  // Each row's words' top, under the fork row's room where a fork row stands over its stop: one
  // sprung value, so the words glide with their wire as the fork's room opens and closes, never
  // stepping by it in a frame.
  const wordsAboveOf = (index: number): number =>
    (rows[index]?.above ?? 0) - forkRoomOf(stopIds[index] ?? "");
  // A leaving row rides up on the row under it as that row rises into its room.
  const { anchors: restingAnchors, tops: topsTarget } = leavingRowsAt(
    {
      anchors: laidAnchors,
      tops: laidAnchors.map((anchor, index) => anchor - wordsAboveOf(index)),
    },
    leavingFlags,
    rows.map((_, index) => wordsAboveOf(index)),
    rowSizes.gap,
  );
  // A row being written, before its energy, opens its spare line on the gentle spring, and so
  // does every row under it: two lines that arrive together open at about 2 px a frame, where
  // `layout` would take them at nearly 4, and a row may move at most about 3. A row on the
  // gentle spring is carried down whole by the wire above it when that wire comes faster.
  const firstWritten = stops.findIndex((stop) => !hasEnergy(stop));
  const kinds = sprungIndexes.map((index): SpringName =>
    firstWritten >= 0 && index >= firstWritten ? "gentle" : "layout",
  );
  const sprungKeys = sprungIndexes.map((index) => stopIds[index] ?? String(index));
  // While a re-plan is drawn beside the day, and until the rows after it rest, rows glide at
  // the pace the header's room reaches, about 3 px a frame however far: the rows around a
  // proposal's row as its room opens among the day's.
  const isGlidingSlow =
    fork !== null ||
    isReplanning ||
    isAfterReplan ||
    backToPlan !== null ||
    proposed.size > 0 ||
    fading.size > 0 ||
    enteringFlags.some(Boolean);
  const reach = isGlidingSlow ? ROOM_REACH_PX : undefined;
  // A fork folding a version away or drawing it beside the day again, at the visitor's tap,
  // moves the rows as one gesture over the day: every row sets off on one spring, timed so no
  // row moves faster than about 3 px a frame while it is on screen (`foldOf`), and all come to
  // rest together.
  const isFolding = fading.size > 0 || (fork?.view.isChosen === true && fork.view.isCompared);
  const [fold, setFold] = useState<Fold | null>(null);
  const sprungAnchorTargets = sprungIndexes.map((index) => restingAnchors[index] ?? 0);
  const sprungTopTargets = sprungIndexes.map((index) => topsTarget[index] ?? 0);
  const sprungAnchors = useSprungAll(
    sprungAnchorTargets,
    !isPlaced,
    kinds,
    sprungKeys,
    reach,
    fold?.spring,
  );
  const sprungTops = useSprungAll(
    sprungTopTargets,
    !isPlaced,
    kinds,
    sprungKeys,
    reach,
    fold?.spring,
  );
  // Read once the rows are told somewhere new, before they set off: how far each goes from
  // where it is now, and which of them the visitor can see.
  const foldKey = isFolding
    ? `${sprungKeys.join(" ")}|${[...sprungAnchorTargets, ...sprungTopTargets].map(Math.round).join(",")}`
    : "";
  if (foldKey !== (fold?.key ?? "")) {
    setFold(
      foldKey === ""
        ? null
        : foldOf(
            foldKey,
            screenOf(outer),
            sprungIndexes.map((index, at) => ({
              id: stopIds[index] ?? "",
              isLeaving: leavingFlags[index] === true,
              from: { anchor: sprungAnchors[at] ?? 0, top: sprungTops[at] ?? 0 },
              to: { anchor: sprungAnchorTargets[at] ?? 0, top: sprungTopTargets[at] ?? 0 },
            })),
            fold,
          ),
    );
  }
  // A leaving row the visitor could not see as the tap was made goes at once.
  const gone = fold?.gone ?? NO_IDS;
  /** Each row's value this frame: its spring's once it has landed, its target until then. */
  const drawnOf = (sprung: readonly number[], targets: readonly number[]): number[] =>
    targets.map((value, index) => {
      const at = sprungIndexes.indexOf(index);
      return at === -1 ? value : (sprung[at] ?? value);
    });
  const anchorsSprung = drawnOf(sprungAnchors, restingAnchors);
  const topsSprung = drawnOf(sprungTops, topsTarget);
  const restingRows = { anchors: restingAnchors, tops: topsTarget };
  const drawnRows = rowsKeptClear(
    { anchors: anchorsSprung, tops: topsSprung },
    restingRows,
    target.scale.plotTop,
    rowSizes.gap,
    enteringFlags,
  );
  const { anchors: anchorsNow, tops: topsNow } = drawnRows;
  // An entering row whose room has opened to where it rests joins the springs there and shows.
  const enteredKey = stopIds
    .filter((id, index) => entering.includes(id) && hasEntered(drawnRows, restingRows, index))
    .join(" ");
  useLayoutEffect(() => {
    if (enteredKey === "") return;
    const entered = enteredKey.split(" ");
    setEntering((now) => now.filter((id) => !entered.includes(id)));
  }, [enteredKey]);
  // Held: entering and not yet nearly in its room. It shows as the last of its room opens, less
  // than half the gap between its words and its wire, so its words never meet the wire, and joins
  // the springs once the room is whole. A row fading out as a re-plan goes back is held unseen
  // too, while the chart takes its stop off the curve and fades its wire and bead.
  const held: ReadonlySet<string> = new Set(
    stopIds.filter(
      (_, index) =>
        enteringFlags[index] && !hasEntered(drawnRows, restingRows, index, rowSizes.wireGap / 2),
    ),
  );
  const isUnseen = (id: string): boolean => held.has(id) || fading.has(id);
  // Said before anything waiting on it looks, and once more as the rows go: a day whose rows
  // are gone has none gliding.
  const isGliding = isAwayFrom(anchorsSprung, restingAnchors) || isAwayFrom(topsSprung, topsTarget);
  if (backToPlan === "pressed" && isGliding) setBackToPlan("gliding");
  if (backToPlan === "gliding" && !isGliding) setBackToPlan(null);
  useLayoutEffect(() => onGlide?.(isGliding), [isGliding, onGlide]);
  useLayoutEffect(() => {
    if (isAfterReplan && !isReplanning && !isGliding) setIsAfterReplan(false);
  }, [isAfterReplan, isReplanning, isGliding]);
  useLayoutEffect(() => () => onGlide?.(false), [onGlide]);
  // Each fork row rests in the room over its part's first stop on screen and glides there as
  // that stop's words do, on the same spring: as a version folds away, that stop becomes
  // another, one row lower, and the fork row stays where it stands; as its room grows, the rows
  // under it make way rather than it rising.
  const forkParts = (fork?.anchors ?? []).map((id) => (id === null ? -1 : stopIds.indexOf(id)));
  const forkRoomAt = (index: number): number => forkRoomOf(stopIds[index] ?? "");
  const forkTopsSprung = useSprungAll(
    forkParts.map((index) => (topsTarget[index] ?? 0) - forkRoomAt(index)),
    !isPlaced,
    forkParts.map((index): SpringName => kinds[sprungIndexes.indexOf(index)] ?? "layout"),
    forkParts.map((_, part) => `fork-${part}`),
    reach,
    fold?.spring,
  );
  const forkTops = forkParts.map((index, part) =>
    index === -1 ? null : (forkTopsSprung[part] ?? 0),
  );
  // The line under a fork row's answers shows once the first row shown under it has made its
  // room, as a compared version comes back beside the day, so it never stands over its words.
  const isForkLineSeen = forkParts.map((index, part) => {
    const top = forkTops[part];
    if (top === null || top === undefined) return true;
    const under = stopIds.findIndex((id, at) => at >= index && !held.has(id) && !fading.has(id));
    const underTop = topsNow[under] ?? Infinity;
    return under === -1 || underTop >= top + forkRoomAt(index) - rowSizes.gap / 2;
  });
  // While a fork's rows come and go, the rows in view stay where the visitor reads them: the
  // first row in view is held, and when rows above the screen make room or give it back, the
  // page scrolls by as much, as the header's glide holds the view after a gesture. Only once
  // the chart's top is above the screen, so a header in view is never scrolled away from.
  const heldInView = useRef<{ id: string; y: number } | null>(null);
  const isForkMoving = fork !== null || proposed.size > 0 || fading.size > 0;
  useLayoutEffect(() => {
    if (!outer || !isForkMoving) {
      heldInView.current = null;
      return;
    }
    const chartTop = outer.getBoundingClientRect().top;
    if (chartTop >= 0) {
      heldInView.current = null;
      return;
    }
    // On the page, not the screen, so the visitor's own scrolling is never taken back.
    const held = heldInView.current;
    const atNow = held === null ? -1 : stopIds.indexOf(held.id);
    if (held !== null && atNow !== -1) {
      const moved = Math.round(chartTop + window.scrollY + (anchorsNow[atNow] ?? 0) - held.y);
      if (moved !== 0) window.scrollBy(0, moved);
    }
    const top = outer.getBoundingClientRect().top;
    const inView = stopIds.findIndex((_, index) => top + (anchorsNow[index] ?? 0) >= 0);
    const id = stopIds[inView];
    heldInView.current =
      id === undefined ? null : { id, y: top + window.scrollY + (anchorsNow[inView] ?? 0) };
  });
  // A bead fills only once its row's room has opened to what its words need as this frame
  // measures them, so the words take their layout inside it. Each row looks only at its own
  // room: one still opening above it carries it down whole, and words still to stream in
  // later open more room ahead of the pen. The rooms are read from the words as last
  // measured, before anything waiting on them looks.
  const { onRoomsOpen } = arrivals;
  useLayoutEffect(() => {
    const open = stops.filter((stop, index) => {
      const wire = anchorsNow[index];
      const roomPx = wire === undefined ? undefined : wire - (topsNow[index] ?? 0);
      const needed = roomOf(measured.current[stop.id], rowSizes) + rowSizes.wireGap;
      return hasEnergy(stop) && isRoomOpen(roomPx, needed, arrivals.of(stop).isReady);
    });
    onRoomsOpen(new Set(open.map((stop) => stop.id)));
  });
  // An entering row bends the time scale once it shows, its words seen, and then on the spring
  // its stop comes onto the curve on, so the curve drawn on that scale never moves in a frame.
  // Bent only once it had wholly entered, a version a fork's Compare draws again stood seen for
  // about 2.5 s with its dashed wire where the scale without it put it, across the words of the
  // stop at its hour (Elche's 13:15 on a phone, 86 px under its own words).
  const seen = useSprungAll(
    stopIds.map((id, index) => (held.has(id) || leavingFlags[index] ? 0 : 1)),
    !isPlaced,
    stopIds.map((): SpringName => "gentle"),
    stopIds,
  );
  // A proposal's row that is entering keeps its wire, its bead and its stretch of the dashed
  // path off the chart until the scale has bent to it, so they stand under its own words from
  // the frame they show: drawn as the scale bent, Compare's 13:15 slid its wire 87 px up
  // through the words of the stop at its hour.
  const chartHeld: ReadonlySet<string> = new Set([
    ...held,
    ...stopIds.filter((id, index) => proposed.has(id) && (seen[index] ?? 1) < 1),
  ]);
  const { anchors, scale } = rowScale(
    width,
    basisHeight,
    dayStart,
    dayEnd,
    rows,
    anchorsNow,
    drawing,
    seen,
  );
  // The ring that invites the first drag waits among the stops whose wires are in view, so
  // on a phone it is on the first screen; it asks when it is about to choose.
  const { seenRef } = chart.invitation;
  useEffect(() => {
    seenRef.current = (index) => {
      if (!outer) return true;
      const view = dayViewOf(outer, scale, rowSizes.seenRoom);
      const y = anchors[index];
      return y !== undefined && y >= view.top && y <= view.bottom;
    };
  });
  const wordsLeft = scale.axisX + rowSizes.beadClear;
  const wordsRight = wordsRightOf(scale.width, rowSizes);
  /** A row's words saying `density`, beside a bead at `energy`, on the side that suits them. */
  const rowLayoutOf = (
    energy: number,
    density: Density,
    naturalWidth: number,
    isWritten: boolean,
  ): RowLayout => {
    const beadX = scale.xOf(energy);
    const placement = placeLabel(beadX, naturalWidth, wordsLeft, wordsRight, isWritten, rowSizes);
    return { density, beadX, placement };
  };
  const lastIndex = stops.length - 1;
  // Each stop's time stands on its name's first line, from the gutter's right edge.
  const timeWidth = scale.axisX - rowSizes.beadClear / 2;
  // A sun's minute is said once the day is whole, where the rows will rest, so it never
  // comes and goes as rows land or spring; and only in the day's order, under the stops that
  // start by its minute and over the ones after.
  const gutterTimes = stops.map((stop, index) => {
    const line = boxes[stop.id]?.lines[0];
    const middle = line ? line.y + line.height / 2 : rowSizes.lineEstimate / 2;
    const wordsTop = topsTarget[index] ?? 0;
    return { minutes: visits[index]?.from ?? 0, y: wordsTop + middle };
  });
  const isSunLabelled = (minute: number | null): boolean =>
    isUsable &&
    minute !== null &&
    isSunMinuteInOrder(
      { minutes: minute, y: target.scale.yOf(minute) },
      gutterTimes,
      rowSizes.sunLabelClearance,
    );
  const sunLabels: SunLabels = {
    sunrise: isSunLabelled(chart.sunrise),
    sunset: isSunLabelled(chart.sunset),
  };
  // A stop that starts where the axis runs in golden hour says its time in amber.
  const isGoldenStart = (index: number): boolean => isGoldenAt(axisLight, visits[index]?.from ?? 0);
  /** Where a waiting phrase sits: by the bead the next name will be written beside. */
  const waitingPlaceAt = (beadX: number): WaitingPlace => {
    const { side, maxWidth } = placeLabel(beadX, 0, wordsLeft, wordsRight, false, rowSizes);
    const inset =
      side === "right" ? beadX + rowSizes.beadClear : scale.width - (beadX - rowSizes.beadClear);
    return { side, inset, maxWidth };
  };
  const nextRowTop = (anchors[lastIndex] ?? scale.plotTop) + rowSizes.gap;
  // Where the list draws the waiting line: in a bare row's own place, over its words' room,
  // or under the last row. A row being written again holds its own (\`rewritingStop\`).
  const waitingRow =
    waiting?.isInPlace && waiting.stopId !== undefined
      ? stops.findIndex((stop) => stop.id === waiting.stopId)
      : -1;
  const waitingRowAbove = rows[waitingRow]?.above ?? 0;
  const listWaiting =
    waiting === null || (waiting.isInPlace && waitingRow === -1)
      ? null
      : waitingRow === -1
        ? { top: nextRowTop, height: 0 }
        : {
            top: topsNow[waitingRow] ?? (anchors[waitingRow] ?? 0) - waitingRowAbove,
            height: waitingRowAbove,
          };
  /**
   * Every stop shows its plan again, its rows gliding at a re-plan's pace, and the keys go on
   * from a stop it changed back, on screen where one is, so the focus never falls to the page
   * as the button that had it goes.
   */
  const takeBackToPlan = () => {
    const sliders = stops.flatMap((stop, index) => {
      const shown = candidatesOf(stop)[picks[index] ?? 0];
      if (!shown || shown.id === plannedPlace(stop).id) return [];
      const slider = outer?.querySelector<SVGGElement>(
        `[role="slider"][aria-label="Energy at ${stop.startTime}"]`,
      );
      return slider ? [slider] : [];
    });
    const onScreen = sliders.find((slider) => {
      const { top, bottom } = slider.getBoundingClientRect();
      return bottom > 0 && top < window.innerHeight;
    });
    setBackToPlan("pressed");
    chart.energy.reset();
    (onScreen ?? sliders[0])?.focus({ preventScroll: true });
  };
  const frame = { width: scale.width, height: scale.height };
  const open = openStop === null ? null : openDetailsOf(openStop);
  // Once the open stop's sheet and the room around the day are measured, the side it opens
  // on, chosen as it opens for the tallest of the stop's versions: down from its words when
  // that ends inside the day or over the page's tail, else up from them. Held while it is
  // open, whichever version is swapped in then fits there, so the sheet never moves and
  // never makes the page taller.
  const body = open && sheetBody?.stopId === open.stop.id ? sheetBody : null;
  const sheetRoom: SheetRoom | null =
    room && room.stop === openStop ? { ...room, frameHeight: scale.height } : null;
  const isSideHeld = open !== null && heldSide?.stopId === open.stop.id;
  if (open && body && sheetRoom && !isSideHeld) {
    const side = sheetSideOf(open.anchor, body.tallest, sheetRoom, drawing);
    setHeldSide({ stopId: open.stop.id, side });
  }
  const sheetSide = isSideHeld ? (heldSide?.side ?? null) : null;
  const sheetBand =
    open && body && sheetSide ? sheetBandOf(sheetSide, open.anchor, body.shown, drawing) : null;

  /** What the open stop shows, what each of its versions would say, and where its words are. */
  function openDetailsOf(index: number): OpenDetails | null {
    const stop = stops[index];
    if (!stop || !isOpenable(index)) return null;
    const pick = picks[index] ?? 0;
    const candidates = candidatesOf(stop);
    const shown = candidates[pick] ?? stop.primary;
    const visit = visits[index] ?? { from: 0, to: 0 };
    const above = rows[index]?.above ?? 0;
    const versionOf = (place: PlaceDraft): SheetVersion => {
      const details = detailsOf(stop, place, city);
      // A row already says how the place sounds and feels, its line where it opens and its
      // two words where it does not; its sheet says the other, never the same twice.
      const isOpenRow = (densityOverride ?? densityOf(writtenEnergyOf(place))) === "open";
      return {
        id: place.id,
        name: place.name ?? "",
        details: isOpenRow
          ? { ...details, texture: null }
          : { ...details, crowd: null, sound: null },
        light: bestLightOf(place, visit, daylight),
      };
    };
    const { details, light } = versionOf(shown);
    return {
      stop,
      shown,
      details,
      light,
      versions: candidates.map(versionOf),
      anchor: {
        wordsTop: topsNow[index] ?? (anchors[index] ?? 0) - above + forkRoomOf(stop.id),
        above: above - forkRoomOf(stop.id),
      },
    };
  }

  // Only a sheet with room neither below nor above its stop, as in a lab cell of a few stops,
  // hangs past where the page ends; the day makes room for it, so it can be read, and the
  // page grows by no more than it needs.
  const sheetEnd =
    sheetBand && sheetRoom ? hungDayHeightOf(sheetBand, sheetRoom, rowSizes) : undefined;

  return (
    <div
      ref={setOuter}
      className={cn(
        "relative",
        // A day that mounts whole fades in once placed; a still appears at once, in its state.
        !isStill && "transition-opacity motion-reduce:transition-none",
        !isPlaced && "opacity-0",
      )}
      inert={!isPlaced}
      style={{ minHeight: sheetEnd }}
    >
      {/* Clipped sideways: words gliding to a bead further left take their new width before
        they get there, and for that moment they must not widen the page. */}
      <div className="relative overflow-x-clip" style={frame}>
        {/* On a phone, the scale's words held at the screen's top while the chart is in view;
            a still of the lab's matrix keeps the chart's own. First in the chart, as it stands
            over it: the focus meets its action, a change's keep, undo or redo, before any
            bead, as the eye does (WCAG 2.4.3). Laid over the chart, it takes no room. */}
        {!isStill && (
          <StickyScale
            scale={scale}
            isCurveNamed={isUsable}
            clause={clauseOf(changesOf(stops, picks))}
            isDragging={chart.energy.isDragging}
            onBackToPlan={takeBackToPlan}
            isUnderSheet={
              sheetBand !== null && sheetBand.top < scale.plotTop - scale.chart.laneTick
            }
          />
        )}
        <AbacusChart
          {...chart}
          held={chartHeld}
          fading={fading}
          gone={gone}
          newcomers={newcomers}
          isReplanning={isReplanning}
          light={axisLight}
          axisTo={axisEnd}
          // A sun on the axis comes with the light it turns, not before it.
          sunrise={isLit(chart.sunrise) ? chart.sunrise : null}
          sunset={isLit(chart.sunset) ? chart.sunset : null}
          sunLabels={sunLabels}
          timesRight={timeWidth}
          isInteractive={isUsable}
          scale={scale}
          onTapStop={onTapStop}
          onHoverStop={onHoverStop}
          onHoverPlace={onHoverPlace}
          wordsMaskRef={setWordsMask}
          isScaleHeld={!isStill}
          beadsOverSheet={
            beadsOverSheet && sheetBand ? { layer: beadsOverSheet, sheet: sheetBand } : null
          }
        />
        <ol
          aria-label="The day"
          aria-busy={!isUsable || penning.size > 0}
          className="pointer-events-none absolute inset-0"
        >
          {stops.map((stop, index) => {
            const pick = picks[index] ?? 0;
            const shown = candidatesOf(stop)[pick] ?? stop.primary;
            const above = rows[index]?.above ?? 0;
            // A fork row's room stands over the words of its part's first stop.
            const forkRoom = forkRoomOf(stop.id);
            const top = topsNow[index] ?? (anchors[index] ?? 0) - above + forkRoom;
            const isProposed = proposed.has(stop.id);
            if (!shown.name && !rewriting.includes(stop.id)) {
              // Placed in time before its name is written: the row says when before where.
              return (
                <motion.li key={stop.id} className="absolute inset-x-0 top-0" style={{ y: top }}>
                  <StartTime
                    time={stop.startTime}
                    width={timeWidth}
                    tone={timeToneOf(false, isGoldenStart(index))}
                  />
                </motion.li>
              );
            }
            const arrival = arrivals.of(stop);
            const writtenEnergy = writtenEnergyOf(shown);
            // Where the bead waits, hollow, until it fills: the requested energy, or for a
            // stop written again the energy it is written again from.
            const waitingEnergy = (arrival.isRewritten ? arrival.slide : null) ?? requestedEnergy;
            // The words go where the bead is going, not where it is this frame: they pick
            // their side and wrap once, then go there with the bead. Followed frame by frame,
            // they flipped sides mid-slide and the rows below jumped. A place's words are all
            // written by the time its energy is.
            const resting = rowLayoutOf(
              writtenEnergy === null
                ? waitingEnergy
                : drawnEnergyOf(scale, writtenEnergy, twinRankOf(stop, pick)),
              // A proposal's stop says the least, its name and kind, whatever its energy.
              isProposed ? "folded" : (densityOverride ?? densityOf(writtenEnergy)),
              boxes[stop.id]?.natural ?? 0,
              writtenEnergy !== null,
            );
            // The room comes with the energy, the words with the bead, and the bead with the
            // room. From the frame its energy is written the row holds room for how it will
            // rest, while its words stay as laid out beside the hollow bead, saying the least.
            // Once that room has opened the bead fills: the words take their layout inside it
            // and set off with the bead, and the pen writes in what the density adds; words
            // that rest shorter than they were shown let the room settle to them. A row the
            // matrix holds at one density is weighed from the start.
            const isWeighed = densityOverride !== null || arrival.isReady;
            // A row that lands with its energy written stands as it will rest from its first
            // frame: it has nowhere to set off for, so only its pen and sun wait for the bead.
            const isShownAtRest = isWeighed || arrival.hasLandedWeighed;
            // Until it is weighed a row says only when, its time above and its hollow bead on the
            // wire under it; its words come as the bead is weighed, once everything they say is
            // written (`weighedWithItsLight`), laid out where they will rest, and the pen writes
            // the name in there (`docs/decisions.md`, "A row's words go where its bead comes to
            // rest, and rows ease rather than jump"). Laid out beside the hollow bead, a name
            // written there took a line more or less as the bead was weighed: 8 of 43 rows on a
            // phone's six written days. A stop the lab writes again keeps its words while it is.
            const isWordsHeld = !isShownAtRest && !arrival.isRewritten;
            // While the bead slides in, the words of a row weighed in its frame ride it: drawn
            // from the same value as the bead in the same frame, so they set off together and
            // never trail it.
            const { slide } = arrival;
            const ridden =
              isWeighed &&
              !arrival.hasLandedWeighed &&
              arrival.isArriving &&
              !arrival.isSettled &&
              slide !== null
                ? scale.xOf(drawnEnergyOf(scale, slide, twinRankOf(stop, pick)))
                : null;
            const layout = !isShownAtRest
              ? rowLayoutOf(waitingEnergy, densityOf(null), 0, false)
              : ridden === null
                ? resting
                : { ...resting, beadX: ridden };
            const visit = visits[index] ?? { from: 0, to: 0 };
            // A proposal's stop is named and its kind said, compact: no sun of its own until it
            // is taken.
            const stopLight = isProposed ? null : bestLightOf(shown, visit, daylight);
            return (
              <StopRow
                key={stop.id}
                stop={stop}
                start={visit.from}
                pick={pick}
                drawing={drawing}
                layout={layout}
                resting={resting}
                isWeighed={isWeighed}
                isWordsHeld={isWordsHeld}
                isRewritten={arrival.isRewritten}
                isRiding={ridden !== null}
                isPenStill={isLeaving || isPenStill}
                isProposed={isProposed}
                shown={shown}
                top={top}
                above={above - forkRoom}
                wordsWidth={boxes[stop.id]?.width ?? 0}
                wordsLines={boxes[stop.id]?.lines ?? NO_LINES}
                wordsMask={wordsMask}
                timeWidth={timeWidth}
                sheet={
                  index === openStop && open
                    ? {
                        ...open,
                        from: scale.axisX + rowSizes.sheetFromAxis,
                        to: scale.width,
                        isFocusTaken: !isStill,
                        side: sheetSide,
                      }
                    : null
                }
                // The sun marks a place once its bead fills; the room holds it from the frame
                // its best window is known, as the icon can take the name onto a line more,
                // and so do words that stand as they will rest.
                light={isShownAtRest ? stopLight : null}
                restingLight={stopLight}
                writing={writing}
                isOpen={index === openStop}
                isLit={chart.litStops.includes(index)}
                isGoldenStart={isGoldenStart(index)}
                measuring={measuring}
                isInteractive={isOpenable(index) && !isUnseen(stop.id)}
                isHeld={isUnseen(stop.id)}
                isGoneAtOnce={gone.has(stop.id)}
                waiting={
                  waiting?.isInPlace && waiting.stopId === undefined && stop.id === rewritingStop
                    ? waiting
                    : null
                }
                waitingPlace={waitingPlaceAt(layout.beadX)}
                onMeasure={onMeasure}
                onPenning={onPenning}
                onToggle={() => onToggleStop(index)}
                onClose={onCloseStop}
                onSheetBody={onSheetBody}
                onHover={(isHovered) => onHoverStop(isHovered ? index : null)}
                isPlacing={!isPlaced || !sprungIndexes.includes(index)}
              />
            );
          })}
        </ol>
        {/* Each fork row in the room its part's first stop holds over its words, moving with
            that row; over the rows, so its answers take a press before a wire's tap does. */}
        {fork && (
          <div className="pointer-events-none absolute inset-0">
            {fork.anchors.map((_, part) => {
              const forkTop = forkTops[part];
              if (forkTop === null || forkTop === undefined) return null;
              return (
                <motion.div key={part} className="absolute inset-x-0 top-0" style={{ y: forkTop }}>
                  <ForkRow
                    view={fork.view}
                    index={part}
                    count={fork.anchors.length}
                    timeWidth={timeWidth}
                    wordsLeft={wordsLeft}
                    drawing={drawing}
                    lineAt={isWide ? "margin" : "under"}
                    isLineSeen={isForkLineSeen[part]}
                    onChoose={fork.onChoose}
                    onCompare={fork.onCompare}
                    onAskAgain={fork.onAskAgain}
                    onMeasure={measureFork(part)}
                  />
                </motion.div>
              );
            })}
          </div>
        )}
        {/* Over the rows and their open sheet: the beads its edges cross, drawn again where
            the sheet lies over them. A picture only; the chart under it is the day. */}
        <svg
          ref={setBeadsOverSheet}
          aria-hidden
          width={scale.width}
          height={scale.height}
          className="pointer-events-none absolute inset-0 z-20 overflow-visible"
        />
        {/* Clipped to nothing, so a long name's one-line copy never widens the page. */}
        <div
          ref={setMeasuring}
          aria-hidden
          className="invisible absolute top-0 left-0 size-0 overflow-hidden"
        />
        {/* Below the last row, where the next one will appear; or in a bare row's own
            place, over its words' room, gliding with the row. */}
        {listWaiting && (
          <motion.div
            className="pointer-events-none absolute inset-x-0 top-0"
            style={{ y: listWaiting.top, height: listWaiting.height }}
          >
            <ListWaiting waiting={waiting} place={waitingPlaceAt(scale.xOf(requestedEnergy))} />
          </motion.div>
        )}
      </div>
      {/* On a laptop each fork row's line stands in the margin right of the chart, level with
          its answers, so the row holds a line of room, not three. Outside the chart's sideways
          clip, which would cut it. */}
      {fork && isWide && (!fork.view.isChosen || fork.view.isCompared) && (
        <div className="pointer-events-none absolute inset-y-0 left-full">
          {fork.anchors.map((_, part) => {
            const forkTop = forkTops[part];
            if (forkTop === null || forkTop === undefined) return null;
            return (
              <motion.div
                key={part}
                {...{ [FORK_LINE_ATTRIBUTE]: part }}
                className={MARGIN_LINE_CLASSES}
                style={{ y: forkTop }}
              >
                <ForkLine view={fork.view} onAskAgain={fork.onAskAgain} />
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** A row's wire and the top of its words, in the chart's pixels. */
interface RowAt {
  anchor: number;
  top: number;
}

/** A row about to glide: from where it is to where it rests, and whether it leaves the day. */
interface RowGlide {
  id: string;
  isLeaving: boolean;
  from: RowAt;
  to: RowAt;
}

/** The screen in the chart's pixels, from its top to its foot. */
interface Screen {
  top: number;
  bottom: number;
}

/** A fork's rows set off at a tap: the spring they glide on, and the leaving rows that go at once. */
interface Fold {
  /** The rows' targets the spring was chosen for. */
  key: string;
  spring: RestingSpringOptions;
  /** Every leaving row looked at so far, and those of them off the screen as they began to go. */
  looked: ReadonlySet<string>;
  gone: ReadonlySet<string>;
}

/** The screen as the chart stands on it now; none before the chart is drawn. */
function screenOf(chart: HTMLElement | null): Screen {
  if (!chart) return { top: 0, bottom: 0 };
  const chartTop = chart.getBoundingClientRect().top;
  return { top: -chartTop, bottom: window.innerHeight - chartTop };
}

/** Whether a row's words or wire stand on the screen. */
function isOnScreen({ anchor, top }: RowAt, screen: Screen): boolean {
  return anchor >= screen.top && top <= screen.bottom;
}

/**
 * A fork's rows as a tap sets them off (`foldGlideOver`): one spring for all, timed so that no
 * row moves faster than a gesture's rows on screen do while the visitor can see it, rising onto
 * the screen from under its foot included. A leaving row off the screen as it begins to go goes
 * at once, so it never rides faint onto the screen with the row under it, and does not time the
 * glide; one on the screen fades where the visitor reads it, and does. Each leaving row is
 * looked at once, as it begins to go: one still fading is never made to go at once.
 */
function foldOf(key: string, screen: Screen, glides: readonly RowGlide[], last: Fold | null): Fold {
  const looked = new Set(last?.looked);
  const gone = new Set(last?.gone);
  for (const glide of glides) {
    if (!glide.isLeaving || looked.has(glide.id)) continue;
    looked.add(glide.id);
    if (!isOnScreen(glide.from, screen)) gone.add(glide.id);
  }
  const distanceOf = ({ from, to }: RowGlide): number =>
    Math.max(Math.abs(to.anchor - from.anchor), Math.abs(to.top - from.top));
  const ways = glides
    .filter((glide) => !gone.has(glide.id))
    .map((glide) => {
      const distancePx = distanceOf(glide);
      const { from, to } = glide;
      return {
        distancePx,
        isSeenAt: (travelledPx: number) => {
          const share = distancePx === 0 ? 1 : travelledPx / distancePx;
          const at = (start: number, end: number) => start + (end - start) * share;
          return isOnScreen(
            { anchor: at(from.anchor, to.anchor), top: at(from.top, to.top) },
            screen,
          );
        },
      };
    });
  const farthest = Math.max(0, ...glides.filter((glide) => !glide.isLeaving).map(distanceOf));
  return { key, spring: foldGlideOver(ways, farthest), looked, gone };
}

function isSameBox(a: Box, b: Box): boolean {
  return (
    Math.abs(a.natural - b.natural) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5 &&
    Math.abs(a.room - b.room) < 0.5 &&
    isSameLines(a.lines, b.lines)
  );
}
