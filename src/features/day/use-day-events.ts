"use client";

import { useCallback, useEffect, useRef } from "react";
import type { DayStream } from "@/features/itinerary/use-day-stream";
import type { DayAct, DayAnswer, DayVia, ProductEvent } from "@/lib/events/event.schema";
import type { DayOutcome } from "@/lib/stream/outcome";
import { sendProductEvent, type SendOptions } from "@/lib/events/send-event";
import { isWrittenRequest } from "@/lib/days/written/requests";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import { daySlugOf } from "@/lib/days/address";
import { isInRenderingCrawler } from "./seen-days";
import { readDayView } from "./view-choice";

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
  /** What the visitor has done with this day already, each told once. */
  acts: Set<DayAct>;
  /** The day's end was answered: once a day opened. */
  isAnswered: boolean;
}

export interface DayEvents {
  /** Sends an event that says what it is about itself, when the page counts them. */
  send: (event: ProductEvent) => void;
  /**
   * Tells what the visitor did with the day on screen, with the day as it was opened and the
   * view it is read in, the first time on that day alone: whether the visitor dragged, swapped,
   * took the day along or read it to its end is the question, and a held arrow key, one pull a
   * step, or a link copied again and again would otherwise spend a visitor's events for the day.
   * Nothing is told before a day is opened.
   */
  act: (act: DayAct) => void;
  /** The visitor's answer at the day's end, told once a day opened, with the view it is read in. */
  answer: (answer: DayAnswer) => void;
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
 * Sends one product event from a page that counts them. A search engine's renderer sends none,
 * so a crawl never reads as a visitor (`isInRenderingCrawler`).
 */
function sendCounted(event: ProductEvent, options: SendOptions): void {
  if (isInRenderingCrawler()) return;
  sendProductEvent(event, options);
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
      if (isCounted) sendCounted(event, { isLeaving });
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
        acts: new Set(),
        isAnswered: false,
      };
      sendOut({ kind: "day-opened", ...day }, false);
      if (isEnded) {
        sendOut({ kind: "day-ended", ...day, view: readDayView(), outcome: ended }, false);
      }
    },
    [leaveDay, sendOut],
  );

  const send = useCallback((event: ProductEvent) => sendOut(event, false), [sendOut]);

  const act = useCallback(
    (kind: DayAct) => {
      const current = opening.current;
      if (current === null || current.acts.has(kind)) return;
      current.acts.add(kind);
      sendOut({ kind, ...current.day, view: readDayView() }, false);
    },
    [sendOut],
  );

  const answer = useCallback(
    (given: DayAnswer) => {
      const current = opening.current;
      if (current === null || current.isAnswered) return;
      current.isAnswered = true;
      sendOut({ kind: "day-answered", ...current.day, view: readDayView(), answer: given }, false);
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
    sendOut(
      { kind: "day-ended", ...current.day, view: readDayView(), outcome: outcome.kind },
      false,
    );
  }, [request, partial, outcome, sendOut]);

  useEffect(() => {
    const onPageHide = () => leaveDay(true);
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [leaveDay]);

  const leave = useCallback(() => leaveDay(false), [leaveDay]);
  return { send, act, answer, open, leave };
}

/** What a page remembers of having told that the start screen was opened. */
export interface HomeViewMemory {
  /** Told already on this page. */
  readonly isTold: boolean;
  onTold: () => void;
}

/** Whether this page load has told that the start screen was opened. */
let isHomeToldThisLoad = false;

/**
 * The page load's memory, kept by the module, so a client navigation back to the start screen,
 * as from the privacy page, tells nothing again, and only a load of the page starts it afresh.
 */
export const PAGE_HOME_VIEW_MEMORY: HomeViewMemory = {
  get isTold() {
    return isHomeToldThisLoad;
  },
  onTold: () => {
    isHomeToldThisLoad = true;
  },
};

/**
 * Tells that the start screen was opened, once a page load, whatever days it plays after or
 * however often it is drawn again: the top of the way from the start screen to a day taken
 * along. Counted only on the product's own page, and never from a search engine's renderer.
 */
export function useHomeViewed(
  isCounted: boolean,
  memory: HomeViewMemory = PAGE_HOME_VIEW_MEMORY,
): void {
  useEffect(() => {
    // Read and set in one step, so React's Strict Mode, which runs effects twice, tells once.
    if (!isCounted || memory.isTold) return;
    memory.onTold();
    sendCounted({ kind: "home-viewed" }, { isLeaving: false });
  }, [isCounted, memory]);
}
