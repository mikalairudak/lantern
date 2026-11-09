"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { BROWSER_STORAGE } from "@/lib/browser-storage";
import type { StopDraft } from "./day-draft";
import { invitedStop, type IsSeen } from "./example-pull";

/**
 * After the chart becomes draggable, the day rests this long, its rows in their places,
 * before the stop that invites the first drag is chosen and its ring drawn.
 */
export const INVITATION_DELAY_MS = 1000;

export interface Invitation {
  /**
   * The stop whose ring invites the first drag, and where the example pull is drawn; null
   * until it is chosen, a moment after the day can be dragged.
   */
  stopIndex: number | null;
  /**
   * Which stops can be seen where the day is on the page, for the day's rows to say: the
   * stop is chosen among them, so on a phone the ring is on the first screen.
   */
  seenRef: RefObject<IsSeen | null>;
}

/**
 * What a page remembers of its invitation across the days it draws (`Day`): it shows once on
 * a page, not on every day a re-plan or a new day lands there.
 */
export interface InvitationMemory {
  /** Shown already on this page, for one of its days. */
  readonly isShown: boolean;
  onShown: () => void;
}

/** Whether this page load has shown the invitation, on any of the days it drew. */
let isShownThisLoad = false;

/**
 * The product's memory of the invitation: the page load's, kept by the module, so a client
 * navigation, as the wordmark's to the start screen and on to another day, keeps it, and only
 * a load of the page starts it again. Read as the stop would be chosen, never while rendering.
 */
export const PAGE_INVITATION_MEMORY: InvitationMemory = {
  get isShown() {
    return isShownThisLoad;
  },
  onShown: () => {
    isShownThisLoad = true;
  },
};

interface InvitationOptions {
  stops: readonly StopDraft[];
  /** The chart can be dragged. The stop is chosen once, a moment after this turns true. */
  isInteractive: boolean;
  /**
   * The page's memory of it, the product's: with it, no stop is chosen on a page that has
   * shown one, nor for a visitor who has dragged a day's curve on this device. Left out, as
   * by a lab that plays one day again and again, the invitation is each day's own.
   */
  memory?: InvitationMemory;
}

/** Where the browser notes that its visitor has dragged a day's curve, in `localStorage`. */
const DRAGGED_STORAGE_KEY = BROWSER_STORAGE.dragged.key;

/** Whether this device's visitor has dragged a day's curve, who needs showing no more. */
function hasDraggedCurve(): boolean {
  try {
    return localStorage.getItem(DRAGGED_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

/** Notes that the visitor has dragged a day's curve, or bent it from the keys. */
export function noteCurveDragged(): void {
  try {
    localStorage.setItem(DRAGGED_STORAGE_KEY, "1");
  } catch {
    // Without storage the next page shows how once more.
  }
}

/**
 * Where the chart invites its first drag. The page never changes the day by itself
 * (2026-10-30): the chart only draws, at this stop, a ring with arrows and the day a pull
 * there would give, and under a moving pointer the day a pull to it would give, until the
 * visitor first drags or taps (`AbacusChart`). The stop is chosen a moment after the day
 * can be dragged, among the stops in view when there is one with room, and kept until the
 * day can no longer be dragged, as while a re-plan writes it: then it is put away for good,
 * so a day changed under it does not bring it back (`docs/decisions.md`, "The page never
 * changes the day by itself").
 */
export function useInvitation({ stops, isInteractive, memory }: InvitationOptions): Invitation {
  const [stopIndex, setStopIndex] = useState<number | null>(null);
  const [isChosen, setIsChosen] = useState(false);
  const seenRef = useRef<IsSeen | null>(null);
  // The latest stops, read when the stop is chosen: a page that rebuilds its list on every
  // render must not restart the wait.
  const stopsRef = useRef(stops);
  const memoryRef = useRef(memory);
  if (isChosen && !isInteractive && stopIndex !== null) setStopIndex(null);

  useEffect(() => {
    stopsRef.current = stops;
    memoryRef.current = memory;
  });

  useEffect(() => {
    if (!isInteractive || isChosen) return undefined;
    const kept = memoryRef.current;
    if (kept !== undefined && (kept.isShown || hasDraggedCurve())) return undefined;
    const timer = window.setTimeout(() => {
      setStopIndex(invitedStop(stopsRef.current, seenRef.current ?? undefined));
      setIsChosen(true);
      memoryRef.current?.onShown();
    }, INVITATION_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isInteractive, isChosen]);

  return { stopIndex, seenRef };
}
