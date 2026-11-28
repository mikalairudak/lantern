"use client";

import { Crosshair } from "lucide-react";
import { useMemo, useRef, type ReactNode } from "react";
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
 * time; the lines beside it start where a row's words do. In a narrow line (`narrow`), which
 * only a large text size makes of a phone's, the time stands over the lines, which take the
 * line's whole width: beside it they kept 128 px at 320 px with the browser's text at 200%.
 */
const ROW_CLASSES = "flex gap-4 @max-narrow:flex-col @max-narrow:gap-1";
/**
 * A count or a distance the summary keeps whole on a line (`summaryLineOf`, its spaces tied):
 * in a narrow line (`narrow`) it wraps between its words where it is wider than the line, as
 * "· about 7.1 km on foot" is at 320 px with the browser's text at 200%.
 */
const TIED_CLASSES = "whitespace-nowrap @max-narrow:whitespace-normal";
/** The space the summary ties a count or a distance with, which a line never breaks at. */
const TIED_SPACE = "\u00a0";
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
    // A container, so the line reads its own width in the text's rems (`narrow`).
    <div ref={line} className={cn("@container", className)}>
      <div className={ROW_CLASSES}>
        <span className={GUTTER_CLASSES}>{words.endsAt}</span>
        <div className="flex min-w-0 flex-col gap-1 type-note">
          <p className="text-ink">
            <TiedWords text={words.summary} />
          </p>
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
    </div>
  );
}

/**
 * The summary with each run its tied spaces keep whole set in a box of its own, whole on a
 * line as the tied spaces keep it, and wrapping between its words in a narrow line. The words
 * between the runs stay one text with their spaces, so no space stands as a text of its own
 * beside another, which the server would part with a comment and Chrome drop from what is read.
 */
function TiedWords({ text }: { text: string }): ReactNode {
  const parts: ReactNode[] = [];
  let plain = "";
  text.split(" ").forEach((word, index) => {
    if (index > 0) plain += " ";
    if (!word.includes(TIED_SPACE)) {
      plain += word;
      return;
    }
    if (plain) parts.push(plain);
    plain = "";
    parts.push(
      <span key={index} className={TIED_CLASSES}>
        {word.replaceAll(TIED_SPACE, " ")}
      </span>,
    );
  });
  if (plain) parts.push(plain);
  return <>{parts}</>;
}
