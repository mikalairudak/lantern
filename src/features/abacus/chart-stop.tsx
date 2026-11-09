"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRef, type KeyboardEvent, type MouseEvent, type Ref } from "react";
import { SPRINGS, type SpringName } from "@/lib/tokens/motion";
import { cn } from "@/components/ui/cn";
import {
  candidatesOf,
  energyOf,
  keyStepOf,
  twinRankOf,
  versionOf,
  writtenEnergyOf,
  type EnergyStep,
} from "./curve";
import { hasEnergy, type EnergeticStop, type StopDraft } from "./day-draft";
import { beadTargetPath, drawnEnergyOf, type ChartScale, type ChartSizes } from "./geometry";

/**
 * The ghost's dashes, counted around the circle rather than measured in pixels, so they
 * close evenly at any radius.
 */
const GHOST_DASHES = 8;

const KEY_STEPS: Record<string, EnergyStep> = {
  ArrowRight: "livelier",
  ArrowUp: "livelier",
  ArrowLeft: "quieter",
  ArrowDown: "quieter",
  Home: "quietest",
  End: "liveliest",
};

/** The attribute that marks a bead, read by the chart when a press starts on one. */
export const CANDIDATE_ATTRIBUTE = "data-candidate";
/** The attribute that marks a stop's shown bead, filled or hollow, by which its row is placed. */
export const SHOWN_BEAD_ATTRIBUTE = "data-shown-bead";

interface ChartStopProps {
  stop: StopDraft;
  scale: ChartScale;
  /** The candidate the chart shows. */
  selected: number;
  /** The candidate the list shows; differs from `selected` only mid-drag. */
  committed: number;
  /** The middle of the stop's time as drawn this frame, where its wire and beads sit. */
  mid: number;
  /** Written again in place: its bead empties where it was rather than landing anew. */
  isRewritten: boolean;
  /** Where the shown bead sits: the requested energy until it is filled, then what it shows. */
  beadEnergy: number;
  /** Filled once the stop's energy is known and its wire drawn; an outline before that. */
  isFilled: boolean;
  /** The shown bead lands and the others appear with motion, rather than in their final state. */
  isArriving: boolean;
  /**
   * Its versions come after it, a re-plan's set whole at once: each fades onto the wire on the
   * gentle spring as it comes, whether or not the stop is arriving.
   */
  isVersionsLate?: boolean;
  /** The shown bead sits where its arrival puts it this frame, with the curve, not on a spring. */
  isFollowing: boolean;
  /** Taps, keys and hover labels work only once the day is complete. */
  isInteractive: boolean;
  /** The curve's energy at this stop, where the focused slider shows its knob. */
  curveEnergy: number | null;
  /** The candidate hovered here, ringed on its wire. */
  hoveredPlace: string | null;
  onHoverPlace: (placeId: string | null) => void;
  onPullTo: (energy: number) => void;
  /** Picks a version directly, as a tap does: how a key reaches a twin at the same energy. */
  onChoose: (candidate: number) => void;
  /** Its slider took or lost the focus; `isFromKeys` where the browser shows that focus. */
  onFocusChange: (isFocused: boolean, isFromKeys: boolean) => void;
  /** A still's slider held as the keys' focus holds it, its knob ringed. */
  isKeyed?: boolean;
}

/** One stop on its wire: its candidates as beads, the shown one filled. */
export function ChartStop({
  stop,
  scale,
  selected,
  committed,
  mid,
  isRewritten,
  beadEnergy,
  isFilled,
  isArriving,
  isVersionsLate = false,
  isFollowing,
  isInteractive,
  curveEnergy,
  hoveredPlace,
  onHoverPlace,
  onPullTo,
  onChoose,
  onFocusChange,
  isKeyed = false,
}: ChartStopProps) {
  const slider = useRef<SVGGElement>(null);
  const candidates = candidatesOf(stop);
  const curveStop = hasEnergy(stop) ? stop : null;
  const { chart } = scale;
  const y = scale.yOf(mid);
  /** Where a version's bead is drawn: its energy, a bead's width inward if it is a twin. */
  const drawnXOf = (index: number, energy: number) =>
    scale.xOf(drawnEnergyOf(scale, energy, twinRankOf(stop, index)));
  const ghostEnergy = committed === selected ? null : writtenEnergyOf(candidates[committed] ?? {});
  // A bead that has just been picked is now the shown one; its ring goes.
  const namedIndex = candidates.findIndex(
    (place, index) => place.id === hoveredPlace && index !== selected,
  );
  const namedEnergy = namedIndex === -1 ? null : writtenEnergyOf(candidates[namedIndex] ?? {});
  const shownX = isFilled ? drawnXOf(selected, beadEnergy) : scale.xOf(beadEnergy);
  const beadXs = candidates.map((place, index) => {
    const energy = writtenEnergyOf(place);
    return index === selected || energy === null ? null : drawnXOf(index, energy);
  });
  /** What a version's bead is called to a screen reader: its name and which way it goes. */
  const labelOf = (index: number): string | null => {
    const place = candidates[index];
    if (!curveStop || !place?.name) return null;
    return `${place.name}, ${versionOf(curveStop, candidatesOf(curveStop)[index] ?? curveStop.primary)}`;
  };

  const handleKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    const step = KEY_STEPS[event.key];
    if (step === undefined || !curveStop) return;
    event.preventDefault();
    const next = keyStepOf(curveStop, selected, step);
    if (next?.kind === "energy") onPullTo(next.energy);
    if (next?.kind === "version") onChoose(next.index);
  };

  return (
    <g>
      {/* A stop written again lets its old versions fade as it empties. */}
      <AnimatePresence>
        {candidates.map((place, index) => {
          const x = beadXs[index];
          return x === null || x === undefined ? null : (
            <Bead
              key={place.id}
              id={place.id}
              x={x}
              y={y}
              chart={chart}
              // Twins touch, so each target stops where its neighbour's begins.
              target={beadTargetPath(
                x,
                y,
                [
                  shownX,
                  ...beadXs.filter((other, at): other is number => other !== null && at !== index),
                ],
                chart.beadHitRadius,
              )}
              isAppearing={(isArriving || isVersionsLate) && !isInteractive}
              appearing={isVersionsLate ? "gentle" : "snappy"}
              isInteractive={isInteractive}
              isNamed={index === namedIndex}
              label={labelOf(index)}
              onHover={(isHovered) => onHoverPlace(isHovered ? place.id : null)}
              // Taken, the bead becomes the stop's shown one and leaves the reader's list: the
              // reader is left on the stop's slider, which says the version it now shows.
              onActivate={() => {
                onChoose(index);
                slider.current?.focus();
              }}
            />
          );
        })}
      </AnimatePresence>
      {ghostEnergy !== null && (
        <circle
          cx={drawnXOf(committed, ghostEnergy)}
          cy={y}
          r={chart.shownBeadRadius}
          pathLength={GHOST_DASHES * 2}
          strokeDasharray="1 1"
          strokeWidth={chart.ringStroke}
          className="fill-none stroke-muted"
        />
      )}
      <ShownBead
        x={shownX}
        y={y}
        chart={chart}
        isFilled={isFilled}
        isFollowing={isFollowing}
        isLanding={isArriving && isFollowing && !isRewritten}
      />
      {namedEnergy !== null && (
        <circle
          cx={drawnXOf(namedIndex, namedEnergy)}
          cy={y}
          r={chart.knobRadius}
          strokeWidth={chart.ringStroke}
          className="pointer-events-none fill-none stroke-swap-drawn"
        />
      )}
      {isInteractive && curveStop && (
        <EnergySlider
          ref={slider}
          stop={curveStop}
          selected={selected}
          x={scale.xOf(curveEnergy ?? beadEnergy)}
          y={y}
          chart={chart}
          isRinged={isKeyed}
          onKeyDown={handleKeyDown}
          onFocusChange={onFocusChange}
        />
      )}
    </g>
  );
}

interface ShownBeadProps {
  x: number;
  y: number;
  chart: ChartSizes;
  isFilled: boolean;
  isFollowing: boolean;
  /** Fades in as its stop arrives, rather than appearing whole. */
  isLanding: boolean;
}

/**
 * The shown candidate: a filled ink bead with a ground halo, so the curve and the wire
 * pass under it. While its stop arrives it sits exactly where the arrival puts it, in the
 * same frame as the curve; once settled, it hops between beads on its own spring. It
 * swaps from one to the other at rest, where both put it in the same place.
 */
function ShownBead({ x, y, chart, isFilled, isFollowing, isLanding }: ShownBeadProps) {
  const bead = (
    <motion.circle
      {...{ [SHOWN_BEAD_ATTRIBUTE]: "" }}
      initial={isLanding ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={SPRINGS.gentle}
      cx={0}
      cy={y}
      r={chart.shownBeadRadius}
      strokeWidth={isFilled ? chart.shownBeadHalo : chart.ringStroke}
      // The halo is painted under the fill, so only its outer half shows.
      paintOrder={isFilled ? "stroke" : undefined}
      // The ink comes in at once: the outline holds until it does, so the bead never vanishes.
      className={isFilled ? "fill-ink stroke-ground" : "fill-ground stroke-ink"}
    />
  );
  if (isFollowing) return <g transform={`translate(${x} 0)`}>{bead}</g>;
  return (
    <motion.g initial={false} animate={{ x }} transition={SPRINGS.snappy}>
      {bead}
    </motion.g>
  );
}

interface EnergySliderProps {
  stop: EnergeticStop;
  selected: number;
  x: number;
  y: number;
  chart: ChartSizes;
  /** Its knob's ring drawn as the keys' focus draws it, for a still that holds that focus. */
  isRinged: boolean;
  ref?: Ref<SVGGElement>;
  onKeyDown: (event: KeyboardEvent<SVGGElement>) => void;
  onFocusChange: (isFocused: boolean, isFromKeys: boolean) => void;
}

/**
 * Whether the browser shows this element's focus, as it does for a focus from the keys: a
 * script's focus, or a browser that cannot say, counts as the keys'.
 */
function isFocusVisible(element: Element): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
}

/**
 * The stop as a slider for the keyboard; its knob rings the curve while focused. Its range
 * runs from the stop's quietest version to its liveliest, where Home and End take it.
 */
function EnergySlider({
  stop,
  selected,
  x,
  y,
  chart,
  isRinged,
  ref,
  onKeyDown,
  onFocusChange,
}: EnergySliderProps) {
  const candidates = candidatesOf(stop);
  const shown = candidates[selected] ?? stop.primary;
  const energies = candidates.map(energyOf);
  return (
    <g
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={`Energy at ${stop.startTime}`}
      aria-orientation="horizontal"
      aria-valuemin={Math.min(...energies)}
      aria-valuemax={Math.max(...energies)}
      aria-valuenow={energyOf(shown)}
      aria-valuetext={`${shown.sensory.energy}: ${shown.name ?? ""}`}
      onKeyDown={onKeyDown}
      onFocus={(event) => onFocusChange(true, isFocusVisible(event.currentTarget))}
      onBlur={() => onFocusChange(false, false)}
      className="group pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-curve"
    >
      <circle
        cx={x}
        cy={y}
        r={chart.knobRadius}
        strokeWidth={chart.knobStroke}
        className={cn(
          "fill-none stroke-curve",
          isRinged ? "opacity-100" : "opacity-0 group-focus-visible:opacity-100",
        )}
      />
    </g>
  );
}

interface BeadProps {
  id: string;
  x: number;
  y: number;
  chart: ChartSizes;
  /** The pointer target, as a path: a circle, cut where a touching twin's begins. */
  target: string;
  /** Fades in as its alternative arrives, rather than appearing whole. */
  isAppearing: boolean;
  /** The spring it fades in on: a re-plan's set, the gentle one, as stops arrive. */
  appearing: SpringName;
  isInteractive: boolean;
  /**
   * Named by the pointer: filled as the hover fills it, from state as well as from `:hover`,
   * so a copy of the bead drawn elsewhere, which no pointer reaches, fills with it.
   */
  isNamed: boolean;
  /** Its version's name and which way it goes; null while its name is not written. */
  label: string | null;
  onHover: (isHovered: boolean) => void;
  /** Picks it, for a screen reader's press; a pointer's is the chart's to read. */
  onActivate: () => void;
}

/**
 * A candidate the stop does not show. A tap picks it and a drag from it bends the curve;
 * the chart tells the two apart. The keyboard reaches the same candidates through the
 * stop's slider and the list, so a bead is no stop of the Tab order; a screen reader finds
 * it by its version's name, and pressing it there picks it, as Enter or Space on it does
 * where it holds the focus, Space on its release, as a button's, and scrolling nothing.
 */
function Bead({
  id,
  x,
  y,
  chart,
  target,
  isAppearing,
  appearing,
  isInteractive,
  isNamed,
  label,
  onHover,
  onActivate,
}: BeadProps) {
  const isNamedAloud = isInteractive && label !== null;
  return (
    <motion.g
      {...(isNamedAloud
        ? {
            role: "button",
            tabIndex: -1,
            "aria-label": label,
            // A pointer's click comes after its press and lift, which the chart reads; only a
            // click with no pointer behind it, a screen reader's, picks the bead here.
            onClick: (event: MouseEvent<SVGGElement>) => {
              if (event.detail === 0) onActivate();
            },
            onKeyDown: (event: KeyboardEvent<SVGGElement>) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              if (event.key === "Enter") onActivate();
            },
            onKeyUp: (event: KeyboardEvent<SVGGElement>) => {
              if (event.key !== " ") return;
              event.preventDefault();
              onActivate();
            },
          }
        : { "aria-hidden": true })}
      {...{ [CANDIDATE_ATTRIBUTE]: id }}
      initial={isAppearing ? { opacity: 0 } : false}
      animate={{ opacity: 1, transition: SPRINGS[appearing] }}
      exit={{ opacity: 0 }}
      transition={SPRINGS.snappy}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      className={cn("group", isInteractive ? "cursor-pointer" : "pointer-events-none")}
    >
      <path d={target} className="fill-none" pointerEvents={isInteractive ? "all" : "none"} />
      <circle
        cx={x}
        cy={y}
        r={chart.beadRadius}
        strokeWidth={chart.ringStroke}
        className={cn(
          "stroke-swap-drawn transition-colors",
          isNamed ? "fill-swap-drawn" : "fill-ground group-hover:fill-swap-drawn",
        )}
      />
    </motion.g>
  );
}
