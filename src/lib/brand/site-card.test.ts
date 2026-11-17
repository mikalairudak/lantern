// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lockupLayoutOf } from "@/features/day/still-lockup";
import { indexPictureOf } from "@/features/day/index-pictures";
import { stillLightBoxOf, stillPlateBoxOf } from "@/features/day/still-plate";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { cardLinesOf } from "./card-lines";
import { fontMeasuresOf } from "./font-advances";
import { CARD_SQUARE, SITE_CARD_LINE, SITE_CARD_LOCKUP, SITE_CARD_PLATES } from "./site-card";

const FONTS = join(__dirname, "..", "..", "..", "assets/fonts");
const ROMAN = fontMeasuresOf(readFileSync(join(FONTS, "Literata36pt-Regular.latin.ttf")));
const ITALIC = fontMeasuresOf(readFileSync(join(FONTS, "Literata72pt-Italic.latin.ttf")));

const PLACED = SITE_CARD_PLATES.plates.map(({ slug, centre, light }) => {
  const picture = indexPictureOf(slug);
  if (picture === null) throw new Error(`"${slug}" has no picture`);
  const placement = { scale: SITE_CARD_PLATES.scale, centre, foot: SITE_CARD_PLATES.foot };
  return {
    slug,
    light,
    box: stillPlateBoxOf(picture, placement),
    lightBox: stillLightBoxOf(picture, placement),
  };
});

describe("the site's card", () => {
  it("draws three plates of the index side by side on one foot, never overlapping", () => {
    expect(PLACED.map(({ slug }) => slug)).toEqual(["paris", "tokyo", "new-york"]);
    for (const { box } of PLACED) expect(box.top + box.height).toBe(SITE_CARD_PLATES.foot);
    const boxes = PLACED.map(({ box }) => box);
    boxes.slice(1).forEach((right, index) => {
      const left = boxes[index]!;
      expect(left.left + left.width).toBeLessThanOrEqual(right.left);
    });
  });

  it("lights the one plate the middle square keeps whole, its light inside the square", () => {
    const lit = PLACED.filter(({ light }) => light === "lit");
    expect(lit.map(({ slug }) => slug)).toEqual(["tokyo"]);
    const [{ box, lightBox }] = lit as [(typeof lit)[number]];
    expect(box.left).toBeGreaterThanOrEqual(CARD_SQUARE.left);
    expect(box.left + box.width).toBeLessThanOrEqual(CARD_SQUARE.right);
    expect(lightBox.left).toBeGreaterThanOrEqual(CARD_SQUARE.left);
  });

  it("keeps the lockup whole inside the middle square", () => {
    const { mark, width } = lockupLayoutOf(
      SITE_CARD_LOCKUP,
      ITALIC.widthOf(SITE_NAME, SITE_CARD_LOCKUP.size),
      ITALIC.baselineShareAt(1),
    );
    expect(mark.left).toBeGreaterThanOrEqual(CARD_SQUARE.left);
    expect(mark.left + width).toBeLessThanOrEqual(CARD_SQUARE.right);
  });

  it("sets each row of the line centred inside x 309 to 891", () => {
    for (const row of cardLinesOf(SITE_DESCRIPTION)) {
      const half = ROMAN.widthOf(row, SITE_CARD_LINE.size) / 2;
      expect(SITE_CARD_LINE.x - half, row).toBeGreaterThanOrEqual(309);
      expect(SITE_CARD_LINE.x + half, row).toBeLessThanOrEqual(891);
    }
  });
});
