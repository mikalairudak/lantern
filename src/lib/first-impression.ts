/**
 * The first impression's flag: the start screen as an index, the day opening on its plan, and
 * the masthead's day menu. Off unless `FIRST_IMPRESSION` is exactly "1", so production renders
 * as it does until the new look is whole. It is read where the page is rendered, as the root
 * layout reads it, so a prerendered page takes it at its build and a deploy turns it on.
 */

/** The server's environment, as `process.env` gives it. */
export type FlagEnv = Readonly<Record<string, string | undefined>>;

/** The one value that turns the first impression on. Anything else, unset included, is off. */
const FIRST_IMPRESSION_ON = "1";

export function isFirstImpression(env: FlagEnv): boolean {
  return env.FIRST_IMPRESSION === FIRST_IMPRESSION_ON;
}
