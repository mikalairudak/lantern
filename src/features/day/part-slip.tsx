"use client";

import { AnimatePresence, motion, useReducedMotionConfig } from "motion/react";
import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { cn } from "@/components/ui/cn";
import { GlidingHeight } from "@/components/ui/gliding-height";
import { PennedText } from "@/components/ui/penned-text";
import type { StopDraft } from "@/features/abacus/day-draft";
import { useDrawing } from "@/features/abacus/drawing";
import {
  ACTION_CLASSES,
  ANSWER_CLASSES,
  ASK_AGAIN_CLASSES,
  AnswerBead,
  FORK_CONTROL_ATTRIBUTE,
  FORK_ROW_ATTRIBUTE,
  ForkStatus,
  LIT_ANSWER_CLASSES,
  LIT_LINE_CLASSES,
  READY_CLASSES,
} from "@/features/abacus/fork-row";
import { HAIRLINE, PROPOSED_WIRE_DASH } from "@/features/abacus/geometry";
import type { WorkLine, WorkReach } from "@/features/abacus/work-line";
import { ROW_REACH_PX, SPRINGS } from "@/lib/tokens/motion";
import { heldLinesOf, SEPARATOR, slipFootOf, slipLinesOf, type SlipLine } from "./part-slip-lines";
import { useEntryPen } from "./reading-list";
import type { ForkSide } from "./replan-controls";
import type { ForkView } from "./replan-work";

/**
 * A part's fork on the plan, drawn as a slip: the fork line over the part, the version on
 * screen's answer, and beside it the other version of the part as a short itinerary, one line a
 * stop, time and name, in the versions' blue on the versions' dashed wire, headed by its answer
 * and "Take". The plan's rows stay the day's alone; the slip is the comparison, open while the
 * fork stands. In the column it stands under the fork line, at the head of its part; in the
 * margin, out of flow beside the plan, so the plan gains only the fork line.
 */

/** Marks a slip, so what holds room for it, or measures it, finds it. */
export const SLIP_ATTRIBUTE = "data-slip";

/** Where the slip stands: under the fork line, or out of flow in the margin right of the plan. */
export type SlipPlacement = "column" | "margin";

/**
 * Every word of the fork is a note's size, as a row's second line is. Its hairline goes at the
 * list's first row, as the fork row's does. It sets no position of its own: the slip in the
 * margin stands from the plan's row it heads (`ReadingList`), outside the fold that opens the
 * fork line's room, which would cut it.
 */
const FORK_CLASSES = "border-t border-line pt-3 pb-3 type-note group-first:border-t-0";

/** The gutter, the rail's room and the words, as the plan's row lays them out. */
const LINE_ROW_CLASSES = "flex gap-3";
/** "1 of 2" in the plan's time gutter, right-aligned as a stop's time. */
const COUNT_CLASSES =
  "flex min-h-6 w-12 shrink-0 items-center justify-end self-start text-muted tabular-nums";
/** The rail's room between the gutter and the words. */
const RAIL_ROOM_CLASSES = "w-2 shrink-0";

/**
 * The slip's answer: the fork row's pill without its pull to the bead's column, so its edge
 * stands on the slip's wire.
 */
const SLIP_PILL_CLASSES = "rounded-full px-2";

/** In the margin: out of flow at the top of the row it heads, the fork's hairline carried over it. */
const MARGIN_CLASSES =
  "absolute -top-px left-full w-margin border-t border-line pt-3 pl-4 group-first:border-t-0";

/** The slip's body on its wire: the receipt or the work line, its lines, its foot. */
const BODY_CLASSES = "relative mt-1.5 pl-3";
const LINES_CLASSES = "mt-1.5 flex flex-col gap-1";
const LINE_CLASSES = "flex gap-2";
/** A line's time: wide enough for "23:45", in figures of one width. */
const TIME_CLASSES = "w-10 shrink-0 tabular-nums";

/** A line's room held unseen, and a word tied to the next: a space no line breaks at. */
const NO_BREAK = "\u00a0";

/**
 * How a moved line names the hour the day on screen gives that place, by whose version the slip
 * lists: the proposal's lines say what the hour was; once it is taken, the day before's lines say
 * what it is now, "now at 01:30". The words and their hour never part at a line's end.
 */
export const MOVED_WORDS: Readonly<Record<ForkSide, string>> = {
  to: "was",
  from: `now${NO_BREAK}at`,
};

/** How far faded in a milestone's words come in, so a change of words reads as one. */
const NOTE_COMES_FROM = 0.3;

export interface PartSlipProps {
  view: ForkView;
  /** The part's stops in the version the day shows, whose hours the slip would take. */
  shown: readonly StopDraft[];
  /**
   * The part's stops in the other version, as far as the stream has finished them: a stop is
   * drawn once its time, name and kind are final and the merge's rule has kept it.
   */
  other: readonly StopDraft[];
  /**
   * Where the part opens on the day's running clock, the end of the stop the day keeps before
   * it (`ReplanWindow.opens`), so its hours run on past midnight; null where it starts the day.
   */
  opens: number | null;
  /** Which part this is, from 0, and how many the fork has: "1 of 2" where more than one. */
  index: number;
  count: number;
  /** A part of the day, or the whole day written again. */
  reach: WorkReach;
  placement: SlipPlacement;
  onChoose: (side: ForkSide) => void;
  onAskAgain: () => void;
}

/** A part's fork on the plan: its fork line, and the other version beside it as a slip. */
export function PartSlip({
  view,
  shown,
  other,
  opens,
  index,
  count,
  reach,
  placement,
  onChoose,
  onAskAgain,
}: PartSlipProps) {
  const group = useRef<HTMLDivElement>(null);
  useFocusOnChecked(group, view.chosen);
  // An ending without a proposal is said once, at the fork's first part.
  if (view.isFailed && index > 0) return null;
  const isOtherEnabled = !view.isWriting && !view.isFailed;
  const otherSide: ForkSide = view.chosen === "to" ? "from" : "to";
  const choose = (side: ForkSide) => {
    if (side === otherSide && !isOtherEnabled) return;
    onChoose(side);
  };
  // Arrows take the other answer, as a radio group does; the focus follows the checked one.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const isArrow = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key);
    if (!isArrow || !isOtherEnabled) return;
    event.preventDefault();
    choose(otherSide);
  };
  const label = `${view.from} or ${view.to}`;
  const isCounted = count > 1;
  const slip = !view.isFailed && (
    <Slip
      view={view}
      shown={shown}
      other={other}
      opens={opens}
      isFirst={index === 0}
      reach={reach}
      isInColumn={placement === "column"}
      side={otherSide}
      onChoose={choose}
    />
  );
  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label={isCounted ? `${label}, ${index + 1} of ${count}` : label}
      onKeyDown={onKeyDown}
      {...{ [FORK_ROW_ATTRIBUTE]: index }}
      className={FORK_CLASSES}
    >
      <GlidingHeight reachPx={ROW_REACH_PX} shouldAlwaysReach isClippedWhileGliding>
        <div className={LINE_ROW_CLASSES}>
          {/* Said in the group's name; drawn here for the eye alone. */}
          <span aria-hidden className={COUNT_CLASSES}>
            {isCounted && `${index + 1} of ${count}`}
          </span>
          <span aria-hidden className={RAIL_ROOM_CLASSES} />
          <div className="min-w-0 grow">
            <ShownAnswer view={view} onChoose={choose} />
            {view.isFailed && <Ending view={view} onAskAgain={onAskAgain} />}
            {placement === "column" && <SlipPresence>{slip}</SlipPresence>}
          </div>
        </div>
      </GlidingHeight>
      {placement === "margin" && (
        <SlipPresence>{slip && <div className={MARGIN_CLASSES}>{slip}</div>}</SlipPresence>
      )}
      {index === 0 && <ForkStatus view={view} />}
    </div>
  );
}

/**
 * Keeps the keys' focus on the checked answer as the choice flips. The two answers keep their
 * places, the fork line's and the slip's, and swap sides as a version is taken, so a focus left
 * where it was would stand on the answer no longer checked, out of the tab order. Moved only
 * from an unchecked answer of this group, so a focus elsewhere on the page stays where it is.
 */
function useFocusOnChecked(group: RefObject<HTMLDivElement | null>, chosen: ForkSide): void {
  useLayoutEffect(() => {
    const element = group.current;
    const active = document.activeElement;
    if (!element || !(active instanceof HTMLElement) || !element.contains(active)) return;
    if (active.getAttribute("role") !== "radio" || active.getAttribute("aria-checked") === "true") {
      return;
    }
    element
      .querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')
      ?.focus({ preventScroll: true });
  }, [group, chosen]);
}

/**
 * The slip while the fork stands: an ending without a proposal fades its lines as one piece,
 * and the room they held is given back by the glide around them.
 */
function SlipPresence({ children }: { children: ReactNode }) {
  const isReducedMotion = useReducedMotionConfig() ?? false;
  return (
    <AnimatePresence initial={false}>
      {children && (
        <motion.div
          key="slip"
          exit={{ opacity: 0 }}
          transition={isReducedMotion ? { duration: 0 } : SPRINGS.brisk}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface ShownAnswerProps {
  view: ForkView;
  onChoose: (side: ForkSide) => void;
}

/** The fork line's answer: the version on screen, its bead filled in ink. A press keeps it. */
function ShownAnswer({ view, onChoose }: ShownAnswerProps) {
  const drawing = useDrawing();
  const side = view.chosen;
  const label = side === "to" ? view.to : view.from;
  return (
    <button
      type="button"
      role="radio"
      {...{ [FORK_CONTROL_ATTRIBUTE]: side }}
      aria-checked
      aria-label={`${label}, your day`}
      // The checked answer is the group's stop in the tab order, which the sentence's pointer
      // finds by it.
      tabIndex={0}
      onClick={() => onChoose(side)}
      className={ANSWER_CLASSES}
    >
      <AnswerBead isFilled isDashed={false} drawing={drawing} />
      <span className="whitespace-nowrap text-ink">{label}</span>
    </button>
  );
}

/** Why the fork ended without a proposal, under the answer, with "Ask again" where it may mend. */
function Ending({ view, onAskAgain }: { view: ForkView; onAskAgain: () => void }) {
  return (
    <p className="mt-0.5 text-muted">
      {view.line?.words}
      {view.canAskAgain && (
        <>
          <span>{SEPARATOR}</span>
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
  );
}

interface SlipProps {
  view: ForkView;
  shown: readonly StopDraft[];
  other: readonly StopDraft[];
  opens: number | null;
  /** The fork's first part, which says the work line or the receipt. */
  isFirst: boolean;
  reach: WorkReach;
  /**
   * Stands in the column, under the fork line, where it holds a line a stop from the press for
   * the lines to come, and a line that wraps takes the rest by a glide; the margin holds none,
   * since nothing there moves the plan.
   */
  isInColumn: boolean;
  /** The other version's answer. */
  side: ForkSide;
  onChoose: (side: ForkSide) => void;
}

/** The other version of the part: its answer, then on its wire its note, lines and foot. */
function Slip({
  view,
  shown,
  other,
  opens,
  isFirst,
  reach,
  isInColumn,
  side,
  onChoose,
}: SlipProps) {
  const lines = slipLinesOf(shown, other, opens);
  // Lines on the slip when it is first drawn stand whole; those that arrive after are penned.
  const [firstIds] = useState(() => new Set(lines.map(({ id }) => id)));
  const foot = view.isWriting ? null : slipFootOf(shown, other, reach, opens);
  const held = view.isWriting && isInColumn ? heldLinesOf(shown.length, reach) - lines.length : 0;
  // The work line, then the receipt, is said once, in the fork's first part; the work line holds
  // its line there from the press in the column. A receipt with nothing to say takes no line.
  const isLineHeld = view.isWriting && isInColumn;
  const end = view.isWriting ? null : view.end;
  const isNoteSaid = isFirst && ((view.line?.words ?? "") !== "" || end !== null || isLineHeld);
  return (
    <div {...{ [SLIP_ATTRIBUTE]: "" }} className={cn(isInColumn && "mt-2")}>
      <SlipAnswer view={view} side={side} onChoose={onChoose} />
      <div className={BODY_CLASSES}>
        <Wire />
        {isNoteSaid && <SlipNote line={view.line} end={end} isLineHeld={isLineHeld} />}
        {(lines.length > 0 || held > 0) && (
          <ol className={LINES_CLASSES}>
            {lines.map((line) => (
              <SlipLineItem
                key={line.id}
                line={line}
                movedWord={MOVED_WORDS[side]}
                isPenned={!firstIds.has(line.id)}
              />
            ))}
            {Array.from({ length: Math.max(0, held) }, (_, at) => (
              // A line's room, unseen, until a stop arrives to fill it.
              <li key={`held-${at}`} aria-hidden className="invisible">
                {NO_BREAK}
              </li>
            ))}
          </ol>
        )}
        {foot !== null && <p className="mt-1.5 text-muted">{foot}</p>}
      </div>
    </div>
  );
}

interface SlipAnswerProps {
  view: ForkView;
  side: ForkSide;
  onChoose: (side: ForkSide) => void;
}

/**
 * The other version's answer at the slip's head: its bead hollow in the versions' blue, dashed
 * while it is written, its words lit then, and "Take" once it can be taken. The ring stands
 * while the fork waits on the visitor, through a take too; once they keep their own day it
 * goes. It keeps its place, shape and word whichever version is the day.
 */
function SlipAnswer({ view, side, onChoose }: SlipAnswerProps) {
  const drawing = useDrawing();
  const label = side === "to" ? view.to : view.from;
  const isWriting = view.isWriting;
  const isRinged = view.isReady || view.chosen === "to";
  const description = isWriting ? "being written" : side === "to" ? "proposed" : "the day before";
  return (
    <button
      type="button"
      role="radio"
      {...{ [FORK_CONTROL_ATTRIBUTE]: side }}
      aria-checked={false}
      aria-disabled={isWriting || undefined}
      aria-label={`${label}, ${description}`}
      tabIndex={-1}
      onClick={() => onChoose(side)}
      className={cn(
        ANSWER_CLASSES,
        SLIP_PILL_CLASSES,
        isRinged && !isWriting && READY_CLASSES,
        isWriting && "cursor-default",
      )}
    >
      <AnswerBead isFilled={false} isDashed={isWriting} drawing={drawing} />
      <span className={cn("whitespace-nowrap text-swap", isWriting && LIT_ANSWER_CLASSES)}>
        {label}
      </span>
      {/* "Take" is the answer's own words, one control with it; its room is held unseen while
          the version is written. */}
      <span aria-hidden className={cn(isWriting && "invisible")}>
        <span className="text-muted">· </span>
        <span className="text-ink underline decoration-1 underline-offset-4">Take</span>
      </span>
    </button>
  );
}

/** The slip's wire: an upright line dashed in the versions' blue, as the chart draws a proposal's. */
function Wire() {
  const dash = HAIRLINE * PROPOSED_WIRE_DASH;
  return (
    <svg aria-hidden width={HAIRLINE} className="absolute inset-y-0 left-0 h-full overflow-visible">
      <line
        x1={HAIRLINE / 2}
        x2={HAIRLINE / 2}
        y1="0"
        y2="100%"
        strokeWidth={HAIRLINE}
        strokeDasharray={`${dash} ${dash}`}
        className="stroke-swap-drawn"
      />
    </svg>
  );
}

/**
 * The note under the slip's answer, said in the first part's slip alone: while the version is
 * written, what Lantern is doing, lit; once whole, what it would change against the day on
 * screen, and where the day's end moves. Its words come in whole at each milestone.
 */
function SlipNote({
  line,
  end,
  isLineHeld,
}: {
  line: WorkLine | null;
  end: string | null;
  /** The work line holds its line before its words come, so nothing below moves when they do. */
  isLineHeld: boolean;
}) {
  const isReducedMotion = useReducedMotionConfig() ?? false;
  const comeIn = {
    initial: { opacity: NOTE_COMES_FROM },
    animate: { opacity: 1 },
    transition: isReducedMotion ? { duration: 0 } : SPRINGS.snappy,
  };
  const words = line?.words ?? "";
  return (
    <div className="text-ink-soft">
      {(words !== "" || isLineHeld) && (
        <p className="min-h-5">
          {words !== "" && (
            <motion.span
              key={words}
              {...comeIn}
              className={cn(line?.isWorking && LIT_LINE_CLASSES)}
            >
              {words}
            </motion.span>
          )}
          {words !== "" && line?.count != null && (
            <>
              <span>{SEPARATOR}</span>
              <motion.span key={line.count} {...comeIn} className="tabular-nums">
                {line.count}
              </motion.span>
            </>
          )}
        </p>
      )}
      {end !== null && <p>{end}</p>}
    </div>
  );
}

interface SlipLineItemProps {
  line: SlipLine;
  /** How a moved line names the hour the day on screen gives it (`MOVED_WORDS`). */
  movedWord: string;
  isPenned: boolean;
}

/** One stop of the other version: its time, then its name and what it is, or how it stands. */
function SlipLineItem({ line, movedWord, isPenned }: SlipLineItemProps) {
  const { time, name, mark } = line;
  const isNew = mark.kind === "new";
  const tail =
    mark.kind === "new"
      ? mark.what
      : mark.kind === "stays"
        ? "stays"
        : `${movedWord}${NO_BREAK}${mark.hour}`;
  const after = `${SEPARATOR}${tail}`;
  // One pen through the line, in the order it reads, as a row's words are written in.
  const written = useEntryPen(time.length + name.length + after.length, isPenned);
  const afterTime = written - time.length;
  const afterName = afterTime - name.length;
  return (
    <li className={LINE_CLASSES}>
      <span className={cn(TIME_CLASSES, isNew ? "text-swap" : "text-muted")}>
        <PennedText text={time} written={written} isActive={false} />
      </span>
      <span className="min-w-0">
        <span className={isNew ? "text-swap" : "text-ink-soft"}>
          <PennedText text={name} written={afterTime} isActive={false} />
        </span>
        <span className="text-muted">
          <PennedText text={after} written={afterName} isActive={false} />
        </span>
      </span>
    </li>
  );
}
