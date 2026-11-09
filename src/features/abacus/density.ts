/**
 * How much a row says follows the energy of the version it shows (`docs/decisions.md`, "The day is
 * drawn as an abacus"): the day reshapes as its energy moves. Calm and reflective places open with
 * how they sound and feel; lively and social ones fold to their name and kind; balanced ones say
 * their name, kind and neighbourhood.
 */
export type Density = "open" | "standard" | "folded";

/** Calm and reflective open; lively and social fold. */
const OPEN_UP_TO = 1;
const FOLD_FROM = 3;

/**
 * How much one row says, from the energy of the version it shows. A row whose energy the
 * stream has not written yet says the least, its name and kind, so it only ever grows once
 * it is weighed: had it said its neighbourhood while being written, a lively row would take
 * it away again.
 */
export function densityOf(energy: number | null): Density {
  if (energy === null) return "folded";
  if (energy <= OPEN_UP_TO) return "open";
  return energy >= FOLD_FROM ? "folded" : "standard";
}
