/**
 * The most letters a line of the link card sets in one row: at its size 40 letters are about
 * 570 px, as the site's first row, "One day in a city, planned hour by hour,", is 569, under
 * `CARD_ROW_MAX_PX`. It guards a line set whole; a test of each row's width guards both.
 */
export const CARD_LINE_LETTERS = 40;

/** The widest a row of the card's line may be, so it stands 24 px inside the middle square. */
export const CARD_ROW_MAX_PX = 582;

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
