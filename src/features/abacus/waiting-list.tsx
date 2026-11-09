"use client";

import { motion } from "motion/react";
import { cn } from "@/components/ui/cn";
import type { LabelSide } from "./rows";
import { FADE, PASS_CLASSES, type Waiting } from "./waiting";

/**
 * The row's half of the waiting line. It sits where the next row's name will be written,
 * by the bead it will sit beside, in space the day already has below its last row, or over
 * the row being written again, and leaves without moving anything.
 */

/** Where the next row's words will start, from the top of its place. */
const ROW_CLASSES = "pointer-events-none absolute inset-x-0 top-full flex items-start";
/** Over a row being written again, in its own box rather than below the last row. */
const IN_PLACE_CLASSES = "pointer-events-none absolute inset-0 flex items-start";
const NAME_CLASSES = "type-name text-quote";
const META_CLASSES = "type-note";
/** Holds an empty line open at its font's height. */
const EMPTY_LINE = " ";

/** Where across the row the phrase sits: beside the bead the name will be written by. */
export interface WaitingPlace {
  side: LabelSide;
  /** From the row's edge on that side to where the words begin. */
  inset: number;
  /** The room the words will have there. */
  maxWidth: number;
}

interface ListWaitingProps {
  waiting: Waiting | null;
  place: WaitingPlace;
}

/**
 * The next part of the day in its own words, set where the next row's name will be: in
 * a place name's face, in italic, in muted ink. The light that crosses the chart's
 * ruled line runs through its letters and along the rule the row will close with. At its
 * strongest it is ink, so the words never fall below muted's contrast.
 *
 * It holds the next row's place, so whatever ends the silence takes that place. It leaves
 * at once rather than over a fade, so it never rides down a row as one arrives.
 */
export function ListWaiting({ waiting, place }: ListWaitingProps) {
  if (!waiting) return null;
  const isLeft = place.side === "left";
  return (
    <motion.div
      aria-hidden
      data-waiting="voice"
      // It fades in; it has no exit, since it leaves outside any AnimatePresence.
      initial={FADE.initial}
      animate={FADE.animate}
      transition={FADE.transition}
      className={cn(waiting.isInPlace ? IN_PLACE_CLASSES : ROW_CLASSES, isLeft && "justify-end")}
      style={isLeft ? { paddingRight: place.inset } : { paddingLeft: place.inset }}
    >
      <span
        className={cn("flex min-w-0 flex-col gap-0.5", isLeft && "text-right")}
        style={{ maxWidth: place.maxWidth }}
      >
        <span
          className={cn(
            NAME_CLASSES,
            "truncate bg-muted via-ink bg-clip-text text-transparent italic",
            PASS_CLASSES,
          )}
        >
          {waiting.phrase}
        </span>
        <span className={META_CLASSES}>{EMPTY_LINE}</span>
      </span>
      {/* Over a bare row its own wire is the rule: one drawn on it ran past both its ends. */}
      {waiting.stopId === undefined && (
        <span className={cn("absolute inset-x-0 top-full h-px bg-line via-ink/50", PASS_CLASSES)} />
      )}
    </motion.div>
  );
}
