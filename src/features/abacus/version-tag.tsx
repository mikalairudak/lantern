"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SPRINGS } from "@/lib/tokens/motion";
import { cn } from "@/components/ui/cn";
import type { Version } from "./curve";
import type { LabelSide } from "./rows";
import {
  placeTag,
  type NamedVersion,
  type Rect,
  type TagBounds,
  type TagLine,
  type TagPlacement,
  type TagToPlace,
} from "./version-tags";

/** A version to name, and where its bead is drawn on its wire. */
export interface TagRequest {
  /**
   * A pointer's or the keys' name for a version not shown; or a drag's, for the version it has
   * just switched its stop to, said as where the stop is going.
   */
  kind: "named" | "dragged";
  /** Stable while it names the same thing, so a tag that stays never fades out and in. */
  key: string;
  named: NamedVersion;
  /** The version's bead, on its wire. */
  x: number;
  y: number;
  /** The wire's other beads, the shown one too, which its words never cover on the wire. */
  others: readonly number[];
  /** The side to try first: a drag's keeps away from the hand. */
  prefer?: LabelSide;
  /** What it keeps off besides the day's words: the hand while it drags. */
  avoid?: readonly Rect[];
  /** Its wire's beads and how far a ring round one reaches, which it stands clear of. */
  rings?: TagToPlace["rings"];
}

/** Marks a tag's box in the curve's mask, which the day's words are read from without it. */
export const TAG_MASK_ATTRIBUTE = "data-tag-mask";

interface VersionTagsProps {
  tags: readonly TagRequest[];
  bounds: TagBounds;
  /** The chart's width, which a tag on the left side is placed from. */
  width: number;
  /** The chart's height, which a name keeps inside where it can. */
  height: number;
  /** From the wire to a tag over or under it, as a row's words end above theirs. */
  wireGap: number;
  /**
   * From the wire to a drag's tag over it: past the fingertip on the curve there, about as
   * far as a tap reaches to name a wire, and the gap a row's words keep.
   */
  fingerClear: number;
  /** The day's words where they stand now, in the chart's pixels, read as tags appear. */
  readWords: () => Rect[];
  /** The mask the rows draw their lines of words into, where the curve steps back. */
  maskLayer: SVGGElement | null;
  /** The room the mask leaves round a line of words, and its corners. */
  maskPad: { x: number; y: number; radius: number };
}

/**
 * A tag's words, a little room either side of them, run as one line of text, so where they
 * wrap the way a version goes ends the name's last line, as Read says it, rather than taking
 * a line of its own.
 */
const TAG_CLASSES = "block w-max rounded-sm -mx-1 px-1 text-small";

/**
 * On the wire, its words stand on the ground, one line of letters tall, which hides the wire
 * under them: written on it, as a label on a rod. Over or under it they stand on the ground as
 * a row's words do, the curve stepping back under them. Only where nowhere beside its bead is
 * clear is a name a card, as the open stop's sheet is laid over the day.
 */
const WIRE_GROUND_CLASSES = "bg-ground leading-none";
const CARD_CLASSES = "border border-line bg-surface";
/** The copies that measure a name: on the wire, and off it with a card's edges. */
const COPY_CLASSES = { wire: "leading-none", under: "border border-transparent" } as const;

/** Which way a version goes in energy's colour, as its row would say it; the plan's, quietly. */
const WAY_CLASSES: Record<Version, string> = {
  quieter: "text-energy",
  livelier: "text-energy",
  "same energy": "text-energy",
  "the original": "text-muted",
};

/** Where a pointer's or the keys' name may stand, in the order it tries them. */
const NAMED_LINES: readonly TagLine[] = ["wire", "over", "under"];
/** A drag's never stands under its wire, where the hand on the curve would cover it. */
const DRAGGED_LINES: readonly TagLine[] = ["wire", "over"];
/**
 * ...except where its name over the wire would stand past the screen's top: there it stands on
 * the wire or under it, kept off the hand as ever, and never over it again.
 */
const DRAGGED_LINES_AT_TOP: readonly TagLine[] = ["wire", "under"];

interface Measured {
  sizes: Readonly<Record<string, TagToPlace["size"]>>;
  words: readonly Rect[];
}

const NOTHING_MEASURED: Measured = { sizes: {}, words: [] };
/** Far enough above the chart to stand for everything above the screen's top. */
const SCREEN_REACH = 100_000;

/**
 * Versions named on the chart before they are taken (`docs/decisions.md`, "The day is drawn as an
 * abacus"): drawn over the day, in its own pixels, and never measured with the rows, so no row
 * moves for them. Each says its version's name in the swap's colour beside its bead, where no word
 * of the day stands if it can.
 */
export function VersionTags({
  tags,
  bounds,
  width,
  height,
  wireGap,
  fingerClear,
  readWords,
  maskLayer,
  maskPad,
}: VersionTagsProps) {
  const isReducedMotion = useReducedMotion() ?? false;
  // Each tag's words on one line, as drawn on the wire and as a card, measured with the day's
  // words before the tags are drawn, so each takes its place and wraps once, from its first
  // frame. Measured as the copies change, the fonts arriving too, after layout and before the
  // frame paints.
  const copies = useRef<Map<string, HTMLSpanElement>>(new Map());
  const layer = useRef<HTMLDivElement>(null);
  // The screen's top, in the chart's pixels: a name stands under it, where it is seen. Read as
  // a name first shows, before that frame paints, as the names are measured, and as the page
  // scrolls while any is shown. Read a frame later, a drag that named the version a drag before
  // it named, at another scroll, placed its first frame by the screen as it was: 62 to 82 px
  // off on Bologna's and Kanazawa's phone, or 33 to 52 px past the top.
  const [screenTop, setScreenTop] = useState(-Infinity);
  const readScreenTop = () => {
    const chartTop = layer.current?.getBoundingClientRect().top;
    if (chartTop !== undefined) setScreenTop(-chartTop);
  };
  const isNaming = tags.length > 0;
  useLayoutEffect(() => {
    const chartTop = layer.current?.getBoundingClientRect().top;
    if (isNaming && chartTop !== undefined) setScreenTop(-chartTop);
  }, [isNaming]);
  useEffect(() => {
    if (!isNaming) return undefined;
    let pending = 0;
    const read = () => {
      pending = 0;
      const chartTop = layer.current?.getBoundingClientRect().top;
      if (chartTop !== undefined) setScreenTop(-chartTop);
    };
    const schedule = () => {
      if (pending === 0) pending = requestAnimationFrame(read);
    };
    schedule();
    addEventListener("scroll", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(pending);
      removeEventListener("scroll", schedule);
    };
  }, [isNaming]);
  const reading = useRef(readWords);
  useLayoutEffect(() => {
    reading.current = readWords;
  });
  const [measured, setMeasured] = useState<Measured>(NOTHING_MEASURED);
  const said = tags.map(saidOf).join("|");
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => {
      const sizes: Record<string, TagToPlace["size"]> = {};
      for (const [id, copy] of copies.current) {
        const [key, line] = id.split("\n");
        if (key === undefined || line === undefined) continue;
        const size = { width: copy.offsetWidth, height: copy.offsetHeight };
        const known = sizes[key] ?? { wire: size, off: size };
        sizes[key] = line === "wire" ? { ...known, wire: size } : { ...known, off: size };
      }
      setMeasured({ sizes, words: reading.current() });
      readScreenTop();
    });
    for (const copy of copies.current.values()) observer.observe(copy);
    return () => observer.disconnect();
  }, [said]);

  // Each name in turn, the ones before it among what it keeps off, so a focused slider's two
  // never lie over each other. Sized by what it says, so a drag's name switching to another
  // never stands a frame at the old one's width.
  // Above the screen's top a name is not seen: a drag grabbed at the top of a phone's screen
  // put its name 46 px past it. Read as the names are measured.
  const aboveTheScreen: Rect = {
    left: -width,
    right: 2 * width,
    top: -SCREEN_REACH,
    bottom: screenTop,
  };
  const placed = tags.reduce<{ tag: TagRequest; placement: TagPlacement }[]>((done, tag) => {
    const size = measured.sizes[saidOf(tag)];
    if (size === undefined) return done;
    const isDragged = tag.kind === "dragged";
    const placeOn = (lines: readonly TagLine[]) =>
      placeTag(
        {
          beadX: tag.x,
          wireY: tag.y,
          size,
          others: tag.others,
          lines,
          prefer: tag.prefer,
          overGap: isDragged ? fingerClear : wireGap,
          avoid: [...(tag.avoid ?? []), aboveTheScreen, ...done.map((each) => each.placement.box)],
          rings: tag.rings,
        },
        { bounds, words: measured.words, wireGap, height },
      );
    const placement = placeOn(isDragged ? DRAGGED_LINES : NAMED_LINES);
    // A drag grabbed near the screen's top, whose name would stand past the screen's edge over
    // its wire, may stand under it there, beside the hand and clear of it.
    const isPastTheTop = isDragged && placement.box.top < screenTop;
    return [...done, { tag, placement: isPastTheTop ? placeOn(DRAGGED_LINES_AT_TOP) : placement }];
  }, []);

  return (
    // Unheard: a screen reader hears each version's name from its bead. Each part says so
    // itself, so the layer is no unheard box among the chart's own.
    <div ref={layer} className="pointer-events-none absolute inset-0 z-30">
      {/* Clipped to nothing, so a long name's one-line copy never widens the page. */}
      <div aria-hidden className="invisible absolute top-0 left-0 size-0 overflow-hidden">
        {tags.flatMap((tag) =>
          (["wire", "under"] as const).map((line) => {
            const id = `${saidOf(tag)}\n${line === "wire" ? "wire" : "off"}`;
            return (
              <span
                key={id}
                ref={(node) => {
                  if (node) copies.current.set(id, node);
                  else copies.current.delete(id);
                }}
                className={cn(TAG_CLASSES, COPY_CLASSES[line], "whitespace-nowrap")}
              >
                <TagWords tag={tag} line={line} />
              </span>
            );
          }),
        )}
      </div>
      <AnimatePresence>
        {placed.map(({ tag, placement }) => {
          // A name over the wire hangs from its bottom, so words that wrap grow upward.
          const top = placement.line === "over" ? placement.box.bottom : placement.box.top;
          const position =
            placement.side === "right"
              ? { left: placement.edge, top }
              : { right: width - placement.edge, top };
          return (
            <motion.div
              key={tag.key}
              data-tag={placement.line}
              data-card={placement.isCard || undefined}
              data-dragged={tag.kind === "dragged" || undefined}
              aria-hidden
              initial={isReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={isReducedMotion ? undefined : { opacity: 0 }}
              transition={SPRINGS.snappy}
              className="absolute"
              style={position}
            >
              <span
                className={cn(
                  TAG_CLASSES,
                  placement.line === "over" && "-translate-y-full",
                  placement.isCard
                    ? CARD_CLASSES
                    : placement.line === "wire" && WIRE_GROUND_CLASSES,
                  placement.side === "left" && "text-right",
                )}
                style={{ maxWidth: placement.maxWidth }}
              >
                <TagWords tag={tag} line={placement.line} />
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
      {/* Where a name stands on the ground, the curve steps back under it, as under a row's
          words: its box drawn into the mask the rows draw their lines into. */}
      {maskLayer &&
        createPortal(
          placed.flatMap(({ tag, placement }) =>
            placement.isCard
              ? []
              : [
                  <rect
                    key={tag.key}
                    {...{ [TAG_MASK_ATTRIBUTE]: "" }}
                    x={placement.box.left - maskPad.x}
                    y={placement.box.top - maskPad.y}
                    width={placement.box.right - placement.box.left + 2 * maskPad.x}
                    height={placement.box.bottom - placement.box.top + 2 * maskPad.y}
                    rx={maskPad.radius}
                  />,
                ],
          ),
          maskLayer,
        )}
    </div>
  );
}

/** What a tag says, for the size its words are measured at. */
function saidOf(tag: TagRequest): string {
  return `${tag.kind}:${tag.key}:${tag.named.name}`;
}

/** On the wire, its words are one line of letters tall, so they stay off the rows' words. */
function TagWords({ tag, line }: { tag: TagRequest; line: TagLine }): ReactNode {
  const { named } = tag;
  const leading = line === "wire" && "leading-none";
  if (tag.kind === "dragged") {
    return <span className={cn("type-name text-small text-swap", leading)}>→ {named.name}</span>;
  }
  return (
    <>
      <span className={cn("type-name text-small text-swap", leading)}>{named.name}</span>{" "}
      <span className={cn("type-note", WAY_CLASSES[named.way], leading)}>{named.way}</span>
    </>
  );
}
