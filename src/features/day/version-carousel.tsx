"use client";

import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { cn } from "@/components/ui/cn";
import { beadOrderOf, candidatesOf, energyOf } from "@/features/abacus/curve";
import { hasEnergy, type StopDraft } from "@/features/abacus/day-draft";
import { SPRINGS } from "@/lib/tokens/motion";

/**
 * A stop on the day's plan as a carousel of its versions (`docs/decisions.md`, "A stop on the
 * plan swipes along its versions"). They wait in the order their beads run along the chart's
 * wire, the quieter on the stop's left and the livelier on its right. Held and dragged, the stop
 * follows the finger or the cursor and shows the version on the side it is pulled from: dragged
 * right, the one on its left comes in. Let go past a third of its width it takes that version;
 * short of it, it springs back. Under the stop, each side that has a version names it with an
 * arrow, a press that plays the same slide; the arrow keys on the stop do the same. An arrow
 * under a pointer or reached by the keyboard takes the ink rule under its name, and the stop leans
 * toward the version it names, as far as the stop's first lean goes, so the slide is foreseen
 * before it is pressed. A stop with no versions neither moves nor says anything.
 *
 * Every move is the layout spring on one value, so a drag catches a slide halfway and a second
 * press runs on from where the first has got to. The slide is quicker than "Three pixels a frame"
 * allows a row to move (`docs/design-direction.md`): the visitor starts it to replace the stop,
 * and nothing they read reflows under it. Under reduced motion the version is simply there.
 *
 * The drag is the carousel's own, on pointer events that set the same value. A library's drag
 * measures its element on every render and plays the frame loop at once after the commit, inside
 * the event that caused it; a swap re-renders the whole day each frame its curve springs, so the
 * slide would be worked out to its end before a frame is painted (`docs/decisions.md`, "A stop on
 * the plan swipes along its versions"). Under a finger the stop's words are neither selected nor
 * offered a callout by a long press, so a hesitant press stays a swipe; with a fine pointer they
 * can be selected.
 */

/** How much of the stop's width a drag must carry to take a version. */
const COMMIT_SHARE = 1 / 3;
/** The gap between the stop and a version waiting beside it: `mr-6` and `ml-6`. */
const GAP_PX = 24;
/** How far a drag with no version on its side gives, as a share of the finger's travel. */
const ELASTIC = 0.08;
const NUDGE_PX = 12;
const NUDGE_DELAY_MS = 900;
/**
 * How far a pointer travels before a press becomes a drag, along the axis it went furthest: a
 * drag across moves the stop, a drag down or up is left to the page and to a text selection.
 */
const LOCK_PX = 6;

type Side = "before" | "after";

/** The axis a drag locks to once the pointer has travelled `LOCK_PX` along it; none before. */
export function lockOf(dx: number, dy: number): "x" | "y" | null {
  if (Math.abs(dx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return null;
  return Math.abs(dx) > Math.abs(dy) ? "x" : "y";
}

/**
 * Where a dragged stop stands: where it was caught plus the pointer's travel, as far as a stride
 * toward each side with a version, and past that a share of the travel (`ELASTIC`).
 */
export function draggedTo(
  from: number,
  travel: number,
  reach: { left: number; right: number },
): number {
  const to = from + travel;
  if (to > reach.right) return reach.right + (to - reach.right) * ELASTIC;
  if (to < reach.left) return reach.left + (to - reach.left) * ELASTIC;
  return to;
}

/**
 * The version a drag let go takes: the one on the side it was pulled from, once the pointer has
 * carried past a third of the stop's width; dragged right, the one on its left.
 */
export function sideTaken(
  travel: number,
  width: number,
  sides: { hasBefore: boolean; hasAfter: boolean },
): Side | null {
  if (travel >= width * COMMIT_SHARE && sides.hasBefore) return "before";
  if (travel <= -width * COMMIT_SHARE && sides.hasAfter) return "after";
  return null;
}

/** A press on the stop, from its pointer's first point; `axis` once it is a drag. */
interface Hold {
  pointerId: number;
  fromX: number;
  fromY: number;
  axis: "x" | "y" | null;
  /** Where the stop stood when the drag caught it. */
  caught: number;
}

/** Holds the pointer to the stop while it drags; a pointer already gone cannot be held. */
function holdPointer(element: Element, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // The drag goes on while the pointer stays over the stop.
  }
}

export interface Neighbour {
  index: number;
  name: string;
  /** How it stands against the version shown, as its arrow is named. */
  side: "Quieter" | "Livelier" | "Same energy";
}

/** The versions either side of the one shown, along the wire. */
export function neighboursOf(
  stop: StopDraft,
  pick: number,
): { before: Neighbour | null; after: Neighbour | null } {
  // A stop is let into the list once its place's energy is written, and a version joins it
  // with its own; one without is not placed on the wire.
  if (!hasEnergy(stop)) return { before: null, after: null };
  const order = beadOrderOf(stop);
  const at = order.indexOf(pick);
  const candidates = candidatesOf(stop);
  const energies = candidates.map(energyOf);
  const shown = energies[pick] ?? 0;
  const neighbourAt = (index: number | undefined): Neighbour | null => {
    if (index === undefined) return null;
    const energy = energies[index] ?? shown;
    return {
      index,
      name: candidates[index]?.name ?? "",
      side: energy < shown ? "Quieter" : energy > shown ? "Livelier" : "Same energy",
    };
  };
  return { before: neighbourAt(order[at - 1]), after: neighbourAt(order[at + 1]) };
}

/**
 * A version's arrow: as wide as its words, and no wider than the column, where a longer name
 * wraps on its own side. Its press target reaches 4 px round its box, and its box 2 px over and
 * under its line, so the target stands 32 px tall; stacked, two arrows' targets meet at the
 * middle of the 8 px between them, and side by side they stay 4 px apart across `gap-3`.
 */
const ARROW_CLASSES =
  "group/pointed relative flex max-w-full min-w-0 items-baseline rounded-sm py-0.5 text-left type-note text-swap focus-ring after:absolute after:-inset-x-1 after:-inset-y-1 aria-disabled:cursor-default";

/**
 * The arrows' line: the two share it when both fit with `gap-3` between them, and otherwise wrap
 * to a line each, the left one first, so layout alone decides it in the first paint. The right
 * one keeps to the right edge on either line, and alone.
 */
const ARROWS_CLASSES = "flex flex-wrap gap-x-3 gap-y-2";

/** The version's name in its arrow, ruled under a pointer or the keyboard's focus. */
const ARROW_NAME_CLASSES = "decoration-1 underline-offset-4 pointed-group:underline";

/** Whether an element has the focus as the keyboard gives it, where the browser can tell. */
function isKeyboardFocus(element: Element): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    return false;
  }
}

export function VersionCarousel({
  stop,
  pick,
  name,
  onPick,
  renderVersion,
  isNudged = false,
  children,
}: {
  stop: StopDraft;
  pick: number;
  /** The stop's name as shown, which names the stop to a screen reader. */
  name: string;
  /**
   * Takes a version; left out while the day is written, when the carousel is drawn as it will
   * stand, its arrows said and waiting, so nothing about the stop changes when the day is done.
   */
  onPick?: (candidate: number) => void;
  /** The words a version would show, drawn beside the stop while it waits there. */
  renderVersion: (candidate: number) => ReactNode;
  /** This stop leans once toward each side it has, to show it can be pulled. */
  isNudged?: boolean;
  children: ReactNode;
}) {
  const { before, after } = neighboursOf(stop, pick);
  const x = useMotionValue(0);
  const isReduced = useReducedMotion();
  const hintId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  /** Where the version taken stands as it becomes the stop: a stride to the side it came from. */
  const shift = useRef<number | null>(null);
  const canSwipe = before !== null || after !== null;
  const isEnabled = onPick !== undefined;
  const hasBefore = before !== null;
  const hasAfter = after !== null;
  const groupRef = useRef<HTMLDivElement>(null);
  const stride = width + GAP_PX;
  /** The lean toward an arrow pointed at, while it plays or holds. */
  const pointedLean = useRef<{ stop: () => void } | null>(null);
  const hold = useRef<Hold | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  /** A drag let go ends in a click on the stop, which is the drag's and nothing else's. */
  const isClickDragged = useRef(false);

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return undefined;
    const measure = () => setWidth(box.offsetWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [canSwipe]);

  // The version taken is now the stop: drawn where it stood as it waited, a stride off, in the
  // same paint, then brought home on the layout spring.
  useLayoutEffect(() => {
    if (shift.current === null) return;
    x.set(x.get() + shift.current);
    shift.current = null;
    if (isReduced) x.set(0);
    else animate(x, 0, SPRINGS.layout);
  }, [pick, x, isReduced]);

  // A stop that stops swapping while an arrow is pointed at, as when a day starts being written,
  // goes home: its arrows may be gone before the pointer leaves them.
  useEffect(() => {
    if (isEnabled || pointedLean.current === null) return;
    pointedLean.current.stop();
    pointedLean.current = null;
    animate(x, 0, SPRINGS.snappy);
  }, [isEnabled, x]);

  // The lean plays once while the stop is shown, and never once a version has been taken.
  const hasLeaned = useRef(false);
  useEffect(() => {
    if (hasLeaned.current || !isNudged || isReduced || !canSwipe || !isEnabled) return undefined;
    // Toward the side the drag to the right shows first, the one on the stop's left.
    const first = hasBefore ? NUDGE_PX : -NUDGE_PX;
    const steps = [first, hasBefore && hasAfter ? -first / 2 : 0, 0];
    let isCurrent = true;
    let isLeaning = false;
    let move: { stop: () => void } | null = null;
    // Any gesture of the visitor's on the page ends a lean at once, the stop home on a quick
    // spring: the page never moves under a hand.
    const endLean = () => {
      isCurrent = false;
      window.clearTimeout(timer);
      move?.stop();
      if (isLeaning) animate(x, 0, SPRINGS.snappy);
      isLeaning = false;
      unlisten();
    };
    const gestures = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    const unlisten = () => {
      for (const gesture of gestures) window.removeEventListener(gesture, endLean, true);
    };
    for (const gesture of gestures) {
      window.addEventListener(gesture, endLean, { capture: true, passive: true });
    }
    const timer = window.setTimeout(async () => {
      // An arrow pointed at leans the stop already.
      if (pointedLean.current !== null) return;
      hasLeaned.current = true;
      isLeaning = true;
      for (const to of steps) {
        if (!isCurrent) return;
        const step = animate(x, to, SPRINGS.gentle);
        move = step;
        await step;
      }
      isLeaning = false;
      unlisten();
    }, NUDGE_DELAY_MS);
    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
      move?.stop();
      unlisten();
      // A lean cut short goes home at once, rather than leave the stop off its place.
      if (isLeaning) x.set(0);
    };
  }, [isNudged, isReduced, canSwipe, isEnabled, hasBefore, hasAfter, x]);

  /**
   * Leans the stop toward the version an arrow names, or brings it home once the arrow is left.
   * The version on the left comes in from a drag to the right, so its arrow leans the stop right.
   */
  const lean = (side: Side | null) => {
    if (side === null && pointedLean.current === null) return;
    // A stop that can no longer swap still goes home from a lean it holds.
    if (side !== null && (!isEnabled || isReduced)) return;
    pointedLean.current?.stop();
    const to = side === "before" ? NUDGE_PX : side === "after" ? -NUDGE_PX : 0;
    const move = animate(x, to, SPRINGS.snappy);
    pointedLean.current = side === null ? null : move;
  };

  /** A pointer that can hover, coming over an arrow: a finger's press leans nothing. */
  const leanFromPointer = (side: Side, event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "touch") lean(side);
  };

  /** The keyboard reaching an arrow; a press that focuses it leans nothing more. */
  const leanFromFocus = (side: Side, event: FocusEvent<HTMLButtonElement>) => {
    if (isKeyboardFocus(event.currentTarget)) lean(side);
  };

  const take = (side: Side, isPressed = false) => {
    const version = side === "before" ? before : after;
    if (!version || !onPick) return;
    hasLeaned.current = true;
    // The slide starts from where the lean has got to, and the arrow left after it leaves the
    // slide alone.
    pointedLean.current?.stop();
    pointedLean.current = null;
    // The version on the left waits a stride to the left, so once taken it starts from there.
    shift.current = side === "before" ? -stride : stride;
    onPick(version.index);
    // An arrow pressed may go with the version it named: the focus stays with the stop.
    if (isPressed) groupRef.current?.focus();
  };

  const goHome = () => {
    if (isReduced) x.set(0);
    else animate(x, 0, SPRINGS.layout);
  };

  /**
   * Ends a press. A drag let go takes the version it carried past a third, while the stop can
   * still swap, and otherwise goes home; a drag cancelled or lost goes home with nothing taken.
   */
  const endHold = (held: Hold, clientX: number | null) => {
    hold.current = null;
    if (held.axis !== "x") return;
    setIsDragging(false);
    if (clientX === null) {
      goHome();
      return;
    }
    isClickDragged.current = true;
    const travel = clientX - held.fromX;
    const side = isEnabled ? sideTaken(travel, width, { hasBefore, hasAfter }) : null;
    if (side) take(side);
    else goHome();
  };

  /** The pointer let go or taken by the page, wherever it was then. */
  const release = (event: globalThis.PointerEvent) => {
    const held = hold.current;
    if (!held || held.pointerId !== event.pointerId) return;
    endHold(held, event.type === "pointerup" ? event.clientX : null);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    isClickDragged.current = false;
    if (!isEnabled || hold.current !== null) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    hold.current = {
      pointerId: event.pointerId,
      fromX: event.clientX,
      fromY: event.clientY,
      axis: null,
      caught: 0,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const held = hold.current;
    if (!held || held.pointerId !== event.pointerId) return;
    // A mouse or a pen moving with no button down was let go where nothing told the stop.
    if (event.pointerType !== "touch" && event.buttons === 0) {
      endHold(held, null);
      return;
    }
    const travel = event.clientX - held.fromX;
    if (held.axis === null) {
      held.axis = lockOf(travel, event.clientY - held.fromY);
      if (held.axis === null) return;
      if (held.axis === "y") {
        hold.current = null;
        return;
      }
      // The drag catches the stop wherever a slide or a lean has got to.
      x.stop();
      pointedLean.current = null;
      hasLeaned.current = true;
      held.caught = x.get();
      holdPointer(event.currentTarget, event.pointerId);
      window.getSelection()?.removeAllRanges();
      setIsDragging(true);
    }
    x.set(
      draggedTo(held.caught, travel, { left: after ? -stride : 0, right: before ? stride : 0 }),
    );
  };

  /**
   * The stop's own hold on the pointer lost, as when the page takes it, sends the stop home. A
   * finger's word or line holds its pointer from the press and loses it as the stop takes it at
   * the lock; that loss bubbles here and is the drag's start, not its end.
   */
  const onLostPointerCapture = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const held = hold.current;
    if (!held || held.pointerId !== event.pointerId) return;
    endHold(held, null);
  };

  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!isClickDragged.current) return;
    isClickDragged.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "ArrowLeft" && before) take("before");
    else if (event.key === "ArrowRight" && after) take("after");
    else return;
    event.preventDefault();
  };

  // The release is heard on the window, where it cannot be missed: a press let go off the stop
  // before it is a drag never reaches the stop.
  const releaseNow = useRef(release);
  useLayoutEffect(() => {
    releaseNow.current = release;
  });
  useEffect(() => {
    const onRelease = (event: globalThis.PointerEvent) => releaseNow.current(event);
    window.addEventListener("pointerup", onRelease);
    window.addEventListener("pointercancel", onRelease);
    return () => {
      window.removeEventListener("pointerup", onRelease);
      window.removeEventListener("pointercancel", onRelease);
    };
  }, []);

  if (!canSwipe) return <>{children}</>;

  const keys = [
    before && `left arrow for ${before.name}`,
    after && `right arrow for ${after.name}`,
  ].filter(Boolean);

  return (
    // The arrows' targets stand below the stop's last line, not over its words.
    <div className="flex flex-col gap-2">
      <div ref={boxRef} className="overflow-hidden">
        <motion.div
          ref={groupRef}
          role="group"
          tabIndex={isEnabled ? 0 : -1}
          aria-label={name}
          aria-describedby={hintId}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onLostPointerCapture={onLostPointerCapture}
          onClickCapture={onClickCapture}
          style={{ x }}
          className={cn(
            "relative flex touch-pan-y flex-col gap-1 rounded-sm focus-ring-inset",
            isEnabled && "cursor-grab active:cursor-grabbing",
            "pointer-coarse:select-none pointer-coarse:touch-callout-none",
            isDragging && "select-none",
          )}
        >
          {children}
          {before && (
            <div aria-hidden className="absolute top-0 right-full mr-6 flex w-full flex-col gap-1">
              {renderVersion(before.index)}
            </div>
          )}
          {after && (
            <div aria-hidden className="absolute top-0 left-full ml-6 flex w-full flex-col gap-1">
              {renderVersion(after.index)}
            </div>
          )}
        </motion.div>
      </div>
      <span id={hintId} className="sr-only">
        {`Swap with the ${keys.join(", or the ")}.`}
      </span>
      <div className={ARROWS_CLASSES}>
        {before && (
          <button
            type="button"
            aria-label={`${before.side}: ${before.name}`}
            aria-disabled={!isEnabled || undefined}
            onClick={() => take("before", true)}
            onPointerEnter={(event) => leanFromPointer("before", event)}
            onPointerLeave={() => lean(null)}
            onFocus={(event) => leanFromFocus("before", event)}
            onBlur={() => lean(null)}
            className={ARROW_CLASSES}
          >
            <span className="min-w-0 text-pretty">
              <span aria-hidden>←&nbsp;</span>
              <span className={cn(isEnabled && ARROW_NAME_CLASSES)}>{before.name}</span>
            </span>
          </button>
        )}
        {after && (
          <button
            type="button"
            aria-label={`${after.side}: ${after.name}`}
            aria-disabled={!isEnabled || undefined}
            onClick={() => take("after", true)}
            onPointerEnter={(event) => leanFromPointer("after", event)}
            onPointerLeave={() => lean(null)}
            onFocus={(event) => leanFromFocus("after", event)}
            onBlur={() => lean(null)}
            className={cn(ARROW_CLASSES, "ml-auto justify-end text-right")}
          >
            <span className="min-w-0 text-pretty">
              <span className={cn(isEnabled && ARROW_NAME_CLASSES)}>{after.name}</span>
              <span aria-hidden>&nbsp;→</span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
