/**
 * How many times longer a wait is on CI than on the laptop. CI's shared runner draws and
 * compiles several times slower, so a limit set for the laptop, such as a day's 30 s to
 * stream, ran out there with the page still at work; the laptop keeps its own, so a page that
 * slows down still fails where the limits were measured (docs/harness.md, "Continuous
 * integration"). Kept apart from `fixtures.ts`, which `playwright.config.ts` cannot import.
 */
export const CI_WAIT_FACTOR = process.env.CI ? 2 : 1;

/** A wait set for the laptop, as long as it runs on this machine. */
export function waitMs(laptopMs: number): number {
  return laptopMs * CI_WAIT_FACTOR;
}
