"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DAY_ID_HEADER, isDayId } from "@/lib/days/stored-day";
import type { ReplanBasis } from "@/lib/replan/merge";
import { REPLAN_WHOLE_DAY_STATUS } from "@/lib/replan/request";
import type { DayOutcome } from "@/lib/stream/outcome";
import type { PartialReplan } from "@/lib/stream/read-replan-stream";
import { NO_CHECKS, type PlaceChecks } from "./use-day-stream";

/**
 * The reader carries the normalizer and the merge, so it loads with the first re-plan rather
 * than with the page, as the day's reader does.
 */
const loadReader = () => import("@/lib/stream/read-replan-stream");

/**
 * Where a targeted re-plan's stream comes from (`docs/targeted-replan.md`): the app's route,
 * or a lab's recorded stream. The basis is what the page holds before it streams: the day on
 * screen, the request with the changed word, its windows and the round's prefix.
 */
export interface ReplanSource {
  basis: ReplanBasis;
  open: (signal: AbortSignal) => Promise<Response>;
}

export interface ReplanStream {
  /** What the re-plan playing, or played last, reads against; null before the first. */
  basis: ReplanBasis | null;
  /** The re-plan as far as it has streamed, at most one new one a frame. */
  partial: PartialReplan | null;
  /**
   * How it ended: `complete` with the merged day, anything else with the day as it was. Null
   * while it streams, and for a re-plan the route sent on to the whole day's route.
   */
  outcome: DayOutcome | null;
  /** The route answered that the word re-plans the whole day (a 409): the page asks for a day. */
  isWholeDay: boolean;
  /**
   * The route answered with the re-plan's stream: only then is the day's part struck through,
   * so a word sent on to the whole day never strikes it and takes it back.
   */
  isAnswered: boolean;
  /** Each new place's check, by its id in the merged day. */
  checks: PlaceChecks;
  /**
   * The re-plan's id in the log, as its answer names it (`DAY_ID_HEADER`): the merged day's
   * own address, which opens it as merged. Null until the answer comes, and from a lab.
   */
  dayId: string | null;
  isStreaming: boolean;
  play: (source: ReplanSource) => void;
  stop: () => void;
}

interface Run {
  controller: AbortController;
  frame: number | null;
  pending: PartialReplan | null;
  checks: PlaceChecks;
}

/**
 * Reads a targeted re-plan's stream into React state, a frame at a time as the day's stream
 * is read (`useDayStream`): its partial re-plans, its place checks and its outcome, the merged
 * day when it completes. A re-plan is all or nothing: any other ending leaves the day as it was.
 */
export function useReplanStream(): ReplanStream {
  const [basis, setBasis] = useState<ReplanBasis | null>(null);
  const [partial, setPartial] = useState<PartialReplan | null>(null);
  const [outcome, setOutcome] = useState<DayOutcome | null>(null);
  const [isWholeDay, setIsWholeDay] = useState(false);
  const [isAnswered, setIsAnswered] = useState(false);
  const [checks, setChecks] = useState<PlaceChecks>(NO_CHECKS);
  const [dayId, setDayId] = useState<string | null>(null);
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
    (source: ReplanSource) => {
      stop();
      const current: Run = {
        controller: new AbortController(),
        frame: null,
        pending: null,
        checks: NO_CHECKS,
      };
      run.current = current;
      setBasis(source.basis);
      setPartial(null);
      setOutcome(null);
      setIsWholeDay(false);
      setIsAnswered(false);
      setChecks(NO_CHECKS);
      setDayId(null);
      setIsStreaming(true);
      const { signal } = current.controller;
      const commit = () => {
        current.frame = null;
        setPartial(current.pending);
        setChecks(current.checks);
      };
      // Opened after the code that played it, as a day is, so one stopped at once is never sent.
      const response = Promise.resolve().then(() => {
        signal.throwIfAborted();
        return source.open(signal);
      });
      response.catch(() => undefined);
      const isLatest = () => run.current === current;
      void response.then(
        (answer) => {
          const id = answer.headers.get(DAY_ID_HEADER);
          if (isLatest() && id !== null && isDayId(id)) setDayId(id);
          if (isLatest() && answer.ok) setIsAnswered(true);
          if (!isLatest() || answer.status !== REPLAN_WHOLE_DAY_STATUS) return;
          run.current = null;
          setIsWholeDay(true);
          setIsStreaming(false);
        },
        () => undefined,
      );
      void loadReader()
        .then(
          ({ readReplanStream }) =>
            readReplanStream({
              basis: source.basis,
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
          (): DayOutcome => {
            current.controller.abort();
            return { kind: "disconnected", itinerary: null };
          },
        )
        .then(
          (ended) => {
            if (!isLatest()) return;
            run.current = null;
            if (current.frame !== null) cancelAnimationFrame(current.frame);
            current.frame = null;
            setPartial(current.pending);
            setChecks(current.checks);
            setOutcome(ended);
            setIsStreaming(false);
          },
          (error: unknown) => {
            // The reader rejects only for its caller's abort; anything else is a bug.
            if (!signal.aborted) setBug({ error });
          },
        );
    },
    [stop],
  );

  // Leaving the page stops its re-plan.
  useEffect(() => stop, [stop]);

  if (bug) throw bug.error;
  return {
    basis,
    partial,
    outcome,
    isWholeDay,
    isAnswered,
    checks,
    dayId,
    isStreaming,
    play,
    stop,
  };
}
