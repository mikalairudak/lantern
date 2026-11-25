"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

/**
 * How long a version's name stays once the pointer that named it is off both its bead and the
 * name: time to cross from the bead to its name, or to slip off the name and back.
 */
export const NAME_HOLD_GRACE_MS = 300;

/** A box on the screen, in the pointer's coordinates. */
export interface ScreenBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Where a pointer stands on the screen. */
interface ScreenPoint {
  clientX: number;
  clientY: number;
}

interface NameHoldOptions {
  /** The place whose bead the pointer is on, as the chart's parent holds it. */
  hoveredPlace: string | null;
  /** Whether a pointer's name can show now: nothing else names, and nothing hides names. */
  isNameable: boolean;
  onHoverPlace: (placeId: string | null) => void;
  /** Where a place's name is drawn on the screen now, or null where none is. */
  nameBoxOf: (placeId: string) => ScreenBox | null;
}

export interface NameHold {
  /** The place whose name the pointer keeps off its bead: on the name, or on its way to it. */
  heldPlace: string | null;
  /**
   * A bead's pointer came or went; leaving a bead whose name is shown keeps the name, so the
   * pointer can move onto it. Leaving one whose name is not shown, as one Escape put away, keeps
   * nothing.
   */
  onHoverPlace: (placeId: string | null, isNameShown: boolean) => void;
  /** Ends a hold at once, as Escape puts its name away, so its bead no longer shows it named. */
  letGo: () => void;
  /** Whether the pointer stands on the held name now, as far as its moves have said. */
  isPointerOnName: () => boolean;
}

/** Whether a point stands inside a box, its edges included. */
function isInside(box: ScreenBox, { clientX, clientY }: ScreenPoint): boolean {
  return clientX >= box.left && clientX <= box.right && clientY >= box.top && clientY <= box.bottom;
}

/**
 * A version's name shown for the bead a pointer rests on stays while the pointer is on the bead
 * or on the name, and a moment longer, so it can be read with the pointer on it (WCAG 1.4.13).
 * The name takes no pointer itself, so a press under it still reaches a row or the curve; the
 * pointer is followed by its moves over the whole page, since a name over a row's words lies off
 * the chart, and read again where it rests as the page scrolls under it. A pointer that leaves
 * the page, or a window that loses the focus, lets the name go at once.
 */
export function useNameHold({
  hoveredPlace,
  isNameable,
  onHoverPlace,
  nameBoxOf,
}: NameHoldOptions): NameHold {
  const [heldPlace, setHeldPlace] = useState<string | null>(null);
  // A name no longer shown, as a sheet opens, a drag begins or the keys name instead, is let
  // go at once: it never comes back under a pointer that has not moved.
  if (heldPlace !== null && !isNameable) setHeldPlace(null);

  const boxOf = useEffectEvent(nameBoxOf);

  // Where the pointer last moved to while it is on a bead or holds a name; unknown until it
  // moves. Followed from the bead on, since the move that leaves a bead for its name can be the
  // last before the hold begins.
  const pointer = useRef<ScreenPoint | null>(null);
  const isFollowed = hoveredPlace !== null || heldPlace !== null;
  useEffect(() => {
    if (!isFollowed) return undefined;
    const notePointer = ({ clientX, clientY }: PointerEvent) => {
      pointer.current = { clientX, clientY };
    };
    document.addEventListener("pointermove", notePointer);
    return () => {
      document.removeEventListener("pointermove", notePointer);
      pointer.current = null;
    };
  }, [isFollowed]);

  useEffect(() => {
    if (heldPlace === null) return undefined;
    let grace: number | null = null;
    const startGrace = () => {
      if (grace === null) grace = window.setTimeout(() => setHeldPlace(null), NAME_HOLD_GRACE_MS);
    };
    const keepWhileOnTheName = () => {
      const box = boxOf(heldPlace);
      const at = pointer.current;
      if (at === null || box === null || !isInside(box, at)) {
        startGrace();
        return;
      }
      if (grace !== null) window.clearTimeout(grace);
      grace = null;
    };
    const followPointer = ({ clientX, clientY }: PointerEvent) => {
      pointer.current = { clientX, clientY };
      keepWhileOnTheName();
    };
    const letGoOffThePage = ({ relatedTarget }: PointerEvent) => {
      if (relatedTarget === null) setHeldPlace(null);
    };
    const letGoNow = () => setHeldPlace(null);
    // Off the bead, the pointer is on the name where it last moved to, or on its way to it.
    keepWhileOnTheName();
    document.addEventListener("pointermove", followPointer);
    // A wheel or the page's scroll carries the name from under a pointer that has not moved.
    window.addEventListener("scroll", keepWhileOnTheName, { capture: true, passive: true });
    document.addEventListener("pointerout", letGoOffThePage);
    window.addEventListener("blur", letGoNow);
    return () => {
      if (grace !== null) window.clearTimeout(grace);
      document.removeEventListener("pointermove", followPointer);
      window.removeEventListener("scroll", keepWhileOnTheName, { capture: true });
      document.removeEventListener("pointerout", letGoOffThePage);
      window.removeEventListener("blur", letGoNow);
    };
  }, [heldPlace]);

  return {
    heldPlace,
    onHoverPlace: (placeId, isNameShown) => {
      setHeldPlace(placeId === null && isNameShown ? hoveredPlace : null);
      onHoverPlace(placeId);
    },
    letGo: () => setHeldPlace(null),
    isPointerOnName: () => {
      const box = heldPlace === null ? null : nameBoxOf(heldPlace);
      return box !== null && pointer.current !== null && isInside(box, pointer.current);
    },
  };
}
