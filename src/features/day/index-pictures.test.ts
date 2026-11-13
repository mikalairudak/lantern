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
const NARROW_BUDGET = 150 * 1024;

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

  it("names every file it serves, each under its city's scene, and serves no other", () => {
    const named = Object.entries(INDEX_PICTURES).flatMap(([slug, picture]) =>
      Object.values(picture.scene.files).map((file) => {
        expect(file.startsWith(`${slug}-scene-`), file).toBe(true);
        return file;
      }),
    );
    for (const file of named) expect(existsSync(new URL(file, PICTURES_DIR)), file).toBe(true);
    expect(readdirSync(PICTURES_DIR).sort()).toEqual([...named].sort());
  });

  it("keeps the start screen's eight light at a phone's twice its pixels, in either theme", () => {
    const bytes = Object.values(INDEX_PICTURES).reduce(
      (sum, picture) => sum + statSync(new URL(picture.scene.files.narrow, PICTURES_DIR)).size,
      0,
    );
    expect(bytes).toBeLessThan(NARROW_BUDGET);
  });

  it("stands every scene on the field's ground, inside a field the widest fills", () => {
    for (const { scene } of Object.values(INDEX_PICTURES)) {
      const [left, top, width, height] = scene.box;
      expect(top + height).toBeCloseTo(316, 0);
      expect(width).toBeLessThan(PICTURE_FIELD_WIDTH);
      expect(left + width / 2).toBeCloseTo(240, 0);
    }
  });

  it("views a picture from just over its top to just under the ground, the field's width across", () => {
    const madrid = INDEX_PICTURES.madrid!;
    const [x, y, width, height] = viewBoxOf(madrid).split(" ").map(Number);
    expect(width).toBe(PICTURE_FIELD_WIDTH);
    expect(x! + width! / 2).toBe(240);
    expect(y).toBeLessThan(madrid.scene.box[1]);
    expect(y! + height!).toBe(318);
  });

  describe("the sources of light drawn in each plate", () => {
    /** How far inside its scene's box a lamp stands, and two lamps apart, as shares of its longer side. */
    const LEAST_INSIDE = 0.08;
    const LEAST_APART = 0.2;

    it.each(Object.entries(INDEX_PICTURES))("gives %s one or two lamps", (_, picture) => {
      expect(picture.lamps.length).toBeGreaterThanOrEqual(1);
      expect(picture.lamps.length).toBeLessThanOrEqual(2);
    });

    it.each(Object.entries(INDEX_PICTURES))(
      "stands each of %s's lamps well inside its scene, and two well apart",
      (_, picture) => {
        const [, , width, height] = picture.scene.box;
        const longer = Math.max(width, height);
        const points = picture.lamps.map(([across, down]) => ({
          x: across * width,
          y: down * height,
        }));
        for (const { x, y } of points) {
          expect(Math.min(x, width - x, y, height - y) / longer).toBeGreaterThanOrEqual(
            LEAST_INSIDE,
          );
        }
        const [first, second] = points;
        if (first !== undefined && second !== undefined) {
          expect(
            Math.hypot(first.x - second.x, first.y - second.y) / longer,
          ).toBeGreaterThanOrEqual(LEAST_APART);
        }
      },
    );
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
