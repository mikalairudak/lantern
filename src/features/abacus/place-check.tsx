"use client";

import { Crosshair } from "lucide-react";
import { motion, useReducedMotionConfig } from "motion/react";
import { createContext, useContext } from "react";
import { cn } from "@/components/ui/cn";
import type { PlaceCheck } from "@/lib/stream/place-checks";
import { ICON_SIZES } from "@/lib/tokens/icon";
import { SPRINGS } from "@/lib/tokens/motion";
import { SMALL_MARK_STROKE } from "./best-light-icon";

/**
 * A place's check as the page shows it (`docs/grounding.md`, "What the visitor sees"): looked
 * up while the day is written, then confirmed, by its name at a spot or by places of its kind
 * around its point, or not. Only a confirmed place's row says so, quietly; one the rule could
 * not confirm, or whose lookup failed, says nothing there, so nothing on the day alarms about
 * the places the map does not know (`docs/decisions.md`, "Places are checked through
 * Geoapify"). Its sheet, opened to read, says how far the map vouches for it (`map-action.ts`).
 */

/** Each place's check by its id; none on a day played from its file. */
export type PlaceChecksOf = (placeId: string) => PlaceCheck | null;

const NO_CHECK: PlaceChecksOf = () => null;

/** The checks of the day on screen, for its rows and its sheet. */
export const PlaceChecksContext = createContext<PlaceChecksOf>(NO_CHECK);

/** The check of one place of the day on screen, or null where none was made. */
export function usePlaceCheck(placeId: string | undefined): PlaceCheck | null {
  const checkOf = useContext(PlaceChecksContext);
  return placeId === undefined ? null : checkOf(placeId);
}

/** What the mark says to a screen reader, after the row's words, and as its title. */
export const ON_THE_MAP = "on the map";

interface CheckMarkProps {
  /** Its place's check, or null while none has come: unseen, as a place not confirmed. */
  check: PlaceCheck | null;
  className?: string;
  /** Its words are written: it comes. Until then it holds its room on their line, unseen. */
  isShown?: boolean;
}

/**
 * A confirmed place's mark: a surveyor's crosshair, "this spot is fixed on the map", in the
 * muted ink of the words beside it, drawn at the line weight of the row's other small marks.
 * It comes into room its row already holds, after the last word of where the place is, and
 * fades in there, as it does for a confirmation that arrives later; with reduced motion it
 * is there in one step, as the sun is. A place not confirmed, or not yet checked, keeps the
 * room unseen.
 */
export function CheckMark({ check, className, isShown = true }: CheckMarkProps) {
  // The page's motion setting, the visitor's own under the day's `reducedMotion="user"`.
  const isReducedMotion = useReducedMotionConfig() ?? false;
  const isConfirmed = check?.state === "confirmed";
  if (!isShown) {
    return (
      <span aria-hidden className={cn("invisible inline-block align-middle", className)}>
        <Crosshair size={ICON_SIZES.xs} strokeWidth={SMALL_MARK_STROKE} />
      </span>
    );
  }
  return (
    <motion.span
      initial={isReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: isConfirmed ? 1 : 0 }}
      transition={isReducedMotion ? { duration: 0 } : SPRINGS.snappy}
      title={isConfirmed ? ON_THE_MAP : undefined}
      className={cn("inline-block align-middle", className)}
    >
      <Crosshair aria-hidden size={ICON_SIZES.xs} strokeWidth={SMALL_MARK_STROKE} />
      {isConfirmed && <span className="sr-only">, {ON_THE_MAP}</span>}
    </motion.span>
  );
}
