/**
 * Whether "Open it again" on the page for a failure asked for the page in the browser, and the
 * page has not come back yet. The press goes with the page for a failure, so the page that
 * comes back in its place hands the focus where it lands a chosen day: the start screen's
 * headline, or the day's city word. Held outside React, since the page that comes back is
 * mounted anew, and only ever set by a press, so a page drawn on the server reads it unset.
 */
let isAskedAgain = false;

/** "Open it again" was pressed: the page asked for again is on its way. */
export function markOpenedAgain(): void {
  isAskedAgain = true;
}

/** The page drawn now comes back from "Open it again". Read as it is drawn, never cleared there. */
export function isOpenedAgain(): boolean {
  return isAskedAgain;
}

/** The page asked for again has come back, or failed again: no later page takes it as its own. */
export function clearOpenedAgain(): void {
  isAskedAgain = false;
}
