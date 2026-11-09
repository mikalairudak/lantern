"use client";

import { MotionConfig } from "motion/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useElementSize, type ElementSize } from "@/components/ui/use-element-size";
import { useSprung } from "@/components/ui/use-sprung";
import { CellNote, StillNote, useStill } from "@/features/itinerary/use-still";
import { SUNRISE_ALTITUDE, sunCrossing } from "@/lib/geo/sun";
import { ENERGY_LEVELS } from "@/lib/schema/itinerary.schema";
import { SPRINGS } from "@/lib/tokens/motion";
import { NO_STOPS_OPEN, hasEnergy, openableStopsOf, type StopDraft } from "./day-draft";
import { DayRows } from "./day-rows";
import type { Density } from "./density";
import { useDrawing } from "./drawing";
import {
  CHART,
  basisAtPaceOf,
  dayBounds,
  paceOf,
  wholeDayEndOf,
  type ChartSizes,
  type DaySpan,
} from "./geometry";
import { axisLightWithin, dayContextOf, dayLightOf } from "./light";
import {
  STOP_ROW_EXAMPLES,
  stillOf,
  type StopRowExample,
  type StopRowState,
  type StillFrame,
  type StopRowStill,
} from "./stop-row-examples";
import { useArrivals } from "./use-arrivals";
import { useInvitation } from "./use-invitation";
import { useEnergyCurve } from "./use-energy-curve";
import { candidatesOf, energyOf, midOf, modelPick, plannedPlace, type CurveStop } from "./curve";
import { keyedCandidateOf } from "./version-tags";
import { bareStopOf, waitingInBareRow, waitingOver, type Waiting } from "./waiting";

/**
 * A cell's frame on the page's: from the cell's first hour to the end of the page's frame,
 * with time running at the page's pace. In a silence the pen's tick on the time axis then
 * stands as far below the last row as on the page, beside the phrase hung under that row,
 * and the axis's last run of light ends where the page's does. The page fits its frame to its day height
 * (`h-day` on a phone), never less than the chart's least. A whole day's frame ends where the
 * page ends it once its stream has ended, on the whole hour after `whole`'s last visit.
 */
export function cellFrameOf(
  cell: DaySpan,
  page: DaySpan,
  dayHeight: number,
  whole: Parameters<typeof wholeDayEndOf>[0] | null = null,
  chart: ChartSizes = CHART,
): { bounds: DaySpan; basisHeight: number } {
  const pace = paceOf(page, dayHeight, chart);
  const end = whole ? wholeDayEndOf(whole, page, pace, chart) : page.end;
  const bounds = { start: cell.start, end };
  return { bounds, basisHeight: basisAtPaceOf(bounds, pace, chart) };
}

/** The example a cell is set on; an index past the examples is a mistake in the matrix. */
function exampleAt(example: number): StopRowExample {
  const chosen = STOP_ROW_EXAMPLES[example];
  if (!chosen) {
    throw new Error(`The stop row has no example ${example}: it has ${STOP_ROW_EXAMPLES.length}`);
  }
  return chosen;
}

export interface StopRowCellProps {
  /** Into `STOP_ROW_EXAMPLES`. */
  example: number;
  state: StopRowState;
  /** Every row at one density; null lets each row's energy decide, as the day does. */
  density: Density | null;
}

/**
 * What a proposed cell of a one-stop day says: a fork draws a proposal for part of a day beside
 * it, and a word changed over all of it proposes the whole day (`/api/replan` answers 409).
 */
export const ONLY_STOP_NEVER_PROPOSED =
  "A day of one stop has no part proposed beside it: a word changed over all of it proposes the whole day.";

/**
 * One stop row in one state, as the lab's matrix shows it: the example's stop between its
 * neighbours, the day frozen at the moment of its real stream the state names.
 */
export function StopRowCell({ example, state, density }: StopRowCellProps) {
  const chosen = exampleAt(example);
  const reading = useStill(stillOf(chosen, state));

  if (reading.status !== "read") return <StillNote reading={reading} />;
  if (state === "proposed" && reading.still.draft.stops.length < 2) {
    return <CellNote>{ONLY_STOP_NEVER_PROPOSED}</CellNote>;
  }
  return (
    <MotionConfig reducedMotion="user" transition={SPRINGS.layout}>
      <StillRows
        key={`${example}:${state}`}
        still={reading.still}
        requestedEnergy={ENERGY_LEVELS.indexOf(chosen.fixture.request.energy)}
        isOpen={state === "open" || state === "open-written"}
        isSwapped={state === "swapped"}
        isInvited={state === "invited"}
        isProposed={state === "proposed"}
        isPenStill={state === "weighing"}
        naming={NAMING_OF[state]}
        density={density}
      />
    </MotionConfig>
  );
}

/** What names a version in a state that names one: a pointer, the keys, or a drag. */
const NAMING_OF: Partial<Record<StopRowState, Naming>> = {
  named: "pointer",
  keyed: "keys",
  dragged: "drag",
};

/** What a still holds as a hand would, to name a version of its stop. */
type Naming = "pointer" | "keys" | "drag";

interface StillRowsProps {
  still: StopRowStill;
  requestedEnergy: number;
  isOpen: boolean;
  /** Its next version is put in, as a visitor would. */
  isSwapped: boolean;
  /**
   * The ring that invites the first drag waits at this stop, with the example of a pull
   * there, as the day draws them once it can be dragged; a still is never dragged, so they
   * stay. Left out, no stop is invited.
   */
  isInvited?: boolean;
  /**
   * A changed word's proposal beside the day: compact and blue, off the day's curve, a dashed
   * curve through it from its neighbours.
   */
  isProposed?: boolean;
  /** Its pens stop where they are, as the frame a row is weighed in. */
  isPenStill?: boolean;
  /**
   * A version of its stop named as a hand would name it: a pointer resting on the next
   * version's bead, the keys focusing its slider, or a drag holding it on the next version.
   */
  naming?: Naming;
  density: Density | null;
}

/**
 * The waiting line a still's frame shows: under the last row in a silence, in the bare row's
 * own place when the silence waits for that row's bead.
 */
function waitingOf(frame: StillFrame, stops: readonly StopDraft[]): Waiting | null {
  if (frame.kind === "silence") return waitingOver(stops, frame.page);
  if (frame.kind !== "bare") return null;
  const bare = bareStopOf(stops);
  return bare ? waitingInBareRow(stops, bare, midOf(stops, bare)) : null;
}

/**
 * The chart and its rows alone, measured by the cell it sits in rather than by the
 * screen's breakpoints, so a phone-wide cell shows a phone's rows on any screen. On its own
 * hours its time scale is the chart's least, so a few stops make a compact cell; on the
 * page's frame it runs at the page's pace. In a silence the waiting line stands under the
 * last row, as on the page.
 */
export function StillRows({
  still,
  requestedEnergy,
  isOpen,
  isSwapped,
  isInvited = false,
  isProposed = false,
  isPenStill = false,
  naming,
  density,
}: StillRowsProps) {
  const { subject, itinerary } = still;
  // A state a row lives through draws the frame before it first, so its row lands waiting for
  // its bead, then its own in the next frame: a row weighed before it had landed never
  // waited for its bead. Held a second, the frame before was what a shot could catch; held
  // one frame, no two shots in a row can agree on it.
  const [isAfter, setIsAfter] = useState(still.before === undefined);
  const draft = isAfter || still.before === undefined ? still.draft : still.before;
  const { stops } = draft;
  const openableStops =
    still.openableStops ?? (draft.isComplete ? openableStopsOf({}, draft) : NO_STOPS_OPEN);
  // Only a stop that opens before its day is complete opens in a still of it: the last stop
  // of a day with no versions shows written and shut until the stream has ended.
  const subjectId = stops[subject]?.id ?? "";
  const [openStop, setOpenStop] = useState<number | null>(
    isOpen && openableStops.has(subjectId) ? subject : null,
  );
  const [hoveredStop, setHoveredStop] = useState<number | null>(null);
  // The version a hand names: the next one livelier along the wire, or quieter at its end.
  const subjectStop = stops[subject];
  const curveStop = subjectStop && hasEnergy(subjectStop) ? (subjectStop as CurveStop) : null;
  const handled = curveStop
    ? (keyedCandidateOf(curveStop, modelPick(curveStop), "livelier") ??
      keyedCandidateOf(curveStop, modelPick(curveStop), "quieter"))
    : null;
  const handledPlace = curveStop && handled !== null ? candidatesOf(curveStop)[handled] : undefined;
  const [hoveredPlace, setHoveredPlace] = useState<string | null>(
    naming === "pointer" ? (handledPlace?.id ?? null) : null,
  );
  const arrivals = useArrivals(stops, requestedEnergy);
  const energy = useEnergyCurve(stops);
  // A proposal beside the day leaves the day the visitor's: it can be dragged as at rest.
  const isInteractive = draft.isComplete && arrivals.isSettled;
  // A drag grabs the curve at the stop and holds it at the version's energy, and is never let
  // go, so the chart shows what it has switched to while the row still says what it was.
  const grabbedAt = subjectStop ? midOf(stops, subjectStop) : 0;
  const { startDrag, drag } = energy;
  const hasGrabbed = useRef(false);
  useEffect(() => {
    if (naming !== "drag" || !isInteractive || !curveStop || !handledPlace) return;
    if (hasGrabbed.current) return;
    hasGrabbed.current = true;
    startDrag(grabbedAt);
    drag(energyOf(handledPlace) - energyOf(plannedPlace(curveStop)));
  }, [naming, isInteractive, curveStop, handledPlace, grabbedAt, startDrag, drag]);
  const chosen = useInvitation({ stops, isInteractive: false });
  const invitation = isInvited ? { ...chosen, stopIndex: subject } : chosen;

  // The version goes in once, as a visitor would: each pick changes the curve, and with it
  // the function that makes the next.
  const hasVersions = (stops[subject]?.alternatives.length ?? 0) > 0;
  const { choose } = energy;
  const hasPicked = useRef(false);
  useEffect(() => {
    if (!isSwapped || !hasVersions || hasPicked.current) return;
    hasPicked.current = true;
    choose(subject, 1);
  }, [isSwapped, hasVersions, subject, choose]);

  // The day's height, measured as the page measures it, for a frame at the page's pace.
  const [dayBox, setDayBox] = useState<HTMLDivElement | null>(null);
  const daySize = useElementSize(dayBox);
  const ownBounds = dayBounds(stops);
  const { frame } = still;
  const page = frame.kind === "own" ? null : frame.page;
  const { chart } = useDrawing();
  // A silence shows the day's last rows, so its frame starts at theirs; a whole day at the
  // page's.
  const pageFrame = page
    ? cellFrameOf(
        frame.kind === "silence" || frame.kind === "bare" ? ownBounds : page,
        page,
        daySize?.height ?? 0,
        frame.kind === "page" && frame.isWhole ? stops : null,
        chart,
      )
    : null;
  const bounds = pageFrame?.bounds ?? ownBounds;
  const context = useMemo(() => dayContextOf(itinerary), [itinerary]);
  const dayLight = useMemo(() => dayLightOf(context), [context]);
  const sunrise = useMemo(() => sunCrossing(context, SUNRISE_ALTITUDE, "rising"), [context]);
  const sunset = useMemo(() => sunCrossing(context, SUNRISE_ALTITUDE, "setting"), [context]);

  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const size = useElementSize(box);
  const [basis, setBasis] = useState<ElementSize | null>(null);
  if (size && size.width > 0 && size.width !== basis?.width) setBasis(size);
  // The frame before lasts until its rows have been drawn, which waits for the cell's size,
  // and a frame more: flipped sooner, a row first drew weighed and its pen never set off.
  const isRowsDrawn = basis !== null && (page === null || daySize !== null);
  useEffect(() => {
    if (isAfter || !isRowsDrawn) return undefined;
    const next = requestAnimationFrame(() => setIsAfter(true));
    return () => cancelAnimationFrame(next);
  }, [isAfter, isRowsDrawn]);

  const litStops = [openStop, hoveredStop].filter(
    (index, at, all): index is number => index !== null && all.indexOf(index) === at,
  );
  const toggleStop = (index: number) => setOpenStop((open) => (open === index ? null : index));

  return (
    <div className="relative min-w-0">
      <div ref={setBox} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0" />
      {/* Clipped to nothing, so the day's height never lengthens the matrix's page. */}
      {page && (
        <div aria-hidden className="invisible absolute top-0 left-0 size-0 overflow-hidden">
          <div ref={setDayBox} className="h-day" />
        </div>
      )}
      {basis && (!page || daySize) && (
        <SprungFrame bounds={bounds}>
          {({ dayStart, dayEnd }) => (
            <DayRows
              width={basis.width}
              basisHeight={pageFrame?.basisHeight ?? chart.minHeight}
              dayStart={dayStart}
              dayEnd={dayEnd}
              stops={stops}
              densityOverride={density}
              picks={energy.committed}
              energy={energy}
              arrivals={arrivals}
              requestedEnergy={requestedEnergy}
              light={axisLightWithin(dayLight, dayStart, dayEnd)}
              daylight={context}
              city={itinerary.city}
              sunrise={sunrise}
              sunset={sunset}
              writing={draft.writing}
              isInteractive={isInteractive}
              isStill
              isPenStill={isPenStill}
              openableStops={openableStops}
              invitation={invitation}
              waiting={waitingOf(frame, stops)}
              openStop={openStop}
              litStops={litStops}
              rewriting={[]}
              proposed={isProposed ? new Set([subjectId]) : undefined}
              rewritingStop={null}
              hoveredPlace={hoveredPlace}
              inHand={
                naming === "keys"
                  ? { keyedStop: subject }
                  : naming === "drag"
                    ? { grabbedAt }
                    : undefined
              }
              onToggleStop={toggleStop}
              onTapStop={setOpenStop}
              onCloseStop={() => setOpenStop(null)}
              onHoverStop={setHoveredStop}
              onHoverPlace={setHoveredPlace}
            />
          )}
        </SprungFrame>
      )}
    </div>
  );
}

interface SprungFrameProps {
  bounds: DaySpan;
  children: (frame: { dayStart: number; dayEnd: number }) => ReactNode;
}

/**
 * A cell's frame, springing as its hours change. Mounted only once the cell knows its day's
 * height, so a whole day stands at its own end from its first frame: sprung from before, it
 * glided there from the asked end on every load.
 */
function SprungFrame({ bounds, children }: SprungFrameProps): ReactNode {
  const dayStart = useSprung(bounds.start);
  const dayEnd = useSprung(bounds.end);
  return children({ dayStart, dayEnd });
}
