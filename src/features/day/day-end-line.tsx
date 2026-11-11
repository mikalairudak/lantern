"use client";

import { Crosshair } from "lucide-react";
import { useMemo, useRef } from "react";
import { cn } from "@/components/ui/cn";
import { SMALL_MARK_STROKE } from "@/features/abacus/best-light-icon";
import { NO_CHECKS, type PlaceChecks } from "@/features/itinerary/use-day-stream";
import type { DayAnswer } from "@/lib/events/event.schema";
import type { Itinerary } from "@/lib/schema/itinerary.schema";
import { ICON_SIZES } from "@/lib/tokens/icon";
import { DayAnswerLine } from "./day-answer";
import { dayEndWordsOf, routeLabelOf } from "./day-end-words";
import { LINK_CLASSES, TARGET_CLASSES } from "./link-classes";
import { useReadToEnd } from "./use-read-to-end";

/**
 * The time in the gutter, as the list's rows set theirs, so the day's end reads as its last
 * time; the lines beside it start where a row's words do.
 */
const ROW_CLASSES = "flex gap-4";
/** Under the chart the time ends where the chart's times do, against its axis. */
const GUTTER_CLASSES = "w-12 shrink-0 type-time tabular-nums text-muted view-chart:text-right";
const ROUTE_CLASSES = cn(LINK_CLASSES, TARGET_CLASSES, "text-ink");

export interface DayEndProps {
  /** The day as it ended, normalized: never a frame of its stream. */
  day: Itinerary;
  /** Which of its versions each stop shows, by its place among them (the curve's `committed`). */
  shown: readonly number[];
  /** Each place's check, by its id; none for a day no check ran on. */
  checks?: PlaceChecks;
  /**
   * The stream stopped inside the day's swaps, cut or dropped, and the day kept what came:
   * it is not the day that was planned, so it is not asked about.
   */
  isCut?: boolean;
  /** Told once the line has stayed in view a moment, the day read to its end (`useReadToEnd`). */
  onReadToEnd?: () => void;
  /**
   * Asks the one-tap question under the day's summary and tells the answer; left out, nothing is
   * asked. A day cut short is not asked: it is not the day that was planned.
   */
  onAnswer?: (answer: DayAnswer) => void;
  /** The answer given for the day opened, which the line thanks for rather than asks again. */
  answered?: DayAnswer | null;
  className?: string;
}

/**
 * The line under a finished day, above its sources: when it ends and how far it goes, how many
 * of its places the map found, and the one question it asks. Every number is worked out from the
 * day as the visitor shaped it, the versions they picked, so the model writes nothing here. The
 * ways to take the day along are the day menu's (`docs/decisions.md`, "The day's ways along live
 * in one menu, in the masthead"), which needs the page's script; without it the walking route, a
 * link of its own, stays here.
 */
export function DayEnd({
  day,
  shown,
  checks = NO_CHECKS,
  isCut = false,
  onReadToEnd,
  onAnswer,
  answered = null,
  className,
}: DayEndProps) {
  const words = useMemo(() => dayEndWordsOf(day, shown, checks), [day, shown, checks]);
  const line = useRef<HTMLDivElement>(null);
  // Watched afresh for each day the line ends, should one take another's place under it.
  useReadToEnd(line, day, onReadToEnd);

  return (
    <div ref={line} className={cn(ROW_CLASSES, className)}>
      <span className={GUTTER_CLASSES}>{words.endsAt}</span>
      <div className="flex min-w-0 flex-col gap-1 type-note">
        <p className="text-ink">{words.summary}</p>
        {words.found && (
          <p className="text-muted">
            {words.found}
            {/* The rows' own mark for a place the map found, after the words that say it. */}
            <Crosshair
              aria-hidden
              size={ICON_SIZES.xs}
              strokeWidth={SMALL_MARK_STROKE}
              className="ml-1 inline-block align-middle"
            />
          </p>
        )}
        {!isCut && words.route && (
          <noscript>
            <p>
              <a href={words.route.url} className={ROUTE_CLASSES}>
                {routeLabelOf(words.route)}
              </a>
            </p>
          </noscript>
        )}
        {onAnswer && !isCut && <DayAnswerLine answered={answered} onAnswer={onAnswer} />}
      </div>
    </div>
  );
}
