"use client";

import { Crosshair } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { SMALL_MARK_STROKE } from "@/features/abacus/best-light-icon";
import { NO_CHECKS, type PlaceChecks } from "@/features/itinerary/use-day-stream";
import type { Itinerary } from "@/lib/schema/itinerary.schema";
import { ICON_SIZES } from "@/lib/tokens/icon";
import { daySlugOf } from "@/lib/days/address";
import { CALENDAR_TYPE, calendarFileNameOf, calendarOf } from "./day-calendar";
import { dayEndWordsOf, routeLabelOf } from "./day-end-words";
import { LINK_CLASSES, TARGET_CLASSES } from "./link-classes";
import { saveFile } from "./save-file";
import { dayLinkOf, shareDayLink, type ShareOutcome } from "./share-day";

/** How the day left the page: its link sent, its calendar saved, its walking route opened. */
export type DayExport = "link" | "calendar" | "route";

/** What "Copy link" says, before and after a press. */
export const COPY_LINK = "Copy link";
export const LINK_COPIED = "Copied";
export const LINK_NOT_COPIED = "Not copied";
export const ADD_TO_CALENDAR = "Add to calendar";
export const PLAN_ANOTHER_DAY = "Plan another day";

type CopyLabel = typeof COPY_LINK | typeof LINK_COPIED | typeof LINK_NOT_COPIED;

/** How long "Copied" stands before the press says "Copy link" again. */
export const COPIED_FOR_MS = 2500;

/**
 * The time in the gutter, as the list's rows set theirs, so the day's end reads as its last
 * time; the lines beside it start where a row's words do.
 */
const ROW_CLASSES = "flex gap-4";
/** Under the chart the time ends where the chart's times do, against its axis. */
const GUTTER_CLASSES = "w-12 shrink-0 type-time tabular-nums text-muted view-chart:text-right";
const ACTION_CLASSES = cn(LINK_CLASSES, TARGET_CLASSES, "text-ink");

export interface DayEndProps {
  /** The day as it ended, normalized: never a frame of its stream. */
  day: Itinerary;
  /** Which of its versions each stop shows, by its place among them (the curve's `committed`). */
  shown: readonly number[];
  /** Each place's check, by its id; none for a day no check ran on. */
  checks?: PlaceChecks;
  /**
   * The day's own address, as `/day/kanazawa` or `/day/<id>`, which "Copy link" sends; null
   * for a day with none, which no link would open.
   */
  address: string | null;
  /**
   * The stream stopped inside the day's swaps, cut or dropped, and the day kept what came:
   * its link alone is offered, which opens it as it was kept.
   */
  isCut?: boolean;
  /**
   * The day's key on this device (`seenKeyOf`, `keptSeenKeyOf`), which names its calendar
   * events, so a file saved again after a swap updates the same events.
   */
  calendarKey: string;
  /** Opens the city word at its field, as the masthead's "Plan another day" does. */
  onPlanAnother?: () => void;
  /** Told when the day leaves the page by one of the line's ways. */
  onExport?: (way: DayExport) => void;
  className?: string;
}

/**
 * The line under a finished day, above its sources: when it ends and how far it goes, how many
 * of its places the map found, and the ways to take it along, its link, a calendar file and
 * the walk in Google Maps, then another day. Every number is worked out from the day as the
 * visitor shaped it, the versions they picked, so the model writes nothing here; the calendar
 * file is made in the browser when it is asked for, and nothing new is sent anywhere.
 */
export function DayEnd({
  day,
  shown,
  checks = NO_CHECKS,
  address,
  isCut = false,
  calendarKey,
  onPlanAnother,
  onExport,
  className,
}: DayEndProps) {
  const words = useMemo(() => dayEndWordsOf(day, shown, checks), [day, shown, checks]);
  const [copied, setCopied] = useState<CopyLabel>(COPY_LINK);
  useEffect(() => {
    if (copied === COPY_LINK) return undefined;
    const back = window.setTimeout(() => setCopied(COPY_LINK), COPIED_FOR_MS);
    return () => window.clearTimeout(back);
  }, [copied]);

  const linkOf = (): string | null =>
    address === null ? null : dayLinkOf(address, window.location.origin);

  const sendLink = async () => {
    const url = linkOf();
    if (url === null) return;
    const outcome: ShareOutcome = await shareDayLink({ url, title: document.title });
    if (outcome === "copied") setCopied(LINK_COPIED);
    if (outcome === "failed") setCopied(LINK_NOT_COPIED);
    if (outcome === "copied" || outcome === "shared") onExport?.("link");
  };

  const saveCalendar = () => {
    const calendar = calendarOf(
      {
        key: calendarKey,
        city: day.city,
        date: day.date,
        timezone: day.timezone,
        stops: day.stops,
        shown,
        checks,
        url: linkOf() ?? undefined,
      },
      new Date(),
    );
    saveFile(calendar, CALENDAR_TYPE, calendarFileNameOf(daySlugOf(day), day.date));
    onExport?.("calendar");
  };

  const actions: ReactNode[] = [];
  if (address !== null) {
    actions.push(
      <button key="link" type="button" onClick={() => void sendLink()} className={ACTION_CLASSES}>
        <HeldRoom room={COPY_LINK} shown={copied} />
      </button>,
    );
  }
  if (!isCut) {
    actions.push(
      <button key="calendar" type="button" onClick={saveCalendar} className={ACTION_CLASSES}>
        {ADD_TO_CALENDAR}
      </button>,
    );
    if (words.route) {
      actions.push(
        <a
          key="route"
          href={words.route.url}
          target="_blank"
          rel="noreferrer"
          onClick={() => onExport?.("route")}
          className={ACTION_CLASSES}
        >
          {routeLabelOf(words.route)}
        </a>,
      );
    }
    if (onPlanAnother) {
      actions.push(
        <button key="another" type="button" onClick={onPlanAnother} className={ACTION_CLASSES}>
          {PLAN_ANOTHER_DAY}
        </button>,
      );
    }
  }

  return (
    // Relative, so the status for screen readers stands inside the line, wherever it is set.
    <div className={cn("relative", ROW_CLASSES, className)}>
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
        {actions.length > 0 && (
          // Lines apart, as the list's versions are, so a press reaching past its words
          // reaches into the line above or below it as little as it can.
          <p className="flex flex-wrap gap-x-2 gap-y-2">
            <Wrapping ways={actions} />
          </p>
        )}
      </div>
      <span role="status" className="sr-only">
        {copied === LINK_COPIED ? "The day's link is copied" : ""}
        {copied === LINK_NOT_COPIED ? "The day's link could not be copied" : ""}
      </span>
    </div>
  );
}

/**
 * Ways joined by a middle dot that screen readers do not hear, standing wide enough apart that
 * each press, which reaches past its words, stays its own. Each way is whole on its line, with
 * the dot before it, so a dot goes to the next line with its way and never hangs at a line's
 * end ("Copy link · Add to calendar ·" on a 393 px phone); the room before a dot is the row's
 * gap, which a line's first way has none of, so a line that starts with a dot starts at the
 * edge, as the summary's does.
 */
function Wrapping({ ways }: { ways: readonly ReactNode[] }) {
  return ways.map((way, index) => (
    <span key={index} className="whitespace-nowrap">
      {index > 0 && (
        <span aria-hidden className="mr-2">
          ·
        </span>
      )}
      {way}
    </span>
  ));
}

/**
 * Words that change in place over the room of the words they stand for, both laid in one cell
 * and the room's unseen while the others show, so a shorter word never pulls the line in
 * after it. A grid passes the underline on to its words, which a button's own does not.
 */
function HeldRoom({ room, shown }: { room: string; shown: string }) {
  return (
    <span className="inline-grid justify-items-start underline decoration-1 underline-offset-4">
      {shown !== room && (
        <span aria-hidden className="invisible col-start-1 row-start-1">
          {room}
        </span>
      )}
      <span className="col-start-1 row-start-1">{shown}</span>
    </span>
  );
}
