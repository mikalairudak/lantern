/**
 * The most a line of the link card holds at its size: the card's first line, "An adaptive,
 * editorial day planner for travel.", 46 letters, kept to about 640 of its 1200 px.
 */
export const CARD_LINE_LETTERS = 48;

/**
 * The site's line as the card sets it: whole when it fits a line, else in two at the comma
 * nearest its middle, the comma kept at the end of the first, so each line reads as a phrase.
 * A line too long with no comma stays whole, to be seen and rewritten.
 */
export function cardLinesOf(line: string): string[] {
  if (line.length <= CARD_LINE_LETTERS) return [line];
  const breaks = [...line.matchAll(/, /g)].map(({ index }) => index + 1);
  const middle = line.length / 2;
  const at = breaks.reduce<number | null>(
    (best, here) =>
      best === null || Math.abs(here - middle) < Math.abs(best - middle) ? here : best,
    null,
  );
  return at === null ? [line] : [line.slice(0, at), line.slice(at + 1)];
}
