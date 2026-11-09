"use client";

import { motion, useReducedMotionConfig } from "motion/react";
import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { SPRINGS } from "@/lib/tokens/motion";
import type { ForkSide } from "@/features/day/replan-controls";
import type { ForkView } from "@/features/day/replan-work";
import type { Drawing } from "./rows";
import type { WorkLine } from "./work-line";

/**
 * A fork row (`docs/decisions.md`, "A changed word proposes its part beside the day, and the
 * visitor takes it"): over each part a changed word rewrites, the two answers as a group of two
 * radio buttons, the visitor's before and the proposal's, and under them what Lantern is doing,
 * what the proposal would change, or why it failed. Its room is held from the press, so the day
 * makes way for it once.
 */

/** Marks each fork row by its place among the fork's rows, as the sentence's pointer finds the first. */
export const FORK_ROW_ATTRIBUTE = "data-fork-row";

/**
 * Marks a fork row's line where it stands apart from its row, in the margin right of the chart
 * on a laptop, by the row's part, so what the row says is found with it.
 */
export const FORK_LINE_ATTRIBUTE = "data-fork-line";

/**
 * Marks each of a fork row's controls by what it does, an answer by its side, so the focus can
 * be given back to the same control where the row is drawn anew.
 */
export const FORK_CONTROL_ATTRIBUTE = "data-fork-control";

/** Every word of the row is a note's size, as the scale's band and a row's second line are. */
const ROW_CLASSES = "type-note";

/** One line of the answers, a pointer target tall. */
const ANSWERS_CLASSES = "flex min-h-6 flex-wrap items-center gap-x-3";

/** An answer: its bead, then its words, the whole a 24 px target. */
const ANSWER_CLASSES =
  "pointer-events-auto inline-flex min-h-6 items-center gap-2 rounded-sm bg-ground transition-colors focus-ring";

/**
 * The proposal's answer while it is written and once whole: the room of the pill "Take" stands
 * in, so the answers wrap on a narrow phone, if they do, from the press, and the row's room
 * never changes as the proposal becomes whole.
 */
const PILL_CLASSES = "rounded-full px-2 -ml-2";

/**
 * The proposal once whole: its answer and "Take" in one hairline box with the theme's least
 * rounding, the versions' ring, so the tap that takes it reads as one control. The ring is drawn
 * inside, so it moves nothing.
 */
const READY_CLASSES = "ring-1 ring-inset ring-swap-drawn";

/**
 * "Ask again" in the line under the answers: a 24 px target that stands over the line's 20 px
 * by half its excess each way, so a failed row is as tall as any other.
 */
const ASK_AGAIN_CLASSES = "-my-0.5";

/** "Take", "Compare" and "Ask again", in the shared link's look, ink on the row's quiet words. */
const ACTION_CLASSES =
  "pointer-events-auto inline-flex min-h-6 items-center rounded-sm text-ink underline decoration-1 underline-offset-4 transition-colors hover:text-energy focus-ring";

/**
 * The steady light through the proposal's answer and its line while Lantern writes, as through
 * a word whose day is on its way: an amber band passing about every second through words in
 * their own colour, the answer's blue or the line's ink. With reduced motion they stand in it.
 */
const LIT_CLASSES =
  "motion-safe:bg-linear-90 motion-safe:from-transparent motion-safe:via-amber motion-safe:to-transparent motion-safe:bg-fixed motion-safe:bg-size-pass motion-safe:bg-no-repeat motion-safe:bg-clip-text motion-safe:text-transparent motion-safe:animate-pass-steady";
const LIT_ANSWER_CLASSES = cn("motion-safe:bg-swap", LIT_CLASSES);
const LIT_LINE_CLASSES = cn("motion-safe:bg-ink-soft", LIT_CLASSES);

/**
 * The line under the answers: the quiet ink, a step up while Lantern works. Its words stand on
 * the ground, so the curves passing under the row step back from them as from a row's words.
 */
const LINE_CLASSES = "min-h-5 w-fit max-w-full bg-ground text-muted";

/** How far faded in a milestone's words come in, so a change of words reads as one. */
const LINE_COMES_FROM = 0.3;

export interface ForkRowProps {
  view: ForkView;
  /** Which of the fork's rows this is, from 0, and how many there are: "1 of 2" where two. */
  index: number;
  count: number;
  /** The time column's width, where "1 of 2" stands, right-aligned as a stop's time does. */
  timeWidth: number;
  /** Where the answers start, from the chart's left: the rows' words' own edge. */
  wordsLeft: number;
  /** The pixels the day is drawn at, for the answers' beads. */
  drawing: Drawing;
  /**
   * Where the line under the answers stands: under them, the room held for it, or in the margin
   * right of the chart, on a laptop, where the row holds a line of room alone.
   */
  lineAt: "under" | "margin";
  /**
   * The line under the answers shows: once the rows under the fork row have made its room, so it
   * never stands over their words. Until then it holds its room unseen.
   */
  isLineSeen?: boolean;
  onChoose: (side: ForkSide) => void;
  onCompare: () => void;
  onAskAgain: () => void;
  /** Told the row's height as laid out, the room the day holds over its part. */
  onMeasure?: (height: number) => void;
}

/** The fork's row over one part of the day. */
export function ForkRow({
  view,
  index,
  count,
  timeWidth,
  wordsLeft,
  drawing,
  lineAt,
  isLineSeen = true,
  onChoose,
  onCompare,
  onAskAgain,
  onMeasure,
}: ForkRowProps) {
  const box = useRef<HTMLDivElement>(null);
  const radios = useRef<Partial<Record<ForkSide, HTMLButtonElement | null>>>({});
  useLayoutEffect(() => {
    const element = box.current;
    if (!element || !onMeasure) return undefined;
    onMeasure(element.offsetHeight);
    const observer = new ResizeObserver(() => onMeasure(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, [onMeasure]);
  const isToShown = !view.isFailed;
  const isToEnabled = !view.isWriting && !view.isFailed;
  const choose = (side: ForkSide) => {
    if (side === "to" && !isToEnabled) return;
    onChoose(side);
  };
  // Arrows move between the two answers and take the one they land on, as a radio group does.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const isArrow = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key);
    if (!isArrow || !isToEnabled) return;
    event.preventDefault();
    const next: ForkSide = view.chosen === "from" ? "to" : "from";
    choose(next);
    radios.current[next]?.focus();
  };
  // The folded row, a version chosen, says no line unless the other is compared.
  const isLineHeld = !view.isChosen || view.isCompared;
  const label = `${view.from} or ${view.to}`;
  return (
    <div
      ref={box}
      {...{ [FORK_ROW_ATTRIBUTE]: index }}
      className={cn("relative", ROW_CLASSES)}
      style={{ paddingLeft: wordsLeft }}
    >
      {count > 1 && (
        <span
          className="absolute top-0 left-0 flex min-h-6 items-center justify-end text-muted tabular-nums"
          style={{ width: timeWidth }}
        >
          {index + 1} of {count}
        </span>
      )}
      <div
        role="radiogroup"
        aria-label={count > 1 ? `${label}, ${index + 1} of ${count}` : label}
        onKeyDown={onKeyDown}
        className={ANSWERS_CLASSES}
      >
        <Answer
          ref={(button) => {
            radios.current.from = button;
          }}
          side="from"
          label={view.from}
          isChecked={view.chosen === "from"}
          isTakeable={view.chosen !== "from"}
          description={view.chosen === "from" ? "your day" : "the day before"}
          drawing={drawing}
          onChoose={choose}
        />
        {isToShown && (
          <Answer
            ref={(button) => {
              radios.current.to = button;
            }}
            side="to"
            label={view.to}
            isChecked={view.chosen === "to"}
            isTakeable={view.chosen !== "to" && isToEnabled}
            isWriting={view.isWriting}
            isReady={view.isReady}
            description={
              view.chosen === "to" ? "your day" : view.isWriting ? "being written" : "proposed"
            }
            drawing={drawing}
            onChoose={choose}
          />
        )}
        {view.isComparable && (
          <button
            type="button"
            {...{ [FORK_CONTROL_ATTRIBUTE]: "compare" }}
            aria-pressed={view.isCompared}
            onClick={onCompare}
            className={cn(ACTION_CLASSES, "text-ink-soft")}
          >
            Compare
          </button>
        )}
      </div>
      {isLineHeld && lineAt === "under" && (
        <ForkLine view={view} onAskAgain={onAskAgain} isRoomHeld isSeen={isLineSeen} />
      )}
      {index === 0 && <ForkStatus view={view} />}
    </div>
  );
}

interface AnswerProps {
  ref: (button: HTMLButtonElement | null) => void;
  side: ForkSide;
  label: string;
  /** Its version is the day on screen. */
  isChecked: boolean;
  /** A press takes its version: whole, and not the day. */
  isTakeable: boolean;
  /** The proposal is being written: its ring dashed and its words lit. */
  isWriting?: boolean;
  /** The proposal is whole and not yet chosen: "Take" stands in its pill. */
  isReady?: boolean;
  /** What a screen reader hears after the answer: "your day", "proposed". */
  description: string;
  drawing: Drawing;
  onChoose: (side: ForkSide) => void;
}

/**
 * One answer as a radio button: a bead, filled in ink where its version is the day, hollow in
 * the versions' blue where it can be taken, dashed while it is written, and its words.
 */
function Answer({
  ref,
  side,
  label,
  isChecked,
  isTakeable,
  isWriting = false,
  isReady = false,
  description,
  drawing,
  onChoose,
}: AnswerProps) {
  const isBlue = !isChecked;
  return (
    <button
      ref={ref}
      type="button"
      role="radio"
      {...{ [FORK_CONTROL_ATTRIBUTE]: side }}
      aria-checked={isChecked}
      aria-disabled={(!isChecked && !isTakeable) || undefined}
      aria-label={`${label}, ${description}`}
      tabIndex={isChecked ? 0 : -1}
      onClick={() => onChoose(side)}
      className={cn(
        ANSWER_CLASSES,
        (isReady || isWriting) && PILL_CLASSES,
        isReady && READY_CLASSES,
        !isTakeable && "cursor-default",
      )}
    >
      <AnswerBead isFilled={isChecked} isDashed={isWriting} drawing={drawing} />
      <span
        className={cn(
          isBlue ? "text-swap" : "text-ink",
          isWriting && LIT_ANSWER_CLASSES,
          "type-note whitespace-nowrap",
        )}
      >
        {label}
      </span>
      {(isReady || isWriting) && (
        // "Take" is the answer's own words, one control with it, as the decision has it; its
        // room is held unseen while the proposal is written.
        <span aria-hidden className={cn(!isReady && "invisible")}>
          <span className="text-muted">· </span>
          <span className="text-ink underline decoration-1 underline-offset-4">Take</span>
        </span>
      )}
    </button>
  );
}

interface AnswerBeadProps {
  isFilled: boolean;
  isDashed: boolean;
  drawing: Drawing;
}

/** An answer's bead, drawn as the chart's beads are: the day's filled, a version's ringed. */
function AnswerBead({ isFilled, isDashed, drawing }: AnswerBeadProps) {
  const { beadRadius, ringStroke } = drawing.chart;
  const size = 2 * (beadRadius + ringStroke);
  return (
    <svg aria-hidden width={size} height={size} className="shrink-0 overflow-visible">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={beadRadius}
        strokeWidth={ringStroke}
        strokeDasharray={isDashed ? `${ringStroke} ${ringStroke}` : undefined}
        className={cn(
          "transition-colors",
          isFilled ? "fill-ink stroke-ink" : "fill-ground stroke-swap-drawn",
        )}
      />
    </svg>
  );
}

interface ForkLineProps {
  view: ForkView;
  onAskAgain: () => void;
  /**
   * The line holds the room of its two lines whatever it says, so the row never changes height
   * while the proposal is written and once it is whole.
   */
  isRoomHeld?: boolean;
  /** Shown, or holding its room unseen while the rows under it make that room. */
  isSeen?: boolean;
}

/**
 * The line under a fork's answers: what Lantern is doing, the proposal's receipt and where the
 * day's end moves, or why it failed, with "Ask again" where another try might mend it. Its words
 * come in whole at each milestone, from most of the way faded in; between them only the count
 * changes.
 */
export function ForkLine({ view, onAskAgain, isRoomHeld = false, isSeen = true }: ForkLineProps) {
  const { line } = view;
  const isReducedMotion = useReducedMotionConfig() ?? false;
  return (
    <motion.div
      className="mt-0.5"
      initial={false}
      animate={{ opacity: isSeen ? 1 : 0 }}
      transition={isReducedMotion ? { duration: 0 } : SPRINGS.snappy}
    >
      <p className={LINE_CLASSES}>
        {line !== null && line.words !== "" ? <LineWords line={line} /> : isRoomHeld && " "}
        {view.canAskAgain && (
          <>
            <span className="text-muted"> · </span>
            <button
              type="button"
              {...{ [FORK_CONTROL_ATTRIBUTE]: "ask-again" }}
              onClick={onAskAgain}
              className={cn(ACTION_CLASSES, ASK_AGAIN_CLASSES)}
            >
              Ask again
            </button>
          </>
        )}
      </p>
      {(isRoomHeld || view.end !== null) && (
        <p className={LINE_CLASSES}>{view.end ?? (isRoomHeld ? " " : null)}</p>
      )}
    </motion.div>
  );
}

/** A line's words and count, each coming in whole as it changes. */
function LineWords({ line }: { line: WorkLine }): ReactNode {
  const isReducedMotion = useReducedMotionConfig() ?? false;
  const comeIn = {
    initial: { opacity: LINE_COMES_FROM },
    animate: { opacity: 1 },
    transition: isReducedMotion ? { duration: 0 } : SPRINGS.snappy,
  };
  return (
    <>
      <motion.span
        key={line.words}
        {...comeIn}
        className={cn("text-ink-soft", line.isWorking && LIT_LINE_CLASSES)}
      >
        {line.words}
      </motion.span>
      {line.count !== null && (
        <>
          <span> · </span>
          <motion.span key={line.count} {...comeIn} className="text-ink-soft tabular-nums">
            {line.count}
          </motion.span>
        </>
      )}
    </>
  );
}

/**
 * What a screen reader hears of the fork once, from a live region on its first row: that the
 * proposal is ready and what it would change, or why it failed. Nothing while it is written,
 * nor once a version is chosen.
 */
function ForkStatus({ view }: { view: ForkView }) {
  const said = view.isReady
    ? `${view.to} is ready beside your day: ${view.line?.words ?? ""}`
    : view.isFailed
      ? (view.line?.words ?? "")
      : "";
  return (
    <p role="status" className="sr-only">
      {said}
    </p>
  );
}
