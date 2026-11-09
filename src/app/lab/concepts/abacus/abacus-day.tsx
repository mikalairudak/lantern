"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react";
import type { GeneratedDay, Itinerary } from "@/lib/schema/itinerary.schema";
import { revealDay } from "./stand-in-stream";
import { SUNRISE_ALTITUDE, sunCrossing } from "@/lib/geo/sun";
import { changesOf, clauseOf } from "@/features/abacus/clause";
import { candidatesOf, midOf, midsOf, writtenEnergyOf } from "@/features/abacus/curve";
import { DEK, NO_STOPS_OPEN, draftDayOf } from "@/features/abacus/day-draft";
import { DayHeader } from "./day-header";
import { DayRows } from "@/features/abacus/day-rows";
import type { Answer, FactKey } from "./facts";
import type { Density } from "@/features/abacus/density";
import { useDrawing } from "@/features/abacus/drawing";
import { dayBounds } from "@/features/abacus/geometry";
import { axisLightWithin, dayContextOf, dayLightOf } from "@/features/abacus/light";
import type { Keyframe } from "./pacing";
import { recompositionFor } from "./recompositions";
import { hoursOf, wordViewsOf } from "./request-sentence";
import { headerReserveOf } from "./reserve";
import { useArrivals, type ArrivalOrigin } from "@/features/abacus/use-arrivals";
import { useInvitation } from "@/features/abacus/use-invitation";
import type { ElementSize } from "@/components/ui/use-element-size";
import { useEnergyCurve } from "@/features/abacus/use-energy-curve";
import { usePlayback, type PlaybackOptions } from "./use-playback";
import { useRequest } from "./use-request";
import { useSprung } from "@/components/ui/use-sprung";
import { waitingInPlace, waitingOver } from "@/features/abacus/waiting";

/** What the lab controls ask of the day on screen. */
export interface DayHandle {
  reset: () => void;
}

/**
 * A still of the day for the lab's matrix: frozen after `written` characters of its
 * stream, without its header or the ring that invites a drag, with a stop open and versions swapped
 * in as given.
 */
export interface DayStill {
  written: number;
  openStop: number | null;
  /** Versions put in as a visitor would: a stop's index, and the candidate shown. */
  picks: readonly (readonly [number, number])[];
  /** Every row at one density, whatever its energy says; null to let energy decide. */
  density: Density | null;
}

interface AbacusDayProps {
  itinerary: Itinerary;
  /** Shows the day as a still for the lab's matrix; see `DayStill`. */
  still?: DayStill;
  weather: string;
  /**
   * The chart spans the stops alone rather than the hours the request asks for. The edge
   * days set it: the header's request is the Alicante concept's, and its hours are not theirs.
   */
  isFramedByStops?: boolean;
  generated: GeneratedDay;
  keyframes: readonly Keyframe[];
  live: PlaybackOptions["live"];
  startsComplete: boolean;
  /**
   * Whether a silence of the write-in shows the waiting line. A replay has no real
   * silences, so it shows none.
   */
  isWaitingShown: boolean;
  /** The lab asks for the next re-composition to fail, once. */
  isNextFailing: boolean;
  onFailingUsed: () => void;
  chartSize: ElementSize | null;
  chartRef: (element: HTMLDivElement | null) => void;
  onInteractiveChange: (isInteractive: boolean) => void;
  ref: Ref<DayHandle>;
}

/** One run of the day: written in from the empty frame, then open to the visitor. */
export function AbacusDay({
  itinerary,
  still,
  weather,
  isFramedByStops = false,
  generated,
  keyframes,
  live,
  startsComplete,
  isWaitingShown,
  isNextFailing,
  onFailingUsed,
  chartSize: size,
  chartRef,
  onInteractiveChange,
  ref,
}: AbacusDayProps) {
  const playback = usePlayback(keyframes, { startsComplete, live });
  const written = still?.written ?? playback.written;
  const isWaiting = !still && playback.isWaiting;
  const draft = useMemo(() => draftDayOf(revealDay(generated, written)), [generated, written]);
  const request = useRequest({ itinerary, draft, isNextFailing, onFailingUsed });
  const { day } = request;
  const { stops } = day;
  const isSilent = isWaiting && isWaitingShown;

  const [openStop, setOpenStop] = useState<number | null>(still?.openStop ?? null);
  const [hoveredStop, setHoveredStop] = useState<number | null>(null);
  // A candidate hovered on the chart: the chart names its bead.
  const [hoveredPlace, setHoveredPlace] = useState<string | null>(null);
  // A word of the request under the pointer or the focus: the stops it shaped light up.
  const [litFact, setLitFact] = useState<FactKey | null>(null);
  const arrivals = useArrivals(stops, request.energy, request.origins);
  const energy = useEnergyCurve(stops);
  // Nothing can be dragged, keyed, opened or answered until the day is written, every bead
  // rests, and no answer is being re-composed.
  const isInteractive =
    draft.isComplete && day.isComplete && arrivals.isSettled && !request.isRecomposing;
  const invitation = useInvitation({ stops, isInteractive: isInteractive && !still });
  // A still puts its versions in once the day it shows is written, as a visitor would, and
  // only once: each pick changes the curve, and with it the function that makes the next.
  const stillPicks = still?.picks;
  const choose = energy.choose;
  const hasPicked = useRef(false);
  useEffect(() => {
    if (!stillPicks || !draft.isComplete || hasPicked.current) return;
    hasPicked.current = true;
    for (const [stopIndex, candidate] of stillPicks) choose(stopIndex, candidate);
  }, [stillPicks, draft.isComplete, choose]);
  // The headline follows the list: it changes when a drag ends, not during it.
  const clause = clauseOf(changesOf(stops, energy.committed));
  const reserve = useMemo(() => headerReserveOf(request.reserve), [request.reserve]);
  useImperativeHandle(ref, () => ({ reset: energy.reset }), [energy.reset]);
  useEffect(() => onInteractiveChange(isInteractive), [isInteractive, onInteractiveChange]);

  // The frame follows the hours the request asks for, and springs when an answer moves them.
  const bounds = dayBounds(stops, isFramedByStops ? undefined : hoursOf(request.facts));
  const dayStart = useSprung(bounds.start);
  const dayEnd = useSprung(bounds.end);
  const context = useMemo(() => dayContextOf(itinerary), [itinerary]);
  const dayLight = useMemo(() => dayLightOf(context), [context]);
  const light = axisLightWithin(dayLight, dayStart, dayEnd);
  const sunrise = useMemo(() => sunCrossing(context, SUNRISE_ALTITUDE, "rising"), [context]);
  const sunset = useMemo(() => sunCrossing(context, SUNRISE_ALTITUDE, "setting"), [context]);
  // The day's time scale is fitted to the room the column has; the rows take more if their
  // words need it, and the column scrolls. It is fitted once per width: when an answer makes
  // the header taller, the rows below move together rather than being rescaled.
  const [basis, setBasis] = useState<ElementSize | null>(null);
  if (size && size.width > 0 && size.width !== basis?.width) setBasis(size);
  const { chart } = useDrawing();
  const basisHeight = basis ? Math.max(chart.minHeight, basis.height) : 0;

  // A re-composition waits in the place of the stop it writes next.
  const rewriting = request.rewritingStop;
  const rewritten = rewriting ? stops.find((stop) => stop.id === rewriting.id) : undefined;
  const waitingInRow =
    request.isWaiting && rewriting && rewritten
      ? waitingInPlace(rewriting, arrivals.of(rewritten).mid ?? midOf(stops, rewritten))
      : null;
  const waiting =
    waitingInRow ?? (isSilent ? waitingOver(stops, { start: dayStart, end: dayEnd }) : null);

  const factLit =
    litFact === null
      ? []
      : stops.flatMap((stop, index) =>
          (request.dependsOn[stop.id] ?? []).includes(litFact) ? [index] : [],
        );
  const litStops = [openStop, hoveredStop, ...factLit].filter(
    (index, at, all): index is number => index !== null && all.indexOf(index) === at,
  );

  /** Where each stop's shown bead is now, for the stops an answer writes again. */
  const originsNow = (): Record<string, ArrivalOrigin> => {
    const mids = midsOf(stops);
    return Object.fromEntries(
      stops.map((stop, index) => {
        const shown = candidatesOf(stop)[energy.selected[index] ?? 0] ?? stop.primary;
        const level = writtenEnergyOf(shown) ?? request.energy;
        return [stop.id, { energy: level, mid: mids[index] ?? 0 }];
      }),
    );
  };

  const answer = (given: Answer) => {
    const replanned = request.replanned(given);
    if (replanned) energy.replan(replanned);
    setOpenStop(null);
    request.answer(given, originsNow());
  };

  // The energy word's options are the scale itself and need no line; the others say what
  // they would change.
  const consequenceOf = (given: Answer): string | null =>
    given.key === "energy" ? null : (recompositionFor(given)?.consequence ?? null);

  const toggleStop = (index: number) => setOpenStop((open) => (open === index ? null : index));
  const closeStop = useCallback(() => setOpenStop(null), []);

  const rows = basis && (
    <DayRows
      width={basis.width}
      basisHeight={basisHeight}
      dayStart={dayStart}
      dayEnd={dayEnd}
      stops={stops}
      densityOverride={still?.density ?? null}
      picks={energy.committed}
      energy={energy}
      arrivals={arrivals}
      requestedEnergy={request.energy}
      light={light}
      daylight={context}
      city={itinerary.city}
      sunrise={sunrise}
      sunset={sunset}
      writing={day.writing}
      isInteractive={isInteractive}
      isStill={still !== undefined}
      // Its re-compositions write stops again in place, so nothing opens until it is whole.
      openableStops={NO_STOPS_OPEN}
      invitation={invitation}
      waiting={waiting}
      openStop={openStop}
      litStops={litStops}
      rewriting={day.rewriting}
      rewritingStop={rewriting?.id ?? null}
      hoveredPlace={hoveredPlace}
      onToggleStop={toggleStop}
      onTapStop={setOpenStop}
      onCloseStop={closeStop}
      onHoverStop={setHoveredStop}
      onHoverPlace={setHoveredPlace}
    />
  );

  // A still is the chart and its rows alone, measured by the cell it sits in rather than by
  // the screen's breakpoints, so a phone-wide cell shows a phone's rows on any screen. Its
  // time scale is the chart's least, so a few stops make a compact cell.
  if (still) {
    return (
      <div className="relative min-w-0">
        <div
          ref={chartRef}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-0"
        />
        {rows}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-page flex-col px-4 md:px-10 lg:h-dvh lg:px-16">
      <DayHeader
        itinerary={itinerary}
        weather={weather}
        sentence={{
          words: wordViewsOf(request.facts, consequenceOf),
          clause,
          isEnabled: isInteractive,
          isQuestionWritten: draft.isComplete,
          onChoose: answer,
          onLight: setLitFact,
        }}
        dek={
          draft.isComplete
            ? { kind: "fragments", view: request.dek }
            : { kind: "streamed", text: draft.dek, isWriting: draft.writing === DEK }
        }
        slot={request.slot}
        onRetry={answer}
        isWaiting={isSilent || request.isWaiting}
        sunrise={sunrise}
        sunset={sunset}
        reserve={reserve}
      />
      <div className="relative min-w-0 lg:min-h-0 lg:max-w-abacus lg:flex-1">
        {/* Measures the room the day has: a phone's day height, or the column on a laptop. */}
        <div
          ref={chartRef}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-day lg:h-full"
        />
        <div className="pb-24 lg:absolute lg:inset-0 lg:overflow-y-auto lg:pb-6">{rows}</div>
      </div>
    </div>
  );
}
