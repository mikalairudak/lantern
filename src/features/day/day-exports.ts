"use client";

import { useEffect, useState } from "react";
import type { PlaceChecks } from "@/features/itinerary/use-day-stream";
import { daySlugOf } from "@/lib/days/address";
import type { Itinerary } from "@/lib/schema/itinerary.schema";
import { CALENDAR_TYPE, calendarFileNameOf, calendarOf } from "./day-calendar";
import { useSaidAgain } from "./said-again";
import { saveFile } from "./save-file";
import { dayLinkOf, shareDayLink, type ShareOutcome } from "./share-day";
import {
  COPIED_FOR_MS,
  COPY_LINK,
  LINK_COPIED,
  LINK_NOT_COPIED,
  type CopyLabel,
  type DayExport,
} from "./day-export-words";

export interface DayExportsOptions {
  /** The finished day, or null while there is none to take along. */
  day: Itinerary | null;
  shown: readonly number[];
  checks: PlaceChecks;
  /** The day's own address, or null for a day with none: then it has no link to send. */
  address: string | null;
  /** What the calendar's events are keyed by, so a day added twice replaces itself. */
  calendarKey: string;
  onExport?: (way: DayExport) => void;
}

export interface DayExports {
  /** What the link's control says now: its words, or how the last send went. */
  copied: CopyLabel;
  /**
   * Whether a screen reader is told how the last send went: false from a send until the status
   * has stood empty (`useSaidAgain`), so a send that went as the one before did is still a
   * change of the status's words.
   */
  isSendSaid: boolean;
  /** Sends the day's link: the phone's share sheet where there is one, the clipboard otherwise. */
  sendLink: (() => Promise<void>) | null;
  /** Saves the day as a calendar file, one event for each stop at its local hour. */
  saveCalendar: () => void;
}

/**
 * The day's link and its calendar file, for the line under a finished day and for the
 * masthead's day menu alike, so both send the same link and save the same events.
 */
export function useDayExports({
  day,
  shown,
  checks,
  address,
  calendarKey,
  onExport,
}: DayExportsOptions): DayExports {
  const [copied, setCopied] = useState<CopyLabel>(COPY_LINK);
  // Each send that is copied or fails is said, a second that goes as the first did included: the
  // status empties at it and says how it went once it has stood empty (`useSaidAgain`), and the
  // control's words stand their whole time from the latest.
  const [sends, setSends] = useState(0);
  const isSendSaid = useSaidAgain(sends);
  useEffect(() => {
    if (copied === COPY_LINK) return undefined;
    const back = window.setTimeout(() => setCopied(COPY_LINK), COPIED_FOR_MS);
    return () => window.clearTimeout(back);
  }, [copied, sends]);

  const linkOf = (): string | null =>
    address === null ? null : dayLinkOf(address, window.location.origin);

  const sendLink = async () => {
    const url = linkOf();
    if (url === null) return;
    const outcome: ShareOutcome = await shareDayLink({ url, title: document.title });
    if (outcome === "copied") setCopied(LINK_COPIED);
    if (outcome === "failed") setCopied(LINK_NOT_COPIED);
    if (outcome === "copied" || outcome === "failed") setSends((count) => count + 1);
    if (outcome === "copied" || outcome === "shared") onExport?.("link");
  };

  const saveCalendar = () => {
    if (day === null) return;
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

  return {
    copied,
    isSendSaid,
    sendLink: address === null ? null : sendLink,
    saveCalendar,
  };
}
