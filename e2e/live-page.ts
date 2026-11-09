import { expect, type Page } from "./fixtures";
import { BROWSER_STORAGE } from "../src/lib/browser-storage";
import { writtenVersionOf } from "../src/lib/days/written/version";
import type { Itinerary } from "../src/lib/schema/itinerary.schema";

/**
 * A written day's page as one with live generation on, for the specs that change a word on
 * it. The e2e server runs without live generation, as no test may reach a model, so the page
 * is told Lantern writes by the one flag the server sends it, rewritten on its way, and every
 * route that would call a model is answered by the spec.
 */

/**
 * The flag the page is sent, as its payload writes it, and what the test makes it say: as
 * long, should a row of the payload be counted by its length.
 */
const NOT_LIVE = '"isLive":false}';
const LIVE = '"isLive":true }';

/**
 * Opens a page as one with live generation on: the one flag the server sends it (`LiveFlag`,
 * or a kept day's page's own prop) is rewritten in the page's payload as React reads it, on
 * the queue Next's inline scripts push it on, before the page's own script takes the queue
 * over. Fails when the payload never said it, so a new shape of it is found here rather than
 * read as a page that is not live.
 */
export async function openLive(page: Page, path: string): Promise<void> {
  await page.addInitScript(
    ([notLive, live]) => {
      const state = window as unknown as { __next_f: unknown[]; liveRewritten: number };
      state.liveRewritten = 0;
      const rewrite = (item: unknown): unknown => {
        if (!Array.isArray(item) || typeof item[1] !== "string" || !item[1].includes(notLive)) {
          return item;
        }
        state.liveRewritten += 1;
        return [item[0], item[1].replace(notLive, live), ...item.slice(2)];
      };
      const chunks: unknown[] = [];
      let push: (...items: unknown[]) => number = Array.prototype.push;
      // Next's script reads the chunks pushed so far, then pushes on with a push of its own.
      Object.defineProperty(chunks, "push", {
        get:
          () =>
          (...items: unknown[]) =>
            push.apply(chunks, items.map(rewrite)),
        set: (next: typeof push) => {
          push = next;
        },
      });
      state.__next_f = chunks;
    },
    [NOT_LIVE, LIVE] as const,
  );
  await page.goto(path);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { liveRewritten: number }).liveRewritten))
    .toBe(1);
}

/**
 * Marks a written day seen on this device, by its address's slug, so its page draws it whole
 * at once rather than playing it.
 */
export async function seeWrittenDay(page: Page, slug: string, itinerary: Itinerary): Promise<void> {
  const seen = `${slug}:${writtenVersionOf(itinerary)}`;
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
    BROWSER_STORAGE.seen.key,
    JSON.stringify([seen]),
  ] as const);
}
