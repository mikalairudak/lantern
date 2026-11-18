/**
 * The sign of work's tally (`SignOfWork`): what each count draws, as still values of the
 * drawing's parts. A plain module, so a page the server draws reads its numbers, not a client
 * reference.
 */

/** Where along the pen's stroke each rib ends, as a share of its length. */
const RIB_ENDS = [0.184, 0.473, 0.757, 1] as const;
/** The ribs a whole lantern has: the tally's count before it is lit. */
export const SIGN_RIBS = RIB_ENDS.length;

/** The lit paper at its wick: a quarter of its size. */
const WICK_SCALE = 0.25;
/** A stroke drawn by its dash: shown whole at an offset of 0, and not at all at 1. */
const UNDRAWN = 1;
const DRAWN = 0;
const HIDDEN = 0;
const SHOWN = 1;

/**
 * What the sign holds with no loop running: a tally of the work. `cut` is the outline with
 * `ribs` of its ribs cut, none to `SIGN_RIBS`; `wick` is the lantern cut whole with its wick
 * lit; `lit` is the lantern lit whole, its ribs through the paper, its glow and haze round it.
 */
export type SignTally = { kind: "cut"; ribs: number } | { kind: "wick" } | { kind: "lit" };

/** The work the sign says: the loop, or a tally held still. */
export type SignWork = { kind: "running" } | SignTally;

/** The outline alone, which the loop starts from and the tally starts at. */
const SIGN_UNCUT: SignTally = { kind: "cut", ribs: 0 };

export interface HeldParts {
  penOffset: number;
  penOpacity: number;
  paperScale: number;
  paperRibsOffset: number;
  lightOpacity: number;
}

/** The parts' still values for a tally; the running sign draws the loop's start. */
export function heldPartsOf(work: SignWork): HeldParts {
  const tally = work.kind === "running" ? SIGN_UNCUT : work;
  const unlit = { penOpacity: SHOWN, paperRibsOffset: UNDRAWN, lightOpacity: HIDDEN };
  switch (tally.kind) {
    case "cut": {
      const ribs = Math.min(Math.max(Math.round(tally.ribs), 0), SIGN_RIBS);
      const drawn = RIB_ENDS[ribs - 1] ?? 0;
      return { ...unlit, penOffset: UNDRAWN - drawn, paperScale: 0 };
    }
    case "wick":
      return { ...unlit, penOffset: DRAWN, paperScale: WICK_SCALE };
    case "lit":
      return {
        penOffset: DRAWN,
        penOpacity: HIDDEN,
        paperScale: 1,
        paperRibsOffset: DRAWN,
        lightOpacity: SHOWN,
      };
  }
}
