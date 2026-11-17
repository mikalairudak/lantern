// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SITE_DESCRIPTION } from "@/lib/site";
import { CARD_LINE_LETTERS, CARD_ROW_MAX_PX, cardLinesOf } from "./card-lines";
import { fontMeasuresOf } from "./font-advances";
import { SITE_CARD_LINE } from "./site-card";

/** The cut the card sets its line in. */
const ROMAN = fontMeasuresOf(
  readFileSync(join(__dirname, "..", "..", "..", "assets/fonts/Literata36pt-Regular.latin.ttf")),
);

describe("cardLinesOf", () => {
  it("keeps a line that fits whole", () => {
    expect(cardLinesOf("A calm day in a city, hour by hour.")).toEqual([
      "A calm day in a city, hour by hour.",
    ]);
  });

  it("breaks a longer one at the comma nearest its middle, the comma kept on the first", () => {
    expect(cardLinesOf(SITE_DESCRIPTION)).toEqual([
      "One day in a city, planned hour by hour,",
      "as quiet or as lively as you want it.",
    ]);
  });

  it("sets the site's line in rows the card holds", () => {
    for (const row of cardLinesOf(SITE_DESCRIPTION)) {
      expect(row.length).toBeLessThanOrEqual(CARD_LINE_LETTERS);
    }
  });

  it("sets each row of the site's line inside the middle square, as the card's renderer measures it", () => {
    for (const row of cardLinesOf(SITE_DESCRIPTION)) {
      expect(ROMAN.widthOf(row, SITE_CARD_LINE.size), row).toBeLessThanOrEqual(CARD_ROW_MAX_PX);
    }
  });

  it("leaves a long line with no comma whole", () => {
    const line = "A line far longer than a card can hold on one line and with no comma in it";

    expect(cardLinesOf(line)).toEqual([line]);
  });
});
