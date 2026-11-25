"use client";

import { AnimatePresence, motion, useIsPresent, useReducedMotionConfig } from "motion/react";
import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
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
  answerStateOf,
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
import { DOUBLE_PRESS_MS } from "./plan-fork";
import { BESIDE_ATTRIBUTE, useEntryPen } from "./reading-list";
import type { ForkSide } from "./replan-controls";
import type { ForkView } from "./replan-work";

/**
 * A part's fork on the plan, drawn as a slip: the fork line over the part, the version on
 * screen's answer, and beside it the other version of the part as a short itinerary, one line a
 * stop, time and name, in the versions' blue on the versions' dashed wire, headed by its answer
 * and "Take". The plan's rows stay the day's alone; the slip is the comparison, open while the
 * fork stands. In the column it stands under the fork line, at the head of its part; in the
 * margin, out of flow beside the plan, so the plan gains the fork line, and after the part's
 * last row only the room the slip takes beyond the part (`ReadingList`).
 */

/** Marks a slip, so what holds room for it, or measures it, finds it. */
export const SLIP_ATTRIBUTE = "data-slip";

/** Where the slip stands: under the fork line, or out of flow in the margin right of the plan. */
export type SlipPlacement = "column" | "margin";

/**
 * Every word of the fork is a note's size, as a row's second line is. Its hairline goes at the
 * list's first row, as the fork row's does. It sets no position of its own: the slip in the
 * margin stands from its head's own item of the plan's list (`ReadingList`), outside the fold
 * that opens the fork line's room, which would cut it.
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
const SLIP_PILL_CLASSES = "px-2";

/** In the margin: out of flow at the top of its head's item, the fork's hairline carried over it. */
const MARGIN_CLASSES =
  "absolute top-0 left-full w-margin border-t border-line pt-3 pl-4 group-first:border-t-0";

/** The slip's body on its wire: the receipt or the work line, its lines, its foot. */
const BODY_CLASSES = "relative mt-1.5 pl-3";
const LINES_CLASSES = "mt-1.5 flex flex-col gap-1";
const LINE_CLASSES = "flex gap-2";
/** A line's time: wide enough for "23:45", in figures of one width. */
const TIME_CLASSES = "w-10 shrink-0 tabular-nums";

/** A word tied to the next: a space no line breaks at. */
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

/** Where a control stands in the fork: its part, and the fork line's answer or the slip's. */
type ControlPlace = `${number}:${"line" | "slip"}`;

/**
 * When each of the fork's controls was last pressed, on the clock its events carry, by its
 * place: the page keeps one for all its slips, so a slip drawn anew, as a whole day taken is as
 * a run of its own, knows a press made on the one before it.
 */
export type ForkPresses = Map<ControlPlace, number>;

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
  /** The page's record of presses (`ForkPresses`); left out, the slip keeps its own. */
  presses?: ForkPresses;
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
  presses,
}: PartSlipProps) {
  const group = useRef<HTMLDivElement>(null);
  const ownPresses = useRef<ForkPresses>(new Map());
  useFocusOnChecked(group, view.chosen);
  // An ending without a proposal is said once, at the fork's first part.
  if (view.isFailed && index > 0) return null;
  const isOtherEnabled = !view.isWriting && !view.isFailed;
  const otherSide: ForkSide = view.chosen === "to" ? "from" : "to";
  /** Chooses an answer, unless its version cannot be taken yet; whether it was chosen. */
  const choose = (side: ForkSide): boolean => {
    if (side === otherSide && !isOtherEnabled) return false;
    onChoose(side);
    return true;
  };
  /**
   * A press on a control: the second of a double press on it does nothing. Only a press that
   * chose is remembered, so one on a version still being written takes nothing from the next.
   */
  const press = (side: ForkSide, at: "line" | "slip", event: MouseEvent<HTMLButtonElement>) => {
    const pressed = presses ?? ownPresses.current;
    const place: ControlPlace = `${index}:${at}`;
    const last = pressed.get(place);
    if (last !== undefined && event.timeStamp - last < DOUBLE_PRESS_MS) return;
    if (choose(side)) pressed.set(place, event.timeStamp);
  };
  // Arrows take the other answer, as a radio group does; the focus follows the checked one.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const isArrow = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key);
    if (!isArrow || !isOtherEnabled) return;
    event.preventDefault();
    choose(otherSide);
  };
  const label = `${view.from} or ${view.to}`;
  // An ending is said on one line for the whole fork, so it counts no part of it.
  const isCounted = count > 1 && !view.isFailed;
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
      onPress={(side, event) => press(side, "slip", event)}
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
            <ShownAnswer view={view} onPress={(side, event) => press(side, "line", event)} />
            {view.isFailed && <Ending view={view} onAskAgain={onAskAgain} />}
            {placement === "column" && <SlipPresence>{slip}</SlipPresence>}
          </div>
        </div>
      </GlidingHeight>
      {placement === "margin" && (
        <SlipPresence>
          {slip && (
            <div {...{ [BESIDE_ATTRIBUTE]: "" }} className={MARGIN_CLASSES}>
              {slip}
            </div>
          )}
        </SlipPresence>
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
  return (
    <AnimatePresence initial={false}>
      {children && <FadingSlip key="slip">{children}</FadingSlip>}
    </AnimatePresence>
  );
}

/**
 * The slip's lines, out of reach once they start to fade: a proposal that ended is no answer
 * to take, so no screen reader meets it while it goes (WCAG 4.1.2). A focus in it, a pointer's
 * on its proposal, goes to the fork line's checked answer, the version that stays, in the frame
 * the fade starts, so it does not rest on the page (WCAG 2.4.3). Only a slip that fades hands it
 * on: a failed proposal's later parts are taken away whole, with no fade.
 */
function FadingSlip({ children }: { children: ReactNode }) {
  const isReducedMotion = useReducedMotionConfig() ?? false;
  const isPresent = useIsPresent();
  const slip = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = slip.current;
    if (isPresent || !element || !element.contains(document.activeElement)) return;
    element
      .closest('[role="radiogroup"]')
      ?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')
      ?.focus({ preventScroll: true });
  }, [isPresent]);
  return (
    <motion.div
      ref={slip}
      inert={!isPresent}
      exit={{ opacity: 0 }}
      transition={isReducedMotion ? { duration: 0 } : SPRINGS.brisk}
    >
      {children}
    </motion.div>
  );
}

/** A press on one of the fork's answers, with the event that made it. */
type AnswerPress = (side: ForkSide, event: MouseEvent<HTMLButtonElement>) => void;

interface ShownAnswerProps {
  view: ForkView;
  onPress: AnswerPress;
}

/** The fork line's answer: the version on screen, its bead filled in ink. A press keeps it. */
function ShownAnswer({ view, onPress }: ShownAnswerProps) {
  const drawing = useDrawing();
  const side = view.chosen;
  const label = side === "to" ? view.to : view.from;
  return (
    <button
      type="button"
      role="radio"
      aria-checked
      aria-label={`${label}, ${answerStateOf(side, view)}`}
      // The checked answer is the group's stop in the tab order, which the sentence's pointer
      // finds by it.
      tabIndex={0}
      onClick={(event) => onPress(side, event)}
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
  /** Stands in the column, under the fork line, rather than in the margin beside the plan. */
  isInColumn: boolean;
  /** The other version's answer. */
  side: ForkSide;
  onPress: AnswerPress;
}

/** The other version of the part: its answer, then on its wire its note, lines and foot. */
function Slip({ view, shown, other, opens, isFirst, reach, isInColumn, side, onPress }: SlipProps) {
  const lines = slipLinesOf(shown, other, opens);
  // Lines on the slip when it is first drawn stand whole, and so does every line of a version
  // already written, as the day before is on a take and a proposal taken back is: only a line
  // that arrives while the proposal is written is penned in. Each is marked as it arrives, so a
  // line's pen never stops midway when the proposal becomes whole, and its mark goes with it,
  // so a line that comes back stands whole.
  const [penned, setPenned] = useState<ReadonlyMap<string, boolean>>(
    () => new Map(lines.map(({ id }) => [id, false])),
  );
  const listed = new Set(lines.map(({ id }) => id));
  const isMarkChanged =
    lines.some(({ id }) => !penned.has(id)) || [...penned.keys()].some((id) => !listed.has(id));
  if (isMarkChanged) {
    setPenned(new Map(lines.map(({ id }) => [id, penned.get(id) ?? view.isWriting])));
  }
  const foot = view.isWriting ? null : slipFootOf(shown, other, reach, opens);
  // From the press the slip holds room for the lines the version most often has, in the column
  // and the margin alike, so what stands under or beside it is most often moved once: a part's
  // own stops and one more, the longest, or a whole day's own stops alone, each set as a new
  // stop's line wrapping at the slip's width (`heldLinesOf`), the foot they would have, and in
  // the first part the work line and the line where the day's end would move. Each line that
  // arrives takes a held line's room. A proposal with more stops than the lines held, or a line
  // that wraps onto more lines than the one whose room it takes, grows the slip again as it
  // arrives; room not used is given back once, as the proposal is whole.
  const held = view.isWriting ? heldLinesOf(shown, opens, reach).slice(lines.length) : [];
  const heldFoot = view.isWriting ? slipFootOf(shown, [], reach, opens) : null;
  // The work line, then the receipt, is said once, in the fork's first part. A receipt with
  // nothing to say takes no line.
  const isLineHeld = view.isWriting;
  const end = view.isWriting ? null : view.end;
  const isNoteSaid = isFirst && ((view.line?.words ?? "") !== "" || end !== null || isLineHeld);
  const [slip, setSlip] = useState<HTMLDivElement | null>(null);
  const heldHeight = useHeightHeld(slip, view.isWriting);
  return (
    <div
      ref={setSlip}
      {...{ [SLIP_ATTRIBUTE]: "" }}
      className={cn(isInColumn && "mt-2")}
      style={{ minHeight: heldHeight }}
    >
      <SlipAnswer view={view} side={side} onPress={onPress} />
      <div className={BODY_CLASSES}>
        <Wire />
        {isNoteSaid && <SlipNote line={view.line} end={end} isLineHeld={isLineHeld} />}
        {(lines.length > 0 || held.length > 0) && (
          <ol className={LINES_CLASSES}>
            {lines.map((line) => (
              <SlipLineItem
                key={line.id}
                line={line}
                movedWord={MOVED_WORDS[side]}
                isPenned={penned.get(line.id) ?? false}
              />
            ))}
            {held.map((line) => (
              // A line's room, unseen, until a stop arrives to fill it.
              <SlipLineItem
                key={`held-${line.id}`}
                line={line}
                movedWord={MOVED_WORDS[side]}
                isPenned={false}
                isHeld
              />
            ))}
          </ol>
        )}
        {foot !== null && <p className="mt-1.5 text-muted">{foot}</p>}
        {heldFoot !== null && (
          <p aria-hidden className="invisible mt-1.5">
            {heldFoot}
          </p>
        )}
        {isFirst && view.isWriting && (
          // The line where the day's end would move in the receipt, held unseen under the rest,
          // so the room held stands below what is said.
          <p aria-hidden className="invisible">
            {END_HELD}
          </p>
        )}
      </div>
    </div>
  );
}

interface SlipAnswerProps {
  view: ForkView;
  side: ForkSide;
  onPress: AnswerPress;
}

/**
 * The other version's answer at the slip's head: its bead hollow in the versions' blue, dashed
 * while it is written, its words lit then, and "Take" once it can be taken. The ring stands
 * while the fork waits on the visitor, through a take too; once they keep their own day it
 * goes. It keeps its place, shape and word whichever version is the day.
 */
function SlipAnswer({ view, side, onPress }: SlipAnswerProps) {
  const drawing = useDrawing();
  const label = side === "to" ? view.to : view.from;
  const isWriting = view.isWriting;
  const isRinged = view.isReady || view.chosen === "to";
  const description = answerStateOf(side, view);
  // One condition draws "Take" and names it, so the two cannot part.
  const isTakeShown = !isWriting;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={false}
      aria-disabled={isWriting || undefined}
      // The name repeats the words shown, in their order, "Take" among them while it is drawn,
      // so a visitor who says what they see finds the control (WCAG 2.5.3); the state follows.
      aria-label={`${label}${isTakeShown ? " Take" : ""}, ${description}`}
      tabIndex={-1}
      onClick={(event) => onPress(side, event)}
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
      <span aria-hidden className={cn(!isTakeShown && "invisible")}>
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

/** A receipt's line where the day's end moves, as long as it is said: its room while written. */
const END_HELD = "ends 00:00, not 00:00";

/**
 * The tallest a slip has stood while `isHolding`, which it keeps as its least height so a line
 * that arrives shorter than the room held for it moves nothing; none once it no longer holds.
 */
function useHeightHeld(slip: HTMLElement | null, isHolding: boolean): number {
  const [height, setHeight] = useState(0);
  if (!isHolding && height !== 0) setHeight(0);
  useLayoutEffect(() => {
    if (!slip || !isHolding) return undefined;
    const measure = () => setHeight((last) => Math.max(last, slip.offsetHeight));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(slip);
    return () => observer.disconnect();
  }, [slip, isHolding]);
  return height;
}

interface SlipLineItemProps {
  line: SlipLine;
  /** How a moved line names the hour the day on screen gives it (`MOVED_WORDS`). */
  movedWord: string;
  isPenned: boolean;
  /** Only its room, unseen and unheard, until a stop arrives to fill it. */
  isHeld?: boolean;
}

/** One stop of the other version: its time, then its name and what it is, or how it stands. */
function SlipLineItem({ line, movedWord, isPenned, isHeld = false }: SlipLineItemProps) {
  const { time, name, mark } = line;
  const isNew = mark.kind === "new";
  const tail =
    mark.kind === "new"
      ? mark.what
      : mark.kind === "stays"
        ? "stays"
        : `${movedWord}${NO_BREAK}${mark.hour}`;
  // The mark's first word never parts from its dot: a line breaks in the name, inside a mark of
  // more than one word, as "late supper", or after a later dot, never after the first.
  const after = `${NO_BREAK}·${NO_BREAK}${tail}`;
  // One pen through the line, in the order it reads, as a row's words are written in.
  const written = useEntryPen(time.length + name.length + after.length, isPenned);
  const afterTime = written - time.length;
  const afterName = afterTime - name.length;
  return (
    <li aria-hidden={isHeld || undefined} className={cn(LINE_CLASSES, isHeld && "invisible")}>
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
