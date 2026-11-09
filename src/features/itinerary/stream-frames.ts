import { parsePartialJson } from "ai";
import type { PartialDay } from "@/lib/stream/outcome";
import { revealedOf, type RevealedPartial } from "./revealed";

/**
 * Frames of a day's real stream, for the lab's matrices: what the client holds after a
 * prefix of the streamed text, and the first prefix at which what it can draw reaches a
 * state. A matrix finds each state it shows this way rather than building partials by
 * hand, which miss what the stream really does.
 */

/** What the client holds after the first `at` characters of a day's stream. */
export async function partialAt(text: string, at: number): Promise<PartialDay> {
  const { value } = await parsePartialJson(text.slice(0, at));
  return (value ?? {}) as PartialDay;
}

/**
 * The first prefix of the stream at which what the page can draw, read as the page reads
 * it, satisfies `isReached`; or the stream's whole length if no prefix does. The stream only
 * ever adds to what is drawn, so `isReached` must stay true once it holds.
 */
export async function firstAt(
  text: string,
  isReached: (revealed: RevealedPartial) => boolean,
): Promise<number> {
  let low = 0;
  let high = text.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (isReached(revealedOf(await partialAt(text, middle), null))) high = middle;
    else low = middle + 1;
  }
  return low;
}
