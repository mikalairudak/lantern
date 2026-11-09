"use client";

import { useCallback, useEffect, useRef } from "react";
import type { DayStream } from "@/features/itinerary/use-day-stream";
import type { DayVia, ProductEvent, ProductEventKind } from "@/lib/events/event.schema";
import type { DayOutcome } from "@/lib/stream/outcome";
import { sendProductEvent } from "@/lib/events/send-event";
import { isWrittenRequest } from "@/lib/days/written/requests";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import { daySlugOf } from "@/lib/days/address";

/**
 * The chart's gestures and the ways a day is taken along, sent once for each day opened:
 * whether the visitor dragged, swapped or took the day along is the question, and a held
 * arrow key, one pull a step, or a link copied again and again would otherwise spend a
 * visitor's events for the day.
 */
const ONCE_A_DAY: readonly ProductEventKind[] = [
  "curve-dragged",
  "stop-swapped",
  "link-shared",
  "calendar-saved",
  "route-opened",
];

/** What every event about a day says of it. */
interface OpenedDay {
  city: string;
  via: DayVia;
  written: boolean;
}

/** A day played, from its `day-opened` until another is. */
interface Opening {
  /** The request as played, which the stream holds while this day streams. */
  request: DayRequest;
  day: OpenedDay;
  /** A stop has arrived in the stream. */
  hasStop: boolean;
  /** Its `day-ended` or `day-left` is sent: nothing more is said of how it streamed. */
  isClosed: boolean;
  /** The gestures sent for it already, of those sent once a day. */
  gestures: Set<ProductEventKind>;
}

export interface DayEvents {
  /** Sends an event, when the page counts them; a gesture only the first time on a day. */
  send: (event: ProductEvent) => void;
  /**
   * A day starts playing, reached this way. A day still streaming before it was left. The
   * request played again as the same object, as React's Strict Mode plays a day on mount in
   * development, is the same opening. A day that comes with its ending, drawn whole as one
   * this device has seen or kept on the server, is ended as it opens, the way it ended
   * (`ended`): it has its stops, and no stream to end it.
   */
  open: (request: DayRequest, via: DayVia, ended?: DayOutcome["kind"]) => void;
  /** The day streaming was stopped with no day played in its place yet. */
  leave: () => void;
}

/**
 * The product's events about the days played (`docs/decisions.md`, "Product events are kept under a
 * visitor key that lives one day"): one `day-opened` for each, then exactly one of `day-ended`,
 * when its outcome arrives, or `day-left`, when another day replaces it, it is stopped, or the page
 * goes away before then. Counted only on the product's pages: anywhere else every event is dropped
 * here.
 */
export function useDayEvents(
  stream: Pick<DayStream, "request" | "partial" | "outcome">,
  isCounted: boolean,
): DayEvents {
  const opening = useRef<Opening | null>(null);

  const sendOut = useCallback(
    (event: ProductEvent, isLeaving: boolean) => {
      if (isCounted) sendProductEvent(event, { isLeaving });
    },
    [isCounted],
  );

  const leaveDay = useCallback(
    (isLeaving: boolean) => {
      const current = opening.current;
      if (current === null || current.isClosed) return;
      current.isClosed = true;
      const stage = current.hasStop ? "before-end" : "before-first-stop";
      sendOut({ kind: "day-left", ...current.day, stage }, isLeaving);
    },
    [sendOut],
  );

  const open = useCallback(
    (request: DayRequest, via: DayVia, ended?: DayOutcome["kind"]) => {
      if (opening.current?.request === request) return;
      leaveDay(false);
      const day = { city: daySlugOf(request), via, written: isWrittenRequest(request) };
      const isEnded = ended !== undefined;
      opening.current = {
        request,
        day,
        hasStop: isEnded,
        isClosed: isEnded,
        gestures: new Set(),
      };
      sendOut({ kind: "day-opened", ...day }, false);
      if (isEnded) sendOut({ kind: "day-ended", ...day, outcome: ended }, false);
    },
    [leaveDay, sendOut],
  );

  const send = useCallback(
    (event: ProductEvent) => {
      const gestures = opening.current?.gestures;
      if (gestures && ONCE_A_DAY.includes(event.kind)) {
        if (gestures.has(event.kind)) return;
        gestures.add(event.kind);
      }
      sendOut(event, false);
    },
    [sendOut],
  );

  const { request, partial, outcome } = stream;
  useEffect(() => {
    const current = opening.current;
    if (current === null || current.isClosed || request !== current.request) return;
    if ((partial?.stops?.length ?? 0) > 0) current.hasStop = true;
    if (outcome === null) return;
    current.isClosed = true;
    sendOut({ kind: "day-ended", ...current.day, outcome: outcome.kind }, false);
  }, [request, partial, outcome, sendOut]);

  useEffect(() => {
    const onPageHide = () => leaveDay(true);
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [leaveDay]);

  const leave = useCallback(() => leaveDay(false), [leaveDay]);
  return { send, open, leave };
}
