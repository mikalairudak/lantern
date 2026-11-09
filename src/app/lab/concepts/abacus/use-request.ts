"use client";

import { useEffect, useMemo, useState } from "react";
import { ENERGY_LEVELS, type Itinerary } from "@/lib/schema/itinerary.schema";
import { DEK, type DayDraft, type StopDraft } from "@/features/abacus/day-draft";
import { ALICANTE_DEK, dekOf, withFragment, type DekFragments, type DekPart } from "./dek";
import {
  ALICANTE_FACTS,
  answerFacts,
  answerKindOf,
  restorePart,
  optionOf,
  revisedFactOf,
  type Answer,
  type Facts,
} from "./facts";
import type { Keyframe } from "./pacing";
import {
  REASON,
  recomposedDayOf,
  recompositionLength,
  replanForEnergy,
  revealRecomposition,
  revisedFacts,
  type DayState,
  type RecomposingDay,
  type Recomposition,
} from "./recompose";
import {
  FAIL_AFTER_SECONDS,
  recompositionBoundaries,
  recompositionOffsetsOf,
  recompositionStreamOf,
} from "./recompose-stream";
import { ALICANTE_DEPENDS_ON, recompositionFor } from "./recompositions";
import type { HeaderState } from "./reserve";
import type { ArrivalOrigin } from "@/features/abacus/use-arrivals";
import { usePlayback } from "./use-playback";

const MS_PER_SECOND = 1000;
const IDLE: readonly Keyframe[] = [{ seconds: 0, budget: 0 }];
const IDLE_LIVE = { boundaries: [] };
const NO_ORIGINS: Readonly<Record<string, ArrivalOrigin>> = {};

/** One answer being re-composed by the model, or re-composed and still on screen. */
interface Run {
  id: number;
  answer: Answer;
  recomposition: Recomposition;
  keyframes: readonly Keyframe[];
  live: { boundaries: readonly number[] };
  /** The lab asked for this call to fail: it gives up after its first pause. */
  willFail: boolean;
  /** The facts before the answer, which a failed call goes back to. */
  before: Facts;
}

/** What the end of the facts line says. */
export type Slot =
  | { kind: "hint" }
  | { kind: "reason"; text: string; isWriting: boolean }
  | { kind: "error"; answer: Answer; name: string }
  | null;

interface RequestOptions {
  itinerary: Itinerary;
  /** The day as the first write-in has it; the request takes over once it is complete. */
  draft: DayDraft;
  /** The lab asks for the next re-composition to fail. */
  isNextFailing: boolean;
  /** A failing re-composition has started, so the lab control can go back to "ok". */
  onFailingUsed: () => void;
}

export interface Request {
  /** The facts as the sentence shows them, revisions included as they are written. */
  facts: Facts;
  /** The day on screen: the write-in, then the request's day with any re-composition. */
  day: RecomposingDay;
  /** The line about the day once it is written, by fragment. */
  dek: DekView;
  dependsOn: DayState["dependsOn"];
  /** A re-composition is streaming: nothing can be changed until it is done. */
  isRecomposing: boolean;
  /** The re-composition is silent for a while: the waiting line may show. */
  isWaiting: boolean;
  /** The stop being written again where the stream will write next, as it was before. */
  rewritingStop: StopDraft | null;
  /** Where each stop's bead was when the latest re-composition began, by stop id. */
  origins: Readonly<Record<string, ArrivalOrigin>>;
  /** The energy word as a level. */
  energy: number;
  slot: Slot;
  /**
   * A visitor's answer: confirmed, re-planned locally, or re-composed. `origins` are where
   * the stops' beads are now, for the stops a re-composition writes again.
   */
  answer: (answer: Answer, origins: Readonly<Record<string, ArrivalOrigin>>) => void;
  /** The energy word re-plans the day: the stops it would show, before they are shown. */
  replanned: (answer: Answer) => readonly StopDraft[] | null;
  /**
   * The states the header holds room for: the day on screen at rest; from the click, the
   * answer's finished state, and the failure it may end in.
   */
  reserve: readonly HeaderState[];
}

/** The line about the day as the header shows it, a re-composition's fragment as it goes. */
export interface DekView {
  /** Each part's fragment, the rewritten one as far as the stream has written it. */
  fragments: DekFragments;
  /** The part a re-composition rewrites, while it is on screen. */
  part: DekPart | null;
  /** The stream is writing that fragment now. */
  isWriting: boolean;
  /** That fragment is written in full. */
  isComplete: boolean;
}

/** The end of the facts line for some facts. */
function slotFor(
  facts: Facts,
  failed: Answer | null,
  hasChanged: boolean,
  isReasonWriting: boolean,
): Slot {
  if (failed) {
    return {
      kind: "error",
      answer: failed,
      name: optionOf(facts[failed.key], failed.value)?.name ?? "",
    };
  }
  const revised = revisedFactOf(facts);
  if (revised?.reason) return { kind: "reason", text: revised.reason, isWriting: isReasonWriting };
  return hasChanged ? null : { kind: "hint" };
}

function levelOf(facts: Facts): number {
  return Math.max(
    0,
    ENERGY_LEVELS.findIndex((level) => level === facts.energy.value),
  );
}

/**
 * The request sentence as the input. It holds the facts and the day once it is written,
 * and turns each answer into its change: a confirmed assumption, a local re-plan for the
 * energy word, or a re-composition streamed through the same machinery as the write-in.
 * A finished re-composition stays on screen and folds into the day at the next answer, so
 * nothing here sets state in reply to its own render.
 */
export function useRequest({
  itinerary,
  draft,
  isNextFailing,
  onFailingUsed,
}: RequestOptions): Request {
  const [facts, setFacts] = useState<Facts>(ALICANTE_FACTS);
  const [base, setBase] = useState<DayState>(() => ({
    fragments: ALICANTE_DEK,
    stops: itinerary.stops,
    dependsOn: ALICANTE_DEPENDS_ON,
  }));
  const [run, setRun] = useState<Run | null>(null);
  const [runCount, setRunCount] = useState(0);
  const [failed, setFailed] = useState<Answer | null>(null);
  const [hasChanged, setHasChanged] = useState(false);
  const [origins, setOrigins] = useState(NO_ORIGINS);

  const playback = usePlayback(run?.keyframes ?? IDLE, { live: run?.live ?? IDLE_LIVE });
  // A failing call writes nothing before it gives up.
  const budget = run && !run.willFail ? playback.written : 0;
  const revealed = useMemo(
    () => (run ? revealRecomposition(run.recomposition.generation, budget) : null),
    [run, budget],
  );
  const recomposed = useMemo(
    () => (run && revealed ? recomposedDayOf(base, run.answer, run.id, revealed) : null),
    [base, run, revealed],
  );
  const isRecomposing = run !== null && !(revealed?.isComplete ?? false);
  const shownFacts = useMemo(
    () => (revealed ? revisedFacts(facts, revealed.value) : facts),
    [facts, revealed],
  );

  // What the answer comes to once it is written in full, known from the click.
  const finished = useMemo(() => {
    if (!run) return null;
    const { generation } = run.recomposition;
    const whole = revealRecomposition(generation, recompositionLength(generation));
    return {
      facts: revisedFacts(facts, whole.value),
      stops: recomposedDayOf(base, run.answer, run.id, whole).stops,
      fragments: withFragment(base.fragments, generation.dekPart, generation.dek),
    };
  }, [run, base, facts]);

  const reserve = useMemo((): HeaderState[] => {
    const now: HeaderState = {
      facts,
      stops: base.stops,
      deks: [dekOf(base.fragments)],
      slot: slotFor(facts, failed, hasChanged, false),
    };
    if (!run || !finished) return [now];
    const done: HeaderState = {
      facts: finished.facts,
      stops: finished.stops,
      // The old fragment is erased as the new one is written: both hold their room.
      deks: [dekOf(base.fragments), dekOf(finished.fragments)],
      slot: slotFor(finished.facts, null, true, false),
    };
    if (!run.willFail) return [done];
    return [
      done,
      { ...now, facts: run.before, slot: slotFor(run.before, run.answer, true, false) },
    ];
  }, [run, finished, facts, base, failed, hasChanged]);

  // The lab's failing call gives up at the end of its first pause.
  useEffect(() => {
    if (!run?.willFail) return undefined;
    const timer = window.setTimeout(() => {
      setRun(null);
      setFacts(run.before);
      setFailed(run.answer);
    }, FAIL_AFTER_SECONDS * MS_PER_SECOND);
    return () => window.clearTimeout(timer);
  }, [run]);

  /** The day with a finished re-composition folded in, as the next answer starts from. */
  const settledDay = (): DayState =>
    run && recomposed?.isComplete && finished
      ? { ...base, fragments: finished.fragments, stops: recomposed.stops }
      : base;

  const replanned = (answer: Answer): readonly StopDraft[] | null => {
    if (answerKindOf(shownFacts, answer) !== "replan") return null;
    const to = ENERGY_LEVELS.findIndex((level) => level === answer.value);
    return replanForEnergy(settledDay().stops, levelOf(shownFacts), to);
  };

  const answer = (given: Answer, at: Readonly<Record<string, ArrivalOrigin>>) => {
    if (isRecomposing) return;
    const kind = answerKindOf(shownFacts, given);
    if (kind === "none") return;
    const day = settledDay();
    const next = answerFacts(shownFacts, given);
    setFailed(null);
    setHasChanged(true);
    if (kind === "confirm" || kind === "replan") {
      setRun(null);
      setBase(kind === "replan" ? { ...day, stops: replanned(given) ?? day.stops } : day);
      setFacts(next);
      return;
    }
    const recomposition = recompositionFor(given);
    if (!recomposition) return;
    const { generation } = recomposition;
    const id = runCount + 1;
    setRunCount(id);
    setBase(day);
    // The other words of this part of the day write themselves back as the answer moves in.
    const revised = generation.revisions.map((revision) => revision.key);
    setFacts(restorePart(next, given, revised, ALICANTE_FACTS));
    setOrigins(at);
    setRun({
      id,
      answer: given,
      recomposition,
      keyframes: recompositionStreamOf(generation),
      live: { boundaries: recompositionBoundaries(recompositionOffsetsOf(generation)) },
      willFail: isNextFailing,
      before: shownFacts,
    });
    if (isNextFailing) onFailingUsed();
  };

  const day: RecomposingDay = !draft.isComplete
    ? { ...draft, rewriting: [] }
    : (recomposed ?? {
        dek: dekOf(base.fragments),
        stops: [...base.stops],
        writing: null,
        rewriting: [],
        isComplete: true,
      });
  const rewritingStop = !isRecomposing
    ? null
    : (day.stops.find((stop) => day.rewriting.includes(stop.id) && !stop.primary.name) ?? null);
  const slot = slotFor(shownFacts, failed, hasChanged, day.writing === REASON);
  const fragment = revealed?.value.dek;
  const dek: DekView = run
    ? {
        fragments:
          fragment === undefined
            ? base.fragments
            : withFragment(base.fragments, run.recomposition.generation.dekPart, fragment),
        part: run.recomposition.generation.dekPart,
        isWriting: day.writing === DEK,
        // Until its rewrite starts, the old fragment stands whole.
        isComplete: fragment === undefined || (revealed?.isComplete ?? false),
      }
    : { fragments: base.fragments, part: null, isWriting: false, isComplete: true };

  return {
    facts: shownFacts,
    day,
    dek,
    dependsOn: base.dependsOn,
    isRecomposing,
    isWaiting: isRecomposing && playback.isWaiting,
    rewritingStop: rewritingStop
      ? (base.stops.find((stop) => stop.id === rewritingStop.id) ?? null)
      : null,
    origins,
    energy: levelOf(shownFacts),
    slot,
    answer,
    replanned,
    reserve,
  };
}
