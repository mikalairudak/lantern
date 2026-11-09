"use client";

import { useId, useState } from "react";
import { cn } from "@/components/ui/cn";
import { LINK_CLASSES, TARGET_CLASSES } from "./link-classes";
import { ShapeRow } from "./shape-row";
import { AskedSentence } from "./asked-sentence";
import type { YourDay } from "./your-days";

/** Over the visitor's own days, above the starts. */
export const YOUR_DAYS_HEADING = "Your days";
/** Forgets the list in this browser; the days stay in the log until their link expires. */
export const FORGET_YOUR_DAYS = "Forget these days";

/**
 * The days shown before the visitor asks for all of them: the newest few, so the starts stay
 * near the question on a phone however many days the visitor has.
 */
export const DAYS_SHOWN_AT_FIRST = 3;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Ties a count to its unit, as the line under the chart does (`progress.ts`). */
const NO_BREAK = "\u00A0";

/** The day a day was asked for, as the visitor's own calendar names it beside today. */
function whenOf(startedAt: string, now: Date): string {
  const asked = new Date(startedAt);
  const dayOf = (date: Date) =>
    Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY);
  const daysAgo = dayOf(now) - dayOf(asked);
  if (daysAgo <= 0) return "today";
  if (daysAgo === 1) return "yesterday";
  return asked.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * How one of the visitor's days stands, under its words: how far it is written while it is,
 * then when it was asked for and how it ended. A day written whole says no time, as its own page no
 * longer does: the seconds were the page's own count, which a reload or a day opened whole turned
 * into another number for the same day.
 */
export function yourDayNoteOf(day: YourDay, now: Date): string {
  const stops = day.energies.length;
  if (day.ending === "writing") {
    if (stops === 0) return "writing";
    return `writing · ${stops}${NO_BREAK}${stops === 1 ? "stop" : "stops"} so far`;
  }
  const when = whenOf(day.startedAt, now);
  if (day.ending === "failed") return `${when} · not finished`;
  if (day.ending === "cut") return `${when} · cut short`;
  return when;
}

export interface YourDaysListProps {
  days: readonly YourDay[];
  /**
   * Today, in the visitor's own calendar: the browser's clock unless given, as a bench gives
   * it. Read only once there is a day, so a page the server prerenders never reads a clock.
   */
  now?: Date;
  onOpen: (day: YourDay) => void;
  onForget: () => void;
  /** Every day shown from the first frame, as a bench sets the list once "All" is pressed. */
  isAllShownAtFirst?: boolean;
}

/**
 * The visitor's own days over the starts, newest first: each its shape, growing while it is
 * written, its sentence and how it stands, the newest three until all are asked for. Nothing
 * at all until there is a day; one link forgets them in this browser.
 */
export function YourDaysList({
  days,
  now,
  onOpen,
  onForget,
  isAllShownAtFirst = false,
}: YourDaysListProps) {
  const heading = useId();
  const [isAllShown, setIsAllShown] = useState(isAllShownAtFirst);
  if (days.length === 0) return null;
  const today = now ?? new Date();
  const shown = isAllShown ? days : days.slice(0, DAYS_SHOWN_AT_FIRST);
  const hidden = days.length - shown.length;
  return (
    <div className="@container mt-12 flex flex-col gap-4">
      <p id={heading} className="type-note text-muted">
        {YOUR_DAYS_HEADING}
      </p>
      <ul
        aria-labelledby={heading}
        className="grid grid-cols-1 gap-x-8 gap-y-6 @measure:grid-cols-2 @abacus:grid-cols-3"
      >
        {shown.map((day) => (
          <li key={day.id}>
            <ShapeRow
              energies={day.energies}
              words={<AskedSentence request={day.request} />}
              under={yourDayNoteOf(day, today)}
              onPress={() => onOpen(day)}
            />
          </li>
        ))}
      </ul>
      <p className="flex flex-wrap gap-x-5 gap-y-2 type-note text-muted">
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setIsAllShown(true)}
            className={cn(LINK_CLASSES, TARGET_CLASSES)}
          >
            All your days · {days.length}
          </button>
        )}
        <button type="button" onClick={onForget} className={cn(LINK_CLASSES, TARGET_CLASSES)}>
          {FORGET_YOUR_DAYS}
        </button>
      </p>
    </div>
  );
}
