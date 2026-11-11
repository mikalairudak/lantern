// @vitest-environment node
import { existsSync, readdirSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { daySlugOf } from "@/lib/days/address";
import { INDEX_PICTURES } from "./index-picture-files";
import {
  densityFor,
  indexPictureOf,
  PICTURE_FIELD_WIDTH,
  pictureSrcOf,
  viewBoxOf,
} from "./index-pictures";

const PICTURES_DIR = new URL("../../../public/pictures/", import.meta.url);
const CITIES = ["Paris", "Tokyo", "Rome", "New York", "Amsterdam", "Barcelona", "Seoul", "Madrid"];
/** Every picture's files together, the start screen's eight at a phone's twice its pixels. */
const NARROW_THEME_BUDGET = 150 * 1024;

describe("the index's pictures", () => {
  it("draws the eight cities, each by its day's slug", () => {
    expect(Object.keys(INDEX_PICTURES).sort()).toEqual(
      CITIES.map((city) => daySlugOf({ city })).sort(),
    );
    expect(indexPictureOf("new-york")).toBe(INDEX_PICTURES["new-york"]);
  });

  it("has none for a city it does not draw, nor for a name every object answers to", () => {
    for (const slug of ["lisbon", "", "constructor", "__proto__", "toString"]) {
      expect(indexPictureOf(slug), slug).toBeNull();
    }
  });

  it("names every file it serves, each under its city and layer, and serves no other", () => {
    const named = Object.entries(INDEX_PICTURES).flatMap(([slug, picture]) =>
      (["scene", "subject"] as const).flatMap((layer) =>
        Object.values(picture[layer].files).map((file) => {
          expect(file.startsWith(`${slug}-${layer}-`), file).toBe(true);
          return file;
        }),
      ),
    );
    for (const file of named) expect(existsSync(new URL(file, PICTURES_DIR)), file).toBe(true);
    expect(readdirSync(PICTURES_DIR).sort()).toEqual([...named].sort());
  });

  it("keeps the start screen's eight light at a phone's twice its pixels, in either theme", () => {
    for (const layer of ["scene", "subject"] as const) {
      const bytes = Object.values(INDEX_PICTURES).reduce(
        (sum, picture) => sum + statSync(new URL(picture[layer].files.narrow, PICTURES_DIR)).size,
        0,
      );
      expect(bytes, layer).toBeLessThan(NARROW_THEME_BUDGET);
    }
  });

  it("stands every layer on the field's ground, inside a field the widest fills", () => {
    for (const picture of Object.values(INDEX_PICTURES)) {
      for (const [left, top, width, height] of [picture.scene.box, picture.subject.box]) {
        expect(top + height).toBeCloseTo(316, 0);
        expect(width).toBeLessThan(PICTURE_FIELD_WIDTH);
        expect(left + width / 2).toBeCloseTo(240, 0);
      }
      // The subject alone never stands taller than its whole scene.
      expect(picture.subject.box[3]).toBeLessThanOrEqual(picture.scene.box[3] + 0.1);
    }
  });

  it("views a picture from just over its top to just under the ground, the field's width across", () => {
    const madrid = INDEX_PICTURES.madrid!;
    const [x, y, width, height] = viewBoxOf(madrid).split(" ").map(Number);
    expect(width).toBe(PICTURE_FIELD_WIDTH);
    expect(x! + width! / 2).toBe(240);
    expect(y).toBeLessThan(Math.min(madrid.scene.box[1], madrid.subject.box[1]));
    expect(y! + height!).toBe(318);
  });

  it("asks for the narrow file a phone's cell needs, and the wide one for a laptop's at 2x or a 3x phone", () => {
    expect(densityFor(167, 2)).toBe("narrow");
    expect(densityFor(167, 1)).toBe("narrow");
    expect(densityFor(237, 1)).toBe("narrow");
    expect(densityFor(237, 2)).toBe("wide");
    expect(densityFor(167, 3)).toBe("wide");
  });

  it("asks for a layer's file under the served folder", () => {
    const layer = INDEX_PICTURES.rome!.scene;
    expect(pictureSrcOf(layer, "wide")).toBe(`/pictures/${layer.files.wide}`);
  });
});
