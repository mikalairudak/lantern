"use client";

import { AnimatePresence, motion, useReducedMotionConfig } from "motion/react";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

import { cn } from "@/components/ui/cn";

import { byEnergy, versionOf, writtenEnergyOf } from "./curve";
import { hasEnergy, isWriting, type PlaceDraft, type StopDraft } from "./day-draft";
import { type Density } from "./density";

import { type BestLight } from "./light";
import { lineBoxesOf, type LineBox } from "./line-boxes";
import { SHOWN_WORDS_SLACK, type Drawing, type LabelPlacement } from "./rows";
import { sheetWidthOf } from "./sheet-placement";

import { SPRINGS } from "@/lib/tokens/motion";

import { isQuarterNamed } from "./quarter";
import { useWordsX } from "./use-words-x";
import type { Waiting } from "./waiting";
import { ListWaiting, type WaitingPlace } from "./waiting-list";

import { NAME_CLASSES, StopWords } from "./stop-words";
import {
  type OpenSheet,
  type SheetBody,
  detailsIdOf,
  SheetCopies,
  WordsSheet,
} from "./words-sheet";

/** An empty line in the name's style, which a row being written holds open under its words. */
const SPARE_LINE_CLASSES = "type-name text-quote basis-full";

const WORDS_CLASSES = "flex w-max flex-wrap items-baseline gap-x-3 text-left";

/** The words inside their box, on the row and on the unseen copy that holds its room. */
const WORDS_INNER_CLASSES = "flex flex-wrap items-baseline gap-x-3 text-left";

export interface Box {
  /** The words as they will rest, on one line, unwrapped. */
  natural: number;
  /** The words as shown beside their bead. */
  width: number;
  height: number;
  /**
   * The words as they will rest, laid out on an unseen copy in the column and at the density
   * of their resting point: the room the row holds from the frame its energy is written.
   */
  room: number;
  /** Each line of the words, from the top left of their box: the curve steps back under them. */
  lines: readonly LineBox[];
}

/** How a row's words are laid out: how much they say, the bead they sit by, and its side. */
export interface RowLayout {
  density: Density;
  beadX: number;
  placement: LabelPlacement;
}

interface StopRowProps {
  stop: StopDraft;
  /**
   * A proposal's stop beside the day (`docs/decisions.md`, "A changed word proposes its part
   * beside the day, and the visitor takes it"): compact, its name and kind alone, its name and
   * time in the versions' blue, and nothing to open until it is taken.
   */
  isProposed?: boolean;
  /**
   * A stop entering the day between two others, unseen while the room it grows into opens;
   * it shows when that room is whole.
   */
  isHeld?: boolean;
  /**
   * A held row goes at once rather than fading: one a fork folds away that the visitor cannot
   * see as the tap is made, which would otherwise ride faint onto the screen.
   */
  isGoneAtOnce?: boolean;
  /** When the stop starts on the day's running clock, which names a meal. */
  start: number;
  pick: number;
  /** The pixels the day is drawn at. */
  drawing: Drawing;
  /**
   * How the words are shown: how much they say (the texture too, the name and note, or the
   * name and kind), beside which bead and on which side. The words glide to the bead.
   */
  layout: RowLayout;
  /** How the words will rest, which the unseen copies measure the row's room from. */
  resting: RowLayout;
  /** Its bead has set off for its energy: the words its density adds write in from here. */
  isWeighed: boolean;
  /**
   * Its energy is still to come: the row says when, and its words wait unseen. Words that
   * waited come as the bead is weighed, and the pen writes the name in.
   */
  isWordsHeld: boolean;
  /** Written again in place, as the lab's re-compositions do: it shows its name as written. */
  isRewritten: boolean;
  /** Its bead is sliding in, and the words take each place it is drawn at at once. */
  isRiding: boolean;
  /** The pen stops where it is: as the day fades out, or in a still of the lab's matrix. */
  isPenStill: boolean;
  shown: PlaceDraft;
  /** Where the row's words start, from the top of the chart. */
  top: number;
  /** From the top of the words to the wire. */
  above: number;
  /** How wide the words are as last laid out, to hang them left of the bead. */
  wordsWidth: number;
  /** The words' lines as last laid out, drawn into `wordsMask` where they are this frame. */
  wordsLines: readonly LineBox[];
  /** The chart's layer for lines of words, where the curve steps back under them. */
  wordsMask: SVGGElement | null;
  timeWidth: number;
  /** Set when the stop is open as a sheet. */
  sheet: OpenSheet | null;
  /** The sun the words hold room for beside the name, and show once the bead fills. */
  light: BestLight | null;
  /** The sun the words will rest with, as soon as it is known. */
  restingLight: BestLight | null;
  writing: string | null;
  isOpen: boolean;
  isLit: boolean;
  /** It starts where the time axis runs in golden hour, so its time is said in amber. */
  isGoldenStart: boolean;
  /** Its words open its sheet: the day can be used, or the stop is whole and at rest. */
  isInteractive: boolean;
  /** Where the words' unseen copies, as they will rest, are measured. */
  measuring: HTMLElement | null;
  /** The waiting line in this row's place, while it is being written again. */
  waiting: Waiting | null;
  /** Where the waiting phrase sits in this row, while it is written again. */
  waitingPlace: WaitingPlace;
  onMeasure: (id: string, box: Box) => void;
  /** Told when the pen starts and stops writing in the row's words. */
  onPenning: (id: string, isPenning: boolean) => void;
  onToggle: () => void;
  onClose: () => void;
  /**
   * How tall the stop's open sheet is besides the room it keeps for the words, with the
   * version on show and with its tallest, so the day can choose its side as it opens.
   */
  onSheetBody: (body: SheetBody) => void;
  onHover: (isHovered: boolean) => void;
  /** The day is taking its first places, or the row is landing: the words go straight to theirs. */
  isPlacing: boolean;
}

/**
 * How a stop's time is inked: lit with its stop, in golden hour's amber, quiet, or a proposal's
 * in the versions' blue.
 */
type TimeTone = "ink" | "amber" | "muted" | "swap";

const TIME_TONE_CLASSES: Record<TimeTone, string> = {
  ink: "text-ink",
  amber: "text-amber",
  muted: "text-muted",
  swap: "text-swap",
};

/**
 * A stop's time is ink while its stop is lit, open or hovered, as any lit stop's is; at
 * rest it is amber where the stop starts in golden hour, as the axis beside it shows, and
 * muted elsewhere.
 */
export function timeToneOf(isLit: boolean, isGoldenStart: boolean): TimeTone {
  if (isLit) return "ink";
  return isGoldenStart ? "amber" : "muted";
}

interface StartTimeProps {
  time: string;
  width: number;
  tone: TimeTone;
}

/**
 * A stop's start time, on the baseline of its name's first line. It is final once the row is
 * placed, so it shows before the name is written, beside a bead not yet weighed.
 */
export function StartTime({ time, width, tone }: StartTimeProps): ReactNode {
  return (
    <span
      data-start-time={time}
      className={cn(
        "pointer-events-auto absolute left-0 flex items-baseline justify-end type-time transition-colors",
        TIME_TONE_CLASSES[tone],
      )}
      style={{ width }}
    >
      <span aria-hidden className={cn(NAME_CLASSES, "invisible w-0")}>
        {" "}
      </span>
      {time}
    </span>
  );
}

/**
 * One stop as a row: its start time on the name's line, and its words beside the bead it
 * shows, above its wire. The words ride their bead: the anchor glides on the layout spring,
 * and the words sit on whichever side has room. The row moves with its wire at once, so it
 * never trails the chart.
 */
export function StopRow({
  stop,
  start,
  pick,
  drawing,
  layout,
  resting,
  isWeighed,
  isWordsHeld,
  isRewritten,
  isRiding,
  isPenStill,
  isProposed = false,
  isHeld = false,
  isGoneAtOnce = false,
  shown,
  top,
  above,
  wordsWidth,
  wordsLines,
  wordsMask,
  timeWidth,
  sheet,
  light,
  restingLight,
  writing,
  isOpen,
  isLit,
  isGoldenStart,
  isInteractive,
  measuring,
  waiting,
  waitingPlace,
  onMeasure,
  onPenning,
  onToggle,
  onClose,
  onSheetBody,
  onHover,
  isPlacing,
}: StopRowProps) {
  // The day's motion setting: under `reducedMotion="user"` Motion still fades opacity, so an
  // entering row that has its room shows in one step rather than fading in.
  const isReducedMotion = useReducedMotionConfig() ?? false;
  const words = useRef<HTMLDivElement>(null);
  const twin = useRef<HTMLSpanElement>(null);
  const room = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  // Words that waited for their bead are written in by the pen as they come; a row shown as
  // it rests from its first frame shows its name.
  const [isNamePenned, setIsNamePenned] = useState(isWordsHeld);
  if (isWordsHeld && !isNamePenned) setIsNamePenned(true);
  // A stop written again in place is not one whose words waited: it shows its name as the
  // stream writes it. Held from before, the lab's Alicante showed a kind with no name.
  if (isRewritten && isNamePenned) setIsNamePenned(false);
  const detailsId = detailsIdOf(stop.id);
  const ranked = hasEnergy(stop) ? byEnergy(stop).find((rank) => rank.index === pick) : null;
  const version = ranked && hasEnergy(stop) ? versionOf(stop, ranked.place) : null;
  const { density, placement } = layout;
  const wordsX = useWordsX(
    layout.beadX,
    placement.side,
    Math.min(wordsWidth, placement.maxWidth),
    isPlacing,
    isRiding,
  );
  const onPen = useCallback(
    (isPenning: boolean) => onPenning(stop.id, isPenning),
    [stop.id, onPenning],
  );
  const shownWordsWidth = Math.min(wordsWidth, placement.maxWidth);
  // Whether its name says its quarter, decided once for the row on screen and the copies
  // that measure it: a quarter still being written counts as said while its letters could
  // still be the name's, so no copy sets down "São V" that the row holds back.
  const isQuarterInName = isQuarterNamed(
    shown.name,
    shown.neighborhood ?? "",
    isWriting(writing, shown.id, "neighborhood"),
  );

  const measure = useCallback(() => {
    const word = words.current;
    const line = twin.current;
    const copy = room.current;
    if (!word || !line || !copy) return;
    onMeasure(stop.id, {
      natural: line.offsetWidth,
      width: word.offsetWidth,
      height: word.offsetHeight,
      room: copy.offsetHeight,
      lines: lineBoxesOf(word),
    });
  }, [stop.id, onMeasure]);

  // A resize the row did not cause, such as the fonts arriving, is caught by the observer.
  useLayoutEffect(() => {
    const word = words.current;
    const line = twin.current;
    const copy = room.current;
    if (!word || !line || !copy) return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(word);
    observer.observe(line);
    observer.observe(copy);
    return () => observer.disconnect();
  }, [measure, measuring]);

  // Every render is measured before it paints, so a row never shows a frame at a guessed
  // height, and words growing leftwards by a letter never overlap their bead while the
  // observer catches up. An unchanged box is ignored, so this settles at once.
  useLayoutEffect(() => {
    measure();
  });

  // The name holds back the one click it knows is not for it: a phone's, sent after the finger
  // lifts at the point it lifted, ending a press that began elsewhere. A tap on a bead swaps
  // the version and the row's words glide to it, so the name can pass under the finger and
  // that click land on it, opening a sheet nobody asked for (`docs/decisions.md`, "The day is
  // drawn as an abacus": tapping a hollow bead swaps, tapping a name opens the stop). Every other
  // click opens it: a press begun on the name, a key's, and one an
  // assistive technology sends with no press before it. A press that ends in no click, as a
  // drag let go over something else, is forgotten by the next click, a cancel, or in a second.
  const elsewhere = useRef<{ endedAt: number | null } | null>(null);
  useEffect(() => {
    const press = (event: PointerEvent) => {
      const name = button.current;
      const isOnName = name !== null && event.target instanceof Node && name.contains(event.target);
      elsewhere.current = isOnName ? null : { endedAt: null };
    };
    const lift = () => {
      if (elsewhere.current !== null) elsewhere.current = { endedAt: performance.now() };
    };
    const forget = () => {
      elsewhere.current = null;
    };
    const options = { capture: true, passive: true } as const;
    addEventListener("pointerdown", press, options);
    addEventListener("pointerup", lift, options);
    addEventListener("pointercancel", forget, options);
    // Bubbling, so it comes after the name has read it.
    addEventListener("click", forget);
    return () => {
      removeEventListener("pointerdown", press, options);
      removeEventListener("pointerup", lift, options);
      removeEventListener("pointercancel", forget, options);
      removeEventListener("click", forget);
    };
  }, []);
  const toggleFromName = (event: MouseEvent<HTMLButtonElement>) => {
    const press = elsewhere.current;
    const isGhost =
      event.detail !== 0 &&
      press !== null &&
      (press.endedAt === null || performance.now() - press.endedAt < GHOST_CLICK_MS);
    if (!isGhost) onToggle();
  };

  // Escape closes an open stop from its name, and the focus stays there.
  const closeOnEscape = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape" || !isOpen) return;
    event.preventDefault();
    onToggle();
    button.current?.focus();
  };

  return (
    <motion.li
      data-lit={isLit || undefined}
      onKeyDown={closeOnEscape}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      className={cn("absolute inset-x-0 top-0", sheet && "z-10")}
      style={{ y: top }}
      // Unseen while it waits for its room, and unheard: it shows, and is read, once it has it.
      aria-hidden={isHeld || undefined}
      initial={false}
      animate={{ opacity: isHeld ? 0 : 1 }}
      transition={isReducedMotion || (isHeld && isGoneAtOnce) ? { duration: 0 } : SPRINGS.gentle}
    >
      <StartTime
        time={stop.startTime}
        width={timeWidth}
        tone={isProposed ? "swap" : timeToneOf(isLit || isOpen, isGoldenStart)}
      />
      <motion.div className="absolute top-0 left-0" style={{ x: wordsX }}>
        {/* A proposal's row has no sheet: one still rolling up as its row folds away goes. */}
        {!isProposed && (
          <AnimatePresence>
            {/* Drawn once the day has chosen its side, so it unrolls from its words' edge. */}
            {sheet?.side && (
              <WordsSheet
                id={detailsId}
                sheet={sheet}
                side={sheet.side}
                wordsX={wordsX}
                width={sheetWidthOf(sheet, shownWordsWidth, drawing.row)}
                drawing={drawing}
                onClose={onClose}
              />
            )}
          </AnimatePresence>
        )}
        <div
          ref={words}
          className={cn(
            "pointer-events-auto absolute top-0 left-0 transition-colors",
            placement.side === "left" && "justify-end text-right",
            WORDS_CLASSES,
            // Lit, the words sit on the surface's ground; at rest the curve steps back under
            // them instead. Open, they are on the sheet itself, which edges them.
            !sheet && isLit && "bg-surface",
            isWordsHeld && "invisible",
          )}
          style={{ maxWidth: placement.maxWidth + SHOWN_WORDS_SLACK }}
        >
          <button
            ref={button}
            type="button"
            aria-expanded={isOpen}
            aria-controls={isOpen ? detailsId : undefined}
            disabled={!isInteractive}
            onClick={toggleFromName}
            className={cn("rounded-sm focus-ring", WORDS_INNER_CLASSES)}
          >
            <StopWords
              // A version swapped in shows its words whole; only weighing writes them in.
              key={shown.id}
              stop={stop}
              start={start}
              shown={shown}
              version={version}
              writing={writing}
              isQuarterInName={isQuarterInName}
              light={light}
              density={density}
              isPenned
              isNamePenned={isNamePenned}
              isWeighed={isWeighed}
              isAtRest={!isWordsHeld && !isRewritten}
              isStill={isPenStill}
              isProposed={isProposed}
              isSecondLineSaid={!isProposed}
              onPen={onPen}
            />
          </button>
        </div>
      </motion.div>
      {/* The words as they will rest, unseen: on one line, to measure how wide they want to
          be, and wrapped in their resting column, to measure the room the row holds. */}
      {measuring &&
        createPortal(
          <>
            <span
              ref={twin}
              className={cn("absolute top-0 left-0 whitespace-nowrap", WORDS_CLASSES)}
            >
              <StopWords
                stop={stop}
                start={start}
                shown={shown}
                version={version}
                writing={null}
                isQuarterInName={isQuarterInName}
                light={restingLight}
                density={resting.density}
                // The second line is a line of its own, so it is no part of the one-line width.
                isSecondLineSaid={false}
              />
            </span>
            <div
              ref={room}
              className={cn(
                "absolute top-0 left-0",
                resting.placement.side === "left" && "justify-end text-right",
                WORDS_CLASSES,
              )}
              style={{ maxWidth: resting.placement.maxWidth }}
            >
              <span className={WORDS_INNER_CLASSES}>
                <StopWords
                  stop={stop}
                  start={start}
                  shown={shown}
                  version={version}
                  writing={null}
                  isQuarterInName={isQuarterInName}
                  light={restingLight}
                  density={resting.density}
                  isSecondLineSaid={!isProposed}
                />
                {/* While the row is written, before its energy, its room is a line ahead of
                    its words, as the header's are: a name or kind that wraps lands in a line
                    already open, and the next opens, gliding, as it fills. */}
                {shown.name && writtenEnergyOf(shown) === null && (
                  <span className={SPARE_LINE_CLASSES}>{"\u00a0"}</span>
                )}
              </span>
            </div>
            {/* Open, what its sheet would say with each version, to choose the sheet's side. */}
            {sheet && (
              <SheetCopies
                stopId={stop.id}
                versions={sheet.versions}
                shownId={sheet.shown.id}
                width={sheetWidthOf(sheet, shownWordsWidth, drawing.row)}
                onBody={onSheetBody}
              />
            )}
          </>,
          measuring,
        )}
      {waiting && (
        <div className="absolute inset-x-0 top-0" style={{ height: above }}>
          <ListWaiting waiting={waiting} place={waitingPlace} />
        </div>
      )}
      {/* Its lines of words, in the chart, where they are this frame: the curve under them
          steps back. An open stop's sheet covers its own. */}
      {wordsMask &&
        !sheet &&
        createPortal(
          <motion.g style={{ x: wordsX, y: top }}>
            {wordsLines.map((line, index) => (
              <rect
                key={index}
                x={line.x - drawing.row.lineMaskPad}
                y={line.y - drawing.row.lineMaskPadY}
                width={line.width + 2 * drawing.row.lineMaskPad}
                height={line.height + 2 * drawing.row.lineMaskPadY}
                rx={drawing.row.lineMaskRadius}
              />
            ))}
          </motion.g>,
          wordsMask,
        )}
    </motion.li>
  );
}

/**
 * How long after a press elsewhere is let go its click can still land on a name: a phone sends
 * it at once, so by a second it has come or never will.
 */
const GHOST_CLICK_MS = 1000;
