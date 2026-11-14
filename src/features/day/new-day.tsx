"use client";

import { useId, type Ref } from "react";
import { cn } from "@/components/ui/cn";
import { isFocusDropped } from "./day-menu";
import { LINK_CLASSES, TARGET_CLASSES } from "./link-classes";

/** What a new day is called, in the masthead's row and as the day menu's last row. */
export const NEW_DAY = "New day";

/** What a new day does, the line its row in the menu says and its button is described by. */
export const NEW_DAY_NOTE = "Ask for a day somewhere else";

/**
 * Words with the pressable word's hairline and no chevron, since nothing hangs from them: a step
 * quieter than the menu's, turning ink under a pointer as the theme's icon does. A 32 px box,
 * 44 px under a finger, reaching 8 px past it on every side.
 */
const NEW_DAY_CLASSES = cn(
  LINK_CLASSES,
  TARGET_CLASSES,
  "min-h-8 items-center text-ink-soft pointed:text-ink pointer-coarse:min-h-11",
);

/** Locked while a re-plan is written: muted and with no hairline, as the menu's locked row. */
const LOCKED_CLASSES = "cursor-default text-muted no-underline pointed:text-muted";

/** The keyboard's ring drawn still, as a lab cell shows the focus: `focus-ring`'s. */
const FOCUS_DRAWN_CLASSES = "outline-2 outline-offset-2 outline-ink";

/**
 * Where the button stands: in the masthead's row from a row of `@masthead`, where the menu then
 * holds the ways alone; under it the menu's last row says it instead. On a day with no way to
 * take it along there is no menu, and it stands in the row at any width.
 */
const SHOWN_FROM_MASTHEAD_CLASSES = "hidden @masthead:inline-flex";

interface NewDayButtonProps {
  /** Opens the headline's city word at its field. */
  onPress: () => void;
  /** Escape on the button, which closes the city's list it opened, as Escape in the list does. */
  onEscape?: () => void;
  /**
   * The button stopped being drawn with the focus on it, as a narrowed window's row puts it in
   * the menu: the focus needs a place that is drawn.
   */
  onHiddenWithFocus?: () => void;
  /** Locked while a re-plan is written: a press says why, and opens nothing. */
  isLocked?: boolean;
  /** In the row at any width, as where the menu has no way to hold. */
  isAlwaysInRow?: boolean;
  /** Drawn as a pointer points at it, as a lab cell draws it. */
  isPointedDrawn?: boolean;
  /** Drawn with the keyboard's ring, as a lab cell draws it. */
  isFocusDrawn?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * The new day in the masthead's row: a button, not a link, since it opens the city's list on
 * this page. It names no popup and carries no `aria-expanded`: the list it opens is the
 * headline's city word's, which carries both. Its menu row's line is its description.
 */
export function NewDayButton({
  onPress,
  onEscape,
  onHiddenWithFocus,
  isLocked = false,
  isAlwaysInRow = false,
  isPointedDrawn = false,
  isFocusDrawn = false,
  ref,
}: NewDayButtonProps) {
  const noteId = useId();
  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-describedby={noteId}
        aria-disabled={isLocked || undefined}
        data-pointed={isPointedDrawn || undefined}
        onClick={onPress}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !onEscape) return;
          event.preventDefault();
          onEscape();
        }}
        onBlur={(event) => {
          if (isFocusDropped(event.relatedTarget, event.currentTarget)) onHiddenWithFocus?.();
        }}
        className={cn(
          NEW_DAY_CLASSES,
          isAlwaysInRow ? "inline-flex" : SHOWN_FROM_MASTHEAD_CLASSES,
          isLocked && LOCKED_CLASSES,
          isFocusDrawn && FOCUS_DRAWN_CLASSES,
          // Without script it stands aside with the menu.
          "view-unset:hidden",
        )}
      >
        {NEW_DAY}
      </button>
      {/* Read as the button's description only, so the masthead says it nowhere else. */}
      <span id={noteId} hidden>
        {NEW_DAY_NOTE}
      </span>
    </>
  );
}
