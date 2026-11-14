// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { daySlugOf } from "@/lib/days/address";
import { INDEX_PICTURES } from "./index-picture-files";
import { LIGHT_PAST } from "./plate-light";
import {
  densityFor,
  FIELD_CENTRE,
  FIELD_GROUND,
  FOOT,
  indexPictureOf,
  PICTURE_FIELD_WIDTH,
  SIDE,
  SKY,
  pictureSrcOf,
  viewBoxOf,
} from "./index-pictures";

const PICTURES_DIR = new URL("../../../public/pictures/", import.meta.url);
const CITIES = ["Paris", "Tokyo", "Rome", "New York", "Amsterdam", "Barcelona", "Seoul", "Madrid"];
/** Every picture's files together, the start screen's eight at a phone's twice its pixels. */
const NARROW_BUDGET = 150 * 1024;
/** A bounds file, and the sixteen together. */
const BOUNDS_FILE_BUDGET = 1200;
const BOUNDS_BUDGET = 14 * 1024;
const stylesheet = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

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

  it("names every file it serves, each under its city, and serves no other", () => {
    const named = Object.entries(INDEX_PICTURES).flatMap(([slug, picture]) => {
      const files = [...Object.values(picture.scene.files), picture.footprint, picture.sheet];
      for (const file of Object.values(picture.scene.files)) {
        expect(file.startsWith(`${slug}-scene-`), file).toBe(true);
      }
      expect(picture.footprint.startsWith(`${slug}-footprint.`)).toBe(true);
      expect(picture.sheet.startsWith(`${slug}-sheet.`)).toBe(true);
      return files;
    });
    for (const file of named) expect(existsSync(new URL(file, PICTURES_DIR)), file).toBe(true);
    expect(readdirSync(PICTURES_DIR).sort()).toEqual([...named].sort());
  });

  it("keeps the start screen's eight light at a phone's twice its pixels, in either theme", () => {
    const bytes = Object.values(INDEX_PICTURES).reduce(
      (sum, picture) =>
        sum +
        [picture.scene.files.narrow, picture.footprint, picture.sheet]
          .map((file) => statSync(new URL(file, PICTURES_DIR)).size)
          .reduce((all, size) => all + size, 0),
      0,
    );
    expect(bytes).toBeLessThan(NARROW_BUDGET);
  });

  it("keeps each bounds file under 1.2 KB, and the sixteen under 14 KB", () => {
    const sizes = Object.values(INDEX_PICTURES).flatMap((picture) =>
      [picture.footprint, picture.sheet].map((file) => statSync(new URL(file, PICTURES_DIR)).size),
    );
    for (const size of sizes) expect(size).toBeLessThanOrEqual(BOUNDS_FILE_BUDGET);
    expect(sizes.reduce((all, size) => all + size, 0)).toBeLessThanOrEqual(BOUNDS_BUDGET);
  });

  it("stands every scene on the field's ground, inside a field the widest fills", () => {
    for (const { scene } of Object.values(INDEX_PICTURES)) {
      const [left, top, width, height] = scene.box;
      expect(top + height).toBeCloseTo(FIELD_GROUND, 0);
      expect(width).toBeLessThan(PICTURE_FIELD_WIDTH);
      expect(left + width / 2).toBeCloseTo(FIELD_CENTRE, 0);
    }
  });

  it("sets the field's width by the widest scene and its sides alone, never by the room over or under it", () => {
    const widest = Math.max(...Object.values(INDEX_PICTURES).map(({ scene }) => scene.box[2]));
    expect(PICTURE_FIELD_WIDTH).toBeCloseTo(widest + 2 * SIDE, 6);
    expect(PICTURE_FIELD_WIDTH).toBeCloseTo(249.9, 6);
  });

  it.each(Object.entries(INDEX_PICTURES))(
    "views %s from its scene's top less 16 to 12 under the ground, the field's width across",
    (_, picture) => {
      const [x, y, width, height] = viewBoxOf(picture).split(" ").map(Number);
      expect(width).toBe(PICTURE_FIELD_WIDTH);
      expect(x! + width! / 2).toBeCloseTo(FIELD_CENTRE, 6);
      expect(y).toBeCloseTo(picture.scene.box[1] - SKY, 6);
      expect(y! + height!).toBeCloseTo(FIELD_GROUND + FOOT, 6);
      expect(SKY).toBe(16);
      expect(FOOT).toBe(12);
    },
  );

  it("keeps a plate's light inside its cell at the largest cell the index draws", () => {
    // The largest picture is a two-across cell just under the width that sets four across: half
    // the list, which reaches a cell's padding past the column each side, less that padding twice.
    const remPx = 16;
    const tokenPx = (name: string) => {
      const [, rems = "0"] = new RegExp(`--${name}:\\s*([\\d.]+)rem`).exec(stylesheet) ?? [];
      return Number(rems) * remPx;
    };
    const cellPadding = tokenPx("spacing-3");
    const fourAcross = tokenPx("container-abacus");
    const largestUnit =
      ((fourAcross + 2 * cellPadding) / 2 - 2 * cellPadding) / PICTURE_FIELD_WIDTH;
    expect(largestUnit).toBeCloseTo(1.489, 3);
    expect(LIGHT_PAST * largestUnit).toBeLessThanOrEqual(cellPadding);
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
