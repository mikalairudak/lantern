/**
 * Where "Open it again" on the page for a failure asked for the page in the browser, until the
 * page has come back. The press goes with the page for a failure, so the page that comes back in
 * its place hands the focus where it lands a chosen day: the start screen's headline, the day's
 * city word, a kept day's way on, or the headline of a page with no day on it. Whichever comes
 * back ends it as it is drawn. Held outside React, since the page that comes back is mounted
 * anew, and only ever set by a press, so a page drawn on the server reads it unset. Held by the
 * page's address, so a page that comes back with neither, as `/privacy`, leaves it to no page at
 * another address.
 */
let askedAt: string | null = null;

/** "Open it again" was pressed: the page at this address, asked for again, is on its way. */
export function markOpenedAgain(): void {
  askedAt = window.location.pathname;
}

/**
 * The page drawn now comes back from "Open it again" at the address it was pressed at. Read as
 * it is drawn, never cleared there.
 */
export function isOpenedAgain(): boolean {
  return askedAt !== null && window.location.pathname === askedAt;
}

/** The page asked for again has come back, or failed again: no later page takes it as its own. */
export function clearOpenedAgain(): void {
  askedAt = null;
}
