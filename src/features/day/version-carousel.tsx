"use client";

import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/components/ui/cn";
import { beadOrderOf, candidatesOf, energyOf, type CurveStop } from "@/features/abacus/curve";
import type { StopDraft } from "@/features/abacus/day-draft";
import { SPRINGS } from "@/lib/tokens/motion";
import { TARGET_CLASSES } from "./link-classes";

/**
 * A stop on the day's plan as a carousel of its versions (`docs/decisions.md`, "A stop on the
 * plan swipes along its versions"). They wait in the order their beads run along the chart's
 * wire, the quieter on the stop's left and the livelier on its right. Held and dragged, the stop
 * follows the finger or the cursor and shows the version on the side it is pulled from: dragged
 * right, the one on its left comes in. Let go past a third of its width it takes that version;
 * short of it, it springs back. Under the stop, each side that has a version names it with an
 * arrow, a press that plays the same slide; the arrow keys on the stop do the same. A stop with no
 * versions neither moves nor says anything.
 *
 * Every move is the layout spring on one value, so a drag catches a slide halfway and a second
 * press runs on from where the first has got to. The slide is quicker than "Three pixels a frame"
 * allows a row to move (`docs/design-direction.md`): the visitor starts it to replace the stop,
 * and nothing they read reflows under it. Under reduced motion the version is simply there.
 */

/** How much of the stop's width a drag must carry to take a version. */
const COMMIT_SHARE = 1 / 3;
/** The gap between the stop and a version waiting beside it: `mr-6` and `ml-6`. */
const GAP_PX = 24;
/** How far a drag with no version on its side gives, as a share of the finger's travel. */
const ELASTIC = 0.08;
const NUDGE_PX = 12;
const NUDGE_DELAY_MS = 900;

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
  const curveStop = stop as unknown as CurveStop;
  const order = beadOrderOf(curveStop);
  const at = order.indexOf(pick);
  const candidates = candidatesOf(curveStop);
  const energies = candidates.map(energyOf);
  const shown = energies[pick] ?? 0;
  const neighbourAt = (index: number | undefined): Neighbour | null => {
    if (index === undefined) return null;
    const energy = energies[index] ?? shown;
    return {
      index,
      name: (candidates[index] as { name?: string } | undefined)?.name ?? "",
      side: energy < shown ? "Quieter" : energy > shown ? "Livelier" : "Same energy",
    };
  };
  return { before: neighbourAt(order[at - 1]), after: neighbourAt(order[at + 1]) };
}

const ARROW_CLASSES = cn(
  TARGET_CLASSES,
  "flex min-w-0 basis-1/2 items-baseline rounded-sm text-left type-note text-swap focus-ring",
);

type Side = "before" | "after";

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
  onPick: (candidate: number) => void;
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
  const stride = width + GAP_PX;

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

  useEffect(() => {
    if (!isNudged || isReduced || !canSwipe) return undefined;
    // Toward the side the drag to the right shows first, the one on the stop's left.
    const first = before ? NUDGE_PX : -NUDGE_PX;
    const steps = [first, before && after ? -first / 2 : 0, 0];
    let isCurrent = true;
    let move: { stop: () => void } | null = null;
    const timer = window.setTimeout(async () => {
      for (const to of steps) {
        if (!isCurrent) return;
        const step = animate(x, to, SPRINGS.gentle);
        move = step;
        await step;
      }
    }, NUDGE_DELAY_MS);
    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
      move?.stop();
    };
  }, [isNudged, isReduced, canSwipe, before, after, x]);

  if (!canSwipe) return <>{children}</>;

  const take = (side: Side) => {
    const version = side === "before" ? before : after;
    if (!version) return;
    // The version on the left waits a stride to the left, so once taken it starts from there.
    shift.current = side === "before" ? -stride : stride;
    onPick(version.index);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "ArrowLeft" && before) take("before");
    else if (event.key === "ArrowRight" && after) take("after");
    else return;
    event.preventDefault();
  };

  const keys = [
    before && `left arrow for ${before.name}`,
    after && `right arrow for ${after.name}`,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-1">
      <div ref={boxRef} className="overflow-hidden">
        <motion.div
          role="group"
          tabIndex={0}
          aria-label={name}
          aria-describedby={hintId}
          onKeyDown={onKeyDown}
          drag="x"
          dragDirectionLock
          dragMomentum={false}
          dragConstraints={{ left: after ? -stride : 0, right: before ? stride : 0 }}
          dragElastic={ELASTIC}
          onDragEnd={(_, { offset }) => {
            if (offset.x >= width * COMMIT_SHARE && before) take("before");
            else if (offset.x <= -width * COMMIT_SHARE && after) take("after");
            else if (isReduced) x.set(0);
            else animate(x, 0, SPRINGS.layout);
          }}
          style={{ x }}
          className="relative flex cursor-grab touch-pan-y flex-col gap-1 rounded-sm focus-ring-inset active:cursor-grabbing"
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
      <div className="flex justify-between gap-3">
        {before ? (
          <button
            type="button"
            aria-label={`${before.side}: ${before.name}`}
            onClick={() => take("before")}
            className={ARROW_CLASSES}
          >
            <span className="min-w-0 text-pretty">
              <span aria-hidden>←&nbsp;</span>
              {before.name}
            </span>
          </button>
        ) : (
          <span className="basis-1/2" />
        )}
        {after && (
          <button
            type="button"
            aria-label={`${after.side}: ${after.name}`}
            onClick={() => take("after")}
            className={cn(ARROW_CLASSES, "justify-end text-right")}
          >
            <span className="min-w-0 text-pretty">
              {after.name}
              <span aria-hidden>&nbsp;→</span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
