"use client";

import { useEffect, useRef, type ReactElement } from "react";
import { clearOpenedAgain, isOpenedAgain } from "./open-again";

interface AddressHeadlineProps {
  /** What the page says in place of what was asked for. */
  headline: string;
  /**
   * The page takes the place of a page the visitor pressed on, as the page for a failure does:
   * the press went with that page, so the headline takes the focus.
   */
  isFocusedAfterPress: boolean;
}

/**
 * The one heading of a page of Lantern's own with no day on it. It takes the focus, by script
 * alone and never by Tab, where the page took it from under the visitor: the page for a failure
 * after a press, and any such page drawn by "Open it again" (`open-again.ts`), which ends there.
 * A page that opened with nothing pressed takes none, as the start screen takes none as it
 * opens, and a focus that stands elsewhere stays.
 */
export function AddressHeadline({
  headline,
  isFocusedAfterPress,
}: AddressHeadlineProps): ReactElement {
  const own = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const isAgain = isOpenedAgain();
    clearOpenedAgain();
    const active = document.activeElement;
    const isLost = active === null || active === document.body;
    const isPressedAway = isFocusedAfterPress && hasBeenPressed();
    if (isLost && (isAgain || isPressedAway)) own.current?.focus({ preventScroll: true });
  }, [isFocusedAfterPress]);
  return (
    <h1 ref={own} tabIndex={-1} className="mt-5 type-voice text-title text-balance text-ink">
      {headline}
    </h1>
  );
}

/** Whether the visitor has pressed anything on this page since it loaded, as the browser keeps it. */
function hasBeenPressed(): boolean {
  return "userActivation" in navigator && navigator.userActivation.hasBeenActive;
}
