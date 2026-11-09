"use client";

import { useMotionValue, useTransform, type MotionValue } from "motion/react";

import { useLayoutEffect, useRef } from "react";

import { cn } from "@/components/ui/cn";

import { type PlaceDraft, type StopDraft } from "./day-draft";

import { type BestLight } from "./light";

import { type Drawing } from "./rows";
import { nameRoomOf, type SheetAnchor, type SheetSide } from "./sheet-placement";
import { type StopDetails } from "./stop-details";
import { DetailsCopy, DetailsPanel } from "./stop-details-view";

/** An open stop: the version it shows, what that says, and where its words are. */
export interface OpenDetails {
  stop: StopDraft;
  shown: PlaceDraft;
  details: StopDetails;
  light: BestLight | null;
  /** What the sheet would say with each of the stop's versions on show, the shown one too. */
  versions: readonly SheetVersion[];
  /** Where the stop's words are this frame, which its sheet opens from. */
  anchor: SheetAnchor;
}

/** What an open stop's sheet says with one of its versions on show. */
export interface SheetVersion {
  id: string;
  name: string;
  details: StopDetails;
  light: BestLight | null;
}

/**
 * An open stop as its row draws the sheet: what it says, the run of the row it may take,
 * from just right of the time axis to the frame's edge, and the side of the words it opens
 * on, null until the sheet has been measured.
 */
export interface OpenSheet extends OpenDetails {
  from: number;
  to: number;
  isFocusTaken: boolean;
  side: SheetSide | null;
}

/** How tall an open stop's sheet is besides the room it keeps for the words, by its stop. */
export interface SheetBody {
  stopId: string;
  /** With the version on show. */
  shown: number;
  /** With the tallest of the stop's versions, which the side is chosen for. */
  tallest: number;
}

/** The side an open stop's sheet took as it opened, by its stop. */
export interface HeldSide {
  stopId: string;
  side: SheetSide;
}

/** The id an open stop's sheet goes by, which its name says it controls. */
export function detailsIdOf(stopId: string): string {
  return `${stopId}-details`;
}

/** A sheet's box: its edge, and its padding but on the side its stop's words are on. */
const SHEET_BOX_CLASSES = "rounded-md border border-line px-4";

interface SheetCopiesProps {
  stopId: string;
  versions: readonly SheetVersion[];
  shownId: string;
  width: number;
  onBody: (body: SheetBody) => void;
}

/**
 * What an open stop's sheet would say with each of its versions, set unseen at the sheet's
 * width, without the room for the words: the height of the version on show, and of the
 * tallest, which the sheet's side is chosen for as it opens. Measured before the first paint,
 * and again as the version on show or the width changes.
 */
export function SheetCopies({ stopId, versions, shownId, width, onBody }: SheetCopiesProps) {
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return undefined;
    // Each version's copy, by the version it is of.
    const copies = [...element.children].flatMap((slot) =>
      slot instanceof HTMLElement && slot.firstElementChild instanceof HTMLElement
        ? [{ id: slot.dataset.version, copy: slot.firstElementChild }]
        : [],
    );
    const report = () =>
      onBody({
        stopId,
        shown: copies.find(({ id }) => id === shownId)?.copy.offsetHeight ?? 0,
        tallest: Math.max(0, ...copies.map(({ copy }) => copy.offsetHeight)),
      });
    report();
    const observer = new ResizeObserver(report);
    copies.forEach(({ copy }) => observer.observe(copy));
    return () => observer.disconnect();
  }, [stopId, versions, shownId, width, onBody]);
  return (
    <div ref={box}>
      {versions.map((version) => (
        <div key={version.id} data-version={version.id}>
          <DetailsCopy
            details={version.details}
            light={version.light}
            name={version.name}
            className={cn("absolute top-0 left-0 pb-4", SHEET_BOX_CLASSES)}
            style={{ width }}
          />
        </div>
      ))}
    </div>
  );
}

interface WordsSheetProps {
  id: string;
  sheet: OpenSheet;
  /** The side of the stop's words it opens on, chosen as it opened. */
  side: SheetSide;
  /** Where the words start, in the row, this frame. */
  wordsX: MotionValue<number>;
  width: number;
  drawing: Drawing;
  onClose: () => void;
}

/**
 * The open stop's words grow into a sheet where they stand: the name stays put, and what
 * the place is unrolls under it, over its wire and the rows below; or, where the day has no
 * room for it there, above it, over the rows before, from just past its own beads. The
 * sheet starts just before the words and is held inside the row, clear of the time axis.
 * It covers the row's own beads where it lies: a version of an open stop is chosen from the
 * keyboard, from a bead the sheet does not reach, or once it is closed.
 */
export function WordsSheet({ id, sheet, side, wordsX, width, drawing, onClose }: WordsSheetProps) {
  const pad = drawing.row.sheetPad;
  const nameRoom = nameRoomOf(side, sheet.anchor.above, drawing);
  // The run the sheet may take is held as a value, so the glide reads this render's.
  const run = useMotionValue({ from: sheet.from, to: sheet.to, width });
  useLayoutEffect(() => {
    run.set({ from: sheet.from, to: sheet.to, width });
  }, [run, sheet.from, sheet.to, width]);
  const x = useTransform(() => {
    const at = wordsX.get();
    const { from, to, width: wide } = run.get();
    return Math.max(from - at, Math.min(-pad, to - at - wide));
  });
  // Down, its top edge a pad above the words; up, its lower edge just past the wire's beads.
  const edge =
    side === "above"
      ? { bottom: -(sheet.anchor.above + drawing.chart.beadReach), paddingBottom: nameRoom }
      : { top: -pad, paddingTop: nameRoom };
  return (
    <DetailsPanel
      id={id}
      name={sheet.shown.name ?? ""}
      details={sheet.details}
      light={sheet.light}
      onClose={onClose}
      side={side}
      className={cn("absolute", SHEET_BOX_CLASSES, side === "above" ? "pt-4" : "pb-4")}
      style={{ x, width, ...edge }}
      isFocusTaken={sheet.isFocusTaken}
    />
  );
}
