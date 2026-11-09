// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SITE_DESCRIPTION } from "@/lib/site";
import { CARD_LINE_LETTERS, cardLinesOf } from "./card-lines";

describe("cardLinesOf", () => {
  it("keeps a line that fits whole", () => {
    expect(cardLinesOf("An adaptive, editorial day planner for travel.")).toEqual([
      "An adaptive, editorial day planner for travel.",
    ]);
  });

  it("breaks a longer one at the comma nearest its middle, the comma kept on the first", () => {
    expect(cardLinesOf(SITE_DESCRIPTION)).toEqual([
      "One day in a city, planned hour by hour,",
      "as quiet or as lively as you want it.",
    ]);
  });

  it("sets the site's line in lines the card holds", () => {
    for (const line of cardLinesOf(SITE_DESCRIPTION)) {
      expect(line.length).toBeLessThanOrEqual(CARD_LINE_LETTERS);
    }
  });

  it("leaves a long line with no comma whole", () => {
    const line = "A line far longer than a card can hold on one line and with no comma in it";

    expect(cardLinesOf(line)).toEqual([line]);
  });
});
