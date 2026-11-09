"use client";

import { Check } from "lucide-react";
import { useEffect, useLayoutEffect, type RefObject } from "react";
import { ICON_SIZES, ICON_STROKE_WIDTH } from "@/lib/tokens/icon";
import { placeShift, shiftToFit } from "./panel-shift";

/*
 * One form for every list a word opens: the headline's words, the city and the theme. The
 * word stays where it is and is never drawn again; the list hangs below it on the sheet's
 * colour and hairline, its rows' text starting on the word's first letter, and the current
 * answer carries a quiet ink check at the end of its row.
 */

/** A word whose list is open: its underline turns solid ink, an assumption's dots too. */
export const OPEN_WORD_CLASSES =
  "aria-expanded:underline aria-expanded:decoration-ink aria-expanded:decoration-solid aria-expanded:decoration-1 underline-offset-4";

/**
 * Where a list hangs from its word: just under it, and back by a row's inset and the sheet's
 * hairline, so the rows' text starts on the word's first letter.
 */
export const HANG_FROM_WORD_CLASSES = "top-full mt-2 -left-3 -ml-px";

/** What every list is drawn on. It unfolds with the list, so nothing shows before the rows. */
export const LIST_SHEET_CLASSES = "rounded-md border border-line bg-surface";

/**
 * The box a list is laid out in: as wide as its longest row, never wider than the intro's
 * column nor than the room between the screen's gutters, where a long row wraps.
 */
export const LIST_BOX_CLASSES =
  "absolute z-50 block w-max min-w-label max-w-list text-left whitespace-normal";

/**
 * A row: its words, a second line where it has one, and the check's room at its end. A
 * coarse pointer gets taller rows, so each stays a finger's target.
 */
export const LIST_ROW_CLASSES =
  "flex w-full cursor-pointer items-start px-3 py-1 text-left transition-colors pointer-coarse:py-2";

/** A row's second line: what it would change, or what it was written as. */
export const ROW_NOTE_CLASSES = "block font-sans text-small text-muted";

/**
 * The quiet ink check at the end of the current answer's row, centred on its first line.
 * Every other row keeps its room, so the rows end alike.
 */
export function CurrentCheck({ isShown }: { isShown: boolean }) {
  return (
    <span aria-hidden className="ml-5 flex h-lh w-4 shrink-0 items-center text-ink">
      {isShown && <Check size={ICON_SIZES.sm} strokeWidth={ICON_STROKE_WIDTH} />}
    </span>
  );
}

/**
 * A list hanging from its word: moved sideways to stay inside its bounds, the word left
 * where it is, and closed by a press anywhere but on the list or on its word, captured so
 * it is gone before the press does anything. A press on the word is the word's own: it
 * closes the list as a toggle, and a close here as well would open it again.
 *
 * It moves in its own layout, by its margins, before the frame paints. Moved by a transform,
 * which lays nothing out again, the page's width still counted it where it first hung, so in
 * the frame it opened a word near a phone's right edge widened the page by 16 px.
 */
export function useHangingList(
  list: RefObject<HTMLElement | null>,
  word: RefObject<HTMLElement | null>,
  onClose: (isFocusReturned: boolean) => void,
): void {
  useLayoutEffect(() => {
    const element = list.current;
    if (element) placeShift(element, shiftToFit(element));
  }, [list]);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      const { target } = event;
      if (!(target instanceof Node)) return;
      if (list.current?.contains(target) || word.current?.contains(target)) return;
      onClose(false);
    };
    window.addEventListener("pointerdown", closeOutside, { capture: true });
    return () => window.removeEventListener("pointerdown", closeOutside, { capture: true });
  }, [list, word, onClose]);
}
