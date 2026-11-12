"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type PointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { GENTLE_REACH_PX, SPRINGS, type SpringName } from "@/lib/tokens/motion";
import { cn } from "@/components/ui/cn";
import { useSprungAll } from "@/components/ui/use-sprung";
import { ChartAxes, type SunLabels } from "./chart-axes";
import { CANDIDATE_ATTRIBUTE, ChartStop } from "./chart-stop";
import { proposalRunsOf } from "./proposal-path";
import { examplePullAt } from "./example-pull";
import { MAX_ENERGY, candidatesOf, midsOf, twinRankOf, writtenEnergyOf } from "./curve";
import type { StopDraft } from "./day-draft";
import { useDrawing } from "./drawing";
import { HAIRLINE, drawnEnergyOf, polylinePath, type ChartScale } from "./geometry";
import { Invitation, Knob } from "./invitation";
import type { AxisRun } from "./light";
import { coveredBeadsOf, isUnderSheet, type SheetBand } from "./sheet-placement";
import { GONE, presentTrack, samplesWithin, sampleTrack, trackAt, type TrackPoint } from "./track";
import type { Arrivals } from "./use-arrivals";
import { useChartPointer } from "./use-chart-pointer";
import type { Invitation as Invited } from "./use-invitation";
import type { CurvePreview, EnergyCurve } from "./use-energy-curve";
import { TAG_MASK_ATTRIBUTE, VersionTags, type TagRequest } from "./version-tag";
import {
  draggedVersionOf,
  hoveredVersionOf,
  keyedVersionsOf,
  type NamedVersion,
  type Rect,
} from "./version-tags";
import type { Waiting } from "./waiting";
import { ChartWaiting } from "./waiting-chart";

/**
 * How much of the curve shows where it passes under a line of words: enough to follow its
 * shape through them, little enough that the words read clean.
 */
export const CURVE_UNDER_WORDS = 0.22;

/** No stop's id: a day with no proposal beside it, no row entering and none fading. */
const NO_IDS: ReadonlySet<string> = new Set();

/** The preview's dashes and the gaps between them, each this many of the curve's strokes long. */
const PREVIEW_DASH_STROKES = 1.6;

export interface AbacusChartProps {
  /** The stops placed so far, in order. */
  stops: readonly StopDraft[];
  scale: ChartScale;
  energy: EnergyCurve;
  arrivals: Arrivals;
  /** The energy the visitor asked for, where a shown bead waits until its own is known. */
  requestedEnergy: number;
  /** Where the time axis runs in golden hour, and where from sunset to sunrise, over the frame. */
  light: readonly AxisRun[];
  /** When the sun rises and sets, in minutes from midnight, marked on the time axis. */
  sunrise: number | null;
  sunset: number | null;
  /** Which suns on the axis say their minute in the gutter. None, left out. */
  sunLabels?: SunLabels;
  /** Where the stops' times end on the right, which a sun's minute lines up with. */
  timesRight?: number;
  /** False while the day is being written: the chart can be watched but not dragged. */
  isInteractive: boolean;
  /** Where the ring waits to invite the first drag, and its example is drawn. */
  invitation: Invited;
  /** The waiting line showing in a silence, if any. */
  waiting: Waiting | null;
  openStop: number | null;
  /**
   * The stops lit: open, hovered here or in the list, or shaped by a hovered word. Their
   * wires darken and their spans light on the time axis.
   */
  litStops: readonly number[];
  /**
   * A proposal's stops drawn beside the day, by id (`replanFrameOf`, `forkFrameOf`): off the
   * day's curve, each a hollow bead ringed in the versions' blue at its energy on a dashed wire,
   * and a dashed curve through them where the proposal's path leaves the day's. A tap on one
   * picks it, which the day reads as taking the proposal.
   */
  proposed?: ReadonlySet<string>;
  /** The day's stops the proposal would replace, by id: its dashed curve passes them by. */
  replaced?: ReadonlySet<string>;
  /**
   * Stops entering the day between two others, by id, while the room they grow into opens:
   * no wire, no bead and no curve through them until it has.
   */
  held?: ReadonlySet<string>;
  /**
   * The stops a re-plan on screen brings, by id: the curve's ends never rest on them until
   * the merged day takes the page (`TrackPoint.isNew`).
   */
  newcomers?: ReadonlySet<string>;
  /**
   * A version's stops fading out where they stand as the fork folds it, by id: off the curve on
   * the gentle spring, their wires and beads fading with their words.
   */
  fading?: ReadonlySet<string>;
  /**
   * The fading stops the visitor cannot see as the fork folds them, by id: their wires and beads
   * go at once, rather than ride faint onto the screen with the rows they rest on.
   */
  gone?: ReadonlySet<string>;
  /**
   * Called once the fading stops are off the curve, so the fork lets go of the frame with
   * nothing of them left to snap away.
   */
  onFaded?: () => void;
  /**
   * A re-plan streams over the day: a stop's versions come after it, each set whole at once
   * (`replanFrameOf`), and fade onto its wire together on the gentle spring, a stop that
   * stays included. Under reduced motion they show in one step.
   */
  isReplanning?: boolean;
  /** The candidate hovered on the chart, ringed on its wire. */
  hoveredPlace: string | null;
  /** A tap off the beads: near a wire it names that stop, elsewhere null. */
  onTapStop: (index: number | null) => void;
  onHoverStop: (index: number | null) => void;
  onHoverPlace: (placeId: string | null) => void;
  /**
   * Where the time axis starts, from the top of the chart: above the plot, up to the sun
   * parked at its head, when there is one. The plot's top otherwise.
   */
  axisFrom?: number;
  /** How far down the day the time axis is drawn, in minutes; the day's end unless given. */
  axisTo?: number;
  /**
   * Receives the layer the words above the chart draw their lines into, in the chart's own
   * pixels; where a line lies, the curve steps back under it. Without one the curve is drawn
   * whole.
   */
  wordsMaskRef?: (layer: SVGGElement | null) => void;
  /**
   * A layer over the rows, in the chart's own pixels, where the beads an open sheet's edge
   * crosses are drawn again on the sheet's side of that edge, so the sheet never cuts a bead
   * in half, whichever wires it lies over. Without one they are drawn only under it.
   */
  beadsOverSheet?: { layer: SVGSVGElement; sheet: SheetBand } | null;
  /** On a phone the scale's words are the sticky scale's, laid over the chart (`StickyScale`). */
  isScaleHeld?: boolean;
  /**
   * What a still of the lab's matrix holds as a hand would: the stop whose slider the keys
   * focus, or the minute a drag grabbed the curve at. Nothing on a page, where hands do.
   */
  inHand?: { keyedStop?: number; grabbedAt?: number };
}

/**
 * The day as an abacus: time runs down, energy across. Each stop is a wire with its
 * candidates as beads; the energy curve is the energy the visitor wants, and pulling it
 * sideways makes each stop show the candidate nearest to it. While the day is written,
 * wires draw in, shown beads slide to their energy and the curve grows with them; it
 * becomes draggable once the day is complete and every shown bead has settled.
 */
export function AbacusChart({
  stops,
  scale,
  energy,
  arrivals,
  requestedEnergy,
  light,
  sunrise,
  sunset,
  sunLabels,
  timesRight,
  isInteractive,
  invitation,
  waiting,
  openStop,
  litStops,
  proposed = NO_IDS,
  replaced = NO_IDS,
  held = NO_IDS,
  newcomers = NO_IDS,
  fading = NO_IDS,
  gone = NO_IDS,
  onFaded,
  isReplanning = false,
  hoveredPlace,
  onTapStop,
  onHoverStop,
  onHoverPlace,
  axisFrom,
  axisTo,
  wordsMaskRef,
  beadsOverSheet,
  inHand,
  isScaleHeld = false,
}: AbacusChartProps) {
  // Two days can be drawn at once, as when one is written over another, so ids are per chart.
  const underWordsId = `under-words-${useId().replace(/[^\w-]/g, "")}`;
  // The rows draw each line of their words into the mask the curve steps back under; a tag
  // reads the same lines, so it keeps off the words as the curve does.
  const maskLayer = useRef<SVGGElement | null>(null);
  // The same layer for the names to draw their own boxes into, once it is there.
  const [maskElement, setMaskElement] = useState<SVGGElement | null>(null);
  const onMaskLayer = useCallback(
    (layer: SVGGElement | null) => {
      maskLayer.current = layer;
      setMaskElement(layer);
      wordsMaskRef?.(layer);
    },
    [wordsMaskRef],
  );
  const onSheetId = `${underWordsId}-on-sheet`;
  const arrivalsByStop = stops.map((stop) => arrivals.of(stop));
  // A stop written again at a new time glides there with its wire, bead and curve.
  const ownMids = midsOf(stops);
  const mids = stops.map((_, index) => arrivalsByStop[index]?.mid ?? ownMids[index] ?? 0);
  // The curve passes only through stops on it, at the energy their bead shows this frame,
  // so a sliding bead and the curve move together.
  // A twin shown is drawn a bead's width inward, and the curve goes through it there.
  // A version's stops leave the curve, and a proposal's taken come onto it, on the gentle
  // spring, never in a frame, and no faster than it carries a day's frame end, however long the
  // stretch of curve they take with them: the furthest such a stop lies from one that stays.
  const isOffCurve = (stop: StopDraft) =>
    proposed.has(stop.id) || held.has(stop.id) || fading.has(stop.id);
  // A stop among others still joining the curve counts too, as one let onto it this frame.
  const isMoving = (stop: StopDraft, index: number) => {
    const arrival = arrivalsByStop[index];
    const isJoining = !(arrival?.isOnCurve ?? false) || (arrival?.grown ?? 1) < 1;
    return isOffCurve(stop) || (isJoining && index < stops.length - 1);
  };
  const stays = stops.flatMap((stop, index) => (isMoving(stop, index) ? [] : [mids[index] ?? 0]));
  const stretchPx = Math.max(
    0,
    ...stops.flatMap((stop, index) => {
      if (!isMoving(stop, index) || stays.length === 0) return [];
      const y = scale.yOf(mids[index] ?? 0);
      return [Math.min(...stays.map((mid) => Math.abs(scale.yOf(mid) - y)))];
    }),
  );
  const presence = useSprungAll(
    stops.map((stop) => (isOffCurve(stop) ? 0 : 1)),
    false,
    stops.map((): SpringName => "gentle"),
    stops.map((stop) => stop.id),
    stretchPx > GENTLE_REACH_PX ? GENTLE_REACH_PX / stretchPx : undefined,
  );
  const isFadedOff =
    fading.size > 0 &&
    stops.every((stop, index) => !fading.has(stop.id) || (presence[index] ?? 0) <= GONE);
  useEffect(() => {
    if (isFadedOff) onFaded?.();
  }, [isFadedOff, onFaded]);
  // A twin's step inward goes with its bead, which hops there on the snappy spring: taken at
  // once, the curve stood on a twin picked a frame before its bead did, 24 px ahead on a
  // phone, and rolled back against a hand dragging off a twin shown.
  const twinRanks = useSprungAll(
    stops.map((stop, index) => twinRankOf(stop, energy.selected[index] ?? 0)),
    false,
    stops.map((): SpringName => "snappy"),
    stops.map((stop) => stop.id),
  );
  const points: TrackPoint[] = stops.flatMap((stop, index) => {
    const arrival = arrivalsByStop[index];
    const level = arrival?.slide ?? energy.curve[index] ?? null;
    if (!arrival?.isOnCurve || level === null || held.has(stop.id)) return [];
    const drawn = drawnEnergyOf(scale, level, twinRanks[index] ?? 0);
    const present = presence[index] ?? 1;
    return [
      {
        mid: mids[index] ?? 0,
        energy: drawn,
        grown: arrival.grown,
        eased: arrival.eased,
        present,
        isNew: newcomers.has(stop.id),
      },
    ];
  });
  const { track, from: curveStart, to: curveEnd } = presentTrack(points);
  const pointOn = (minutes: number) => ({
    x: scale.xOf(trackAt(track, minutes)),
    y: scale.yOf(minutes),
  });
  // Motion's own reduced motion keeps opacity's fades; the preview comes and goes at once.
  const isReducedMotion = useReducedMotion() ?? false;
  // Where a pointer that has moved over the chart is, across it; null when it is away, so
  // a page scrolled under a resting pointer previews nothing.
  const [hoverX, setHoverX] = useState<number | null>(null);
  const curvePath = polylinePath(
    samplesWithin(track, sampleTrack(track), curveStart, curveEnd).map((sample) => ({
      x: scale.xOf(sample.energy),
      y: scale.yOf(sample.minutes),
    })),
  );

  // The stop whose slider has the keys' focus, whose arrows' versions are named; and whether
  // the last pointer over the chart was a finger, which never hovers, so names nothing.
  const [keyedStop, setKeyedStop] = useState<number | null>(null);
  // A day that stops being draggable, as a re-plan takes it, takes its sliders with it, and
  // no blur says so: the keys' focus is gone with them.
  if (!isInteractive && keyedStop !== null) setKeyedStop(null);
  const [isTouch, setIsTouch] = useState(false);
  const notePointerType = (event: PointerEvent<SVGSVGElement>) => {
    const isFinger = event.pointerType === "touch";
    if (isFinger !== isTouch) setIsTouch(isFinger);
  };

  const pointer = useChartPointer({
    stops,
    mids,
    curveFrom: curveStart ?? track[0]?.mid ?? scale.dayStart,
    curveTo: curveEnd ?? track.at(-1)?.mid ?? scale.dayEnd,
    scale,
    energy,
    isInteractive,
    onTapStop,
    onHoverStop,
  });

  // The ring waits at the invited stop, once it is chosen, until the first drag or tap.
  const invited = invitation.stopIndex;
  const ring =
    !isInteractive || invited === null || !stops[invited] || pointer.hasInteracted
      ? null
      : pointOn(mids[invited] ?? 0);
  // It steps aside while its stop is open, and while another's sheet lies over its wire,
  // whose edge would cut it as it would a bead.
  const { chart } = scale;
  const { row } = useDrawing();
  const isRingCovered =
    ring !== null &&
    (invited === openStop ||
      (!!beadsOverSheet && isUnderSheet(ring.y, beadsOverSheet.sheet, chart.beadReach)));
  const plotFrom = scale.xOf(0) - chart.beadHitRadius;
  const plotTo = scale.xOf(MAX_ENERGY) + chart.beadHitRadius;
  // Where a hand holds the curve: a pointer over it, or a still's drag.
  const heldAt = pointer.pointerMinutes ?? inHand?.grabbedAt ?? null;
  const knob = heldAt === null ? null : pointOn(heldAt);

  // The page never changes the day by itself (2026-10-30). Until the first drag or tap the
  // chart draws, dashed over the day there is and changing nothing, the day a pull would
  // give: while the pointer is away, the example at the ring's stop; under a pointer that
  // has moved over the chart, a pull from the curve to it, its clause said in the headline.
  // Both retire with the ring, so nothing reflows under a reader after that.
  const isInviting = isInteractive && !pointer.hasInteracted;
  const example = examplePullAt(stops, invited);
  const isExampleShown =
    ring !== null && pointer.pointerMinutes === null && !isRingCovered && example !== null;
  const isPreviewing =
    isInviting && hoverX !== null && knob !== null && pointer.pointerMinutes !== null;
  const previewed =
    isPreviewing && knob && pointer.pointerMinutes !== null
      ? energy.previewOf(pointer.pointerMinutes, (hoverX - knob.x) / scale.laneStep)
      : isExampleShown && example
        ? energy.previewOf(example.minutes, example.levels)
        : null;
  const preview: CurvePreview | null =
    previewed && previewed.selected.some((pick, index) => pick !== energy.selected[index])
      ? previewed
      : null;
  const previewPlaces = stops.map((stop, index) => {
    const pick = preview?.selected[index];
    return pick === undefined || pick === energy.selected[index]
      ? null
      : (candidatesOf(stop)[pick]?.id ?? null);
  });
  const previewPath = preview
    ? polylinePath(
        sampleTrack(
          stops.flatMap((stop, index) => {
            const arrival = arrivalsByStop[index];
            const level = preview.curve[index] ?? null;
            if (!arrival?.isOnCurve || level === null) return [];
            const rank = twinRankOf(stop, preview.selected[index] ?? 0);
            return [
              {
                mid: mids[index] ?? 0,
                energy: drawnEnergyOf(scale, level, rank),
                grown: arrival.grown,
                eased: arrival.eased,
              },
            ];
          }),
        ).map((sample) => ({ x: scale.xOf(sample.energy), y: scale.yOf(sample.minutes) })),
      )
    : null;
  // The proposal's path where it leaves the day's, dashed as the preview's, through each stop
  // at the energy its bead shows this frame: the day's where both share it, the proposal's own
  // where it is proposed.
  const levelAt = (index: number): number | null => {
    const level = arrivalsByStop[index]?.slide ?? energy.curve[index] ?? null;
    const stop = stops[index];
    return level === null || !stop ? null : drawnEnergyOf(scale, level, twinRanks[index] ?? 0);
  };
  const proposalPaths =
    proposed.size === 0
      ? []
      : proposalRunsOf(
          stops.map(({ id }) => id),
          proposed,
          replaced,
          held,
        ).flatMap((run) => {
          const runPoints = run.flatMap((index) => {
            const level = levelAt(index);
            return level === null
              ? []
              : [{ mid: mids[index] ?? 0, energy: level, grown: 1, eased: 1 }];
          });
          if (runPoints.length < 2) return [];
          const path = polylinePath(
            sampleTrack(runPoints).map((sample) => ({
              x: scale.xOf(sample.energy),
              y: scale.yOf(sample.minutes),
            })),
          );
          return [{ key: stops[run[0] ?? 0]?.id ?? "", path }];
        });
  /** Notes where a pointer that moved, unpressed, is across the chart. */
  const noteHover = (event: PointerEvent<SVGSVGElement>) => {
    if (event.buttons !== 0) {
      setHoverX(null);
      return;
    }
    if (event.movementX === 0 && event.movementY === 0) return;
    setHoverX(event.clientX - event.currentTarget.getBoundingClientRect().left);
  };

  const stopPropsOf = (index: number): ComponentProps<typeof ChartStop> => {
    const stop = stops[index] as StopDraft;
    const arrival = arrivalsByStop[index];
    const selected = energy.selected[index] ?? 0;
    const shown = candidatesOf(stop)[selected] ?? stop.primary;
    const isFilled = arrival?.isReady ?? false;
    const filledEnergy = arrival?.slide ?? writtenEnergyOf(shown) ?? requestedEnergy;
    return {
      stop,
      scale,
      selected,
      committed: energy.committed[index] ?? selected,
      mid: mids[index] ?? 0,
      // An empty bead waits at the requested energy, or where it was when rewritten.
      beadEnergy: isFilled ? filledEnergy : (arrival?.slide ?? requestedEnergy),
      isFilled,
      isArriving: arrival?.isArriving ?? false,
      isVersionsLate: isReplanning && !isReducedMotion,
      isRewritten: arrival?.isRewritten ?? false,
      isFollowing: (arrival?.isArriving ?? false) && !(arrival?.isSettled ?? true),
      isInteractive,
      curveEnergy: energy.curve[index] ?? null,
      hoveredPlace: previewPlaces[index] ?? hoveredPlace,
      onHoverPlace,
      onPullTo: (target) => {
        pointer.markInteracted();
        energy.pullTo(index, target);
      },
      onChoose: (candidate) => {
        pointer.markInteracted();
        energy.choose(index, candidate);
      },
      isKeyed: inHand?.keyedStop === index,
      onFocusChange: (isFocused, isFromKeys) => {
        onHoverStop(isFocused ? index : null);
        setKeyedStop((current) =>
          isFocused && isFromKeys ? index : current === index ? null : current,
        );
      },
    };
  };
  // Versions named before they are taken (2026-11-05), each beside its bead: under a drag,
  // the version it has just switched its grabbed stop to, away from the hand; else the
  // versions the focused slider's arrows would take its stop to, or the one whose bead a
  // pointer rests on. A finger never rests, so names nothing until it drags.
  const beadXOf = (index: number, candidate: number): number => {
    const stop = stops[index] as StopDraft;
    const energyLevel = writtenEnergyOf(candidatesOf(stop)[candidate] ?? {}) ?? 0;
    return scale.xOf(drawnEnergyOf(scale, energyLevel, twinRankOf(stop, candidate)));
  };
  // A bead's ring, the hover's or the keys' focus, as wide as a bead is ever drawn.
  const ringReach = chart.knobRadius + chart.knobStroke;
  // A finger on the curve covers about as far as a tap reaches to name a wire, and the hand
  // comes up from below it.
  const fingerReach = chart.wireReach + row.wireGap;
  // Every other stop's drawn beads, each as far as a ring round it reaches: a name lies over
  // none, a card least of all. A card under a morning stop at 390 px can lie over the next
  // stop's hollow bead and its ring.
  const beadsBesides = (stopIndex: number): Rect[] =>
    stops.flatMap((stop, index) => {
      if (index === stopIndex) return [];
      const y = scale.yOf(mids[index] ?? 0);
      return candidatesOf(stop).flatMap((candidate, at) => {
        if (writtenEnergyOf(candidate) === null) return [];
        const x = beadXOf(index, at);
        return [
          { left: x - ringReach, right: x + ringReach, top: y - ringReach, bottom: y + ringReach },
        ];
      });
    });
  const tagOf = (named: NamedVersion, kind: TagRequest["kind"]): TagRequest => {
    const candidates = candidatesOf(stops[named.stopIndex] as StopDraft);
    const x = beadXOf(named.stopIndex, named.candidate);
    const y = scale.yOf(mids[named.stopIndex] ?? 0);
    const beads = candidates.map((_, candidate) => beadXOf(named.stopIndex, candidate));
    const hand = kind === "dragged" && knob ? knob : null;
    return {
      kind,
      key: kind === "dragged" ? "dragged" : (candidates[named.candidate]?.id ?? ""),
      named,
      x,
      y,
      // While it drags, the curve crosses the wire where the hand holds it, too.
      others: [
        ...beads.filter((_, candidate) => candidate !== named.candidate),
        ...(hand ? [hand.x] : []),
      ],
      prefer: hand ? (hand.x > x ? "left" : "right") : undefined,
      rings: { at: beads, reach: ringReach },
      avoid: [
        ...beadsBesides(named.stopIndex),
        ...(hand
          ? [
              {
                left: hand.x - fingerReach,
                right: hand.x + fingerReach,
                top: hand.y - fingerReach,
                bottom: scale.height,
              },
            ]
          : []),
      ],
    };
  };
  /**
   * Each line of the day's words where it stands now, in the chart's pixels: a mask is never
   * drawn, so each line is read from its own numbers and where its row has moved it.
   */
  const readWords = (): Rect[] => {
    const layer = maskLayer.current;
    if (!layer) return [];
    return [...layer.querySelectorAll(`rect:not([${TAG_MASK_ATTRIBUTE}])`)].map((line) => {
      const moved = line.parentElement ? getComputedStyle(line.parentElement).transform : "none";
      const { e, f } = new DOMMatrixReadOnly(moved === "none" ? undefined : moved);
      const at = (name: string) => Number(line.getAttribute(name) ?? 0);
      // Less the room the mask leaves round each line for the curve to step back softly.
      const left = at("x") + e + row.lineMaskPad;
      const top = at("y") + f + row.lineMaskPadY;
      return {
        left,
        top,
        right: left + at("width") - 2 * row.lineMaskPad,
        bottom: top + at("height") - 2 * row.lineMaskPadY,
      };
    });
  };
  const dragged = energy.isDragging
    ? draggedVersionOf(stops, mids, energy.selected, energy.committed, heldAt)
    : null;
  const keyed = keyedStop ?? inHand?.keyedStop ?? null;
  // An open stop's sheet is what is being read: nothing is named over it.
  const named: NamedVersion[] =
    !isInteractive || energy.isDragging || openStop !== null
      ? []
      : keyed !== null
        ? keyedVersionsOf(stops, energy.selected, keyed)
        : [isTouch ? null : hoveredVersionOf(stops, energy.selected, hoveredPlace)].filter(
            (version): version is NamedVersion => version !== null,
          );
  const tags: TagRequest[] = dragged
    ? [tagOf(dragged, "dragged")]
    : named.map((version) => tagOf(version, "named"));
  // The stops whose beads an open sheet's edge crosses: the wire above it where it opens
  // down, and wherever its edges fall among the wires it lies over.
  const covered = beadsOverSheet
    ? stops.flatMap((stop, index) => {
        if (proposed.has(stop.id)) return [];
        const band = coveredBeadsOf(
          scale.yOf(mids[index] ?? 0),
          beadsOverSheet.sheet,
          chart.beadReach,
        );
        return band ? [{ stop, index, band }] : [];
      })
    : [];

  return (
    <>
      <svg
        width={scale.width}
        height={scale.height}
        role="group"
        aria-label="The day's energy. Drag the curve sideways, or use the arrow keys on each stop."
        aria-busy={!isInteractive}
        {...pointer.handlers}
        onPointerMove={(event) => {
          notePointerType(event);
          pointer.handlers.onPointerMove(event);
          noteHover(event);
        }}
        onPointerDown={(event) => {
          notePointerType(event);
          setHoverX(null);
          pointer.handlers.onPointerDown(event);
        }}
        onPointerLeave={() => {
          setHoverX(null);
          pointer.handlers.onPointerLeave();
        }}
        className={cn(
          "block touch-pan-y select-none",
          isInteractive && (energy.isDragging ? "cursor-grabbing" : "cursor-grab"),
        )}
      >
        <ChartAxes
          scale={scale}
          light={light}
          sunrise={sunrise}
          sunset={sunset}
          sunLabels={sunLabels}
          timesRight={timesRight}
          stops={stops}
          starts={stops.map((stop, index) => (mids[index] ?? 0) - stop.durationMinutes / 2)}
          litStops={litStops}
          axisFrom={axisFrom}
          axisTo={axisTo}
          // The scale names the curve once it can be dragged.
          isCurveNamed={isInteractive}
          isScaleHeld={isScaleHeld}
        />
        {wordsMaskRef && (
          <defs>
            {/* Soft ends where the curve goes under words and comes out, rather than a cut. */}
            <filter id={`${underWordsId}-soft`} x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation={chart.underWordsSoftness} />
            </filter>
            <mask
              id={underWordsId}
              maskUnits="userSpaceOnUse"
              x={0}
              y={0}
              width={scale.width}
              height={scale.height}
            >
              <rect width={scale.width} height={scale.height} fill="white" />
              <g
                ref={onMaskLayer}
                fill="black"
                fillOpacity={1 - CURVE_UNDER_WORDS}
                filter={`url(#${underWordsId}-soft)`}
              />
            </mask>
          </defs>
        )}
        <ChartWaiting waiting={waiting} scale={scale} />
        <g>
          {stops.map((stop, index) =>
            held.has(stop.id) ? null : (
              <FadingWith key={stop.id} isFading={fading.has(stop.id)} isAtOnce={gone.has(stop.id)}>
                <Wire
                  from={plotFrom}
                  to={plotTo}
                  y={scale.yOf(mids[index] ?? 0)}
                  isHighlighted={litStops.includes(index)}
                  isDrawingIn={!(arrivalsByStop[index]?.isDrawn ?? true)}
                  isProposed={proposed.has(stop.id)}
                />
              </FadingWith>
            ),
          )}
          <path
            d={curvePath}
            fill="none"
            strokeWidth={chart.curveStroke}
            strokeLinecap="round"
            strokeLinejoin="round"
            mask={wordsMaskRef ? `url(#${underWordsId})` : undefined}
            className="stroke-curve"
          />
          <AnimatePresence>
            {previewPath && (
              <motion.path
                key="preview"
                data-preview={isPreviewing ? "pointer" : "example"}
                d={previewPath}
                initial={isReducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={isReducedMotion ? undefined : { opacity: 0 }}
                transition={SPRINGS.snappy}
                fill="none"
                strokeWidth={chart.ringStroke}
                strokeDasharray={`${chart.curveStroke * PREVIEW_DASH_STROKES} ${chart.curveStroke * PREVIEW_DASH_STROKES}`}
                strokeLinecap="round"
                mask={wordsMaskRef ? `url(#${underWordsId})` : undefined}
                aria-hidden
                className="pointer-events-none stroke-curve"
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {proposalPaths.map(({ key, path }) => (
              <motion.path
                key={key}
                data-proposal-path={key}
                d={path}
                initial={isReducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={isReducedMotion ? undefined : { opacity: 0 }}
                transition={SPRINGS.gentle}
                fill="none"
                strokeWidth={chart.ringStroke}
                strokeDasharray={`${chart.curveStroke * PREVIEW_DASH_STROKES} ${chart.curveStroke * PREVIEW_DASH_STROKES}`}
                strokeLinecap="round"
                mask={wordsMaskRef ? `url(#${underWordsId})` : undefined}
                aria-hidden
                className="pointer-events-none stroke-curve"
              />
            ))}
          </AnimatePresence>
          {stops.map((stop, index) =>
            held.has(stop.id) ? null : (
              <FadingWith key={stop.id} isFading={fading.has(stop.id)} isAtOnce={gone.has(stop.id)}>
                {proposed.has(stop.id) ? (
                  <ProposedBead
                    stop={stop}
                    x={scale.xOf(levelAt(index) ?? requestedEnergy)}
                    y={scale.yOf(mids[index] ?? 0)}
                    isInteractive={isInteractive}
                  />
                ) : (
                  <ChartStop {...stopPropsOf(index)} />
                )}
              </FadingWith>
            ),
          )}
        </g>
        {knob && <Knob x={knob.x} y={knob.y} chart={chart} />}
        {ring && (
          <Invitation
            x={ring.x}
            y={ring.y}
            chart={chart}
            isShown={pointer.pointerMinutes === null && !isRingCovered}
          />
        )}
      </svg>
      <VersionTags
        tags={tags}
        bounds={{
          left: scale.axisX + row.beadClear,
          // To the chart's edge: a row's words keep clear of an open sheet's ring there, which a
          // tag, never shown with a sheet open, never meets.
          right: scale.width,
          // A named bead wears the hover's ring, wider than a shown bead by this much, and
          // its words keep as clear of the ring as a row's do of its bead.
          beadClear: row.beadClear + chart.knobRadius - chart.shownBeadRadius,
        }}
        width={scale.width}
        height={scale.height}
        wireGap={row.wireGap}
        fingerClear={chart.wireReach + row.wireGap}
        readWords={readWords}
        maskLayer={maskElement}
        maskPad={{ x: row.lineMaskPad, y: row.lineMaskPadY, radius: row.lineMaskRadius }}
      />
      {beadsOverSheet &&
        covered.length > 0 &&
        createPortal(
          // Each stop drawn again from the same values, so it moves as the one under the sheet
          // does, and shown only on the sheet's side of the edge that crosses its beads.
          covered.map(({ stop, index, band }) => (
            <Fragment key={stop.id}>
              <clipPath id={`${onSheetId}-${index}`}>
                <rect x={0} y={band.from} width={scale.width} height={band.height} />
              </clipPath>
              <g clipPath={`url(#${onSheetId}-${index})`}>
                <ChartStop {...stopPropsOf(index)} isInteractive={false} />
              </g>
            </Fragment>
          )),
          beadsOverSheet.layer,
        )}
    </>
  );
}

interface WireProps {
  from: number;
  to: number;
  y: number;
  isHighlighted: boolean;
  /** Draws in from the axis as its stop arrives, rather than appearing whole. */
  isDrawingIn: boolean;
  /** A proposal's stop: its wire dashed in the versions' blue, not yet the day's. */
  isProposed?: boolean;
}

/** How long a proposal's wire's dashes and gaps are, in hairlines. */
const PROPOSED_WIRE_DASH = 3;

/** A stop's wire, the structure its beads sit on. */
function Wire({ from, to, y, isHighlighted, isDrawingIn, isProposed = false }: WireProps) {
  return (
    <motion.path
      d={`M${from} ${y} H${to}`}
      // A dashed wire draws in whole: its dashes would not draw in along it.
      initial={isDrawingIn && !isProposed ? { pathLength: 0 } : false}
      animate={isProposed ? {} : { pathLength: 1 }}
      transition={SPRINGS.gentle}
      strokeWidth={HAIRLINE}
      strokeDasharray={
        isProposed ? `${HAIRLINE * PROPOSED_WIRE_DASH} ${HAIRLINE * PROPOSED_WIRE_DASH}` : undefined
      }
      className={cn(
        "transition-colors",
        isProposed ? "stroke-swap-drawn" : isHighlighted ? "stroke-muted" : "stroke-wire",
      )}
    />
  );
}

interface ProposedBeadProps {
  stop: StopDraft;
  x: number;
  y: number;
  /** The day can be used: a tap on the bead takes the proposal, as a version's bead is taken. */
  isInteractive: boolean;
}

/**
 * A proposal's stop on the chart: a hollow bead ringed in the versions' blue at its energy, as
 * big as a shown bead, with a bead's target round it. It is drawn for the eye and taken by a
 * tap, as a version's bead is; the keyboard and a screen reader take the proposal from its fork
 * row, which says what it is.
 */
function ProposedBead({ stop, x, y, isInteractive }: ProposedBeadProps) {
  const { chart } = useDrawing();
  return (
    <g
      aria-hidden
      {...{ [CANDIDATE_ATTRIBUTE]: stop.primary.id }}
      className={isInteractive ? "cursor-pointer" : "pointer-events-none"}
    >
      <circle
        cx={x}
        cy={y}
        r={chart.beadHitRadius}
        className="fill-none"
        pointerEvents={isInteractive ? "all" : "none"}
      />
      <circle
        cx={x}
        cy={y}
        r={chart.shownBeadRadius}
        strokeWidth={chart.ringStroke}
        className="fill-ground stroke-swap-drawn"
      />
    </g>
  );
}

interface FadingWithProps {
  isFading: boolean;
  /** Gone in one step, as a stop the visitor cannot see as the fork folds it. */
  isAtOnce: boolean;
  children: ReactNode;
}

/**
 * A stop's wire or bead, fading out with its row's words as a re-plan goes back; in one step
 * with reduced motion. Drawn as it is otherwise.
 */
function FadingWith({ isFading, isAtOnce, children }: FadingWithProps) {
  const isReducedMotion = useReducedMotion() ?? false;
  if (!isFading) return <>{children}</>;
  return (
    <motion.g
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={isReducedMotion || isAtOnce ? { duration: 0 } : SPRINGS.gentle}
    >
      {children}
    </motion.g>
  );
}
