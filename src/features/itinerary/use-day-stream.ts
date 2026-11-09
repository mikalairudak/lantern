"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DAY_ID_HEADER, isDayId } from "@/lib/days/stored-day";
import {
  DAY_VERSION_HEADER,
  WHOLE_DAY_HEADER,
  WRITTEN_VERSION_PATTERN,
} from "@/lib/days/written/version";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import type { DayOutcome, PartialDay } from "@/lib/stream/outcome";
import type { PlaceCheck } from "@/lib/stream/place-checks";

/** Each place's last check, by its id in the day: what a page shows of it. */
export type PlaceChecks = Readonly<Record<string, PlaceCheck>>;

/** No place checked: a written day played from its file, and any day before its first. */
export const NO_CHECKS: PlaceChecks = {};

/**
 * The reader carries the AI SDK's stream parser, the normalizer and the day's schemas, so it
 * loads with the first day played rather than with the page: the start screen shows a day
 * already written, and may never play one.
 */
const loadReader = () => import("@/lib/stream/read-day-stream");

/**
 * How many times a day that came back empty is asked for again before its ending is shown
 * (`docs/decisions.md`, "A day has at least one stop"): once, so an empty day never loops.
 */
const EMPTY_DAY_RETRIES = 1;

/**
 * Where a day's stream comes from: the app's route (`routeSourceFor`), which streams a written
 * day through the simulator and, with live generation on, any other day from Claude, or the
 * simulator in the page, as the lab plays it. Both send the AI SDK's UI message stream, so the
 * hook reads either.
 */
export interface DaySource {
  /** Already parsed through `DayRequestSchema`; the normalizer takes its city, date and zone. */
  request: DayRequest;
  /**
   * Opens the stream with the signal that stops it. The same signal goes to the reader, so
   * stopping during the body is the caller's own abort, not a lost connection. Opened once
   * more, the same request under the same signature, for a day that came back empty.
   */
  open: (signal: AbortSignal) => Promise<Response>;
}

export interface DayStream {
  /**
   * What the day playing, or played last, was asked for: set the moment it starts, so the
   * request can be said before the first token arrives.
   */
  request: DayRequest | null;
  /**
   * The day as far as it has streamed, in schema order, at most one new one a frame. Null
   * before a day starts and after a refusal; kept when a stream is cut or dropped, so a
   * failure can show what arrived.
   */
  partial: PartialDay | null;
  /**
   * How the stream ended: null before it ends, and for a day that was stopped. A day that
   * came back empty the first time is asked for again instead, so only the second is one.
   */
  outcome: DayOutcome | null;
  /**
   * Which time the day playing is being read: 0, then 1 while it is asked for again after
   * coming back empty, its partial back to nothing.
   */
  attempt: number;
  /**
   * The last frame of the day that came back empty, while it is asked for again: what was
   * on the page, for the page to hold until the day asked again has begun. Null otherwise.
   */
  held: PartialDay | null;
  /**
   * The day's id in the generation log, as its answer names it (`DAY_ID_HEADER`), once the
   * answer has arrived: a live day's or a re-plan's, for its own address. Null for a day
   * played from its file, and until the answer comes.
   */
  dayId: string | null;
  /**
   * A written day's version as its answer says it (`DAY_VERSION_HEADER`), and whether it came
   * whole at once, as to a browser that has watched that version to its end. Null for a day
   * Lantern writes, and until the answer comes.
   */
  written: WrittenAnswer | null;
  /**
   * Each place's check as the answer carries it, by the place's id (`docs/grounding.md`):
   * `checking` as its lookup starts, then how it ended. Empty for a day played from its file.
   */
  checks: PlaceChecks;
  isStreaming: boolean;
  /** Starts a day, stopping any day still streaming. */
  play: (source: DaySource) => void;
  /** Stops the day without an outcome, as when the visitor leaves it. */
  stop: () => void;
}

/** What a written day's answer says of it. */
export interface WrittenAnswer {
  version: string;
  isWhole: boolean;
}

/** One played day: what stops it, and the partial waiting for the next frame. */
interface Run {
  controller: AbortController;
  frame: number | null;
  pending: PartialDay | null;
  /** The checks so far, taken by the page with the partial, a frame at a time. */
  checks: PlaceChecks;
  attempt: number;
}

/** The day came back empty, and has not been asked for again as many times as it may be. */
function isAskedAgain(ended: DayOutcome, attempt: number): boolean {
  return ended.kind === "invalid" && ended.isEmpty && attempt < EMPTY_DAY_RETRIES;
}

/**
 * Reads a day's stream into React state (`docs/harness.md`, "The outcome protocol"). The
 * reader parses every delta; the page takes the latest partial once a frame, because a
 * day of a few thousand deltas would otherwise render a few thousand times.
 */
export function useDayStream(): DayStream {
  const [request, setRequest] = useState<DayRequest | null>(null);
  const [partial, setPartial] = useState<PartialDay | null>(null);
  const [outcome, setOutcome] = useState<DayOutcome | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [held, setHeld] = useState<PartialDay | null>(null);
  const [dayId, setDayId] = useState<string | null>(null);
  const [written, setWritten] = useState<WrittenAnswer | null>(null);
  const [checks, setChecks] = useState<PlaceChecks>(NO_CHECKS);
  const [isStreaming, setIsStreaming] = useState(false);
  // A failure that is not a stream's: thrown while rendering, so an error boundary sees it.
  const [bug, setBug] = useState<{ error: unknown } | null>(null);
  const run = useRef<Run | null>(null);

  const stop = useCallback(() => {
    const current = run.current;
    if (!current) return;
    run.current = null;
    current.controller.abort();
    if (current.frame !== null) cancelAnimationFrame(current.frame);
    setIsStreaming(false);
  }, []);

  const play = useCallback(
    (source: DaySource) => {
      stop();
      const current: Run = {
        controller: new AbortController(),
        frame: null,
        pending: null,
        checks: NO_CHECKS,
        attempt: 0,
      };
      run.current = current;
      setRequest(source.request);
      setPartial(null);
      setOutcome(null);
      setAttempt(0);
      setHeld(null);
      setDayId(null);
      setWritten(null);
      setChecks(NO_CHECKS);
      setIsStreaming(true);

      const { signal } = current.controller;
      const commit = () => {
        current.frame = null;
        setPartial(current.pending);
        setChecks(current.checks);
      };
      const read = () => {
        // Opened in the same task, so the reader loads while the stream connects, but after
        // the code that played it has finished: a day stopped by then is never opened. React's
        // Strict Mode mounts a component, unmounts it and mounts it again at once in
        // development, so a day played on mount is stopped and played again in one task, and
        // opening at once would send the route two requests, the first a model call and a
        // visitor's limit spent on a day nobody reads.
        const response = Promise.resolve().then(() => {
          signal.throwIfAborted();
          return source.open(signal);
        });
        // Until the reader holds it, a stop's abort is not an unhandled rejection.
        response.catch(() => undefined);
        // Named before the body arrives, so the day can take its address as it is written.
        response.then(
          (answer) => {
            const id = answer.headers.get(DAY_ID_HEADER);
            if (run.current === current && id !== null && isDayId(id)) setDayId(id);
            const version = answer.headers.get(DAY_VERSION_HEADER);
            if (
              run.current === current &&
              version !== null &&
              WRITTEN_VERSION_PATTERN.test(version)
            ) {
              setWritten({ version, isWhole: answer.headers.get(WHOLE_DAY_HEADER) === "1" });
            }
          },
          () => undefined,
        );
        loadReader()
          .then(
            ({ readDayStream }) =>
              readDayStream({
                request: source.request,
                // Passed on as it is, so an `open` that rejects reads as a lost connection.
                response,
                signal,
                onPartial: (next) => {
                  current.pending = next;
                  current.frame ??= requestAnimationFrame(commit);
                },
                onPlaceCheck: (check) => {
                  current.checks = { ...current.checks, [check.placeId]: check };
                  current.frame ??= requestAnimationFrame(commit);
                },
              }),
            // A reader that cannot load is a connection lost before anything arrived, and the
            // stream opened beside it is closed, since nothing will read it.
            (): DayOutcome => {
              current.controller.abort();
              return { kind: "disconnected", itinerary: null };
            },
          )
          .then(
            (ended) => {
              // A day played since, or stopped, has the page now.
              if (run.current !== current) return;
              if (current.frame !== null) cancelAnimationFrame(current.frame);
              current.frame = null;
              // An empty day is the model's, not the visitor's: the route gave their day back,
              // and the same day is asked for again, written from its empty frame.
              if (isAskedAgain(ended, current.attempt)) {
                current.attempt += 1;
                setHeld(current.pending);
                current.pending = null;
                current.checks = NO_CHECKS;
                setChecks(NO_CHECKS);
                setPartial(null);
                setAttempt(current.attempt);
                read();
                return;
              }
              run.current = null;
              // The last partial lands with the outcome, except after a refusal, which shows none.
              setPartial(ended.kind === "refused" ? null : current.pending);
              setChecks(current.checks);
              setOutcome(ended);
              setIsStreaming(false);
            },
            (error: unknown) => {
              // The reader rejects only for its caller's abort; anything else is a bug.
              if (!signal.aborted) setBug({ error });
            },
          );
      };
      read();
    },
    [stop],
  );

  // Leaving the page stops its day, so nothing reads a stream nobody sees.
  useEffect(() => stop, [stop]);

  if (bug) throw bug.error;
  return {
    request,
    partial,
    outcome,
    attempt,
    held,
    dayId,
    written,
    checks,
    isStreaming,
    play,
    stop,
  };
}
