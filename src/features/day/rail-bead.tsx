"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/components/ui/cn";
import { SPRINGS } from "@/lib/tokens/motion";

/** A lit bead's glow grows from the bead's own size. */
const GLOW_FROM_SCALE = 0.5;
const AT_ONCE = { duration: 0 };

/**
 * A stop's bead, 8 px: ink, or lit, the lamp with one flat 4 px step of its glow round it. It is
 * drawn as its border, which forced colours draw in the text colour, where a background would
 * take the page's own and vanish; the glow is not drawn there. A bead is lit or not from its
 * first frame, so a row streamed in or drawn whole in the first HTML stands as it will stay; one
 * that lights later, as a proposal's stop does once taken, grows its glow on the gentle spring.
 * The glow has a presence of its own: the list's rows are let in with `initial` off, which would
 * otherwise reach a glow that comes later and set it whole.
 */
export function RailBead({ isLit }: { isLit: boolean }) {
  const isReducedMotion = useReducedMotion() ?? false;
  return (
    <span data-bead={isLit ? "lit" : "ink"} className="relative mt-2 size-2">
      <AnimatePresence initial={false}>
        {isLit && (
          <motion.span
            className="absolute -inset-1 rounded-full bg-lamp-glow forced-colors:hidden"
            initial={isReducedMotion ? false : { scale: GLOW_FROM_SCALE }}
            animate={{ scale: 1 }}
            transition={isReducedMotion ? AT_ONCE : SPRINGS.gentle}
          />
        )}
      </AnimatePresence>
      <span
        className={cn(
          "absolute inset-0 rounded-full border-4",
          isLit ? "border-lamp" : "border-ink",
        )}
      />
    </span>
  );
}
