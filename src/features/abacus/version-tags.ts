import {
  candidatesOf,
  energyOf,
  keyStepOf,
  versionOf,
  type CurveStop,
  type EnergyStep,
  type Version,
} from "./curve";
import { hasEnergy, type StopDraft } from "./day-draft";
import { placeLabel, type LabelPlacement, type LabelSide } from "./rows";

/**
 * A version named on the chart before it is taken: by a pointer resting on its bead, by the
 * arrow keys of its stop's focused slider, or by a drag that has just switched its stop to
 * it. Its row's words still name what the stop shows; the name stands under the wire, beside
 * the version's bead, until the hand moves on.
 */
export interface NamedVersion {
  stopIndex: number;
  candidate: number;
  name: string;
  /** How it differs from what the model planned, in the words its row would say it in. */
  way: Version;
}

/** The version at `candidate` of a stop whose versions are written, if it has a name yet. */
function namedOf(stop: StopDraft, stopIndex: number, candidate: number): NamedVersion | null {
  if (!hasEnergy(stop)) return null;
  const place = candidatesOf(stop)[candidate];
  if (!place?.name) return null;
  return {
    stopIndex,
    candidate,
    name: place.name,
    way: versionOf(stop as CurveStop, place as CurveStop["primary"]),
  };
}

/**
 * The version whose bead a pointer rests on, unless it is the one its stop shows: a bead just
 * picked is shown, and says its name in its row.
 */
export function hoveredVersionOf(
  stops: readonly StopDraft[],
  selected: readonly number[],
  hoveredPlace: string | null,
): NamedVersion | null {
  if (hoveredPlace === null) return null;
  for (const [stopIndex, stop] of stops.entries()) {
    const candidate = candidatesOf(stop).findIndex((place) => place.id === hoveredPlace);
    if (candidate === -1) continue;
    if (candidate === (selected[stopIndex] ?? 0)) return null;
    return namedOf(stop, stopIndex, candidate);
  }
  return null;
}

/**
 * The version an arrow key on a stop's slider takes it to: the next bead along its wire that
 * way, or, where the key pulls the curve to the next energy, the version the stop then shows,
 * the first written at that energy (`pickCandidate` breaks ties the same way).
 */
export function keyedCandidateOf(
  stop: CurveStop,
  shown: number,
  step: Extract<EnergyStep, "quieter" | "livelier">,
): number | null {
  const next = keyStepOf(stop, shown, step);
  if (next === null) return null;
  if (next.kind === "version") return next.index;
  const index = candidatesOf(stop).findIndex((place) => energyOf(place) === next.energy);
  return index === -1 ? null : index;
}

/** The versions the arrow keys of a focused stop's slider would take it to, quieter first. */
export function keyedVersionsOf(
  stops: readonly StopDraft[],
  selected: readonly number[],
  focusedStop: number | null,
): NamedVersion[] {
  if (focusedStop === null) return [];
  const stop = stops[focusedStop];
  if (!stop || !hasEnergy(stop)) return [];
  const shown = selected[focusedStop] ?? 0;
  return (["quieter", "livelier"] as const).flatMap((step) => {
    const candidate = keyedCandidateOf(stop as CurveStop, shown, step);
    const named = candidate === null ? null : namedOf(stop, focusedStop, candidate);
    return named ? [named] : [];
  });
}

/**
 * The version a drag has switched its grabbed stop to: the stop whose wire is nearest the
 * minute the curve was grabbed at, once what the chart shows there differs from what its row
 * says. It changes only as the pick crosses a switching point, and is gone when the drag
 * comes back to what the row says.
 */
export function draggedVersionOf(
  stops: readonly StopDraft[],
  mids: readonly number[],
  selected: readonly number[],
  committed: readonly number[],
  grabbedAt: number | null,
): NamedVersion | null {
  if (grabbedAt === null) return null;
  let nearest = -1;
  for (const [index, stop] of stops.entries()) {
    if (!hasEnergy(stop)) continue;
    const distance = Math.abs((mids[index] ?? 0) - grabbedAt);
    if (nearest === -1 || distance < Math.abs((mids[nearest] ?? 0) - grabbedAt)) nearest = index;
  }
  const stop = stops[nearest];
  if (!stop) return null;
  const shown = selected[nearest] ?? 0;
  if (shown === (committed[nearest] ?? shown)) return null;
  return namedOf(stop, nearest, shown);
}

/**
 * Where a tag stands against its wire: on it, as a label on a rod; over it, in its own row's
 * band beside its row's words; or under it, in the next row's band.
 */
export type TagLine = "wire" | "over" | "under";

/** A box in the chart's pixels. */
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Where a named version's words stand beside its bead. */
export interface TagPlacement extends LabelPlacement {
  line: TagLine;
  /** The x its words start from on the right side, or end at on the left. */
  edge: number;
  /** The top of its box. */
  top: number;
  /** Where it stands, wrapped as it will be, in the chart's pixels. */
  box: Rect;
  /**
   * It lies over words or a bead, or nowhere beside its bead holds it: a card, as the open
   * stop's sheet is, where any other name stands on the ground.
   */
  isCard: boolean;
}

/** The room a stop's words have across the chart, which a tag keeps to as well. */
export interface TagBounds {
  left: number;
  right: number;
  /** From a bead's centre to the words beside it. */
  beadClear: number;
}

/** What a tag is placed among. */
export interface TagRoom {
  bounds: TagBounds;
  /** The day's words where they stand, which a tag never lies over where it has the choice. */
  words: readonly Rect[];
  /** From the wire to a tag over or under it, as a row's words end above theirs. */
  wireGap: number;
  /** How tall the chart is: a name never stands past its top or its end where it can help it. */
  height?: number;
}

/**
 * How much worse it is to lie over the hand or another name, or past the chart's ends, than
 * over a row's words: a card may lie over a few words, never over a finger, a name or a bead.
 */
const HARD_COVER = 100;

/** The tag to place: its words' size on one line, its bead, and where it may stand. */
export interface TagToPlace {
  beadX: number;
  wireY: number;
  /** Its words on one line: on the wire, and off it, where it is a card. */
  size: { wire: { width: number; height: number }; off: { width: number; height: number } };
  /** The wire's other beads, the shown one too, which its words never cover on the wire. */
  others: readonly number[];
  /** The lines it may take, in the order it tries them. */
  lines: readonly TagLine[];
  /** The side it tries first; its row's words' side (`placeLabel`) where none is asked. */
  prefer?: LabelSide;
  /** From the wire to a tag over it, where that is more than the words' gap. */
  overGap?: number;
  /** What else it keeps off, besides the day's words: the hand while it drags, a name before it. */
  avoid?: readonly Rect[];
  /**
   * Its wire's beads, its own too, and how far a ring round one reaches: over or under the
   * wire, a name that passes one stands clear of its ring, as the hover's or the keys' focus
   * draws it.
   */
  rings?: { at: readonly number[]; reach: number };
}

/** A tag wraps beside its bead onto two lines at most before it gives up its bead's side. */
const MOST_LINES_BESIDE = 2;
/**
 * Words wrap where a word ends, not where the room does: a name is counted this much wider
 * when its lines are, so two lines counted are never three drawn.
 */
const WRAP_SLACK = 1.2;

/** Two boxes touching by less than this are apart: a line's edge, not its letters. */
const TOUCH = 1;

function overlapOf(a: Rect, b: Rect): number {
  const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return x > TOUCH && y > TOUCH ? x * y : 0;
}

/**
 * Where a version's words stand beside its bead (2026-11-05): the first of its `lines`, on the
 * side it prefers and then the other, where they hold on one line and lie over nothing it
 * keeps off, the day's words and its `avoid`; then the same off the wire, on two lines. On the
 * wire they keep to the run no other point in `others` stands in, so they never cover a bead,
 * nor the curve, which crosses a wire only at its shown bead, or where a hand holds it. Where
 * every such place would lie over something, they are a card where they cover least; where
 * none holds them even on two lines, a card centred on the bead, as wide as the room allows.
 */
export function placeTag(tag: TagToPlace, room: TagRoom): TagPlacement {
  const { bounds, wireGap } = room;
  const { beadX, wireY, size, others, lines } = tag;
  const { beadClear } = bounds;
  const avoided = tag.avoid ?? [];
  const runTo = {
    right: Math.min(bounds.right, ...others.filter((x) => x > beadX).map((x) => x - beadClear)),
    left: Math.max(bounds.left, ...others.filter((x) => x < beadX).map((x) => x + beadClear)),
  };
  const roomOf = (line: TagLine, side: LabelSide): number => {
    const right = line === "wire" ? runTo.right : bounds.right;
    const left = line === "wire" ? runTo.left : bounds.left;
    return Math.max(
      0,
      Math.floor(side === "right" ? right - (beadX + beadClear) : beadX - beadClear - left),
    );
  };
  const first =
    tag.prefer ?? placeLabel(beadX, size.off.width, bounds.left, bounds.right, true, bounds).side;
  const sides: LabelSide[] = first === "right" ? ["right", "left"] : ["left", "right"];
  // A card's line is its words' and its edges'; a line more adds its words' alone.
  const lineHeight = Math.max(0, size.off.height - CARD_EDGES);
  // Off the wire, a name stands as far from it as a row's words do, and further where it
  // passes over or under a bead, clear of the ring the bead may wear.
  const gapOf = (line: TagLine, left: number, right: number): number => {
    const passesBead = (tag.rings?.at ?? []).some(
      (x) => x + (tag.rings?.reach ?? 0) > left && x - (tag.rings?.reach ?? 0) < right,
    );
    const ringGap = passesBead ? (tag.rings?.reach ?? 0) + TOUCH : 0;
    const asked = line === "over" ? (tag.overGap ?? 0) : 0;
    return Math.max(wireGap, ringGap, asked);
  };
  const topOf = (line: TagLine, height: number, left: number, right: number): number =>
    line === "wire"
      ? wireY - height / 2
      : line === "under"
        ? wireY + gapOf(line, left, right)
        : wireY - gapOf(line, left, right) - height;
  const placementOf = (line: TagLine, side: LabelSide, lineCount: number): TagPlacement => {
    const maxWidth = roomOf(line, side);
    const one = line === "wire" ? size.wire : size.off;
    const width = Math.min(one.width, maxWidth);
    const height = one.height + (lineCount - 1) * lineHeight;
    const edge = side === "right" ? beadX + beadClear : beadX - beadClear;
    const left = side === "right" ? edge : edge - width;
    const top = topOf(line, height, left, left + width);
    const box = { left, top, right: left + width, bottom: top + height };
    return { side, line, edge, top, maxWidth, box, isCard: false };
  };
  const coverOf = ({ box }: TagPlacement): number => {
    const words = room.words.reduce((sum, rect) => sum + overlapOf(box, rect), 0);
    const hard = avoided.reduce((sum, rect) => sum + overlapOf(box, rect), 0);
    const past =
      room.height === undefined
        ? 0
        : (box.right - box.left) * (Math.max(0, -box.top) + Math.max(0, box.bottom - room.height));
    return words + HARD_COVER * (hard + past);
  };
  const oneLine = lines.flatMap((line) =>
    sides.flatMap((side) => {
      const width = line === "wire" ? size.wire.width : size.off.width;
      return width <= roomOf(line, side) ? [placementOf(line, side, 1)] : [];
    }),
  );
  const twoLines = lines
    .filter((line) => line !== "wire")
    .flatMap((line) =>
      sides.flatMap((side) => {
        const room = roomOf(line, side);
        const lineCount = room > 0 ? Math.ceil((size.off.width * WRAP_SLACK) / room) : Infinity;
        return lineCount > 1 && lineCount <= MOST_LINES_BESIDE
          ? [placementOf(line, side, lineCount)]
          : [];
      }),
    );
  const beside = [...oneLine, ...twoLines];
  const covered = beside.map(coverOf);
  const clear = beside[covered.indexOf(0)];
  if (clear) return clear;
  const least = beside[covered.indexOf(Math.min(...covered))];
  if (least) return { ...least, isCard: true };
  // Nowhere beside its bead holds it, even on two lines: a card centred on the bead, kept
  // inside the room, off the wire where it covers least.
  const roomAcross = Math.max(0, Math.floor(bounds.right - bounds.left));
  const width = Math.min(size.off.width, roomAcross);
  const lineCount =
    roomAcross > 0 ? Math.max(1, Math.ceil((size.off.width * WRAP_SLACK) / roomAcross)) : 1;
  const height = size.off.height + (lineCount - 1) * lineHeight;
  const left = Math.min(Math.max(beadX - width / 2, bounds.left), bounds.right - width);
  const centred = lines
    .filter((line) => line !== "wire")
    .map((line): TagPlacement => {
      const top = topOf(line, height, left, left + width);
      const box = { left, top, right: left + width, bottom: top + height };
      return { side: "right", line, edge: left, top, maxWidth: roomAcross, box, isCard: true };
    });
  const centredCover = centred.map(coverOf);
  const fallback = centred[centredCover.indexOf(Math.min(...centredCover))];
  if (fallback) return fallback;
  const top = topOf("under", height, left, left + width);
  const box = { left, top, right: left + width, bottom: top + height };
  return { side: "right", line: "under", edge: left, top, maxWidth: roomAcross, box, isCard: true };
}

/** A card's edges, top and bottom, which a line of its words more does not add again. */
const CARD_EDGES = 2;
